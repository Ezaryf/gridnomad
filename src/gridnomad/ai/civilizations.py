from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from gridnomad.ai.adapters import AgentContext, HeuristicLLMAdapter, LLMAdapter, parse_group_decision_payloads
from gridnomad.ai.prompting import build_group_batch_prompt


ANSI_PATTERN = re.compile(r"\x1b\[[0-9;]*m")
DEFAULT_OPENAI_MODEL = "gpt-5-mini"
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5"
DEFAULT_GEMINI_API_MODEL = "gemini-2.5-flash"


class ProviderDecisionError(RuntimeError):
    def __init__(
        self,
        *,
        faction_id: str,
        provider: str,
        model: str,
        message: str,
    ) -> None:
        super().__init__(message)
        self.faction_id = faction_id
        self.provider = provider
        self.model = model
        self.message = message


def _clean_cli_output(output: str) -> str:
    text = ANSI_PATTERN.sub("", output).strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return text


def _extract_ndjson_error(output: str) -> str:
    stripped = ANSI_PATTERN.sub("", output or "").strip()
    for line in stripped.splitlines():
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if payload.get("type") != "error":
            continue
        error_payload = payload.get("error") or {}
        message = (
            error_payload.get("data", {}).get("message")
            or error_payload.get("message")
            or payload.get("message")
            or ""
        )
        if message:
            return str(message).strip()
    return ""


def _recursive_string_values(value: Any) -> list[str]:
    results: list[str] = []
    if isinstance(value, str):
        results.append(value)
    elif isinstance(value, dict):
        for item in value.values():
            results.extend(_recursive_string_values(item))
    elif isinstance(value, list):
        for item in value:
            results.extend(_recursive_string_values(item))
    return results


def _extract_opencode_response(output: str) -> str:
    stripped = ANSI_PATTERN.sub("", output or "").strip()
    if not stripped:
        return ""
    if not stripped.startswith("{"):
        return _clean_cli_output(stripped)

    candidate_texts: list[str] = []
    for line in stripped.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if payload.get("type") == "error":
            continue
        candidate_texts.extend(_recursive_string_values(payload))

    for candidate in candidate_texts:
        cleaned = _clean_cli_output(candidate)
        if cleaned.startswith("{") and cleaned.endswith("}"):
            return cleaned

    return _clean_cli_output(stripped)


def build_cli_environment(cli_home: str | None = None, extra: dict[str, str] | None = None) -> dict[str, str]:
    env = os.environ.copy()
    if cli_home:
        base = Path(cli_home).resolve()
        config_home = base / "config"
        data_home = base / "data"
        state_home = base / "state"
        local_app_data = base / "localapp"
        for path in (config_home, data_home, state_home, local_app_data):
            path.mkdir(parents=True, exist_ok=True)
        env["XDG_CONFIG_HOME"] = str(config_home)
        env["XDG_DATA_HOME"] = str(data_home)
        env["XDG_STATE_HOME"] = str(state_home)
        env["LOCALAPPDATA"] = str(local_app_data)
    if extra:
        for key, value in extra.items():
            if value:
                env[key] = value
    return env


def _discover_cli_candidates(command_name: str) -> list[str]:
    candidates: list[str] = []

    def add_candidate(path_value: str | None) -> None:
        if not path_value:
            return
        normalized = str(Path(path_value).resolve())
        if normalized not in candidates:
            candidates.append(normalized)

    if os.name == "nt":
        for candidate in (
            f"{command_name}.cmd",
            f"{command_name}.exe",
            f"{command_name}.bat",
            f"{command_name}.ps1",
            command_name,
        ):
            add_candidate(shutil.which(candidate))

        where_executable = shutil.which("where.exe") or shutil.which("where")
        if where_executable:
            completed = subprocess.run(
                [where_executable, command_name],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            for line in completed.stdout.splitlines():
                add_candidate(line.strip())
    else:
        add_candidate(shutil.which(command_name))

    return candidates


def _resolve_cli_command(command_name: str) -> tuple[list[str], str]:
    candidates = _discover_cli_candidates(command_name)
    if not candidates:
        raise RuntimeError(f"{command_name} CLI was not found on this machine.")

    resolved = candidates[0]
    if os.name == "nt" and resolved.lower().endswith(".ps1"):
        shell = (
            shutil.which("pwsh.exe")
            or shutil.which("pwsh")
            or shutil.which("powershell.exe")
            or shutil.which("powershell")
        )
        if not shell:
            raise RuntimeError(
                f"{command_name} was found at {resolved}, but no PowerShell executable was available to launch it."
            )
        return [shell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolved], resolved
    return [resolved], resolved


@dataclass(slots=True)
class CivilizationProviderConfig:
    provider: str = "heuristic"
    model: str | None = None
    api_key: str | None = None
    google_api_key: str | None = None
    auth_mode: str = "existing-cli-auth"
    google_cloud_project: str | None = None
    use_vertex: bool = False
    opencode_provider: str | None = None
    cli_home: str | None = None
    managed_home_id: str | None = None
    execution_mode: str = "per_human"
    timeout_seconds: int = 120
    base_url: str | None = None
    available_models: list[str] = field(default_factory=list)
    supports_model_listing: bool = False
    supports_manual_model_entry: bool = False

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CivilizationProviderConfig":
        return cls(
            provider=str(data.get("provider", "heuristic")),
            model=data.get("model"),
            api_key=data.get("apiKey") or data.get("api_key"),
            google_api_key=data.get("googleApiKey") or data.get("google_api_key"),
            auth_mode=str(data.get("authMode", data.get("auth_mode", "existing-cli-auth"))),
            google_cloud_project=data.get("googleCloudProject") or data.get("google_cloud_project"),
            use_vertex=bool(data.get("useVertex", data.get("use_vertex", False))),
            opencode_provider=data.get("opencodeProvider") or data.get("opencode_provider"),
            cli_home=data.get("cliHome") or data.get("cli_home"),
            managed_home_id=data.get("managedHomeId") or data.get("managed_home_id"),
            execution_mode=str(data.get("executionMode", data.get("execution_mode", "per_human"))),
            timeout_seconds=int(data.get("timeoutSeconds", data.get("timeout_seconds", 120))),
            base_url=data.get("baseUrl") or data.get("base_url"),
            available_models=[str(item) for item in data.get("availableModels", data.get("available_models", []))],
            supports_model_listing=bool(data.get("supportsModelListing", data.get("supports_model_listing", False))),
            supports_manual_model_entry=bool(data.get("supportsManualModelEntry", data.get("supports_manual_model_entry", False))),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model,
            "apiKey": self.api_key or "",
            "googleApiKey": self.google_api_key or "",
            "authMode": self.auth_mode,
            "googleCloudProject": self.google_cloud_project or "",
            "useVertex": self.use_vertex,
            "opencodeProvider": self.opencode_provider or "",
            "cliHome": self.cli_home or "",
            "managedHomeId": self.managed_home_id or "",
            "executionMode": self.execution_mode,
            "timeoutSeconds": self.timeout_seconds,
            "baseUrl": self.base_url or "",
            "availableModels": list(self.available_models),
            "supportsModelListing": self.supports_model_listing,
            "supportsManualModelEntry": self.supports_manual_model_entry,
        }


@dataclass(slots=True)
class CivilizationSettings:
    factions: dict[str, CivilizationProviderConfig] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CivilizationSettings":
        raw_factions = data.get("factions", {})
        if raw_factions:
            if isinstance(raw_factions, list):
                return cls(
                    factions={
                        str(faction["id"]): CivilizationProviderConfig.from_dict(faction.get("controller", {}))
                        for faction in raw_factions
                    }
                )
            return cls(
                factions={
                    faction_id: CivilizationProviderConfig.from_dict(config)
                    for faction_id, config in raw_factions.items()
                }
            )
        starter_kingdoms = data.get("starter_kingdoms", [])
        if starter_kingdoms:
            return cls(
                factions={
                    str(kingdom["id"]): CivilizationProviderConfig.from_dict(kingdom.get("controller", {}))
                    for kingdom in starter_kingdoms
                }
            )
        groups = data.get("groups", [])
        if groups:
            return cls(
                factions={
                    str(group["id"]): CivilizationProviderConfig.from_dict(group.get("controller", {}))
                    for group in groups
                }
            )
        civilizations = data.get("civilizations", [])
        return cls(
            factions={
                str(civilization["id"]): CivilizationProviderConfig.from_dict(civilization.get("controller", {}))
                for civilization in civilizations
            }
        )

    @classmethod
    def from_path(cls, path: str | Path) -> "CivilizationSettings":
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls.from_dict(payload)

    def for_faction(self, faction_id: str) -> CivilizationProviderConfig:
        return self.factions.get(faction_id, CivilizationProviderConfig())

    def to_dict(self) -> dict[str, Any]:
        return {"factions": {faction_id: config.to_dict() for faction_id, config in self.factions.items()}}


class OpenAIAPIAdapter:
    def __init__(self, config: CivilizationProviderConfig) -> None:
        self.config = config

    def decide(self, agent_context: AgentContext) -> str:
        api_key = self.config.api_key or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OpenAI API key is missing.")
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("OpenAI SDK is not installed.") from exc

        client = OpenAI(
            api_key=api_key,
            base_url=self.config.base_url or None,
            timeout=self.config.timeout_seconds,
        )
        response = client.responses.create(
            model=self.config.model or DEFAULT_OPENAI_MODEL,
            input=agent_context.prompt,
        )
        output = getattr(response, "output_text", "") or ""
        if not output:
            raise RuntimeError("OpenAI API returned no output.")
        return _clean_cli_output(output)


class AnthropicAPIAdapter:
    def __init__(self, config: CivilizationProviderConfig) -> None:
        self.config = config

    def decide(self, agent_context: AgentContext) -> str:
        api_key = self.config.api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("Anthropic API key is missing.")
        try:
            import anthropic
        except ImportError as exc:
            raise RuntimeError("Anthropic SDK is not installed.") from exc

        client = anthropic.Anthropic(
            api_key=api_key,
            base_url=self.config.base_url or None,
            timeout=self.config.timeout_seconds,
        )
        response = client.messages.create(
            model=self.config.model or DEFAULT_ANTHROPIC_MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": agent_context.prompt}],
        )
        output = "\n".join(
            block.text
            for block in getattr(response, "content", [])
            if getattr(block, "type", "") == "text" and getattr(block, "text", "").strip()
        ).strip()
        if not output:
            raise RuntimeError("Anthropic API returned no output.")
        return _clean_cli_output(output)


class GeminiAPIAdapter:
    def __init__(self, config: CivilizationProviderConfig) -> None:
        self.config = config

    def decide(self, agent_context: AgentContext) -> str:
        api_key = self.config.api_key or self.config.google_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("Gemini API key is missing.")
        try:
            from google import genai
        except ImportError as exc:
            raise RuntimeError("Google GenAI SDK is not installed.") from exc

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=self.config.model or DEFAULT_GEMINI_API_MODEL,
            contents=agent_context.prompt,
        )
        output = getattr(response, "text", "") or ""
        if not output:
            raise RuntimeError("Gemini API returned no output.")
        return _clean_cli_output(output)


class GeminiCLIAdapter:
    def __init__(self, config: CivilizationProviderConfig, *, project_dir: Path | None = None) -> None:
        self.config = config
        self.project_dir = Path(project_dir or Path.cwd()).resolve()
        self._command_prefix: list[str] | None = None
        self._resolved_command: str | None = None

    def _command_base(self) -> list[str]:
        if self._command_prefix is None or self._resolved_command is None:
            self._command_prefix, self._resolved_command = _resolve_cli_command("gemini")
        command = list(self._command_prefix)
        command.extend(["-p"])
        return command

    def decide(self, agent_context: AgentContext) -> str:
        command = self._command_base()
        command.append(agent_context.prompt)
        if self.config.model:
            command.extend(["-m", self.config.model])
        env_extra = {
            "GEMINI_API_KEY": self.config.api_key or os.environ.get("GEMINI_API_KEY") or "",
            "GOOGLE_API_KEY": self.config.google_api_key or os.environ.get("GOOGLE_API_KEY") or "",
            "GOOGLE_CLOUD_PROJECT": self.config.google_cloud_project or os.environ.get("GOOGLE_CLOUD_PROJECT") or "",
        }
        if self.config.use_vertex or self.config.auth_mode == "vertex-ai":
            env_extra["GOOGLE_GENAI_USE_VERTEXAI"] = "true"
        completed = subprocess.run(
            command,
            cwd=self.project_dir,
            env=build_cli_environment(self.config.cli_home, env_extra),
            capture_output=True,
            text=True,
            timeout=self.config.timeout_seconds,
            check=False,
        )
        output = completed.stdout.strip() or completed.stderr.strip()
        if completed.returncode != 0 and not output:
            resolved_hint = f" via {self._resolved_command}" if self._resolved_command else ""
            raise RuntimeError(f"Gemini CLI returned no output{resolved_hint}.")
        if completed.returncode != 0 and completed.stdout.strip() == "":
            resolved_hint = f" via {self._resolved_command}" if self._resolved_command else ""
            raise RuntimeError(f"{output}{resolved_hint}")
        return _clean_cli_output(output)


class OpenCodeCLIAdapter:
    def __init__(self, config: CivilizationProviderConfig, *, project_dir: Path | None = None) -> None:
        self.config = config
        self.project_dir = Path(project_dir or Path.cwd()).resolve()
        self._command_prefix: list[str] | None = None
        self._resolved_command: str | None = None

    def _command_base(self) -> list[str]:
        if self._command_prefix is None or self._resolved_command is None:
            self._command_prefix, self._resolved_command = _resolve_cli_command("opencode")
        command = list(self._command_prefix)
        command.extend(["run", "--dir", str(self.project_dir), "--format", "json", "--title", "GridNomad simulation"])

        if self.config.model:
            command.extend(["-m", self.config.model])
        return command

    def _run_prompt(self, prompt: str) -> str:
        command = self._command_base()
        command.append(prompt)
        completed = subprocess.run(
            command,
            cwd=self.project_dir,
            env=build_cli_environment(
                self.config.cli_home,
                {
                    "OPENCODE_PROVIDER": self.config.opencode_provider or "",
                    "OPENCODE_CLIENT": "gridnomad",
                    "OPENCODE_PERMISSION": json.dumps({"*": "deny"}),
                },
            ),
            capture_output=True,
            text=True,
            timeout=self.config.timeout_seconds,
            check=False,
        )
        combined_output = "\n".join(part for part in [completed.stdout, completed.stderr] if part).strip()
        error_message = _extract_ndjson_error(combined_output)
        if error_message:
            raise RuntimeError(error_message)
        output = _extract_opencode_response(completed.stdout)
        if completed.returncode != 0 and not output:
            resolved_hint = f" via {self._resolved_command}" if self._resolved_command else ""
            raise RuntimeError((combined_output or "OpenCode returned no usable output.").strip() + resolved_hint)
        if not output:
            raise RuntimeError("OpenCode returned no usable assistant response.")
        return output

    def decide(self, agent_context: AgentContext) -> str:
        return self._run_prompt(agent_context.prompt)

    def decide_many(self, agent_contexts: list[AgentContext]) -> dict[str, object]:
        if not agent_contexts:
            return {}
        serialized_humans = [
            {
                "human_id": context.agent.id,
                "name": context.agent.name,
                "group": context.agent.faction_id,
                "position": {"x": context.agent.x, "y": context.agent.y},
                "persona_summary": context.agent.persona_summary,
                "social_style": context.agent.social_style,
                "resource_bias": context.agent.resource_bias,
                "starting_drive": context.agent.starting_drive,
                "weapon_kind": context.agent.weapon_kind,
                "bonded_partner_id": context.agent.bonded_partner_id,
                "home_structure_id": context.agent.home_structure_id,
                "last_world_action_summary": context.agent.last_world_action_summary,
                "personality": context.agent.personality.to_dict(),
                "emotions": context.agent.emotions.to_dict(),
                "needs": context.agent.needs.to_dict(),
                "inventory": context.agent.inventory.to_dict(),
                "position_history": list(context.agent.position_history),
                "visited_tiles": dict(context.agent.visited_tiles),
                "recent_events": list(context.recent_events),
                "recent_memories": list(context.memories),
                "recent_messages": dict(context.recent_messages),
                "perception": context.perception.text,
            }
            for context in agent_contexts
        ]
        prompt = build_group_batch_prompt(
            agent_contexts[0].agent.faction_id,
            agent_contexts[0].cultural_context,
            serialized_humans,
        )
        response = self._run_prompt(prompt)
        return parse_group_decision_payloads(response)


class RoutingLLMAdapter:
    def __init__(self, settings: CivilizationSettings, *, project_dir: Path | None = None) -> None:
        self.settings = settings
        self.project_dir = Path(project_dir or Path.cwd()).resolve()
        self.heuristic = HeuristicLLMAdapter()
        self._cache: dict[tuple[Any, ...], Any] = {}
        self._runtime_messages: list[dict[str, str]] = []
        self._lock = threading.Lock()

    @classmethod
    def from_path(cls, path: str | Path, *, project_dir: Path | None = None) -> "RoutingLLMAdapter":
        return cls(CivilizationSettings.from_path(path), project_dir=project_dir)

    @classmethod
    def from_dict(cls, payload: dict[str, Any], *, project_dir: Path | None = None) -> "RoutingLLMAdapter":
        return cls(CivilizationSettings.from_dict(payload), project_dir=project_dir)

    def decide(self, agent_context: AgentContext):
        config = self.settings.for_faction(agent_context.agent.faction_id)
        if config.provider == "heuristic":
            return self.heuristic.decide(agent_context)
        adapter = self._adapter_for(config)
        try:
            return adapter.decide(agent_context)
        except Exception as exc:
            with self._lock:
                self._runtime_messages.append(
                    {
                        "faction_id": agent_context.agent.faction_id,
                        "provider": config.provider,
                        "model": config.model or "",
                        "message": str(exc),
                    }
                )
            raise ProviderDecisionError(
                faction_id=agent_context.agent.faction_id,
                provider=config.provider,
                model=config.model or "",
                message=str(exc),
            ) from exc

    def decide_many(self, agent_contexts: list[AgentContext]) -> dict[str, object]:
        outputs: dict[str, object] = {}
        grouped: dict[str, list[AgentContext]] = {}
        for context in agent_contexts:
            grouped.setdefault(context.agent.faction_id, []).append(context)

        for faction_id, contexts in grouped.items():
            config = self.settings.for_faction(faction_id)
            if config.provider == "opencode" and config.execution_mode == "group_batch":
                adapter = self._adapter_for(config)
                try:
                    decisions = adapter.decide_many(contexts)
                except Exception as exc:
                    with self._lock:
                        self._runtime_messages.append(
                            {
                                "faction_id": faction_id,
                                "provider": config.provider,
                                "model": config.model or "",
                                "message": str(exc),
                            }
                        )
                    raise ProviderDecisionError(
                        faction_id=faction_id,
                        provider=config.provider,
                        model=config.model or "",
                        message=str(exc),
                    ) from exc
                expected_ids = {context.agent.id for context in contexts}
                returned_ids = set(decisions.keys())
                if returned_ids != expected_ids:
                    missing = sorted(expected_ids - returned_ids)
                    extras = sorted(returned_ids - expected_ids)
                    detail_bits: list[str] = []
                    if missing:
                        detail_bits.append(f"missing {', '.join(missing)}")
                    if extras:
                        detail_bits.append(f"unexpected {', '.join(extras)}")
                    detail = f"Batch OpenCode response did not cover the group exactly ({'; '.join(detail_bits)})."
                    with self._lock:
                        self._runtime_messages.append(
                            {
                                "faction_id": faction_id,
                                "provider": config.provider,
                                "model": config.model or "",
                                "message": detail,
                            }
                        )
                    raise ProviderDecisionError(
                        faction_id=faction_id,
                        provider=config.provider,
                        model=config.model or "",
                        message=detail,
                    )
                outputs.update(decisions)
                continue

            for context in contexts:
                outputs[context.agent.id] = self.decide(context)
        return outputs

    def _adapter_for(self, config: CivilizationProviderConfig):
        cache_key = (
            config.provider,
            config.model or "",
            config.api_key or "",
            config.google_api_key or "",
            config.cli_home or "",
            config.auth_mode,
            config.google_cloud_project or "",
            config.use_vertex,
            config.opencode_provider or "",
            config.managed_home_id or "",
            config.execution_mode,
            config.timeout_seconds,
            config.base_url or "",
        )
        with self._lock:
            if cache_key in self._cache:
                return self._cache[cache_key]
            if config.provider == "gemini-cli":
                adapter = GeminiCLIAdapter(config, project_dir=self.project_dir)
            elif config.provider == "gemini-api":
                adapter = GeminiAPIAdapter(config)
            elif config.provider == "openai":
                adapter = OpenAIAPIAdapter(config)
            elif config.provider == "anthropic":
                adapter = AnthropicAPIAdapter(config)
            elif config.provider == "opencode":
                adapter = OpenCodeCLIAdapter(config, project_dir=self.project_dir)
            else:
                adapter = self.heuristic
            self._cache[cache_key] = adapter
            return adapter

    def describe_controllers(self, factions: dict[str, Any]) -> list[dict[str, str]]:
        summaries: list[dict[str, str]] = []
        for faction_id in sorted(factions):
            faction = factions[faction_id]
            config = self.settings.for_faction(faction_id)
            summaries.append(
                {
                    "faction_id": faction_id,
                    "group_name": getattr(faction, "name", faction_id),
                    "provider": config.provider,
                    "model": config.model or "",
                    "credential": config.opencode_provider or "",
                    "execution_mode": config.execution_mode,
                    "cli_home": config.cli_home or "",
                }
            )
        return summaries

    def consume_runtime_messages(self) -> list[dict[str, str]]:
        with self._lock:
            messages = list(self._runtime_messages)
            self._runtime_messages.clear()
            return messages

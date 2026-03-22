from __future__ import annotations

import json
import os
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from gridnomad.ai.adapters import AgentContext, HeuristicLLMAdapter, LLMAdapter


ANSI_PATTERN = re.compile(r"\x1b\[[0-9;]*m")
DEFAULT_OPENAI_MODEL = "gpt-5-mini"
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5"
DEFAULT_GEMINI_API_MODEL = "gemini-2.5-flash"


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


def build_cli_environment(cli_home: str | None = None, extra: dict[str, str] | None = None) -> dict[str, str]:
    base = Path(cli_home or os.environ.get("GRIDNOMAD_CLI_HOME", Path.cwd() / ".cli-runtime")).resolve()
    config_home = base / "config"
    data_home = base / "data"
    state_home = base / "state"
    local_app_data = base / "localapp"
    for path in (config_home, data_home, state_home, local_app_data):
        path.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["XDG_CONFIG_HOME"] = str(config_home)
    env["XDG_DATA_HOME"] = str(data_home)
    env["XDG_STATE_HOME"] = str(state_home)
    env["LOCALAPPDATA"] = str(local_app_data)
    if extra:
        for key, value in extra.items():
            if value:
                env[key] = value
    return env


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
            return cls(
                factions={
                    faction_id: CivilizationProviderConfig.from_dict(config)
                    for faction_id, config in raw_factions.items()
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
        if not self.config.api_key:
            raise RuntimeError("OpenAI API key is missing.")
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("OpenAI SDK is not installed.") from exc

        client = OpenAI(
            api_key=self.config.api_key,
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
        if not self.config.api_key:
            raise RuntimeError("Anthropic API key is missing.")
        try:
            import anthropic
        except ImportError as exc:
            raise RuntimeError("Anthropic SDK is not installed.") from exc

        client = anthropic.Anthropic(
            api_key=self.config.api_key,
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
        api_key = self.config.api_key or self.config.google_api_key
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

    def decide(self, agent_context: AgentContext) -> str:
        command = ["gemini", "-p", agent_context.prompt]
        if self.config.model:
            command.extend(["-m", self.config.model])
        env_extra = {
            "GEMINI_API_KEY": self.config.api_key or "",
            "GOOGLE_API_KEY": self.config.google_api_key or "",
            "GOOGLE_CLOUD_PROJECT": self.config.google_cloud_project or "",
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
            raise RuntimeError("Gemini CLI returned no output.")
        if completed.returncode != 0 and completed.stdout.strip() == "":
            raise RuntimeError(output)
        return _clean_cli_output(output)


class OpenCodeCLIAdapter:
    def __init__(self, config: CivilizationProviderConfig, *, project_dir: Path | None = None) -> None:
        self.config = config
        self.project_dir = Path(project_dir or Path.cwd()).resolve()

    def decide(self, agent_context: AgentContext) -> str:
        command = ["opencode", "run", "--dir", str(self.project_dir)]
        if self.config.opencode_provider:
            command.extend(["--provider", self.config.opencode_provider])
        if self.config.model:
            command.extend(["-m", self.config.model])
        command.append(agent_context.prompt)
        completed = subprocess.run(
            command,
            cwd=self.project_dir,
            env=build_cli_environment(
                self.config.cli_home,
                {"OPENCODE_PROVIDER": self.config.opencode_provider or ""},
            ),
            capture_output=True,
            text=True,
            timeout=self.config.timeout_seconds,
            check=False,
        )
        output = completed.stdout.strip() or completed.stderr.strip()
        if completed.returncode != 0 and completed.stdout.strip() == "":
            raise RuntimeError(output)
        return _clean_cli_output(output)


class RoutingLLMAdapter:
    def __init__(self, settings: CivilizationSettings, *, project_dir: Path | None = None) -> None:
        self.settings = settings
        self.project_dir = Path(project_dir or Path.cwd()).resolve()
        self.heuristic = HeuristicLLMAdapter()
        self._cache: dict[tuple[str, str, str, str], Any] = {}
        self._runtime_messages: list[dict[str, str]] = []

    @classmethod
    def from_path(cls, path: str | Path, *, project_dir: Path | None = None) -> "RoutingLLMAdapter":
        return cls(CivilizationSettings.from_path(path), project_dir=project_dir)

    def decide(self, agent_context: AgentContext):
        config = self.settings.for_faction(agent_context.agent.faction_id)
        if config.provider == "heuristic":
            return self.heuristic.decide(agent_context)
        adapter = self._adapter_for(config)
        try:
            return adapter.decide(agent_context)
        except Exception as exc:
            self._runtime_messages.append(
                {
                    "faction_id": agent_context.agent.faction_id,
                    "provider": config.provider,
                    "model": config.model or "",
                    "message": str(exc),
                }
            )
            fallback = self.heuristic.decide(agent_context)
            fallback.reason = f"Provider fallback after {config.provider} error: {exc}"
            fallback.thought = f"{fallback.thought} Provider fallback engaged."
            return fallback

    def _adapter_for(self, config: CivilizationProviderConfig):
        cache_key = (
            config.provider,
            config.model or "",
            config.cli_home or "",
            config.auth_mode,
        )
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
                }
            )
        return summaries

    def consume_runtime_messages(self) -> list[dict[str, str]]:
        messages = list(self._runtime_messages)
        self._runtime_messages.clear()
        return messages

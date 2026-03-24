from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from helpers import build_agent, build_world
from gridnomad.ai.adapters import build_agent_context
from gridnomad.ai.civilizations import (
    AnthropicAPIAdapter,
    CivilizationProviderConfig,
    CivilizationSettings,
    GeminiCLIAdapter,
    GeminiAPIAdapter,
    OpenAIAPIAdapter,
    OpenCodeCLIAdapter,
    ProviderDecisionError,
    RoutingLLMAdapter,
)
from gridnomad.core.perception import build_perception


class ExplodingAdapter:
    def decide(self, agent_context):
        raise RuntimeError("provider exploded")


class ProviderRoutingTests(unittest.TestCase):
    def test_civilization_settings_parses_direct_api_groups(self) -> None:
        settings = CivilizationSettings.from_dict(
            {
                "groups": [
                    {"id": "red", "controller": {"provider": "openai", "model": "gpt-5-mini", "apiKey": "sk-openai"}},
                    {"id": "blue", "controller": {"provider": "anthropic", "model": "claude-sonnet-4-5", "apiKey": "sk-anthropic"}},
                    {"id": "gold", "controller": {"provider": "gemini-api", "model": "gemini-2.5-flash", "apiKey": "sk-gemini"}},
                ]
            }
        )
        self.assertEqual(settings.for_faction("red").provider, "openai")
        self.assertEqual(settings.for_faction("blue").provider, "anthropic")
        self.assertEqual(settings.for_faction("gold").provider, "gemini-api")

    def test_civilization_settings_parses_runtime_faction_list(self) -> None:
        settings = CivilizationSettings.from_dict(
            {
                "factions": [
                    {"id": "human-kingdom-01", "controller": {"provider": "gemini-cli", "model": "gemini-2.5-pro"}},
                    {"id": "manual-keep", "controller": {"provider": "openai", "model": "gpt-5-mini", "apiKey": "sk-openai"}},
                ]
            }
        )
        self.assertEqual(settings.for_faction("human-kingdom-01").provider, "gemini-cli")
        self.assertEqual(settings.for_faction("manual-keep").provider, "openai")

    def test_routing_adapter_builds_direct_provider_adapters(self) -> None:
        adapter = RoutingLLMAdapter(CivilizationSettings())
        self.assertIsInstance(adapter._adapter_for(CivilizationProviderConfig(provider="openai")), OpenAIAPIAdapter)
        self.assertIsInstance(adapter._adapter_for(CivilizationProviderConfig(provider="anthropic")), AnthropicAPIAdapter)
        self.assertIsInstance(adapter._adapter_for(CivilizationProviderConfig(provider="gemini-api")), GeminiAPIAdapter)

    def test_routing_adapter_cache_respects_credentials_and_base_url(self) -> None:
        adapter = RoutingLLMAdapter(CivilizationSettings())
        first = adapter._adapter_for(
            CivilizationProviderConfig(provider="openai", model="gpt-5-mini", api_key="sk-one", base_url="https://a.example")
        )
        second = adapter._adapter_for(
            CivilizationProviderConfig(provider="openai", model="gpt-5-mini", api_key="sk-two", base_url="https://b.example")
        )
        self.assertIsNot(first, second)

    def test_routing_adapter_raises_and_records_provider_messages(self) -> None:
        agent = build_agent("ada", "red", 1, 1)
        _, world, _ = build_world(agents=[agent])
        perception = build_perception(world, agent, 2)
        context = build_agent_context(
            tick=0,
            agent=agent,
            world=world,
            perception=perception,
            recent_events=[],
            memories=[],
            recent_messages={"civilization": [], "diplomacy": []},
            cultural_context="",
            group_context="Alive humans in group: 1.",
        )
        adapter = RoutingLLMAdapter(
            CivilizationSettings(
                factions={"red": CivilizationProviderConfig(provider="openai", model="gpt-5-mini", api_key="sk-test")}
            )
        )
        adapter._adapter_for = lambda config: ExplodingAdapter()  # type: ignore[method-assign]

        with self.assertRaises(ProviderDecisionError):
            adapter.decide(context)
        messages = adapter.consume_runtime_messages()
        self.assertEqual(messages[0]["provider"], "openai")
        self.assertEqual(messages[0]["faction_id"], "red")
        self.assertIn("provider exploded", messages[0]["message"])

    def test_opencode_adapter_uses_selected_provider_and_model(self) -> None:
        agent = build_agent("ada", "red", 1, 1)
        _, world, _ = build_world(agents=[agent])
        perception = build_perception(world, agent, 2)
        context = build_agent_context(
            tick=0,
            agent=agent,
            world=world,
            perception=perception,
            recent_events=[],
            memories=[],
            recent_messages={"civilization": [], "diplomacy": []},
            cultural_context="",
            group_context="Alive humans in group: 1.",
        )
        adapter = OpenCodeCLIAdapter(
            CivilizationProviderConfig(
                provider="opencode",
                model="opencode/minimax-m2.5-free",
                opencode_provider="openrouter",
            )
        )

        class Completed:
            returncode = 0
            stdout = '{"action":"MOVE_NORTH","target_x":null,"target_y":null,"reason":"test","updated_emotions":{"Joy":4,"Sadness":1,"Fear":1,"Anger":0,"Disgust":0,"Surprise":1},"updated_needs":{"Survival":4,"Safety":4,"Belonging":4,"Esteem":4,"Self_Actualization":4},"thought":"test"}'
            stderr = ""

        with patch("gridnomad.ai.civilizations.subprocess.run", return_value=Completed()) as mocked_run:
            adapter.decide(context)

        command = mocked_run.call_args.args[0]
        self.assertIn("--title", command)
        self.assertIn("GridNomad simulation", command)
        self.assertIn("--provider", command)
        self.assertIn("openrouter", command)
        self.assertIn("-m", command)
        self.assertIn("opencode/minimax-m2.5-free", command)

    def test_opencode_batch_mode_returns_one_decision_per_human(self) -> None:
        ada = build_agent("ada", "red", 1, 1)
        bo = build_agent("bo", "red", 2, 1)
        _, world, _ = build_world(agents=[ada, bo])
        contexts = []
        for agent in (ada, bo):
            perception = build_perception(world, agent, 2)
            contexts.append(
                build_agent_context(
                    tick=0,
                    agent=agent,
                    world=world,
                    perception=perception,
                    recent_events=[],
                    memories=[],
                    recent_messages={"civilization": [], "diplomacy": []},
                    cultural_context="Stay close and help each other.",
                    group_context="Alive humans in group: 2.",
                )
            )

        adapter = RoutingLLMAdapter(
            CivilizationSettings(
                factions={
                    "red": CivilizationProviderConfig(
                        provider="opencode",
                        model="opencode/minimax-m2.5-free",
                        cli_home=str((Path.cwd() / ".tmp-test-artifacts" / "opencode-home").resolve()),
                        execution_mode="group_batch",
                    )
                }
            )
        )

        class Completed:
            returncode = 0
            stdout = """{"decisions":[{"human_id":"ada","action":"MOVE_EAST","target_x":2,"target_y":1,"reason":"test","intent":"step east","speech":"","updated_emotions":{"Joy":4,"Sadness":1,"Fear":1,"Anger":0,"Disgust":0,"Surprise":1},"updated_needs":{"Survival":4,"Safety":4,"Belonging":4,"Esteem":4,"Self_Actualization":4},"thought":"test"},{"human_id":"bo","action":"REST","target_x":null,"target_y":null,"reason":"test","intent":"rest","speech":"","updated_emotions":{"Joy":4,"Sadness":1,"Fear":1,"Anger":0,"Disgust":0,"Surprise":1},"updated_needs":{"Survival":4,"Safety":4,"Belonging":4,"Esteem":4,"Self_Actualization":4},"thought":"test"}]}"""
            stderr = ""

        with patch("gridnomad.ai.civilizations.subprocess.run", return_value=Completed()) as mocked_run:
            decisions = adapter.decide_many(contexts)

        command = mocked_run.call_args.args[0]
        self.assertIn("opencode", command[0])
        self.assertEqual(set(decisions.keys()), {"ada", "bo"})
        self.assertEqual(decisions["bo"].action, "REST")

    def test_opencode_adapter_surfaces_ndjson_error_message(self) -> None:
        agent = build_agent("ada", "red", 1, 1)
        _, world, _ = build_world(agents=[agent])
        perception = build_perception(world, agent, 2)
        context = build_agent_context(
            tick=0,
            agent=agent,
            world=world,
            perception=perception,
            recent_events=[],
            memories=[],
            recent_messages={"civilization": [], "diplomacy": []},
            cultural_context="",
            group_context="Alive humans in group: 1.",
        )
        adapter = OpenCodeCLIAdapter(
            CivilizationProviderConfig(
                provider="opencode",
                model="opencode/minimax-m2.5-free",
            )
        )

        class Completed:
            returncode = 1
            stdout = '{"type":"error","error":{"data":{"message":"Error: Unable to connect. Is the computer able to access the url?"}}}'
            stderr = ""

        with patch("gridnomad.ai.civilizations.subprocess.run", return_value=Completed()):
            with self.assertRaises(RuntimeError) as raised:
                adapter.decide(context)

        self.assertIn("Unable to connect", str(raised.exception))

    def test_opencode_adapter_extracts_json_from_ndjson_output(self) -> None:
        agent = build_agent("ada", "red", 1, 1)
        _, world, _ = build_world(agents=[agent])
        perception = build_perception(world, agent, 2)
        context = build_agent_context(
            tick=0,
            agent=agent,
            world=world,
            perception=perception,
            recent_events=[],
            memories=[],
            recent_messages={"civilization": [], "diplomacy": []},
            cultural_context="",
            group_context="Alive humans in group: 1.",
        )
        adapter = OpenCodeCLIAdapter(
            CivilizationProviderConfig(
                provider="opencode",
                model="opencode/minimax-m2.5-free",
            )
        )

        class Completed:
            returncode = 0
            stdout = '\n'.join([
                '{"type":"session.started","sessionID":"abc"}',
                '{"type":"assistant","message":{"content":[{"type":"text","text":"{\\"action\\":\\"MOVE_NORTH\\",\\"target_x\\":null,\\"target_y\\":null,\\"reason\\":\\"test\\",\\"updated_emotions\\":{\\"Joy\\":4,\\"Sadness\\":1,\\"Fear\\":1,\\"Anger\\":0,\\"Disgust\\":0,\\"Surprise\\":1},\\"updated_needs\\":{\\"Survival\\":4,\\"Safety\\":4,\\"Belonging\\":4,\\"Esteem\\":4,\\"Self_Actualization\\":4},\\"thought\\":\\"test\\"}"}]}}'
            ])
            stderr = ""

        with patch("gridnomad.ai.civilizations.subprocess.run", return_value=Completed()):
            output = adapter.decide(context)

        self.assertIn('"action":"MOVE_NORTH"', output.replace(" ", ""))

    def test_gemini_cli_prefers_explicit_windows_wrapper(self) -> None:
        agent = build_agent("ada", "red", 1, 1)
        _, world, _ = build_world(agents=[agent])
        perception = build_perception(world, agent, 2)
        context = build_agent_context(
            tick=0,
            agent=agent,
            world=world,
            perception=perception,
            recent_events=[],
            memories=[],
            recent_messages={"civilization": [], "diplomacy": []},
            cultural_context="",
            group_context="Alive humans in group: 1.",
        )
        adapter = GeminiCLIAdapter(
            CivilizationProviderConfig(provider="gemini-cli", model="gemini-2.5-flash")
        )

        class Completed:
            returncode = 0
            stdout = '{"action":"MOVE_EAST","target_x":2,"target_y":1,"reason":"test","intent":"step east","speech":"","updated_emotions":{"Joy":4,"Sadness":1,"Fear":1,"Anger":0,"Disgust":0,"Surprise":1},"updated_needs":{"Survival":4,"Safety":4,"Belonging":4,"Esteem":4,"Self_Actualization":4},"thought":"test"}'
            stderr = ""

        with (
            patch("gridnomad.ai.civilizations.os.name", "nt"),
            patch("gridnomad.ai.civilizations.shutil.which") as mocked_which,
            patch("gridnomad.ai.civilizations.subprocess.run", return_value=Completed()) as mocked_run,
        ):
            mocked_which.side_effect = lambda value: {
                "gemini.cmd": r"C:\nvm4w\nodejs\gemini.cmd",
                "where.exe": r"C:\Windows\System32\where.exe",
            }.get(value)
            adapter.decide(context)

        command = mocked_run.call_args.args[0]
        self.assertTrue(command[0].lower().endswith("gemini.cmd"))
        self.assertIn("-m", command)
        self.assertIn("gemini-2.5-flash", command)


if __name__ == "__main__":
    unittest.main()

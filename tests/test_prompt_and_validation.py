from __future__ import annotations

import json
import unittest

from helpers import build_agent, build_world
from gridnomad.ai.adapters import parse_decision_payload
from gridnomad.ai.prompting import AgentPromptView, build_agent_prompt
from gridnomad.core.actions import ActionRegistry


class PromptAndValidationTests(unittest.TestCase):
    def test_build_agent_prompt_includes_memory_events_and_culture(self) -> None:
        agent = build_agent("ada", "red", 1, 2)
        prompt_agent = AgentPromptView.from_agent(agent, ["Built a bridge yesterday", "Shared food at dawn"])
        prompt = build_agent_prompt(
            prompt_agent,
            "water tile 1 tile east; friendly agent Bo 1 tile south",
            ["shared food", "built bridge"],
            {
                "civilization": ["Ada to red council: I found a ford."],
                "diplomacy": ["Bo to red: We can trade at dawn."]
            },
            "Share food, stay together, and keep exploring the river path carefully.",
        )
        self.assertIn("You are Ada", prompt)
        self.assertIn("Share food", prompt)
        self.assertIn("shared food", prompt)
        self.assertIn("Built a bridge yesterday", prompt)
        self.assertIn("I found a ford", prompt)
        self.assertIn("MOVE_NORTH", prompt)
        self.assertIn("INTERACT", prompt)

    def test_parse_decision_payload_clamps_state_values_and_captures_unknown_action(self) -> None:
        raw = json.dumps(
            {
                "action": "DANCE",
                "target_x": None,
                "target_y": None,
                "reason": "I want to celebrate.",
                "intent": "celebrate with the people near me",
                "speech": "Come celebrate with me.",
                "updated_emotions": {
                    "Joy": 99,
                    "Sadness": -5,
                    "Fear": 3,
                    "Anger": 1,
                    "Disgust": 0,
                    "Surprise": 12,
                },
                "updated_needs": {
                    "Survival": 11,
                    "Safety": -1,
                    "Belonging": 5,
                    "Esteem": 4,
                    "Self_Actualization": 2,
                },
                "thought": "Celebration feels right.",
                "outbound_message": {
                    "scope": "civilization",
                    "text": "Celebrate with me."
                }
            }
        )
        decision = parse_decision_payload(raw)
        self.assertEqual(decision.updated_emotions.joy, 10)
        self.assertEqual(decision.updated_emotions.sadness, 0)
        self.assertEqual(decision.updated_needs.survival, 10)
        self.assertEqual(decision.updated_needs.safety, 0)
        self.assertIsNotNone(decision.action_proposal)
        self.assertEqual(decision.action_proposal.name, "DANCE")
        self.assertEqual(decision.outbound_message.text, "Celebrate with me.")
        self.assertEqual(decision.intent, "celebrate with the people near me")
        self.assertEqual(decision.speech, "Come celebrate with me.")

    def test_action_registry_returns_noop_for_unknown_action(self) -> None:
        agent = build_agent("ada", "red", 1, 1)
        _, world, _ = build_world(agents=[agent])
        decision = parse_decision_payload(
            json.dumps(
                {
                    "action": "PAINT_SKY",
                    "target_x": None,
                    "target_y": None,
                    "reason": "A novel artistic ritual.",
                    "intent": "make the sky feel ceremonial for everyone nearby",
                    "speech": "",
                    "updated_emotions": {
                        "Joy": 5,
                        "Sadness": 1,
                        "Fear": 1,
                        "Anger": 0,
                        "Disgust": 0,
                        "Surprise": 6,
                    },
                    "updated_needs": {
                        "Survival": 4,
                        "Safety": 4,
                        "Belonging": 4,
                        "Esteem": 5,
                        "Self_Actualization": 7,
                    },
                    "thought": "This could become our next ritual."
                }
            )
        )
        action = ActionRegistry().resolve(decision, world, agent)
        self.assertEqual(action.kind, "NO_OP")
        self.assertEqual(action.metadata["action_proposal"]["name"], "PAINT_SKY")


if __name__ == "__main__":
    unittest.main()

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
            "Norm 'River Pact' (75): help build bridges.",
        )
        self.assertIn("You are Ada", prompt)
        self.assertIn("River Pact", prompt)
        self.assertIn("shared food", prompt)
        self.assertIn("Built a bridge yesterday", prompt)
        self.assertIn("MOVE_NORTH / MOVE_SOUTH / MOVE_EAST / MOVE_WEST", prompt)

    def test_parse_decision_payload_clamps_state_values_and_captures_unknown_action(self) -> None:
        raw = json.dumps(
            {
                "action": "DANCE",
                "target_x": None,
                "target_y": None,
                "reason": "I want to celebrate.",
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
                "thought": "Celebration feels right."
            }
        )
        decision = parse_decision_payload(raw)
        self.assertEqual(decision.updated_emotions.joy, 10)
        self.assertEqual(decision.updated_emotions.sadness, 0)
        self.assertEqual(decision.updated_needs.survival, 10)
        self.assertEqual(decision.updated_needs.safety, 0)
        self.assertIsNotNone(decision.action_proposal)
        self.assertEqual(decision.action_proposal.name, "DANCE")

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

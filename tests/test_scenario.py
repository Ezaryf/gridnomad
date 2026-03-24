from __future__ import annotations

import unittest

from gridnomad.core.scenario import load_scenario_data


class ScenarioLoadTests(unittest.TestCase):
    def test_load_scenario_data_restores_snapshot_state_for_resume(self) -> None:
        bundle = load_scenario_data(
            {
                "config": {
                    "width": 3,
                    "height": 3,
                    "perception_radius": 2,
                    "snapshot_interval": 10,
                },
                "world": {
                    "tick": 14,
                    "seed": 77,
                    "tiles": [
                        {"x": 0, "y": 0, "terrain": "plain", "tree_cover": 2, "wood_stock": 3},
                        {"x": 1, "y": 0, "terrain": "water", "water_access": True, "feature": "river"},
                        {"x": 2, "y": 0, "terrain": "plain"},
                        {"x": 0, "y": 1, "terrain": "plain"},
                        {"x": 1, "y": 1, "terrain": "house", "structure_kind": "home", "structure_id": "red-home-001"},
                        {"x": 2, "y": 1, "terrain": "plain"},
                        {"x": 0, "y": 2, "terrain": "plain"},
                        {"x": 1, "y": 2, "terrain": "plain"},
                        {"x": 2, "y": 2, "terrain": "plain"},
                    ],
                    "factions": {
                        "red": {"id": "red", "name": "Red"},
                    },
                    "agents": {
                        "red-human-01": {
                            "id": "red-human-01",
                            "name": "Ada",
                            "faction_id": "red",
                            "x": 1,
                            "y": 1,
                            "personality": {
                                "openness": 6,
                                "conscientiousness": 6,
                                "extraversion": 5,
                                "agreeableness": 6,
                                "neuroticism": 3,
                            },
                            "emotions": {
                                "Joy": 4,
                                "Sadness": 1,
                                "Fear": 1,
                                "Anger": 0,
                                "Disgust": 0,
                                "Surprise": 2,
                            },
                            "needs": {
                                "Survival": 3,
                                "Safety": 2,
                                "Belonging": 4,
                                "Esteem": 3,
                                "Self_Actualization": 2,
                            },
                            "inventory": {"food": 2, "wood": 1, "stone": 0},
                            "role": "builder",
                            "last_goal": "Finish a safer resting place.",
                        }
                    },
                    "communications": [
                        {
                            "tick": 14,
                            "scope": "civilization",
                            "sender_agent_id": "red-human-01",
                            "sender_faction_id": "red",
                            "target_faction_id": "red",
                            "target_agent_id": None,
                            "text": "The shelter is almost ready.",
                        }
                    ],
                    "structures": {
                        "red-home-001": {
                            "id": "red-home-001",
                            "kind": "home",
                            "x": 1,
                            "y": 1,
                            "owner_faction_id": "red",
                            "builder_agent_id": "red-human-01",
                            "integrity": 10,
                            "materials": {"wood": 3, "stone": 1},
                        }
                    },
                    "time_of_day": 19,
                    "weather": "clear",
                },
                "culture": {
                    "red": [
                        {
                            "element": "Safe Hearth",
                            "description": "Rest matters.",
                            "strength": 60,
                            "category": "ritual",
                        }
                    ]
                },
            }
        )

        self.assertEqual(bundle.world.tick, 14)
        self.assertEqual(bundle.world.seed, 77)
        self.assertIn("red-human-01", bundle.world.agents)
        self.assertEqual(bundle.world.agents["red-human-01"].role, "builder")
        self.assertEqual(bundle.world.agents["red-human-01"].last_goal, "Finish a safer resting place.")
        self.assertIn("red-home-001", bundle.world.structures)
        self.assertEqual(bundle.world.get_tile(1, 1).structure_id, "red-home-001")
        self.assertEqual(len(bundle.world.communications), 1)
        self.assertEqual(bundle.world.time_of_day, 19)
        self.assertEqual(bundle.world.weather, "clear")
        self.assertTrue(bundle.culture_store.summarize("red"))


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import unittest
from pathlib import Path

from helpers import ROOT
from gridnomad.core.scenario import load_scenario


class GenerationTests(unittest.TestCase):
    def test_generated_world_is_deterministic_for_seed(self) -> None:
        scenario = ROOT / "scenarios" / "frontier_seeded.json"
        first = load_scenario(scenario, seed_override=77, width_override=40, height_override=40)
        second = load_scenario(scenario, seed_override=77, width_override=40, height_override=40)
        self.assertEqual(first.world.to_dict(), second.world.to_dict())

    def test_generated_world_changes_when_seed_changes(self) -> None:
        scenario = ROOT / "scenarios" / "frontier_seeded.json"
        first = load_scenario(scenario, seed_override=77, width_override=40, height_override=40)
        second = load_scenario(scenario, seed_override=91, width_override=40, height_override=40)
        self.assertNotEqual(first.world.to_dict()["tiles"], second.world.to_dict()["tiles"])

    def test_generated_world_invariants_hold(self) -> None:
        scenario = ROOT / "scenarios" / "frontier_seeded.json"
        bundle = load_scenario(scenario, seed_override=99, width_override=48, height_override=48)
        world = bundle.world

        self.assertGreaterEqual(len(world.settlements), len(world.factions))
        self.assertTrue(any(tile["kind"] == "river-trace" for tile in world.props))
        self.assertEqual(set(world.kingdoms), set(world.factions))
        self.assertGreaterEqual(len(world.cities), len(world.factions))

        for settlement in world.settlements:
            tile = world.get_tile(settlement["x"], settlement["y"])
            self.assertNotEqual(tile.terrain.value, "water")
            self.assertEqual(tile.settlement_id, settlement["id"])
            self.assertTrue(settlement["sprite_key"].startswith("settlement-"))
            self.assertGreaterEqual(len(settlement["footprint"]), 1)
            for segment in settlement["footprint"]:
                self.assertTrue(world.in_bounds(segment["x"], segment["y"]))
                self.assertIn("district_kind", segment)
                self.assertIn("sprite_key", segment)

        for road in world.roads:
            self.assertGreaterEqual(len(road["points"]), 2)
            for point in road["points"]:
                self.assertTrue(world.in_bounds(point["x"], point["y"]))

        for faction_id, territory in world.territories.items():
            self.assertIn(faction_id, world.factions)
            self.assertGreater(territory["tile_count"], 0)

        river_traces = [prop for prop in world.props if prop["kind"] == "river-trace"]
        for river in river_traces:
            end = river["points"][-1]
            self.assertEqual(world.get_tile(end["x"], end["y"]).terrain.value, "water")

        for row in world.tiles:
            for tile in row:
                payload = tile.to_dict()
                self.assertIn("visual_variant", payload)
                self.assertIn("edge_mask", payload)
                self.assertIn("river_mask", payload)
                self.assertIn("road_mask", payload)
                self.assertIn("decal", payload)
                self.assertIn("elevation_band", payload)
                self.assertIn("fertility", payload)
                self.assertIn("resource_tags", payload)
                self.assertIn("danger_tags", payload)
                self.assertIn("race_affinity", payload)
                self.assertIn("city_score", payload)
                self.assertGreaterEqual(payload["edge_mask"], 0)
                self.assertLessEqual(payload["edge_mask"], 15)
                self.assertGreaterEqual(payload["river_mask"], 0)
                self.assertLessEqual(payload["river_mask"], 15)
                self.assertGreaterEqual(payload["road_mask"], 0)
                self.assertLessEqual(payload["road_mask"], 15)
                self.assertGreaterEqual(payload["fertility"], 0)
                self.assertLessEqual(payload["fertility"], 100)
                self.assertGreaterEqual(payload["city_score"], 0)
                self.assertLessEqual(payload["city_score"], 100)
                self.assertIn("human", payload["race_affinity"])
                self.assertIn("orc", payload["race_affinity"])
                self.assertIn("elf", payload["race_affinity"])
                self.assertIn("dwarf", payload["race_affinity"])

        for prop in world.props:
            if prop["kind"] == "river-trace":
                self.assertIn("sprite_key", prop)
                self.assertIn("layer", prop)
                continue
            self.assertIn("sprite_key", prop)
            self.assertIn("layer", prop)


if __name__ == "__main__":
    unittest.main()

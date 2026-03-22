from __future__ import annotations

import unittest

from helpers import build_agent, build_simulation, farmable_tile, water_tile
from gridnomad.ai.adapters import ScriptedLLMAdapter
from gridnomad.core.models import CulturalInnovation, DecisionPayload, Emotions, Needs, OutboundMessage
from gridnomad.core.perception import build_perception


class SimulationTests(unittest.TestCase):
    def test_salience_detects_urgent_need_and_changed_context(self) -> None:
        ada = build_agent("ada", "red", 1, 1, survival=8)
        simulation = build_simulation(agents=[ada], tile_overrides=[(2, 1, water_tile())])
        agent = simulation.world.agents["ada"]
        self.assertEqual(simulation.world.get_tile(2, 1).terrain.value, "water")
        perception = build_perception(simulation.world, agent, simulation.config.perception_radius)
        salience = simulation.evaluate_salience(agent, perception, recent_events=[])
        self.assertTrue(salience.should_reason)
        self.assertIn("urgent_need", salience.reasons)
        self.assertIn("new_context", salience.reasons)
        self.assertIn("reason_interval", salience.reasons)

    def test_scripted_bridge_step_records_memory_and_culture(self) -> None:
        ada = build_agent("ada", "red", 1, 1, wood=3)
        scripted = ScriptedLLMAdapter(
            {
                "ada": [
                    DecisionPayload(
                        action="BUILD_BRIDGE",
                        target_x=2,
                        target_y=1,
                        reason="The river blocks our path.",
                        updated_emotions=Emotions(joy=6, sadness=1, fear=1, anger=0, disgust=0, surprise=4),
                        updated_needs=Needs(
                            survival=4,
                            safety=4,
                            belonging=4,
                            esteem=6,
                            self_actualization=5,
                        ),
                        thought="Building this bridge should help everyone.",
                        cultural_innovation=CulturalInnovation(
                            element="Bridge Oath",
                            description="Celebrate builders who reconnect land.",
                            strength=70,
                            category="ritual",
                        ),
                        outbound_message=OutboundMessage(
                            scope="civilization",
                            text="The bridge is going up. Meet me at the river."
                        ),
                    )
                ]
            }
        )
        simulation = build_simulation(
            agents=[ada],
            tile_overrides=[(2, 1, water_tile())],
            culture_seed={
                "red": [
                    {
                        "category": "norm",
                        "element": "River Pact",
                        "description": "Build bridges for the clan.",
                        "strength": 75,
                    }
                ]
            },
            adapter=scripted,
        )
        events = simulation.step()
        self.assertTrue(any(event.kind == "BUILD_BRIDGE" and event.success for event in events))
        self.assertTrue(any(event.kind == "CULTURAL_INNOVATION" for event in events))
        self.assertTrue(any(event.kind == "COMMUNICATION" for event in events))
        self.assertEqual(simulation.world.get_tile(2, 1).terrain.value, "bridge")
        self.assertIn("Building this bridge should help everyone.", simulation.memory_store.recent_thoughts("ada"))
        self.assertIn("Bridge Oath", simulation.culture_store.summarize("red"))
        self.assertTrue(simulation.world.communications)
        self.assertIn("bridge is going up", simulation.world.communications[-1].text.lower())

    def test_trade_attack_and_alliance_actions_mutate_world(self) -> None:
        ada = build_agent("ada", "red", 1, 1, food=0, wood=2, stone=0)
        bo = build_agent("bo", "blue", 2, 1, food=3, wood=0, stone=1, health=2)
        simulation = build_simulation(agents=[ada, bo])

        alliance = DecisionPayload(
            action="FORM_ALLIANCE",
            target_x=2,
            target_y=1,
            reason="Peace is useful.",
            updated_emotions=ada.emotions,
            updated_needs=ada.needs,
            thought="We should stop fighting.",
        )
        trade = DecisionPayload(
            action="TRADE",
            target_x=2,
            target_y=1,
            reason="I need food.",
            updated_emotions=ada.emotions,
            updated_needs=ada.needs,
            thought="A fair trade keeps us alive.",
        )
        attack = DecisionPayload(
            action="ATTACK",
            target_x=2,
            target_y=1,
            reason="The alliance failed.",
            updated_emotions=ada.emotions,
            updated_needs=ada.needs,
            thought="I have no safer option.",
        )

        alliance_events = simulation._apply_action(simulation.registry.resolve(alliance, simulation.world, ada))
        self.assertTrue(alliance_events[0].success)
        self.assertIn("blue", simulation.world.factions["red"].alliances)

        trade_events = simulation._apply_action(simulation.registry.resolve(trade, simulation.world, ada))
        self.assertTrue(trade_events[0].success)
        self.assertEqual(ada.inventory.food, 1)
        self.assertEqual(bo.inventory.food, 2)

        attack_events = simulation._apply_action(simulation.registry.resolve(attack, simulation.world, ada))
        self.assertTrue(any(event.kind == "DEATH" for event in attack_events))
        self.assertFalse(bo.alive)

    def test_invalid_model_response_uses_safe_fallback(self) -> None:
        ada = build_agent("ada", "red", 1, 1, survival=8)
        adapter = ScriptedLLMAdapter({"ada": ["{not valid json"]})
        simulation = build_simulation(
            agents=[ada],
            tile_overrides=[(1, 0, water_tile()), (2, 1, farmable_tile())],
            adapter=adapter,
        )
        events = simulation.step()
        self.assertTrue(any(event.kind in {"MOVE", "CULTIVATE"} for event in events))
        self.assertTrue(simulation.world.agents["ada"].alive)

    def test_diplomacy_messages_are_visible_to_involved_factions(self) -> None:
        ada = build_agent("ada", "red", 1, 1)
        bo = build_agent("bo", "blue", 2, 1)
        suri = build_agent("suri", "gold", 3, 1)
        scripted = ScriptedLLMAdapter(
            {
                "ada": [
                    DecisionPayload(
                        action="FORM_ALLIANCE",
                        target_x=2,
                        target_y=1,
                        reason="Trade would benefit us both.",
                        updated_emotions=ada.emotions,
                        updated_needs=ada.needs,
                        thought="We should talk before the next march.",
                        outbound_message=OutboundMessage(
                            scope="diplomacy",
                            target_faction_id="blue",
                            text="Blue faction, let's open talks near the river."
                        ),
                    )
                ],
                "bo": [
                    DecisionPayload(
                        action="MOVE_WEST",
                        target_x=1,
                        target_y=1,
                        reason="I am approaching the discussion.",
                        updated_emotions=bo.emotions,
                        updated_needs=bo.needs,
                        thought="I should hear them out.",
                    )
                ],
                "suri": [
                    DecisionPayload(
                        action="MOVE_WEST",
                        target_x=2,
                        target_y=1,
                        reason="I am scouting quietly.",
                        updated_emotions=suri.emotions,
                        updated_needs=suri.needs,
                        thought="Watching from a distance.",
                    )
                ],
            }
        )
        simulation = build_simulation(agents=[ada, bo, suri], adapter=scripted)
        simulation.step()
        red_messages = simulation._recent_messages_for_agent(simulation.world.agents["ada"])
        blue_messages = simulation._recent_messages_for_agent(simulation.world.agents["bo"])
        gold_messages = simulation._recent_messages_for_agent(simulation.world.agents["suri"])
        self.assertTrue(red_messages["diplomacy"])
        self.assertTrue(blue_messages["diplomacy"])
        self.assertFalse(gold_messages["diplomacy"])


if __name__ == "__main__":
    unittest.main()

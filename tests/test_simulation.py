from __future__ import annotations

import unittest

from helpers import build_agent, build_simulation, farmable_tile, water_tile
from gridnomad.ai.adapters import ScriptedLLMAdapter
from gridnomad.core.models import CulturalInnovation, DecisionPayload, Emotions, Needs, OutboundMessage, TileType
from gridnomad.core.perception import build_perception


class SimulationTests(unittest.TestCase):
    def test_salience_reports_full_ai_mode_and_context(self) -> None:
        ada = build_agent("ada", "red", 1, 1, survival=8)
        simulation = build_simulation(agents=[ada], tile_overrides=[(2, 1, water_tile())])
        agent = simulation.world.agents["ada"]
        perception = build_perception(simulation.world, agent, simulation.config.perception_radius)
        salience = simulation.evaluate_salience(agent, perception, recent_events=[])
        self.assertTrue(salience.should_reason)
        self.assertIn("full_ai_mode", salience.reasons)
        self.assertIn("urgent_need", salience.reasons)
        self.assertIn("new_context", salience.reasons)

    def test_scripted_build_step_records_intent_memory_and_culture(self) -> None:
        ada = build_agent("ada", "red", 1, 1, wood=3, stone=2)
        scripted = ScriptedLLMAdapter(
            {
                "ada": [
                    DecisionPayload(
                        action="BUILD",
                        target_x=1,
                        target_y=1,
                        reason="I need a safe resting place.",
                        intent="build a small shelter so the group can recover here",
                        speech="I am turning this spot into a safe place to rest.",
                        updated_emotions=Emotions(joy=6, sadness=1, fear=1, anger=0, disgust=0, surprise=4),
                        updated_needs=Needs(
                            survival=4,
                            safety=3,
                            belonging=4,
                            esteem=6,
                            self_actualization=5,
                        ),
                        thought="A shelter will make this place feel livable.",
                        cultural_innovation=CulturalInnovation(
                            element="Safe Hearth",
                            description="Respect the people who make safe resting places.",
                            strength=70,
                            category="ritual",
                        ),
                        outbound_message=OutboundMessage(
                            scope="civilization",
                            text="I have started a safe shelter here."
                        ),
                    )
                ]
            }
        )
        simulation = build_simulation(
            agents=[ada],
            culture_seed={
                "red": [
                    {
                        "category": "norm",
                        "element": "Harbor Supper",
                        "description": "People share food and rest together.",
                        "strength": 75,
                    }
                ]
            },
            adapter=scripted,
        )
        events = simulation.step()
        self.assertTrue(any(event.kind == "INTENT" for event in events))
        self.assertTrue(any(event.kind == "SPEECH" for event in events))
        self.assertTrue(any(event.kind == "BUILD" and event.success for event in events))
        self.assertTrue(any(event.kind == "CULTURAL_INNOVATION" for event in events))
        self.assertTrue(any(event.kind == "COMMUNICATION" for event in events))
        self.assertEqual(simulation.world.get_tile(1, 1).terrain, TileType.HOUSE)
        self.assertEqual(simulation.world.agents["ada"].current_intent, "build a small shelter so the group can recover here")
        self.assertEqual(simulation.world.agents["ada"].last_speech, "I am turning this spot into a safe place to rest.")
        self.assertIn("A shelter will make this place feel livable.", simulation.memory_store.recent_thoughts("ada"))
        self.assertIn("Safe Hearth", simulation.culture_store.summarize("red"))

    def test_transfer_interact_and_gather_mutate_world(self) -> None:
        ada = build_agent("ada", "red", 1, 1, food=1, wood=2, stone=1, belonging=8)
        bo = build_agent("bo", "red", 2, 1, food=0, wood=0, stone=0)
        simulation = build_simulation(agents=[ada, bo], tile_overrides=[(1, 1, farmable_tile())])

        transfer = DecisionPayload(
            action="TRANSFER",
            target_x=2,
            target_y=1,
            reason="Bo needs supplies.",
            intent="share whatever I have most of with Bo",
            speech="Take this and keep going.",
            updated_emotions=ada.emotions,
            updated_needs=ada.needs,
            thought="Sharing keeps the group together.",
        )
        interact = DecisionPayload(
            action="INTERACT",
            target_x=2,
            target_y=1,
            reason="I feel isolated.",
            intent="spend time with Bo and reconnect",
            speech="Stay close for a bit.",
            updated_emotions=ada.emotions,
            updated_needs=ada.needs,
            thought="I need company.",
        )
        gather = DecisionPayload(
            action="GATHER",
            target_x=1,
            target_y=1,
            reason="This tile should have useful supplies.",
            intent="gather something useful from this area",
            speech="I can find something useful here.",
            updated_emotions=ada.emotions,
            updated_needs=ada.needs,
            thought="Worth checking the ground closely.",
        )

        transfer_events = simulation._apply_action(simulation.registry.resolve(transfer, simulation.world, ada), transfer)
        self.assertTrue(transfer_events[0].success)
        self.assertEqual(bo.inventory.wood, 1)

        interact_events = simulation._apply_action(simulation.registry.resolve(interact, simulation.world, ada), interact)
        self.assertTrue(interact_events[0].success)
        self.assertLess(ada.needs.belonging, 8)

        gather_events = simulation._apply_action(simulation.registry.resolve(gather, simulation.world, ada), gather)
        self.assertTrue(gather_events[0].success)
        self.assertGreaterEqual(ada.inventory.food, 1)

    def test_interact_can_approach_non_adjacent_target_and_frames_interpolate(self) -> None:
        ada = build_agent("ada", "red", 1, 1, belonging=8)
        bo = build_agent("bo", "red", 4, 1)
        simulation = build_simulation(agents=[ada, bo])

        interact = DecisionPayload(
            action="INTERACT",
            target_x=4,
            target_y=1,
            reason="I want to reconnect with Bo.",
            intent="walk over and talk with Bo",
            speech="Bo, wait up.",
            updated_emotions=ada.emotions,
            updated_needs=ada.needs,
            thought="I should close the distance and talk.",
            target_agent_id="bo",
            interaction_mode="conversation",
        )

        previous_agents = {"ada": {"x": ada.x, "y": ada.y}, "bo": {"x": bo.x, "y": bo.y}}
        event = simulation._apply_action(simulation.registry.resolve(interact, simulation.world, ada), interact)[0]
        simulation._prime_task(
            simulation.world.agents["ada"],
            simulation.registry.resolve(interact, simulation.world, simulation.world.agents["ada"]),
            interact,
            beat_start_ms=0,
            beat_end_ms=simulation.config.decision_interval_ms,
        )
        frames = simulation.build_transition_frames(previous_agents)

        self.assertTrue(event.success)
        self.assertLessEqual(abs(simulation.world.agents["ada"].x - simulation.world.agents["bo"].x) + abs(simulation.world.agents["ada"].y - simulation.world.agents["bo"].y), 1)
        self.assertTrue(frames)
        self.assertLess(frames[0]["humans"][0]["render_x"], frames[-1]["humans"][0]["render_x"])

    def test_invalid_model_response_uses_safe_fallback(self) -> None:
        ada = build_agent("ada", "red", 1, 1, survival=8)
        adapter = ScriptedLLMAdapter({"ada": ["{not valid json"]})
        simulation = build_simulation(
            agents=[ada],
            tile_overrides=[(1, 0, water_tile()), (2, 1, farmable_tile())],
            adapter=adapter,
        )
        events = simulation.step()
        self.assertTrue(any(event.kind in {"MOVE", "REST"} for event in events))
        self.assertTrue(simulation.world.agents["ada"].alive)

    def test_no_survival_death_before_tick_40(self) -> None:
        ada = build_agent("ada", "red", 1, 1, health=1, survival=10)
        simulation = build_simulation(agents=[ada])
        for _ in range(20):
            simulation.step()
        self.assertTrue(simulation.world.agents["ada"].alive)

    def test_diplomacy_messages_are_visible_to_involved_groups(self) -> None:
        ada = build_agent("ada", "red", 1, 1)
        bo = build_agent("bo", "blue", 2, 1)
        suri = build_agent("suri", "gold", 3, 1)
        scripted = ScriptedLLMAdapter(
            {
                "ada": [
                    DecisionPayload(
                        action="COMMUNICATE",
                        target_x=2,
                        target_y=1,
                        reason="Cross-group coordination matters here.",
                        intent="open a calm conversation with the blue group",
                        speech="Blue group, can we talk before this gets tense?",
                        updated_emotions=ada.emotions,
                        updated_needs=ada.needs,
                        thought="Talking first is safer than guessing.",
                        outbound_message=OutboundMessage(
                            scope="diplomacy",
                            target_faction_id="blue",
                            text="Blue group, can we talk near the river?"
                        ),
                    )
                ],
                "bo": [
                    DecisionPayload(
                        action="MOVE_WEST",
                        target_x=1,
                        target_y=1,
                        reason="I am approaching the discussion.",
                        intent="move closer so I can hear the message directly",
                        speech="I am listening.",
                        updated_emotions=bo.emotions,
                        updated_needs=bo.needs,
                        thought="Better to hear them out first.",
                    )
                ],
                "suri": [
                    DecisionPayload(
                        action="MOVE_WEST",
                        target_x=2,
                        target_y=1,
                        reason="I am scouting quietly.",
                        intent="watch from a distance without joining the talk",
                        speech="",
                        updated_emotions=suri.emotions,
                        updated_needs=suri.needs,
                        thought="I should not step into that yet.",
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

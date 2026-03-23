from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

from gridnomad.ai.prompting import AgentPromptView, build_agent_prompt
from gridnomad.core.actions import MODEL_ACTIONS, MOVE_DELTAS
from gridnomad.core.models import (
    ActionProposal,
    AgentState,
    DecisionPayload,
    Emotions,
    Needs,
    OutboundMessage,
    WorldState,
)
from gridnomad.core.perception import PerceptionSnapshot


@dataclass(slots=True)
class AgentContext:
    tick: int
    agent: AgentState
    world: WorldState
    perception: PerceptionSnapshot
    recent_events: list[str]
    memories: list[str]
    recent_messages: dict[str, list[str]]
    cultural_context: str
    group_context: str
    prompt: str


class LLMAdapter(Protocol):
    def decide(self, agent_context: AgentContext) -> DecisionPayload | str:
        ...


class HeuristicLLMAdapter:
    def __init__(self, *, deterministic_offset: int = 0) -> None:
        self.deterministic_offset = deterministic_offset

    def decide(self, agent_context: AgentContext) -> DecisionPayload:
        agent = agent_context.agent
        perception = agent_context.perception
        action = "MOVE_NORTH"
        target_x: int | None = None
        target_y: int | None = None
        target_agent_id: str | None = None
        reason = "I want to take one concrete next step that keeps me useful and observant."
        intent = "Take one careful next step through the area and keep watch for people or resources."
        speech = ""
        outbound_message: OutboundMessage | None = None
        interaction_mode: str | None = None
        target_resource_kind: str | None = None
        gather_mode: str | None = None
        build_kind: str | None = None
        craft_kind: str | None = None

        if perception.hostile_agents:
            hostile = agent_context.world.agents[perception.hostile_agents[0]]
            action = "ATTACK"
            target_x, target_y = hostile.x, hostile.y
            target_agent_id = hostile.id
            reason = f"{hostile.name} feels dangerous, so I need to confront the situation carefully."
            intent = f"Deal with the threat from {hostile.name} before it gets worse."
            speech = f"{hostile.name}, back away. I do not want this to get worse."
            interaction_mode = "hostile"
            outbound_message = OutboundMessage(
                scope="diplomacy",
                target_faction_id=hostile.faction_id,
                target_agent_id=hostile.id,
                text=f"{hostile.name} is escalating tension near me."
            )
        elif agent.needs.survival >= 7 and perception.nearby_farmable:
            target_x, target_y = self._nearest_tile(agent, perception.nearby_farmable)
            action = "GATHER"
            reason = "My survival need is urgent and this land looks useful for food or supplies."
            intent = "Find food or usable materials before my survival need gets worse."
            speech = "I need food and supplies soon."
            target_resource_kind = "food"
            gather_mode = "forage_food"
            outbound_message = OutboundMessage(
                scope="civilization",
                text="I am searching this area for food and supplies."
            )
        elif agent.inventory.wood >= 2 and agent.inventory.stone >= 1 and agent.needs.safety >= 6:
            action = "BUILD"
            reason = "I want a safer place to recover and I have enough materials to start something small."
            intent = "Build a simple shelter or marker that makes this area feel safer."
            speech = "I can turn this spot into a safer resting place."
            build_kind = "home"
            outbound_message = OutboundMessage(
                scope="civilization",
                text="I am starting a small shelter here if anyone needs a safe place."
            )
        elif agent.needs.belonging >= 7 and perception.friendly_agents:
            friend = agent_context.world.agents[perception.friendly_agents[0]]
            action = "INTERACT"
            target_x, target_y = friend.x, friend.y
            target_agent_id = friend.id
            reason = f"I feel isolated and want to reconnect with {friend.name}."
            intent = f"Move closer to {friend.name} and restore some sense of connection."
            speech = f"{friend.name}, can we stay together for a while?"
            interaction_mode = "support"
            outbound_message = OutboundMessage(
                scope="civilization",
                target_agent_id=friend.id,
                text=f"I need support from {friend.name} nearby."
            )
        elif perception.friendly_agents and agent_context.tick % 3 == 0:
            friend = agent_context.world.agents[perception.friendly_agents[0]]
            action = "COMMUNICATE"
            target_x, target_y = friend.x, friend.y
            target_agent_id = friend.id
            reason = f"I want to check in with {friend.name} and keep the group coordinated."
            intent = f"Talk with {friend.name} and stay coordinated."
            speech = f"{friend.name}, what do you need right now?"
            interaction_mode = "conversation"
            outbound_message = OutboundMessage(
                scope="civilization",
                target_agent_id=friend.id,
                text=f"I am checking in with {friend.name} so we stay coordinated."
            )
        elif agent.inventory.food > 0 and agent.needs.survival >= 5:
            action = "CONSUME"
            reason = "I have food on hand and I need to stabilize myself before doing anything else."
            intent = "Eat what I have and get steady before I move again."
        elif agent.stuck_steps >= 3 and perception.frontier_direction:
            move_toward = self._direction_to_move(perception.frontier_direction)
            action = move_toward
            dx, dy = MOVE_DELTAS[action]
            target_x = agent.x + dx
            target_y = agent.y + dy
            reason = "I have been circling too long. I need to break out and head toward unexplored ground."
            intent = f"Escape the local loop and push {perception.frontier_direction} toward fresh terrain."
            speech = self._pick_speech(agent, agent_context.tick, "escape")
            outbound_message = OutboundMessage(
                scope="civilization",
                text=f"Breaking out of a rut, heading {perception.frontier_direction}."
            )
        elif agent.needs.survival >= 5 and (perception.nearby_farmable or perception.nearest_resource_hints):
            if perception.nearby_farmable:
                target_x, target_y = self._nearest_tile(agent, perception.nearby_farmable)
            action = "GATHER"
            reason = "My survival need is growing and I should gather supplies before it becomes critical."
            intent = "Secure food or usable materials while I can still think clearly."
            speech = self._pick_speech(agent, agent_context.tick, "gather")
            target_resource_kind = "food"
            gather_mode = "forage_food"
            outbound_message = OutboundMessage(
                scope="civilization",
                text="Gathering supplies before things get urgent."
            )
        elif perception.visible_resources and agent_context.tick % 2 == 0:
            action = "GATHER"
            resource_bias = (agent.resource_bias or "food").lower()
            if resource_bias in ("wood", "stone"):
                gather_mode = "cut_tree" if resource_bias == "wood" else "quarry_stone"
                target_resource_kind = resource_bias
            else:
                gather_mode = "forage_food"
                target_resource_kind = "food"
            reason = f"There are resources nearby and I want to collect {target_resource_kind} for the group."
            intent = f"Gather {target_resource_kind} from what I can see around me."
            speech = self._pick_speech(agent, agent_context.tick, "resource")
            outbound_message = OutboundMessage(
                scope="civilization",
                text=f"I spotted {target_resource_kind} nearby, picking some up."
            )
        elif agent.inventory.wood >= 3 and agent.inventory.stone >= 1:
            action = "BUILD"
            reason = "I have enough material to start something useful for the group."
            intent = "Build a shelter or structure with the materials I have been carrying."
            speech = self._pick_speech(agent, agent_context.tick, "build")
            build_kind = "home"
            outbound_message = OutboundMessage(
                scope="civilization",
                text="Starting to build with the materials I gathered."
            )
        elif perception.friendly_agents and agent_context.tick % 3 == 0:
            friend = agent_context.world.agents[perception.friendly_agents[0]]
            action = "INTERACT" if agent.needs.belonging >= 4 else "COMMUNICATE"
            target_x, target_y = friend.x, friend.y
            target_agent_id = friend.id
            reason = f"I want to connect with {friend.name} and keep the group together."
            intent = f"Spend time with {friend.name} and stay coordinated."
            speech = self._pick_speech(agent, agent_context.tick, "social")
            interaction_mode = "support" if action == "INTERACT" else "conversation"
            outbound_message = OutboundMessage(
                scope="civilization",
                target_agent_id=friend.id,
                text=f"Checking in with {friend.name}."
            )
        else:
            if perception.frontier_direction:
                action = self._direction_to_move(perception.frontier_direction)
            else:
                move_names = sorted(MOVE_DELTAS)
                index = (sum(ord(char) for char in agent.id) + agent_context.tick + self.deterministic_offset) % len(move_names)
                action = move_names[index]
            dx, dy = MOVE_DELTAS[action]
            target_x = agent.x + dx
            target_y = agent.y + dy
            reason = "I want to explore and find something useful for myself or the group."
            intent = "Move toward less-explored ground and look for resources or people."
            speech = self._pick_speech(agent, agent_context.tick, "explore")
            if agent_context.tick % 4 == 0:
                outbound_message = OutboundMessage(
                    scope="civilization",
                    text=self._pick_speech(agent, agent_context.tick, "report")
                )

        updated_emotions = Emotions(
            joy=max(0, agent.emotions.joy - 1 + (1 if action in {"BUILD", "INTERACT"} else 0)),
            sadness=max(0, agent.emotions.sadness - (1 if perception.friendly_agents else 0)),
            fear=min(10, agent.emotions.fear + (2 if perception.hostile_agents else 0)),
            anger=min(10, agent.emotions.anger + (1 if perception.hostile_agents else 0)),
            disgust=agent.emotions.disgust,
            surprise=min(10, agent.emotions.surprise + (1 if perception.visible_resources else 0)),
        )
        updated_needs = Needs(
            survival=min(10, max(0, agent.needs.survival - (1 if action in {"CONSUME", "GATHER"} else 0))),
            safety=min(10, max(0, agent.needs.safety + (1 if perception.hostile_agents else 0))),
            belonging=min(10, max(0, agent.needs.belonging - (1 if action == "INTERACT" else 0))),
            esteem=min(10, max(0, agent.needs.esteem + (1 if action in {"BUILD", "TRANSFER"} else 0))),
            self_actualization=min(
                10, max(0, agent.needs.self_actualization + (1 if action in MOVE_DELTAS else 0))
            ),
        )
        dominant_emotion, intensity = updated_emotions.dominant()
        thought = f"{dominant_emotion} at {intensity}: {intent}"
        cultural_innovation = None
        if action == "BUILD" and agent.personality.openness >= 7 and agent_context.tick % 3 == 0:
            from gridnomad.core.models import CulturalInnovation

            cultural_innovation = CulturalInnovation(
                element="Safe Hearth",
                description="The group respects people who create places of rest and safety.",
                strength=65,
                category="ritual",
            )

        return DecisionPayload(
            action=action,
            target_x=target_x,
            target_y=target_y,
            reason=reason,
            intent=intent,
            speech=speech,
            updated_emotions=updated_emotions,
            updated_needs=updated_needs,
            thought=thought,
            target_agent_id=target_agent_id,
            target_resource_kind=target_resource_kind,
            gather_mode=gather_mode,
            build_kind=build_kind,
            craft_kind=craft_kind,
            interaction_mode=interaction_mode,
            cultural_innovation=cultural_innovation,
            outbound_message=outbound_message,
        )

    def _nearest_tile(self, agent: AgentState, points: list[tuple[int, int]]) -> tuple[int, int]:
        return min(points, key=lambda point: (abs(point[0] - agent.x) + abs(point[1] - agent.y), point[1], point[0]))

    def _direction_to_move(self, direction: str) -> str:
        direction_lower = direction.lower()
        if "north" in direction_lower:
            return "MOVE_NORTH"
        if "south" in direction_lower:
            return "MOVE_SOUTH"
        if "east" in direction_lower:
            return "MOVE_EAST"
        if "west" in direction_lower:
            return "MOVE_WEST"
        return "MOVE_NORTH"

    _SPEECH_POOLS: dict[str, list[str]] = {
        "escape": [
            "I need to break free from this loop.",
            "Time to try a different path.",
            "I keep coming back to the same spot. Enough.",
            "This area has nothing new. Moving on.",
        ],
        "gather": [
            "I should stock up before I get too hungry.",
            "Let me see what I can find here.",
            "These supplies will help the group.",
            "Better to gather while it is safe.",
        ],
        "resource": [
            "I see something useful nearby.",
            "There is material here worth collecting.",
            "This could be exactly what we need.",
            "Picking up what I can before I move on.",
        ],
        "build": [
            "Time to put these materials to use.",
            "This spot could become a shelter.",
            "Building something solid here.",
            "Let me set up a structure for the group.",
        ],
        "social": [
            "Hey, how are you holding up?",
            "Good to see a familiar face.",
            "Let us stick together for a while.",
            "We should coordinate our next move.",
        ],
        "explore": [
            "Curious what is out there.",
            "I want to see what lies ahead.",
            "Pushing into new ground.",
            "Let me check this direction.",
        ],
        "report": [
            "The terrain looks different ahead.",
            "Reporting back on what I found.",
            "Nothing dangerous so far, still moving.",
            "Scouting this area for the group.",
        ],
    }

    def _pick_speech(self, agent: AgentState, tick: int, category: str) -> str:
        pool = self._SPEECH_POOLS.get(category, self._SPEECH_POOLS["explore"])
        index = (sum(ord(char) for char in agent.id) + tick) % len(pool)
        return pool[index]


class ScriptedLLMAdapter:
    def __init__(self, responses: dict[str, list[DecisionPayload | str]] | list[DecisionPayload | str]) -> None:
        self.responses = responses
        self._index = 0

    def decide(self, agent_context: AgentContext) -> DecisionPayload | str:
        if isinstance(self.responses, dict):
            queue = self.responses.get(agent_context.agent.id, [])
            if queue:
                return queue.pop(0)
            raise IndexError(f"No scripted responses left for {agent_context.agent.id}")
        response = self.responses[self._index]
        self._index += 1
        return response


def build_agent_context(
    tick: int,
    agent: AgentState,
    world: WorldState,
    perception: PerceptionSnapshot,
    recent_events: list[str],
    memories: list[str],
    recent_messages: dict[str, list[str]],
    cultural_context: str,
    group_context: str,
) -> AgentContext:
    prompt_view = AgentPromptView.from_agent(agent, memories)
    prompt = build_agent_prompt(prompt_view, perception.text, recent_events, recent_messages, cultural_context, group_context)
    return AgentContext(
        tick=tick,
        agent=agent,
        world=world,
        perception=perception,
        recent_events=recent_events,
        memories=memories,
        recent_messages=recent_messages,
        cultural_context=cultural_context,
        group_context=group_context,
        prompt=prompt,
    )


def parse_decision_payload(response: DecisionPayload | str) -> DecisionPayload:
    if isinstance(response, DecisionPayload):
        return response
    data = json.loads(response)
    decision = DecisionPayload.from_dict(data, clamp_states=True)
    if decision.action not in MODEL_ACTIONS and decision.action_proposal is None:
        decision.action_proposal = ActionProposal(
            name=decision.action,
            description=decision.reason or "Novel action suggested by raw model response.",
        )
    return decision


def parse_group_decision_payloads(response: str) -> dict[str, DecisionPayload]:
    data = json.loads(response)
    raw_decisions = data.get("decisions")
    if not isinstance(raw_decisions, list):
        raise ValueError("Group decision response must contain a decisions array.")
    decisions: dict[str, DecisionPayload] = {}
    for item in raw_decisions:
        if not isinstance(item, dict):
            raise ValueError("Each group decision must be an object.")
        human_id = str(item.get("human_id", "")).strip()
        if not human_id:
            raise ValueError("Each group decision must include human_id.")
        if human_id in decisions:
            raise ValueError(f"Duplicate decision for {human_id}.")
        decision = DecisionPayload.from_dict(item, clamp_states=True)
        if decision.action not in MODEL_ACTIONS and decision.action_proposal is None:
            decision.action_proposal = ActionProposal(
                name=decision.action,
                description=decision.reason or "Novel action suggested by raw model response.",
            )
        decisions[human_id] = decision
    return decisions

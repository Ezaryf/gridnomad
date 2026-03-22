from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

from gridnomad.ai.prompting import AgentPromptView, build_agent_prompt
from gridnomad.core.actions import MODEL_ACTIONS, MOVE_DELTAS
from gridnomad.core.models import ActionProposal, AgentState, DecisionPayload, Emotions, Needs, WorldState
from gridnomad.core.perception import PerceptionSnapshot


@dataclass(slots=True)
class AgentContext:
    tick: int
    agent: AgentState
    world: WorldState
    perception: PerceptionSnapshot
    recent_events: list[str]
    memories: list[str]
    cultural_context: str
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
        reason = "I am keeping momentum and exploring nearby terrain."

        if perception.hostile_agents:
            hostile = agent_context.world.agents[perception.hostile_agents[0]]
            action = "ATTACK"
            target_x, target_y = hostile.x, hostile.y
            reason = f"{hostile.name} is close enough to threaten me, so I will strike first."
        elif agent.needs.survival >= 7 and perception.nearby_farmable:
            target_x, target_y = self._nearest_tile(agent, perception.nearby_farmable)
            action = "CULTIVATE"
            reason = "My survival need is urgent and this farmable ground can produce food."
        elif perception.nearby_water and agent.inventory.wood >= 2 and "bridge" in agent_context.cultural_context.lower():
            adjacent_water = [
                point
                for point in perception.nearby_water
                if abs(point[0] - agent.x) + abs(point[1] - agent.y) <= 1
            ]
            bridge_targets = adjacent_water or perception.nearby_water
            target_x, target_y = self._nearest_tile(agent, bridge_targets)
            action = "BUILD_BRIDGE"
            reason = "Our culture values crossing water, and I have enough wood to help."
        elif agent.needs.belonging >= 7 and perception.friendly_agents:
            friend = agent_context.world.agents[perception.friendly_agents[0]]
            action = "ASK_FOR_HELP"
            target_x, target_y = friend.x, friend.y
            reason = f"I feel isolated and want to reconnect with {friend.name}."
        else:
            move_names = list(MOVE_DELTAS)
            index = (sum(ord(char) for char in agent.id) + agent_context.tick + self.deterministic_offset) % len(
                move_names
            )
            action = move_names[index]
            reason = "I do not face an urgent conflict, so I am exploring a new direction."

        updated_emotions = Emotions(
            joy=max(0, agent.emotions.joy - 1 + (1 if action in {"BUILD_BRIDGE", "FORM_ALLIANCE"} else 0)),
            sadness=max(0, agent.emotions.sadness - (1 if perception.friendly_agents else 0)),
            fear=min(10, agent.emotions.fear + (2 if perception.hostile_agents else 0)),
            anger=min(10, agent.emotions.anger + (1 if perception.hostile_agents else 0)),
            disgust=agent.emotions.disgust,
            surprise=min(10, agent.emotions.surprise + (1 if perception.visible_resources else 0)),
        )
        updated_needs = Needs(
            survival=min(10, max(0, agent.needs.survival - (1 if action == "CULTIVATE" else 0))),
            safety=min(10, max(0, agent.needs.safety + (1 if perception.hostile_agents else 0))),
            belonging=min(10, max(0, agent.needs.belonging - (1 if action == "ASK_FOR_HELP" else 0))),
            esteem=min(10, max(0, agent.needs.esteem + (1 if action in {"BUILD_BRIDGE", "ATTACK"} else 0))),
            self_actualization=min(
                10, max(0, agent.needs.self_actualization + (1 if action.startswith("MOVE_") else 0))
            ),
        )
        dominant_emotion, intensity = updated_emotions.dominant()
        thought = f"{dominant_emotion} at {intensity}: {reason}"
        cultural_innovation = None
        if action == "BUILD_BRIDGE" and agent.personality.openness >= 7 and agent_context.tick % 3 == 0:
            from gridnomad.core.models import CulturalInnovation

            cultural_innovation = CulturalInnovation(
                element="River Pact",
                description="Honour those who build bridges for the faction.",
                strength=65,
                category="ritual",
            )

        return DecisionPayload(
            action=action,
            target_x=target_x,
            target_y=target_y,
            reason=reason,
            updated_emotions=updated_emotions,
            updated_needs=updated_needs,
            thought=thought,
            cultural_innovation=cultural_innovation,
        )

    def _nearest_tile(self, agent: AgentState, points: list[tuple[int, int]]) -> tuple[int, int]:
        return min(points, key=lambda point: (abs(point[0] - agent.x) + abs(point[1] - agent.y), point[1], point[0]))


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
    cultural_context: str,
) -> AgentContext:
    prompt_view = AgentPromptView.from_agent(agent, memories)
    prompt = build_agent_prompt(prompt_view, perception.text, recent_events, cultural_context)
    return AgentContext(
        tick=tick,
        agent=agent,
        world=world,
        perception=perception,
        recent_events=recent_events,
        memories=memories,
        cultural_context=cultural_context,
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

from __future__ import annotations

from dataclasses import dataclass

from gridnomad.core.models import AgentState, DecisionPayload, EngineAction, IntentState, WorldState


MOVE_DELTAS = {
    "MOVE_NORTH": (0, -1),
    "MOVE_SOUTH": (0, 1),
    "MOVE_EAST": (1, 0),
    "MOVE_WEST": (-1, 0),
}

PRIMITIVE_ACTIONS = {
    "MOVE",
    "REST",
    "INTERACT",
    "CONSUME",
    "GATHER",
    "BUILD",
    "TRANSFER",
    "COMMUNICATE",
}

MODEL_ACTIONS = set(MOVE_DELTAS) | PRIMITIVE_ACTIONS


@dataclass(slots=True)
class ActionRegistry:
    perception_radius: int = 2

    def is_known(self, action: str) -> bool:
        return action in MODEL_ACTIONS

    def resolve(self, decision: DecisionPayload, world_state: WorldState, actor: AgentState) -> EngineAction:
        action = decision.action
        if action in MOVE_DELTAS:
            dx, dy = MOVE_DELTAS[action]
            return EngineAction(
                kind="MOVE",
                actor_id=actor.id,
                target_x=actor.x + dx,
                target_y=actor.y + dy,
                metadata={"cardinal_action": action},
            )

        if action not in MODEL_ACTIONS:
            decision.ensure_action_proposal_for_unknown()
            return EngineAction(
                kind="NO_OP",
                actor_id=actor.id,
                metadata={
                    "reason": "Unknown action proposal",
                    "action_proposal": decision.action_proposal.to_dict() if decision.action_proposal else None,
                },
            )

        if action == "MOVE":
            target_x, target_y = self._resolve_target_tile(decision, world_state, actor)
            return EngineAction(kind="MOVE", actor_id=actor.id, target_x=target_x, target_y=target_y)

        if action in {"INTERACT", "TRANSFER", "COMMUNICATE"}:
            target_agent = self._resolve_target_agent(decision, world_state, actor)
            return EngineAction(
                kind=action,
                actor_id=actor.id,
                target_x=None if target_agent is None else target_agent.x,
                target_y=None if target_agent is None else target_agent.y,
                target_agent_id=None if target_agent is None else target_agent.id,
            )

        if action in {"REST", "CONSUME", "GATHER", "BUILD"}:
            target_x, target_y = self._resolve_target_tile(decision, world_state, actor)
            return EngineAction(kind=action, actor_id=actor.id, target_x=target_x, target_y=target_y)

        return EngineAction(kind="NO_OP", actor_id=actor.id, metadata={"reason": "Unhandled action"})

    def _resolve_target_tile(
        self, decision: DecisionPayload, world_state: WorldState, actor: AgentState
    ) -> tuple[int | None, int | None]:
        if decision.target_x is not None and decision.target_y is not None:
            return decision.target_x, decision.target_y
        candidates = [
            (actor.x, actor.y),
            (actor.x, actor.y - 1),
            (actor.x + 1, actor.y),
            (actor.x, actor.y + 1),
            (actor.x - 1, actor.y),
        ]
        for x, y in candidates:
            if world_state.in_bounds(x, y):
                return x, y
        return None, None

    def _resolve_target_agent(
        self,
        decision: DecisionPayload,
        world_state: WorldState,
        actor: AgentState,
    ):
        if decision.target_agent_id is not None:
            target = world_state.agents.get(decision.target_agent_id)
            if target is not None and target.alive and target.id != actor.id:
                return target
        if decision.target_x is not None and decision.target_y is not None:
            target = world_state.agent_at(decision.target_x, decision.target_y, exclude_agent_id=actor.id)
            if target is not None:
                return target
        nearby = world_state.nearby_agents(
            actor.x, actor.y, self.perception_radius, exclude_agent_id=actor.id
        )
        return nearby[0] if nearby else None

    def intent_from_decision(self, decision: DecisionPayload) -> IntentState:
        return decision.to_intent()

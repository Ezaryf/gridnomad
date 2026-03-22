from __future__ import annotations

from dataclasses import dataclass

from gridnomad.core.models import AgentState, DecisionPayload, EngineAction, IntentState, WorldState


MOVE_DELTAS = {
    "MOVE_NORTH": (0, -1),
    "MOVE_SOUTH": (0, 1),
    "MOVE_EAST": (1, 0),
    "MOVE_WEST": (-1, 0),
}

MODEL_ACTIONS = set(MOVE_DELTAS) | {
    "BUILD_BRIDGE",
    "CONSTRUCT_HOUSE",
    "DECLARE_WAR",
    "FORM_ALLIANCE",
    "VOTE_LEADER",
    "ATTACK",
    "ASK_FOR_HELP",
    "CULTIVATE",
    "TRADE",
}


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
                kind=action,
                actor_id=actor.id,
                target_x=actor.x + dx,
                target_y=actor.y + dy,
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

        if action in {"BUILD_BRIDGE", "CONSTRUCT_HOUSE", "CULTIVATE"}:
            target_x, target_y = self._resolve_target_tile(decision, world_state, actor)
            return EngineAction(kind=action, actor_id=actor.id, target_x=target_x, target_y=target_y)

        if action in {"ATTACK", "ASK_FOR_HELP", "TRADE", "VOTE_LEADER"}:
            target_agent = self._resolve_target_agent(decision, world_state, actor)
            return EngineAction(
                kind=action,
                actor_id=actor.id,
                target_x=None if target_agent is None else target_agent.x,
                target_y=None if target_agent is None else target_agent.y,
                target_agent_id=None if target_agent is None else target_agent.id,
            )

        if action in {"DECLARE_WAR", "FORM_ALLIANCE"}:
            target_agent = self._resolve_target_agent(decision, world_state, actor, allow_any_visible=True)
            target_faction_id = None if target_agent is None else target_agent.faction_id
            if target_faction_id is None:
                for candidate in sorted(world_state.factions):
                    if candidate != actor.faction_id:
                        target_faction_id = candidate
                        break
            return EngineAction(
                kind=action,
                actor_id=actor.id,
                target_agent_id=None if target_agent is None else target_agent.id,
                target_faction_id=target_faction_id,
            )

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
        *,
        allow_any_visible: bool = False,
    ):
        if decision.target_x is not None and decision.target_y is not None:
            target = world_state.agent_at(decision.target_x, decision.target_y, exclude_agent_id=actor.id)
            if target is not None:
                return target
        nearby = world_state.nearby_agents(
            actor.x, actor.y, self.perception_radius, exclude_agent_id=actor.id
        )
        if not allow_any_visible:
            nearby = [candidate for candidate in nearby if abs(candidate.x - actor.x) + abs(candidate.y - actor.y) <= 1]
        return nearby[0] if nearby else None

    def intent_from_decision(self, decision: DecisionPayload) -> IntentState:
        return decision.to_intent()

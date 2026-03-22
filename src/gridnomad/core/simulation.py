from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path

from gridnomad.ai.adapters import LLMAdapter, build_agent_context, parse_decision_payload
from gridnomad.core.actions import ActionRegistry, MODEL_ACTIONS, MOVE_DELTAS
from gridnomad.core.culture import CultureStore
from gridnomad.core.memory import MemoryStore
from gridnomad.core.models import (
    AgentState,
    AnimalUnitState,
    BattleState,
    CommunicationMessage,
    DecisionPayload,
    Emotions,
    EngineAction,
    Needs,
    SimulationConfig,
    SimulationEvent,
    TileType,
    WorldState,
)
from gridnomad.core.perception import PerceptionSnapshot, build_perception


@dataclass(slots=True)
class SalienceDecision:
    should_reason: bool
    reasons: list[str]


class Simulation:
    def __init__(
        self,
        config: SimulationConfig,
        world: WorldState,
        adapter: LLMAdapter,
        *,
        culture_store: CultureStore | None = None,
        memory_store: MemoryStore | None = None,
        rng: random.Random | None = None,
    ) -> None:
        self.config = config
        self.world = world
        self.adapter = adapter
        self.registry = ActionRegistry(perception_radius=config.perception_radius)
        self.culture_store = culture_store or CultureStore()
        self.memory_store = memory_store or MemoryStore(
            thought_limit=config.thought_memory_limit,
            event_limit=config.event_memory_limit,
        )
        self.rng = rng or random.Random(world.seed)
        self.events: list[SimulationEvent] = []

    def run(self, ticks: int) -> list[SimulationEvent]:
        produced: list[SimulationEvent] = []
        for _ in range(ticks):
            produced.extend(self.step())
        return produced

    def step(self) -> list[SimulationEvent]:
        self.world.tick += 1
        tick_events: list[SimulationEvent] = []
        tick_events.extend(self._world_decay_update())
        for agent in sorted(self.world.agents.values(), key=lambda item: item.id):
            if not agent.alive:
                continue
            perception = build_perception(self.world, agent, self.config.perception_radius)
            recent_events = self.memory_store.recent_events(agent.id, limit=5)
            memories = self.memory_store.recent_thoughts(agent.id, limit=5)
            recent_messages = self._recent_messages_for_agent(agent)
            salience = self.evaluate_salience(agent, perception, recent_events, recent_messages)
            if salience.should_reason:
                decision = self._reason_for_agent(agent, perception, recent_events, memories, recent_messages)
            else:
                decision = self._reuse_or_fallback_decision(agent)
            action = self.registry.resolve(decision, self.world, agent)
            result_events = self._apply_action(action)
            tick_events.extend(result_events)
            agent.emotions = decision.updated_emotions
            agent.needs = decision.updated_needs
            if self.registry.is_known(decision.action):
                agent.last_intent = decision.to_intent()
            agent.last_perception_signature = perception.signature
            if decision.thought.strip():
                self.memory_store.add_thought(agent.id, decision.thought)
            if decision.cultural_innovation is not None:
                self.culture_store.add_innovation(
                    agent.faction_id,
                    decision.cultural_innovation,
                    origin_agent_id=agent.id,
                )
                tick_events.append(
                    self._event(
                        kind="CULTURAL_INNOVATION",
                        description=(
                            f"{agent.name} proposed cultural element "
                            f"{decision.cultural_innovation.element}."
                        ),
                        success=True,
                        actor_id=agent.id,
                        faction_id=agent.faction_id,
                        metadata=decision.cultural_innovation.to_dict(),
                    )
                )
            if decision.action_proposal is not None and decision.action not in MODEL_ACTIONS:
                tick_events.append(
                    self._event(
                        kind="ACTION_PROPOSAL",
                        description=f"{agent.name} proposed a new action: {decision.action_proposal.name}.",
                        success=True,
                        actor_id=agent.id,
                        faction_id=agent.faction_id,
                        metadata=decision.action_proposal.to_dict(),
                    )
                )
            message = self._emit_outbound_message(agent, action, decision)
            if message is not None:
                tick_events.append(
                    self._event(
                        kind="COMMUNICATION",
                        description=self._describe_message(message),
                        success=True,
                        actor_id=agent.id,
                        target_agent_id=message.target_agent_id,
                        faction_id=agent.faction_id,
                        metadata=message.to_dict(),
                    )
                )

        tick_events.extend(self._update_worldbox_state(tick_events))

        for event in tick_events:
            self._record_event(event)
        self.events.extend(tick_events)
        return tick_events

    def evaluate_salience(
        self,
        agent: AgentState,
        perception: PerceptionSnapshot,
        recent_events: list[str],
        recent_messages: dict[str, list[str]] | None = None,
    ) -> SalienceDecision:
        reasons: list[str] = []
        message_context = recent_messages or {}
        if agent.needs.any_at_or_above(7):
            reasons.append("urgent_need")
        if perception.hostile_agents:
            reasons.append("direct_threat")
        if perception.signature != agent.last_perception_signature:
            reasons.append("new_context")
        if not agent.last_action_success:
            reasons.append("failed_action")
        if any("help" in event.lower() for event in recent_events):
            reasons.append("help_signal")
        if any("goal" in event.lower() and "complete" in event.lower() for event in recent_events):
            reasons.append("goal_completion")
        if message_context.get("civilization") or message_context.get("diplomacy"):
            reasons.append("new_message")
        if self.world.tick - agent.last_reasoned_tick >= self.config.reason_interval:
            reasons.append("reason_interval")
        return SalienceDecision(should_reason=bool(reasons), reasons=reasons)

    def snapshot(self) -> dict[str, object]:
        return {
            "tick": self.world.tick,
            "config": self.config.to_dict(),
            "world": self.world.to_dict(),
            "culture": self.culture_store.to_dict(),
        }

    def write_events(self, output_dir: str | Path) -> None:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        lines = [json.dumps(event.to_dict(), sort_keys=True) for event in self.events]
        (out / "events.jsonl").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    def _reason_for_agent(
        self,
        agent: AgentState,
        perception: PerceptionSnapshot,
        recent_events: list[str],
        memories: list[str],
        recent_messages: dict[str, list[str]],
    ) -> DecisionPayload:
        context = build_agent_context(
            self.world.tick,
            agent,
            self.world,
            perception,
            recent_events,
            memories,
            recent_messages,
            self.culture_store.summarize(agent.faction_id),
        )
        raw = self.adapter.decide(context)
        try:
            decision = parse_decision_payload(raw)
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            decision = self._safe_fallback_decision(agent, reason="Invalid model response; using fallback.")
        decision.updated_emotions = Emotions.from_dict(decision.updated_emotions.to_dict(), clamp=True)
        decision.updated_needs = Needs.from_dict(decision.updated_needs.to_dict(), clamp=True)
        agent.last_reasoned_tick = self.world.tick
        return decision

    def _recent_messages_for_agent(self, agent: AgentState, limit: int = 5) -> dict[str, list[str]]:
        civilization: list[str] = []
        diplomacy: list[str] = []
        for message in reversed(self.world.communications):
            if not message.visible_to_faction(agent.faction_id):
                continue
            rendered = self._describe_message(message)
            if message.scope == "civilization":
                civilization.append(rendered)
            else:
                diplomacy.append(rendered)
            if len(civilization) >= limit and len(diplomacy) >= limit:
                break
        civilization.reverse()
        diplomacy.reverse()
        return {
            "civilization": civilization[-limit:],
            "diplomacy": diplomacy[-limit:],
        }

    def _emit_outbound_message(
        self,
        agent: AgentState,
        action: EngineAction,
        decision: DecisionPayload,
    ) -> CommunicationMessage | None:
        outbound = decision.outbound_message
        if outbound is None or not outbound.text.strip():
            return None
        target_faction_id = outbound.target_faction_id
        target_agent_id = outbound.target_agent_id
        if outbound.scope == "diplomacy":
            if target_faction_id is None:
                if action.target_faction_id:
                    target_faction_id = action.target_faction_id
                elif action.target_agent_id:
                    target = self.world.agents.get(action.target_agent_id)
                    target_faction_id = None if target is None else target.faction_id
            if target_faction_id is None or target_faction_id == agent.faction_id:
                return None
        else:
            target_faction_id = agent.faction_id
            if target_agent_id and self.world.agents.get(target_agent_id) is None:
                target_agent_id = None

        message = CommunicationMessage(
            tick=self.world.tick,
            scope=outbound.scope,
            sender_agent_id=agent.id,
            sender_faction_id=agent.faction_id,
            target_faction_id=target_faction_id,
            target_agent_id=target_agent_id,
            text=outbound.text.strip(),
        )
        self.world.communications.append(message)
        if len(self.world.communications) > 240:
            self.world.communications = self.world.communications[-240:]
        return message

    def _describe_message(self, message: CommunicationMessage) -> str:
        sender = self.world.agents.get(message.sender_agent_id)
        sender_name = sender.name if sender is not None else message.sender_agent_id
        if message.scope == "civilization":
            return f"{sender_name} to {message.sender_faction_id} council: {message.text}"
        target = message.target_faction_id or "unknown faction"
        return f"{sender_name} to {target}: {message.text}"

    def _reuse_or_fallback_decision(self, agent: AgentState) -> DecisionPayload:
        if agent.last_intent and self.registry.is_known(agent.last_intent.action):
            intent = agent.last_intent
            return DecisionPayload(
                action=intent.action,
                target_x=intent.target_x,
                target_y=intent.target_y,
                reason=f"Continuing previous intent: {intent.reason or intent.action}.",
                updated_emotions=agent.emotions,
                updated_needs=agent.needs,
                thought=f"I am staying the course with {intent.action}.",
            )
        return self._safe_fallback_decision(agent, reason="No recent intent; using safe fallback.")

    def _safe_fallback_decision(self, agent: AgentState, *, reason: str) -> DecisionPayload:
        for action_name, (dx, dy) in sorted(MOVE_DELTAS.items()):
            nx = agent.x + dx
            ny = agent.y + dy
            if not self.world.in_bounds(nx, ny):
                continue
            tile = self.world.get_tile(nx, ny)
            if tile.passable and not self.world.position_occupied(nx, ny, exclude_agent_id=agent.id):
                dominant, intensity = agent.emotions.dominant()
                return DecisionPayload(
                    action=action_name,
                    target_x=nx,
                    target_y=ny,
                    reason=reason,
                    updated_emotions=agent.emotions,
                    updated_needs=agent.needs,
                    thought=f"{dominant} at {intensity}: {reason}",
                )
        dominant, intensity = agent.emotions.dominant()
        return DecisionPayload(
            action="MOVE_NORTH",
            target_x=agent.x,
            target_y=agent.y,
            reason=reason,
            updated_emotions=agent.emotions,
            updated_needs=agent.needs,
            thought=f"{dominant} at {intensity}: Holding position because no safe tile is open.",
        )

    def _world_decay_update(self) -> list[SimulationEvent]:
        events: list[SimulationEvent] = []
        for row in self.world.tiles:
            for tile in row:
                if tile.terrain == TileType.FARM:
                    tile.farm_progress += 1
        for agent in sorted(self.world.agents.values(), key=lambda item: item.id):
            if not agent.alive:
                continue
            if agent.inventory.food > 0:
                agent.inventory.food -= 1
                agent.needs.survival = max(0, agent.needs.survival - 1)
            else:
                agent.needs.survival = min(10, agent.needs.survival + 1)
                agent.health = max(0, agent.health - 1)
                if agent.health == 0:
                    agent.alive = False
                    events.append(
                        self._event(
                            kind="DEATH",
                            description=f"{agent.name} succumbed to starvation and exposure.",
                            success=False,
                            actor_id=agent.id,
                            faction_id=agent.faction_id,
                        )
                    )
                    continue
            current_tile = self.world.get_tile(agent.x, agent.y)
            if current_tile.terrain == TileType.HOUSE:
                agent.needs.safety = max(0, agent.needs.safety - 1)
            if current_tile.terrain == TileType.FARM and current_tile.farm_progress >= 3:
                current_tile.farm_progress = 0
                agent.inventory.food += 1
                events.append(
                    self._event(
                        kind="HARVEST",
                        description=f"{agent.name} harvested food from a cultivated farm.",
                        success=True,
                        actor_id=agent.id,
                        faction_id=agent.faction_id,
                    )
                )
        return events

    def _apply_action(self, action: EngineAction) -> list[SimulationEvent]:
        actor = self.world.agents[action.actor_id]
        kind = action.kind
        if not actor.alive:
            return [
                self._event(
                    kind="ACTION_SKIPPED",
                    description=f"{actor.name} could not act because they are no longer alive.",
                    success=False,
                    actor_id=actor.id,
                    faction_id=actor.faction_id,
                )
            ]

        if kind in MOVE_DELTAS:
            return [self._apply_move(actor, action)]
        if kind == "BUILD_BRIDGE":
            return [self._apply_build_bridge(actor, action)]
        if kind == "CONSTRUCT_HOUSE":
            return [self._apply_construct_house(actor, action)]
        if kind == "CULTIVATE":
            return [self._apply_cultivate(actor, action)]
        if kind == "ATTACK":
            return self._apply_attack(actor, action)
        if kind == "TRADE":
            return [self._apply_trade(actor, action)]
        if kind == "ASK_FOR_HELP":
            return [self._apply_help(actor, action)]
        if kind == "DECLARE_WAR":
            return [self._apply_war(actor, action)]
        if kind == "FORM_ALLIANCE":
            return [self._apply_alliance(actor, action)]
        if kind == "VOTE_LEADER":
            return [self._apply_vote_leader(actor, action)]
        actor.last_action_success = False
        return [
            self._event(
                kind="NO_OP",
                description=f"{actor.name} did not execute a concrete world action.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
                metadata=action.metadata,
            )
        ]

    def _apply_move(self, actor: AgentState, action: EngineAction) -> SimulationEvent:
        if action.target_x is None or action.target_y is None or not self.world.in_bounds(action.target_x, action.target_y):
            actor.last_action_success = False
            return self._event(
                kind="MOVE",
                description=f"{actor.name} tried to move out of bounds.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        tile = self.world.get_tile(action.target_x, action.target_y)
        if not tile.passable or self.world.position_occupied(action.target_x, action.target_y, exclude_agent_id=actor.id):
            actor.last_action_success = False
            return self._event(
                kind="MOVE",
                description=f"{actor.name} could not move into a blocked tile.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
                metadata={"target_x": action.target_x, "target_y": action.target_y},
            )
        actor.x = action.target_x
        actor.y = action.target_y
        actor.last_action_success = True
        return self._event(
            kind="MOVE",
            description=f"{actor.name} moved to ({actor.x}, {actor.y}).",
            success=True,
            actor_id=actor.id,
            faction_id=actor.faction_id,
            metadata={"target_x": actor.x, "target_y": actor.y},
        )

    def _apply_build_bridge(self, actor: AgentState, action: EngineAction) -> SimulationEvent:
        if action.target_x is None or action.target_y is None or not self.world.in_bounds(action.target_x, action.target_y):
            actor.last_action_success = False
            return self._event(
                kind="BUILD_BRIDGE",
                description=f"{actor.name} could not find a valid bridge target.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        tile = self.world.get_tile(action.target_x, action.target_y)
        adjacent = abs(action.target_x - actor.x) + abs(action.target_y - actor.y) <= 1
        if tile.terrain != TileType.WATER or not adjacent or actor.inventory.wood < 2:
            actor.last_action_success = False
            return self._event(
                kind="BUILD_BRIDGE",
                description=f"{actor.name} failed to build a bridge.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        tile.terrain = TileType.BRIDGE
        tile.owner_faction = actor.faction_id
        tile.feature = "bridge"
        actor.inventory.wood -= 2
        actor.last_action_success = True
        return self._event(
            kind="BUILD_BRIDGE",
            description=f"{actor.name} built a bridge at ({action.target_x}, {action.target_y}).",
            success=True,
            actor_id=actor.id,
            faction_id=actor.faction_id,
            metadata={"target_x": action.target_x, "target_y": action.target_y},
        )

    def _apply_construct_house(self, actor: AgentState, action: EngineAction) -> SimulationEvent:
        target_x = actor.x if action.target_x is None else action.target_x
        target_y = actor.y if action.target_y is None else action.target_y
        if not self.world.in_bounds(target_x, target_y):
            actor.last_action_success = False
            return self._event(
                kind="CONSTRUCT_HOUSE",
                description=f"{actor.name} tried to build a house out of bounds.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        tile = self.world.get_tile(target_x, target_y)
        adjacent = abs(target_x - actor.x) + abs(target_y - actor.y) <= 1
        if not adjacent or not tile.buildable or actor.inventory.wood < 2 or actor.inventory.stone < 1:
            actor.last_action_success = False
            return self._event(
                kind="CONSTRUCT_HOUSE",
                description=f"{actor.name} failed to construct a house.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        tile.terrain = TileType.HOUSE
        tile.owner_faction = actor.faction_id
        tile.feature = "homestead"
        actor.inventory.wood -= 2
        actor.inventory.stone -= 1
        actor.last_action_success = True
        return self._event(
            kind="CONSTRUCT_HOUSE",
            description=f"{actor.name} constructed a house at ({target_x}, {target_y}).",
            success=True,
            actor_id=actor.id,
            faction_id=actor.faction_id,
            metadata={"target_x": target_x, "target_y": target_y},
        )

    def _apply_cultivate(self, actor: AgentState, action: EngineAction) -> SimulationEvent:
        if action.target_x is None or action.target_y is None or not self.world.in_bounds(action.target_x, action.target_y):
            actor.last_action_success = False
            return self._event(
                kind="CULTIVATE",
                description=f"{actor.name} could not locate a farmable tile.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        tile = self.world.get_tile(action.target_x, action.target_y)
        adjacent = abs(action.target_x - actor.x) + abs(action.target_y - actor.y) <= 1
        if not adjacent or not tile.farmable or tile.terrain != TileType.PLAIN:
            actor.last_action_success = False
            return self._event(
                kind="CULTIVATE",
                description=f"{actor.name} failed to cultivate the land.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        tile.terrain = TileType.FARM
        tile.owner_faction = actor.faction_id
        tile.feature = "field"
        tile.farm_progress = 0
        actor.last_action_success = True
        return self._event(
            kind="CULTIVATE",
            description=f"{actor.name} cultivated a farm at ({action.target_x}, {action.target_y}).",
            success=True,
            actor_id=actor.id,
            faction_id=actor.faction_id,
            metadata={"target_x": action.target_x, "target_y": action.target_y},
        )

    def _apply_attack(self, actor: AgentState, action: EngineAction) -> list[SimulationEvent]:
        target = None if action.target_agent_id is None else self.world.agents.get(action.target_agent_id)
        if target is None or not target.alive or abs(target.x - actor.x) + abs(target.y - actor.y) > 1:
            actor.last_action_success = False
            return [
                self._event(
                    kind="ATTACK",
                    description=f"{actor.name} failed to reach a valid attack target.",
                    success=False,
                    actor_id=actor.id,
                    faction_id=actor.faction_id,
                )
            ]
        target.health = max(0, target.health - 2)
        actor.last_action_success = True
        events = [
            self._event(
                kind="ATTACK",
                description=f"{actor.name} attacked {target.name}.",
                success=True,
                actor_id=actor.id,
                target_agent_id=target.id,
                faction_id=actor.faction_id,
            )
        ]
        if target.health == 0:
            target.alive = False
            events.append(
                self._event(
                    kind="DEATH",
                    description=f"{target.name} was defeated by {actor.name}.",
                    success=False,
                    actor_id=target.id,
                    target_agent_id=actor.id,
                    faction_id=target.faction_id,
                )
            )
        return events

    def _apply_trade(self, actor: AgentState, action: EngineAction) -> SimulationEvent:
        target = None if action.target_agent_id is None else self.world.agents.get(action.target_agent_id)
        if target is None or not target.alive or abs(target.x - actor.x) + abs(target.y - actor.y) > 1:
            actor.last_action_success = False
            return self._event(
                kind="TRADE",
                description=f"{actor.name} could not find a nearby trade partner.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        if actor.inventory.food == 0 and actor.inventory.wood > 0 and target.inventory.food > 0:
            actor.inventory.wood -= 1
            target.inventory.wood += 1
            actor.inventory.food += 1
            target.inventory.food -= 1
        else:
            actor_resource, actor_amount = actor.inventory.most_abundant()
            target_resource, target_amount = target.inventory.most_abundant()
            if actor_amount <= 0 or target_amount <= 0 or actor_resource == target_resource:
                actor.last_action_success = False
                return self._event(
                    kind="TRADE",
                    description=f"{actor.name} and {target.name} had nothing useful to trade.",
                    success=False,
                    actor_id=actor.id,
                    target_agent_id=target.id,
                    faction_id=actor.faction_id,
                )
            setattr(actor.inventory, actor_resource, getattr(actor.inventory, actor_resource) - 1)
            setattr(target.inventory, actor_resource, getattr(target.inventory, actor_resource) + 1)
            setattr(target.inventory, target_resource, getattr(target.inventory, target_resource) - 1)
            setattr(actor.inventory, target_resource, getattr(actor.inventory, target_resource) + 1)
        actor.last_action_success = True
        return self._event(
            kind="TRADE",
            description=f"{actor.name} traded with {target.name}.",
            success=True,
            actor_id=actor.id,
            target_agent_id=target.id,
            faction_id=actor.faction_id,
        )

    def _apply_help(self, actor: AgentState, action: EngineAction) -> SimulationEvent:
        target = None if action.target_agent_id is None else self.world.agents.get(action.target_agent_id)
        if target is None or not target.alive:
            actor.last_action_success = False
            return self._event(
                kind="ASK_FOR_HELP",
                description=f"{actor.name}'s request for help reached no one.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        if target.inventory.food > 0 and actor.inventory.food == 0:
            target.inventory.food -= 1
            actor.inventory.food += 1
            actor.last_action_success = True
            return self._event(
                kind="ASK_FOR_HELP",
                description=f"{target.name} shared food with {actor.name}.",
                success=True,
                actor_id=actor.id,
                target_agent_id=target.id,
                faction_id=actor.faction_id,
            )
        actor.last_action_success = True
        return self._event(
            kind="ASK_FOR_HELP",
            description=f"{actor.name} asked {target.name} for help, strengthening their bond.",
            success=True,
            actor_id=actor.id,
            target_agent_id=target.id,
            faction_id=actor.faction_id,
        )

    def _apply_war(self, actor: AgentState, action: EngineAction) -> SimulationEvent:
        faction = self.world.factions[actor.faction_id]
        target_faction_id = action.target_faction_id
        if target_faction_id is None or target_faction_id == actor.faction_id:
            actor.last_action_success = False
            return self._event(
                kind="DECLARE_WAR",
                description=f"{actor.name} could not identify a valid faction to oppose.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        faction.wars.add(target_faction_id)
        faction.alliances.discard(target_faction_id)
        self.world.factions[target_faction_id].wars.add(actor.faction_id)
        self.world.factions[target_faction_id].alliances.discard(actor.faction_id)
        actor.last_action_success = True
        return self._event(
            kind="DECLARE_WAR",
            description=f"{actor.name} escalated hostilities with faction {target_faction_id}.",
            success=True,
            actor_id=actor.id,
            faction_id=actor.faction_id,
            metadata={"target_faction_id": target_faction_id},
        )

    def _apply_alliance(self, actor: AgentState, action: EngineAction) -> SimulationEvent:
        faction = self.world.factions[actor.faction_id]
        target_faction_id = action.target_faction_id
        if target_faction_id is None or target_faction_id == actor.faction_id:
            actor.last_action_success = False
            return self._event(
                kind="FORM_ALLIANCE",
                description=f"{actor.name} had no faction available for an alliance.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        faction.alliances.add(target_faction_id)
        faction.wars.discard(target_faction_id)
        self.world.factions[target_faction_id].alliances.add(actor.faction_id)
        self.world.factions[target_faction_id].wars.discard(actor.faction_id)
        actor.last_action_success = True
        return self._event(
            kind="FORM_ALLIANCE",
            description=f"{actor.name} helped form an alliance with faction {target_faction_id}.",
            success=True,
            actor_id=actor.id,
            faction_id=actor.faction_id,
            metadata={"target_faction_id": target_faction_id},
        )

    def _apply_vote_leader(self, actor: AgentState, action: EngineAction) -> SimulationEvent:
        faction = self.world.factions[actor.faction_id]
        target = self.world.agents.get(action.target_agent_id) if action.target_agent_id else actor
        if target.faction_id != actor.faction_id:
            actor.last_action_success = False
            return self._event(
                kind="VOTE_LEADER",
                description=f"{actor.name} cannot vote for a leader outside the faction.",
                success=False,
                actor_id=actor.id,
                faction_id=actor.faction_id,
            )
        faction.leader_id = target.id
        actor.last_action_success = True
        return self._event(
            kind="VOTE_LEADER",
            description=f"{actor.name} voted for {target.name} as faction leader.",
            success=True,
            actor_id=actor.id,
            target_agent_id=target.id,
            faction_id=actor.faction_id,
        )

    def _record_event(self, event: SimulationEvent) -> None:
        if event.actor_id is not None:
            self.memory_store.add_event(event.actor_id, event.description)
            actor = self.world.agents.get(event.actor_id)
            if actor is not None:
                self.culture_store.observe_outcome(actor.faction_id, event.description, event.success)
        if event.target_agent_id is not None:
            self.memory_store.add_event(event.target_agent_id, event.description)
            target = self.world.agents.get(event.target_agent_id)
            if target is not None:
                self.culture_store.observe_outcome(target.faction_id, event.description, event.success)
        if event.kind == "COMMUNICATION":
            target_faction_id = event.metadata.get("target_faction_id") if isinstance(event.metadata, dict) else None
            for agent in self.world.agents.values():
                if not agent.alive:
                    continue
                if agent.faction_id == event.faction_id or agent.faction_id == target_faction_id:
                    self.memory_store.add_event(agent.id, event.description)

    def _update_worldbox_state(self, tick_events: list[SimulationEvent]) -> list[SimulationEvent]:
        produced: list[SimulationEvent] = []
        self._refresh_population_and_cities()
        produced.extend(self._step_animals())
        if self.world.tick % 6 == 0:
            produced.extend(self._maybe_found_cities())
        produced.extend(self._refresh_battles(tick_events + produced))
        return produced

    def _refresh_population_and_cities(self) -> None:
        for city in self.world.cities.values():
            city.population = 0
        for kingdom in self.world.kingdoms.values():
            kingdom.population = 0
            kingdom.city_ids = []
        for city in self.world.cities.values():
            kingdom = self.world.kingdoms.get(city.kingdom_id)
            if kingdom is not None:
                kingdom.city_ids.append(city.id)
        for agent in self.world.agents.values():
            if not agent.alive:
                continue
            kingdom = self.world.kingdoms.get(agent.faction_id)
            if kingdom is not None:
                kingdom.population += 1
                if kingdom.leader_id is None and agent.role == "leader":
                    kingdom.leader_id = agent.id
            if agent.home_city_id and agent.home_city_id in self.world.cities:
                self.world.cities[agent.home_city_id].population += 1
            else:
                city = self._nearest_city(agent.x, agent.y, agent.faction_id)
                if city is not None:
                    agent.home_city_id = city.id
                    city.population += 1
        for kingdom in self.world.kingdoms.values():
            if kingdom.capital_city_id is None and kingdom.city_ids:
                kingdom.capital_city_id = kingdom.city_ids[0]
            if kingdom.id in self.world.factions:
                self.world.factions[kingdom.id].leader_id = kingdom.leader_id
                self.world.factions[kingdom.id].capital_settlement_id = kingdom.capital_city_id

    def _maybe_found_cities(self) -> list[SimulationEvent]:
        produced: list[SimulationEvent] = []
        growth_pressure = max(1, self.config.kingdom_growth_intensity // 20)
        next_city_index = len(self.world.cities) + 1
        next_structure_index = len(self.world.structures) + 1
        for kingdom in self.world.kingdoms.values():
            if kingdom.population < (10 + (len(kingdom.city_ids) * 8)):
                continue
            if len(kingdom.city_ids) >= growth_pressure + 1:
                continue
            candidate = self._best_city_site(kingdom.id)
            if candidate is None:
                continue
            x, y = candidate
            city_id = f"{kingdom.id}-city-{next_city_index:02d}"
            next_city_index += 1
            city = self.world.cities[city_id] = self._create_city_state(city_id, kingdom.id, x, y)
            kingdom.city_ids.append(city_id)
            if kingdom.capital_city_id is None:
                kingdom.capital_city_id = city_id
            self.world.settlements.append(
                {
                    "id": city.id,
                    "name": city.name,
                    "kind": "frontier",
                    "x": city.x,
                    "y": city.y,
                    "owner_faction": kingdom.id,
                    "region_id": self.world.get_tile(city.x, city.y).region_id,
                    "footprint": [dict(item) for item in city.footprint],
                }
            )
            for segment in city.footprint:
                structure_id = f"{city_id}-structure-{next_structure_index:02d}"
                next_structure_index += 1
                self.world.structures[structure_id] = self._create_structure_state(
                    structure_id,
                    kingdom.id,
                    city.id,
                    int(segment["x"]),
                    int(segment["y"]),
                    str(segment.get("district_kind", "district")),
                )
                tile = self.world.get_tile(int(segment["x"]), int(segment["y"]))
                tile.owner_faction = kingdom.id
                tile.settlement_id = city.id
                tile.feature = "district" if not segment.get("is_core") else "settlement"
            produced.append(
                self._event(
                    kind="CITY_FOUNDED",
                    description=f"{kingdom.name} founded {city.name}.",
                    success=True,
                    faction_id=kingdom.id,
                    metadata={"city_id": city.id, "x": city.x, "y": city.y},
                )
            )
        return produced

    def _best_city_site(self, kingdom_id: str) -> tuple[int, int] | None:
        owned_tiles: list[tuple[int, int, int]] = []
        existing = {(city.x, city.y) for city in self.world.cities.values() if city.kingdom_id == kingdom_id}
        for y, row in enumerate(self.world.tiles):
            for x, tile in enumerate(row):
                if tile.owner_faction != kingdom_id or tile.terrain == TileType.WATER or not tile.passable:
                    continue
                if (x, y) in existing:
                    continue
                if any(abs(city_x - x) + abs(city_y - y) < 8 for city_x, city_y in existing):
                    continue
                owned_tiles.append((tile.city_score, x, y))
        if not owned_tiles:
            return None
        owned_tiles.sort(reverse=True)
        _, x, y = owned_tiles[0]
        return x, y

    def _create_city_state(self, city_id: str, kingdom_id: str, x: int, y: int):
        kingdom = self.world.kingdoms[kingdom_id]
        footprint = [
            {"x": x, "y": y, "district_kind": "core", "is_core": True},
            {"x": x + 1 if x + 1 < self.world.width else x - 1, "y": y, "district_kind": "ward", "is_core": False},
            {"x": x, "y": y + 1 if y + 1 < self.world.height else y - 1, "district_kind": "farm", "is_core": False},
        ]
        from gridnomad.core.models import CityState

        return CityState(
            id=city_id,
            name=f"{kingdom.name} Hold {len(kingdom.city_ids) + 1}",
            kingdom_id=kingdom_id,
            race_kind=kingdom.race_kind,
            x=x,
            y=y,
            population=0,
            level=1,
            footprint=footprint,
            district_kinds=[str(item["district_kind"]) for item in footprint],
        )

    def _create_structure_state(self, structure_id: str, kingdom_id: str, city_id: str, x: int, y: int, kind: str):
        from gridnomad.core.models import StructureState

        return StructureState(
            id=structure_id,
            kind=kind,
            x=x,
            y=y,
            kingdom_id=kingdom_id,
            city_id=city_id,
            integrity=10,
        )

    def _step_animals(self) -> list[SimulationEvent]:
        produced: list[SimulationEvent] = []
        newborns: list[AnimalUnitState] = []
        next_index = len(self.world.animals) + 1
        for animal in sorted(self.world.animals.values(), key=lambda item: item.id):
            if not animal.alive:
                continue
            animal.hunger = min(10, animal.hunger + 1)
            if animal.kind in {"predator", "apex"}:
                target = self._nearest_human(animal.x, animal.y, radius=2)
                if target is not None and abs(target.x - animal.x) + abs(target.y - animal.y) <= 1:
                    target.health = max(0, target.health - (3 if animal.kind == "apex" else 1))
                    animal.hunger = max(0, animal.hunger - 3)
                    produced.append(
                        self._event(
                            kind="FAUNA_ATTACK",
                            description=f"{animal.name} attacked {target.name}.",
                            success=True,
                            actor_id=target.id,
                            faction_id=target.faction_id,
                            metadata={"animal_id": animal.id, "species": animal.species},
                        )
                    )
                    if target.health == 0:
                        target.alive = False
                        produced.append(
                            self._event(
                                kind="DEATH",
                                description=f"{target.name} was killed by {animal.name}.",
                                success=False,
                                actor_id=target.id,
                                faction_id=target.faction_id,
                                metadata={"animal_id": animal.id},
                            )
                        )
                    continue
                self._move_animal_toward(
                    animal,
                    None if target is None else target.x,
                    None if target is None else target.y,
                )
            else:
                tile = self.world.get_tile(animal.x, animal.y)
                if tile.fertility >= 45 or tile.resource == "food":
                    animal.hunger = max(0, animal.hunger - 2)
                self._wander_animal(animal)
                if animal.hunger <= 3 and self.world.tick % 9 == 0 and next_index % 2 == 0:
                    spawn = self._adjacent_open_tile(animal.x, animal.y)
                    if spawn is not None:
                        newborns.append(
                            AnimalUnitState(
                                id=f"{animal.species}-{next_index:04d}",
                                species=animal.species,
                                name=animal.name,
                                kind=animal.kind,
                                x=spawn[0],
                                y=spawn[1],
                                hunger=4,
                                energy=6,
                            )
                        )
                        next_index += 1
            if animal.hunger >= 10:
                animal.alive = False
                produced.append(
                    self._event(
                        kind="FAUNA_DEATH",
                        description=f"{animal.name} succumbed to hunger.",
                        success=False,
                        metadata={"animal_id": animal.id, "species": animal.species},
                    )
                )
        for animal in newborns:
            self.world.animals[animal.id] = animal
            produced.append(
                self._event(
                    kind="FAUNA_BIRTH",
                    description=f"A new {animal.species} was born in the wild.",
                    success=True,
                    metadata={"animal_id": animal.id, "species": animal.species, "x": animal.x, "y": animal.y},
                )
            )
        self.world.fauna_events.extend([event.to_dict() for event in produced if event.kind.startswith("FAUNA_")])
        return produced

    def _nearest_human(self, x: int, y: int, radius: int) -> AgentState | None:
        candidates = [
            agent
            for agent in self.world.agents.values()
            if agent.alive and abs(agent.x - x) + abs(agent.y - y) <= radius
        ]
        if not candidates:
            return None
        return min(candidates, key=lambda item: (abs(item.x - x) + abs(item.y - y), item.id))

    def _move_animal_toward(self, animal: AnimalUnitState, target_x: int | None, target_y: int | None) -> None:
        if target_x is None or target_y is None:
            self._wander_animal(animal)
            return
        options = []
        for dx, dy in MOVE_DELTAS.values():
            nx = animal.x + dx
            ny = animal.y + dy
            if not self.world.in_bounds(nx, ny):
                continue
            tile = self.world.get_tile(nx, ny)
            if not tile.passable or self.world.position_occupied(nx, ny):
                continue
            options.append((abs(target_x - nx) + abs(target_y - ny), nx, ny))
        if not options:
            return
        _, animal.x, animal.y = min(options)

    def _wander_animal(self, animal: AnimalUnitState) -> None:
        options = []
        for dx, dy in MOVE_DELTAS.values():
            nx = animal.x + dx
            ny = animal.y + dy
            if not self.world.in_bounds(nx, ny):
                continue
            tile = self.world.get_tile(nx, ny)
            if not tile.passable or self.world.position_occupied(nx, ny):
                continue
            options.append((tile.fertility, self.rng.random(), nx, ny))
        if not options:
            return
        options.sort(reverse=True)
        _, _, animal.x, animal.y = options[0]

    def _adjacent_open_tile(self, x: int, y: int) -> tuple[int, int] | None:
        for dx, dy in MOVE_DELTAS.values():
            nx = x + dx
            ny = y + dy
            if not self.world.in_bounds(nx, ny):
                continue
            tile = self.world.get_tile(nx, ny)
            if tile.passable and not self.world.position_occupied(nx, ny):
                return nx, ny
        return None

    def _refresh_battles(self, events: list[SimulationEvent]) -> list[SimulationEvent]:
        produced: list[SimulationEvent] = []
        next_battles: dict[str, BattleState] = {}
        for event in events:
            if event.kind != "ATTACK" or not event.success or event.actor_id is None or event.target_agent_id is None:
                continue
            attacker = self.world.agents.get(event.actor_id)
            defender = self.world.agents.get(event.target_agent_id)
            if attacker is None or defender is None or attacker.faction_id == defender.faction_id:
                continue
            battle_id = f"battle-{min(attacker.id, defender.id)}-{max(attacker.id, defender.id)}"
            next_battles[battle_id] = BattleState(
                id=battle_id,
                x=defender.x,
                y=defender.y,
                attacker_kingdom_id=attacker.faction_id,
                defender_kingdom_id=defender.faction_id,
                intensity=4,
                tick_started=self.world.tick,
            )
        for battle in self.world.battles.values():
            if self.world.tick - battle.tick_started <= 2:
                battle.intensity = max(1, battle.intensity - 1)
                next_battles[battle.id] = battle
        self.world.battles = next_battles
        if next_battles:
            produced.append(
                self._event(
                    kind="BATTLE_UPDATE",
                    description=f"{len(next_battles)} battle zone(s) are active.",
                    success=True,
                    metadata={"battle_count": len(next_battles)},
                )
            )
        return produced

    def _nearest_city(self, x: int, y: int, kingdom_id: str):
        cities = [city for city in self.world.cities.values() if city.kingdom_id == kingdom_id]
        if not cities:
            return None
        return min(cities, key=lambda item: (abs(item.x - x) + abs(item.y - y), item.id))

    def _event(
        self,
        *,
        kind: str,
        description: str,
        success: bool,
        actor_id: str | None = None,
        target_agent_id: str | None = None,
        faction_id: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> SimulationEvent:
        return SimulationEvent(
            tick=self.world.tick,
            kind=kind,
            description=description,
            success=success,
            actor_id=actor_id,
            target_agent_id=target_agent_id,
            faction_id=faction_id,
            metadata={} if metadata is None else dict(metadata),
        )

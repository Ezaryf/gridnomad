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
    CommunicationMessage,
    DecisionPayload,
    Emotions,
    EngineAction,
    Inventory,
    Needs,
    SimulationConfig,
    SimulationEvent,
    TileState,
    TileType,
    WorldState,
)
from gridnomad.core.perception import build_perception


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
        self.culture_store = culture_store or CultureStore(
        )
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
            decision = self._reason_for_agent(agent, perception, recent_events, memories, recent_messages)

            agent.emotions = decision.updated_emotions
            agent.needs = decision.updated_needs
            agent.current_intent = decision.intent or decision.reason
            agent.last_speech = decision.speech.strip()
            agent.last_thought = decision.thought.strip()
            agent.last_reasoned_tick = self.world.tick
            agent.last_perception_signature = perception.signature

            if self.registry.is_known(decision.action):
                agent.last_intent = decision.to_intent()

            tick_events.append(
                self._event(
                    kind="INTENT",
                    description=f"{agent.name} intends to {agent.current_intent}",
                    success=True,
                    actor_id=agent.id,
                    faction_id=agent.faction_id,
                    metadata={"intent": agent.current_intent, "primitive": decision.action},
                )
            )

            if agent.last_speech:
                tick_events.append(
                    self._event(
                        kind="SPEECH",
                        description=f'{agent.name} says: "{agent.last_speech}"',
                        success=True,
                        actor_id=agent.id,
                        faction_id=agent.faction_id,
                    )
                )

            action = self.registry.resolve(decision, self.world, agent)
            tick_events.extend(self._apply_action(action, decision))

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
                        description=f"{agent.name} proposed cultural element {decision.cultural_innovation.element}.",
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

        for event in tick_events:
            self._record_event(event)
        self.events.extend(tick_events)
        return tick_events

    def snapshot(self) -> dict[str, object]:
        return {
            "tick": self.world.tick,
            "config": self.config.to_dict(),
            "world": self.world.to_dict(),
            "culture": self.culture_store.to_dict(),
        }

    def evaluate_salience(
        self,
        agent: AgentState,
        perception,
        recent_events: list[str],
        recent_messages: dict[str, list[str]] | None = None,
    ) -> SalienceDecision:
        reasons: list[str] = ["full_ai_mode"]
        if agent.needs.any_at_or_above(7):
            reasons.append("urgent_need")
        if perception.signature != agent.last_perception_signature:
            reasons.append("new_context")
        if recent_messages and (recent_messages.get("civilization") or recent_messages.get("diplomacy")):
            reasons.append("new_message")
        if self.world.tick - agent.last_reasoned_tick >= self.config.reason_interval:
            reasons.append("reason_interval")
        return SalienceDecision(should_reason=True, reasons=reasons)

    def write_events(self, output_dir: str | Path) -> None:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        lines = [json.dumps(event.to_dict(), sort_keys=True) for event in self.events]
        (out / "events.jsonl").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    def _reason_for_agent(
        self,
        agent: AgentState,
        perception,
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
            return f"{sender_name} to {message.sender_faction_id} group: {message.text}"
        target = message.target_faction_id or "unknown group"
        return f"{sender_name} to {target}: {message.text}"

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
                    intent="move to a nearby safe tile and keep going",
                    speech="",
                    updated_emotions=agent.emotions,
                    updated_needs=agent.needs,
                    thought=f"{dominant} at {intensity}: {reason}",
                )
        dominant, intensity = agent.emotions.dominant()
        return DecisionPayload(
            action="REST",
            target_x=agent.x,
            target_y=agent.y,
            reason=reason,
            intent="hold position and recover while waiting for a safer option",
            speech="",
            updated_emotions=agent.emotions,
            updated_needs=agent.needs,
            thought=f"{dominant} at {intensity}: Holding position because no safe tile is open.",
        )

    def _world_decay_update(self) -> list[SimulationEvent]:
        events: list[SimulationEvent] = []
        for agent in sorted(self.world.agents.values(), key=lambda item: item.id):
            if not agent.alive:
                continue

            agent.age_ticks += 1

            if self.world.tick % 6 == 0:
                agent.needs.survival = min(10, agent.needs.survival + 1)
            if self.world.tick % 9 == 0:
                agent.needs.belonging = min(10, agent.needs.belonging + 1)
            if self.world.tick % 10 == 0:
                agent.needs.self_actualization = min(10, agent.needs.self_actualization + 1)

            current_tile = self.world.get_tile(agent.x, agent.y)
            if current_tile.terrain == TileType.HOUSE:
                agent.needs.safety = max(0, agent.needs.safety - 1)
            elif self.world.tick % 8 == 0:
                agent.needs.safety = min(10, agent.needs.safety + 1)

            if agent.needs.survival >= 10:
                agent.critical_survival_ticks += 1
            else:
                agent.critical_survival_ticks = max(0, agent.critical_survival_ticks - 1)

            if self.world.tick < 40 or agent.critical_survival_ticks < 6:
                continue

            agent.health = max(0, agent.health - 1)
            if agent.health == 0:
                agent.alive = False
                events.append(
                    self._event(
                        kind="DEATH",
                        description=f"{agent.name} died after prolonged critical neglect.",
                        success=False,
                        actor_id=agent.id,
                        faction_id=agent.faction_id,
                    )
                )
        return events

    def _apply_action(self, action: EngineAction, decision: DecisionPayload) -> list[SimulationEvent]:
        actor = self.world.agents[action.actor_id]
        if not actor.alive:
            return [self._event("ACTION_SKIPPED", f"{actor.name} could not act because they are no longer alive.", False, actor.id, faction_id=actor.faction_id)]

        if action.kind == "MOVE":
            return [self._apply_move(actor, action, decision)]
        if action.kind == "REST":
            return [self._apply_rest(actor, decision)]
        if action.kind == "CONSUME":
            return [self._apply_consume(actor, decision)]
        if action.kind == "GATHER":
            return [self._apply_gather(actor, action, decision)]
        if action.kind == "BUILD":
            return [self._apply_build(actor, action, decision)]
        if action.kind == "INTERACT":
            return [self._apply_interact(actor, action, decision)]
        if action.kind == "TRANSFER":
            return [self._apply_transfer(actor, action, decision)]
        if action.kind == "COMMUNICATE":
            actor.last_action_success = True
            return [self._event("COMMUNICATE", f"{actor.name} focused on communication.", True, actor.id, faction_id=actor.faction_id, metadata={"intent": decision.intent})]
        actor.last_action_success = False
        return [self._event("NO_OP", f"{actor.name} did not execute a concrete world action.", False, actor.id, faction_id=actor.faction_id, metadata=action.metadata)]

    def _apply_move(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        if action.target_x is None or action.target_y is None or not self.world.in_bounds(action.target_x, action.target_y):
            actor.last_action_success = False
            return self._event("MOVE", f"{actor.name} could not find a valid path.", False, actor.id, faction_id=actor.faction_id)
        tile = self.world.get_tile(action.target_x, action.target_y)
        if not tile.passable or self.world.position_occupied(action.target_x, action.target_y, exclude_agent_id=actor.id):
            actor.last_action_success = False
            return self._event("MOVE", f"{actor.name} tried to move into a blocked tile.", False, actor.id, faction_id=actor.faction_id)
        actor.x = action.target_x
        actor.y = action.target_y
        actor.last_action_success = True
        return self._event("MOVE", f"{actor.name} moved while trying to {decision.intent or decision.reason}.", True, actor.id, faction_id=actor.faction_id, metadata={"target_x": actor.x, "target_y": actor.y})

    def _apply_rest(self, actor: AgentState, decision: DecisionPayload) -> SimulationEvent:
        actor.needs.safety = max(0, actor.needs.safety - 1)
        actor.needs.survival = max(0, actor.needs.survival - 1)
        actor.last_action_success = True
        return self._event("REST", f"{actor.name} rested to recover.", True, actor.id, faction_id=actor.faction_id, metadata={"intent": decision.intent})

    def _apply_consume(self, actor: AgentState, decision: DecisionPayload) -> SimulationEvent:
        if actor.inventory.food <= 0:
            actor.last_action_success = False
            return self._event("CONSUME", f"{actor.name} tried to eat but had no food.", False, actor.id, faction_id=actor.faction_id)
        actor.inventory.food -= 1
        actor.needs.survival = max(0, actor.needs.survival - 3)
        actor.health = min(10, actor.health + 1)
        actor.critical_survival_ticks = max(0, actor.critical_survival_ticks - 2)
        actor.last_action_success = True
        return self._event("CONSUME", f"{actor.name} ate food and stabilized.", True, actor.id, faction_id=actor.faction_id, metadata={"intent": decision.intent})

    def _apply_gather(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        tile = self._target_or_current_tile(actor, action)
        inventory = actor.inventory
        gathered = None
        amount = 1
        if tile.resource in {"berries", "fish", "fruit"} or tile.biome in {"grassland", "meadow", "fertile-plains", "coast"}:
            inventory.food += amount
            actor.needs.survival = max(0, actor.needs.survival - 1)
            gathered = "food"
        elif tile.biome in {"forest", "jungle", "grove"} or tile.feature == "forest":
            inventory.wood += amount
            gathered = "wood"
        elif tile.biome in {"mountain", "alpine", "crystal", "highland"} or tile.feature == "mountain":
            inventory.stone += amount
            gathered = "stone"

        if gathered is None:
            actor.last_action_success = False
            return self._event("GATHER", f"{actor.name} searched the area but found nothing useful.", False, actor.id, faction_id=actor.faction_id)

        actor.last_action_success = True
        return self._event("GATHER", f"{actor.name} gathered {gathered}.", True, actor.id, faction_id=actor.faction_id, metadata={"resource": gathered, "intent": decision.intent})

    def _apply_build(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        tile = self._target_or_current_tile(actor, action)
        if actor.inventory.wood < 2 or actor.inventory.stone < 1 or not tile.buildable:
            actor.last_action_success = False
            return self._event("BUILD", f"{actor.name} could not build anything useful here.", False, actor.id, faction_id=actor.faction_id)
        actor.inventory.wood -= 2
        actor.inventory.stone -= 1
        tile.terrain = TileType.HOUSE
        tile.feature = "shelter"
        tile.owner_faction = actor.faction_id
        actor.needs.safety = max(0, actor.needs.safety - 2)
        actor.last_action_success = True
        return self._event("BUILD", f"{actor.name} built a small shelter.", True, actor.id, faction_id=actor.faction_id, metadata={"intent": decision.intent, "x": action.target_x, "y": action.target_y})

    def _apply_interact(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        target = None if action.target_agent_id is None else self.world.agents.get(action.target_agent_id)
        if target is None or not target.alive or abs(target.x - actor.x) + abs(target.y - actor.y) > 1:
            actor.last_action_success = False
            return self._event("INTERACT", f"{actor.name} could not find anyone close enough to interact with.", False, actor.id, faction_id=actor.faction_id)
        actor.needs.belonging = max(0, actor.needs.belonging - 2)
        target.needs.belonging = max(0, target.needs.belonging - 1)
        actor.last_action_success = True
        return self._event("INTERACT", f"{actor.name} spent time with {target.name}.", True, actor.id, target_agent_id=target.id, faction_id=actor.faction_id, metadata={"intent": decision.intent})

    def _apply_transfer(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        target = None if action.target_agent_id is None else self.world.agents.get(action.target_agent_id)
        if target is None or not target.alive or abs(target.x - actor.x) + abs(target.y - actor.y) > 1:
            actor.last_action_success = False
            return self._event("TRANSFER", f"{actor.name} had no nearby person to share with.", False, actor.id, faction_id=actor.faction_id)
        resource, amount = actor.inventory.most_abundant()
        if amount <= 0:
            actor.last_action_success = False
            return self._event("TRANSFER", f"{actor.name} had nothing to share.", False, actor.id, target_agent_id=target.id, faction_id=actor.faction_id)
        setattr(actor.inventory, resource, getattr(actor.inventory, resource) - 1)
        setattr(target.inventory, resource, getattr(target.inventory, resource) + 1)
        actor.needs.belonging = max(0, actor.needs.belonging - 1)
        actor.last_action_success = True
        return self._event("TRANSFER", f"{actor.name} shared {resource} with {target.name}.", True, actor.id, target_agent_id=target.id, faction_id=actor.faction_id, metadata={"resource": resource, "intent": decision.intent})

    def _target_or_current_tile(self, actor: AgentState, action: EngineAction) -> TileState:
        target_x = actor.x if action.target_x is None else action.target_x
        target_y = actor.y if action.target_y is None else action.target_y
        if not self.world.in_bounds(target_x, target_y):
            target_x, target_y = actor.x, actor.y
        return self.world.get_tile(target_x, target_y)

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

    def _event(
        self,
        kind: str,
        description: str,
        success: bool,
        actor_id: str | None = None,
        target_agent_id: str | None = None,
        faction_id: str | None = None,
        metadata: dict | None = None,
    ) -> SimulationEvent:
        return SimulationEvent(
            tick=self.world.tick,
            kind=kind,
            description=description,
            success=success,
            actor_id=actor_id,
            target_agent_id=target_agent_id,
            faction_id=faction_id,
            metadata=metadata or {},
        )

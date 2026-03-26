from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import json
import random
from dataclasses import dataclass
from pathlib import Path

from gridnomad.ai.adapters import AgentContext, LLMAdapter, build_agent_context, parse_decision_payload
from gridnomad.ai.cognition import CognitionAdapter
from gridnomad.ai.civilizations import ProviderDecisionError
from gridnomad.ai.personality_weights import get_action_modifier
from gridnomad.core.actions import ActionRegistry, MODEL_ACTIONS, MOVE_DELTAS
from gridnomad.core.culture import CultureStore
from gridnomad.core.memory import MemoryStore
from gridnomad.core.models import (
    AgentState,
    BigFivePersonality,
    CommunicationMessage,
    DecisionPayload,
    Emotions,
    EngineAction,
    Inventory,
    Needs,
    SimulationConfig,
    SimulationEvent,
    StructureState,
    TileState,
    TileType,
    WorldState,
)
from gridnomad.core.perception import build_perception

NEWBORN_NAME_POOL = [
    "Ada", "Milo", "Nora", "Jae", "Lina", "Oren", "Tala", "Bram", "Iris", "Soren",
    "Kaia", "Mina", "Rian", "Cleo", "Vera", "Pax", "Mara", "Arlo", "Noel", "Yuna",
]
NEWBORN_SURNAME_POOL = [
    "Vale", "Rowan", "Morrow", "Pine", "Reed", "Hollow", "Frost", "Brook", "Dawn", "Sable", "Field", "Hart",
]
PERSONA_TONE_POOL = [
    "steady and practical under pressure",
    "curious about the unknown nearby",
    "protective of people who seem vulnerable",
    "quietly observant before acting",
    "optimistic about building something useful",
    "careful with risk and sudden conflict",
]
SOCIAL_STYLE_POOL = ["supportive", "reserved", "assertive", "cooperative", "watchful", "encouraging"]
RESOURCE_BIAS_POOL = ["food", "wood", "stone", "water", "shelter", "information"]
STARTING_DRIVE_POOL = [
    "Scout the nearby terrain and report back.",
    "Stay close to others and keep the group coordinated.",
    "Look for food or water before needs become urgent.",
    "Search for materials that could make a safer resting place.",
    "Check on anyone who seems isolated or overwhelmed.",
    "Observe first, then move once the situation is clearer.",
]
BOND_THRESHOLD = 3
REPRODUCTION_COOLDOWN_TICKS = 48
GESTATION_TICKS = 24


@dataclass(slots=True)
class SalienceDecision:
    should_reason: bool
    reasons: list[str]


@dataclass(slots=True)
class AgentDecisionFrame:
    agent: AgentState
    perception: object
    decision: DecisionPayload


@dataclass(slots=True)
class SimulationAbortError(RuntimeError):
    message: str
    actor_id: str | None = None
    faction_id: str | None = None
    provider: str | None = None
    model: str | None = None
    reason: str = "simulation_error"

    def __str__(self) -> str:
        return self.message


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
        self.cognition = CognitionAdapter(adapter=adapter)
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
        step_time_ms = self.current_time_ms
        tick_events: list[SimulationEvent] = []
        tick_events.extend(self._world_decay_update())

        decision_frames = self._collect_decisions()

        for frame in decision_frames:
            agent = frame.agent
            perception = frame.perception
            decision = frame.decision

            agent.emotions = decision.updated_emotions
            agent.needs = decision.updated_needs
            agent.current_intent = decision.intent or decision.reason
            agent.last_speech = decision.speech.strip()
            agent.last_thought = decision.thought.strip()
            agent.last_reasoned_tick = self.world.tick
            agent.last_perception_signature = perception.signature

            if self.registry.is_known(decision.action):
                agent.last_intent = decision.to_intent()

            action = self.registry.resolve(decision, self.world, agent)
            self._prime_task(agent, action, decision, step_time_ms=step_time_ms)

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

            action_events = self._apply_action(action, decision)
            tick_events.extend(action_events)
            agent.render_x = float(agent.x)
            agent.render_y = float(agent.y)
            self._update_agent_step_memory(agent, decision, action, action_events)

            if decision.thought.strip():
                node = self.memory_store.add_memory(agent.id, "thought", decision.thought.strip(), self.world.tick)
                if node: agent.accumulated_importance += node.importance

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

    @property
    def current_time_ms(self) -> int:
        return self.world.tick * self.config.microstep_interval_ms

    def _collect_decisions(self) -> list[AgentDecisionFrame]:
        active_agents = [agent for agent in sorted(self.world.agents.values(), key=lambda item: item.id) if agent.alive]
        if not active_agents:
            return []

        inputs = [self._build_decision_input(agent) for agent in active_agents]
        if hasattr(self.adapter, "decide_many"):
            contexts = [context for _, _, context in inputs]
            try:
                raw_map = self.adapter.decide_many(contexts)
            except ProviderDecisionError as exc:
                raise SimulationAbortError(
                    message=f"A group controller could not get a decision from {exc.provider}: {exc.message}",
                    faction_id=exc.faction_id,
                    provider=exc.provider,
                    model=exc.model,
                    reason="provider_failure",
                ) from exc
            return [
                self._resolve_raw_decision(agent, perception, raw_map[agent.id])
                for agent, perception, _ in inputs
            ]
        max_workers = min(8, len(inputs))
        if max_workers <= 1:
            return [self._resolve_decision_input(item) for item in inputs]

        with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="gridnomad-reason") as executor:
            return list(executor.map(self._resolve_decision_input, inputs))

    def _build_decision_input(self, agent: AgentState) -> tuple[AgentState, object, AgentContext]:
        perception = build_perception(self.world, agent, self.config.perception_radius)
        
        # Contextual retrieval based on current situation and plans
        query_str = f"{perception.signature} {agent.current_intent} {agent.daily_plan}"
        retrieved_nodes = self.memory_store.retrieve(agent.id, query_str, self.world.tick, limit=8)
        recent_events = [n.content for n in retrieved_nodes if n.type == "event"]
        memories = [n.content for n in retrieved_nodes if n.type != "event"]
        
        recent_messages = self._recent_messages_for_agent(agent)
        group_context = self._group_context_for_agent(agent)
        context = build_agent_context(
            self.world.tick,
            agent,
            self.world,
            perception,
            recent_events,
            memories,
            recent_messages,
            self.culture_store.summarize(agent.faction_id),
            group_context,
        )
        return agent, perception, context

    def _group_context_for_agent(self, agent: AgentState) -> str:
        group_agents = [
            other
            for other in self.world.agents.values()
            if other.faction_id == agent.faction_id and other.alive
        ]
        if not group_agents:
            return "You are effectively alone right now."
        total_food = sum(other.inventory.food for other in group_agents)
        total_wood = sum(other.inventory.wood for other in group_agents)
        total_stone = sum(other.inventory.stone for other in group_agents)
        avg_survival = round(sum(other.needs.survival for other in group_agents) / len(group_agents), 1)
        avg_safety = round(sum(other.needs.safety for other in group_agents) / len(group_agents), 1)
        avg_belonging = round(sum(other.needs.belonging for other in group_agents) / len(group_agents), 1)
        homes = [
            structure
            for structure in self.world.structures.values()
            if structure.owner_faction_id == agent.faction_id and structure.kind == "home"
        ]
        bridges = [
            structure
            for structure in self.world.structures.values()
            if structure.owner_faction_id == agent.faction_id and structure.kind == "bridge"
        ]
        armed = sum(1 for other in group_agents if other.weapon_kind)
        pregnant = sum(1 for other in group_agents if other.pregnancy_ticks_remaining > 0)
        starving = sum(1 for other in group_agents if other.needs.survival >= 6)
        wounded = sum(1 for other in group_agents if other.health <= 5)
        return (
            f"Alive humans in group: {len(group_agents)}. "
            f"Shared carried resources are food={total_food}, wood={total_wood}, stone={total_stone}. "
            f"Average pressure is survival={avg_survival}, safety={avg_safety}, belonging={avg_belonging}. "
            f"The group currently has {len(homes)} home(s), {len(bridges)} bridge(s), {armed} armed human(s), "
            f"{pregnant} pregnancy/pending birth state(s), {starving} human(s) with urgent survival pressure, and {wounded} wounded human(s)."
        )

    def _resolve_decision_input(self, item: tuple[AgentState, object, AgentContext]) -> AgentDecisionFrame:
        agent, perception, context = item
        
        # Stanford Memory Stream: Planning Layer
        time_of_day_interval = max(1, round(15000 / self.config.microstep_interval_ms))
        if self.world.tick % time_of_day_interval == 0 or not agent.daily_plan:
            if self.world.tick - agent.last_planned_tick >= time_of_day_interval * 24 or not agent.daily_plan:
                try:
                    plan = self.cognition.generate_daily_plan(agent, self.memory_store, self.world, self.world.tick)
                    if plan:
                        agent.daily_plan = plan
                        node = self.memory_store.add_memory(agent.id, "plan", f"Plan for the day: {plan}", self.world.tick)
                        if node: agent.accumulated_importance += node.importance
                        agent.last_planned_tick = self.world.tick
                except Exception:
                    pass

        # Stanford Memory Stream: Reflection Layer
        if agent.accumulated_importance >= agent.reflection_threshold:
            try:
                insights = self.cognition.generate_reflection(agent, self.memory_store, self.world, self.world.tick)
                for insight in insights:
                    node = self.memory_store.add_memory(agent.id, "reflection", insight, self.world.tick)
                agent.accumulated_importance = 0
                agent.reflection_threshold = min(150, agent.reflection_threshold + 5)
            except Exception:
                pass

        try:
            raw = self.adapter.decide(context)
        except ProviderDecisionError as exc:
            raise SimulationAbortError(
                message=f"{agent.name} could not get a decision from {exc.provider}: {exc.message}",
                actor_id=agent.id,
                faction_id=agent.faction_id,
                provider=exc.provider,
                model=exc.model,
                reason="provider_failure",
            ) from exc
        return self._resolve_raw_decision(agent, perception, raw)

    def _resolve_raw_decision(self, agent: AgentState, perception, raw) -> AgentDecisionFrame:
        try:
            decision = parse_decision_payload(raw)
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            raise SimulationAbortError(
                message=f"{agent.name} returned invalid decision JSON: {exc}",
                actor_id=agent.id,
                faction_id=agent.faction_id,
                reason="invalid_model_response",
            ) from exc
        self._validate_decision(agent, decision)
        decision.updated_emotions = Emotions.from_dict(decision.updated_emotions.to_dict(), clamp=True)
        decision.updated_needs = Needs.from_dict(decision.updated_needs.to_dict(), clamp=True)
        return AgentDecisionFrame(agent=agent, perception=perception, decision=decision)

    def _validate_decision(self, agent: AgentState, decision: DecisionPayload) -> None:
        if decision.action not in MODEL_ACTIONS and decision.action_proposal is None:
            raise SimulationAbortError(
                message=f"{agent.name} proposed unsupported action {decision.action!r}.",
                actor_id=agent.id,
                faction_id=agent.faction_id,
                reason="unsupported_action",
            )
        if decision.action == "MOVE":
            raise SimulationAbortError(
                message=f"{agent.name} used generic MOVE. Strict mode requires explicit cardinal movement.",
                actor_id=agent.id,
                faction_id=agent.faction_id,
                reason="generic_move_forbidden",
            )
        if decision.action == "GATHER" and not decision.gather_mode:
            raise SimulationAbortError(
                message=f"{agent.name} chose GATHER without gather_mode.",
                actor_id=agent.id,
                faction_id=agent.faction_id,
                reason="gather_mode_required",
            )
        if decision.action == "BUILD" and not decision.build_kind:
            raise SimulationAbortError(
                message=f"{agent.name} chose BUILD without build_kind.",
                actor_id=agent.id,
                faction_id=agent.faction_id,
                reason="build_kind_required",
            )
        if decision.action == "CRAFT" and not decision.craft_kind:
            raise SimulationAbortError(
                message=f"{agent.name} chose CRAFT without craft_kind.",
                actor_id=agent.id,
                faction_id=agent.faction_id,
                reason="craft_kind_required",
            )
        if decision.action in {"ATTACK", "REPRODUCE"} and not decision.target_agent_id:
            raise SimulationAbortError(
                message=f"{agent.name} chose {decision.action} without target_agent_id.",
                actor_id=agent.id,
                faction_id=agent.faction_id,
                reason="target_agent_required",
            )

    def snapshot(self) -> dict[str, object]:
        return {
            "tick": self.world.tick,
            "config": self.config.to_dict(),
            "world": self.world.to_dict(),
            "culture": self.culture_store.to_dict(),
        }

    def build_transition_frames(
        self,
        previous_agents: dict[str, dict[str, object]],
        *,
        frame_index_start: int = 0,
    ) -> list[dict[str, object]]:
        humans: list[dict[str, object]] = []
        for agent in sorted(self.world.agents.values(), key=lambda item: item.id):
            humans.append(
                {
                    "id": agent.id,
                    "x": agent.x,
                    "y": agent.y,
                    "render_x": float(agent.x),
                    "render_y": float(agent.y),
                    "health": agent.health,
                    "food": agent.inventory.food,
                    "wood": agent.inventory.wood,
                    "stone": agent.inventory.stone,
                    "weapon_kind": agent.weapon_kind,
                    "bonded_partner_id": agent.bonded_partner_id,
                    "home_structure_id": agent.home_structure_id,
                    "last_world_action_summary": agent.last_world_action_summary,
                    "state": agent.task_state,
                    "task_progress": agent.task_progress,
                    "target_human_id": agent.interaction_target_id,
                    "target_tile": None
                    if agent.task_target_x is None or agent.task_target_y is None
                    else {"x": agent.task_target_x, "y": agent.task_target_y},
                    "speaking": bool(agent.last_speech and self.current_time_ms <= agent.speaking_until_ms),
                    "alive": agent.alive,
                }
            )
        return [
            {
                "time_ms": self.current_time_ms,
                "frame_index": frame_index_start + 1,
                "decision_beat": self.world.tick,
                "humans": humans,
            }
        ]

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
        _, _, context = self._build_decision_input(agent)
        return self._resolve_decision_input((agent, perception, context)).decision

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
        raise SimulationAbortError(
            message=f"{agent.name} has no fallback decision in strict mode: {reason}",
            actor_id=agent.id,
            faction_id=agent.faction_id,
            reason="fallback_forbidden",
        )

    def _world_decay_update(self) -> list[SimulationEvent]:
        events: list[SimulationEvent] = []
        current_time_ms = self.current_time_ms
        survival_interval = max(1, round(6000 / self.config.microstep_interval_ms))
        belonging_interval = max(1, round(8000 / self.config.microstep_interval_ms))
        self_actualization_interval = max(1, round(10000 / self.config.microstep_interval_ms))
        safety_interval = max(1, round(7000 / self.config.microstep_interval_ms))
        esteem_interval = max(1, round(9000 / self.config.microstep_interval_ms))
        time_of_day_interval = max(1, round(15000 / self.config.microstep_interval_ms))
        weather_interval = max(1, round(30000 / self.config.microstep_interval_ms))

        if self.world.tick % time_of_day_interval == 0:
            self.world.time_of_day = (self.world.time_of_day + 1) % 24
        if self.world.tick % weather_interval == 0 and self.rng.random() < 0.05:
            roll = self.rng.random()
            if roll < 0.60:
                self.world.weather = "clear"
            elif roll < 0.85:
                self.world.weather = "rain"
            elif roll < 0.95:
                self.world.weather = "snow"
            else:
                self.world.weather = "storm"

        for agent in sorted(self.world.agents.values(), key=lambda item: item.id):
            if not agent.alive:
                continue

            agent.age_ticks += 1
            if agent.reproduction_cooldown_ticks > 0:
                agent.reproduction_cooldown_ticks -= 1
            if agent.pregnancy_ticks_remaining > 0:
                agent.pregnancy_ticks_remaining -= 1
            agent.task_state = "idle"
            agent.task_progress = 0
            agent.task_target_x = None
            agent.task_target_y = None
            agent.interaction_target_id = None

            if self.world.tick % survival_interval == 0:
                agent.needs.survival = min(10, agent.needs.survival + 1)
            if self.world.tick % belonging_interval == 0:
                agent.needs.belonging = min(10, agent.needs.belonging + 1)
            if self.world.tick % self_actualization_interval == 0:
                agent.needs.self_actualization = min(10, agent.needs.self_actualization + 1)
            if self.world.tick % esteem_interval == 0:
                agent.needs.esteem = min(10, agent.needs.esteem + 1)

            current_tile = self.world.get_tile(agent.x, agent.y)
            if current_tile.terrain == TileType.HOUSE or current_tile.structure_kind == "home":
                agent.needs.safety = max(0, agent.needs.safety - 1)
            elif self.world.tick % safety_interval == 0:
                agent.needs.safety = min(10, agent.needs.safety + 1)

            if agent.needs.survival >= 10:
                agent.critical_survival_ticks += 1
            else:
                agent.critical_survival_ticks = max(0, agent.critical_survival_ticks - 1)

            hunger_drain_interval = max(1, round(15000 / self.config.microstep_interval_ms))
            if agent.needs.survival >= 8 and agent.inventory.food == 0 and self.world.tick % hunger_drain_interval == 0:
                agent.health = max(0, agent.health - 1)
                if agent.health > 0:
                    events.append(
                        self._event(
                            kind="HUNGER",
                            description=f"{agent.name} is weakening from hunger.",
                            success=False,
                            actor_id=agent.id,
                            faction_id=agent.faction_id,
                        )
                    )

            if agent.pregnancy_ticks_remaining == 0 and agent.pregnancy_partner_id:
                birth_event = self._complete_birth(agent)
                if birth_event is not None:
                    events.append(birth_event)

            if current_time_ms < 90000 or agent.critical_survival_ticks < 48:
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
        if action.kind == "CRAFT":
            return [self._apply_craft(actor, action, decision)]
        if action.kind == "INTERACT":
            return [self._apply_interact(actor, action, decision)]
        if action.kind == "ATTACK":
            return [self._apply_attack(actor, action, decision)]
        if action.kind == "REPRODUCE":
            return [self._apply_reproduce(actor, action, decision)]
        if action.kind == "TRANSFER":
            return [self._apply_transfer(actor, action, decision)]
        if action.kind == "COMMUNICATE":
            return [self._apply_communicate(actor, action, decision)]
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
        if action.target_x is None or action.target_y is None or not self.world.in_bounds(action.target_x, action.target_y):
            actor.last_action_success = False
            return self._event("GATHER", f"{actor.name} could not find a valid gathering tile.", False, actor.id, faction_id=actor.faction_id)
        if abs(action.target_x - actor.x) + abs(action.target_y - actor.y) > 1:
            actor.last_action_success = False
            return self._event("GATHER", f"{actor.name} is too far from the target tile to gather there.", False, actor.id, faction_id=actor.faction_id)

        tile = self.world.get_tile(action.target_x, action.target_y)
        gather_mode = decision.gather_mode or "forage_food"
        if gather_mode == "cut_tree":
            available_wood = tile.wood_stock or (2 if tile.tree_cover > 0 else 0)
            if tile.tree_cover <= 0 and available_wood <= 0:
                actor.last_action_success = False
                return self._event("GATHER", f"{actor.name} tried to cut a tree, but there are no usable trees here.", False, actor.id, faction_id=actor.faction_id)
            yield_amount = 2 if available_wood >= 2 else 1
            actor.inventory.wood += yield_amount
            tile.tree_cover = max(0, tile.tree_cover - 1)
            tile.wood_stock = max(0, available_wood - yield_amount)
            tile.resource_depleted_at = self.world.tick if tile.tree_cover == 0 and tile.wood_stock == 0 else tile.resource_depleted_at
            tile.decal = "pebbles" if tile.tree_cover == 0 else tile.decal
            self._remove_props_at(action.target_x, action.target_y, {"tree-cluster", "grove"})
            self._sync_tile_resources(tile)
            actor.last_action_success = True
            return self._event(
                "GATHER",
                f"{actor.name} cut a tree and gained {yield_amount} wood.",
                True,
                actor.id,
                faction_id=actor.faction_id,
                metadata={"resource": "wood", "amount": yield_amount, "gather_mode": gather_mode, "x": action.target_x, "y": action.target_y, "intent": decision.intent},
            )
        if gather_mode == "quarry_stone":
            available_stone = tile.stone_stock or (1 if tile.feature == "mountain" or tile.biome in {"mountain", "hills", "crystal", "highland"} else 0)
            if available_stone <= 0:
                actor.last_action_success = False
                return self._event("GATHER", f"{actor.name} searched for stone here but found nothing usable.", False, actor.id, faction_id=actor.faction_id)
            actor.inventory.stone += 1
            tile.stone_stock = max(0, available_stone - 1)
            if tile.stone_stock == 0:
                tile.resource_depleted_at = self.world.tick
                self._remove_props_at(action.target_x, action.target_y, {"stone-outcrop"})
            self._sync_tile_resources(tile)
            actor.last_action_success = True
            return self._event(
                "GATHER",
                f"{actor.name} quarried stone from the ground.",
                True,
                actor.id,
                faction_id=actor.faction_id,
                metadata={"resource": "stone", "amount": 1, "gather_mode": gather_mode, "x": action.target_x, "y": action.target_y, "intent": decision.intent},
            )
        if gather_mode == "collect_water":
            if not self._tile_has_water_access(action.target_x, action.target_y):
                actor.last_action_success = False
                return self._event("GATHER", f"{actor.name} tried to collect water where none was reachable.", False, actor.id, faction_id=actor.faction_id)
            actor.needs.survival = max(0, actor.needs.survival - 2)
            actor.needs.safety = max(0, actor.needs.safety - 1)
            actor.last_action_success = True
            return self._event(
                "GATHER",
                f"{actor.name} collected fresh water and steadied themself.",
                True,
                actor.id,
                faction_id=actor.faction_id,
                metadata={"resource": "water", "amount": 1, "gather_mode": gather_mode, "x": action.target_x, "y": action.target_y, "intent": decision.intent},
            )

        available_food = tile.food_stock or (1 if tile.farmable or tile.biome in {"grassland", "meadow", "fertile-plains", "coast"} else 0)
        if available_food <= 0:
            actor.last_action_success = False
            return self._event("GATHER", f"{actor.name} searched the area but found nothing useful to eat.", False, actor.id, faction_id=actor.faction_id)
        actor.inventory.food += 1
        actor.needs.survival = max(0, actor.needs.survival - 1)
        tile.food_stock = max(0, available_food - 1)
        if tile.food_stock == 0:
            tile.resource_depleted_at = self.world.tick
        self._sync_tile_resources(tile)
        actor.last_action_success = True
        return self._event(
            "GATHER",
            f"{actor.name} foraged food from the area.",
            True,
            actor.id,
            faction_id=actor.faction_id,
            metadata={"resource": "food", "amount": 1, "gather_mode": gather_mode, "x": action.target_x, "y": action.target_y, "intent": decision.intent},
        )

    def _apply_build(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        build_kind = decision.build_kind or "home"
        if action.target_x is None or action.target_y is None or not self.world.in_bounds(action.target_x, action.target_y):
            actor.last_action_success = False
            return self._event("BUILD", f"{actor.name} could not find a valid build site.", False, actor.id, faction_id=actor.faction_id)
        distance = abs(action.target_x - actor.x) + abs(action.target_y - actor.y)
        tile = self.world.get_tile(action.target_x, action.target_y)

        if build_kind == "bridge":
            if distance > 1:
                actor.last_action_success = False
                return self._event("BUILD", f"{actor.name} must stand next to the crossing before building a bridge.", False, actor.id, faction_id=actor.faction_id)
            if tile.terrain != TileType.WATER and tile.feature != "river":
                actor.last_action_success = False
                return self._event("BUILD", f"{actor.name} chose a tile that does not need a bridge.", False, actor.id, faction_id=actor.faction_id)
            if actor.inventory.wood < 3 or actor.inventory.stone < 1:
                actor.last_action_success = False
                return self._event("BUILD", f"{actor.name} lacks the materials to build a bridge.", False, actor.id, faction_id=actor.faction_id)
            actor.inventory.wood -= 3
            actor.inventory.stone -= 1
            structure = self._create_structure("bridge", action.target_x, action.target_y, actor, {"wood": 3, "stone": 1})
            tile.terrain = TileType.BRIDGE
            tile.feature = "bridge"
            tile.structure_kind = "bridge"
            tile.structure_id = structure.id
            tile.owner_faction = actor.faction_id
            tile.water_access = True
            tile.decal = None
            self._sync_tile_resources(tile)
            actor.last_action_success = True
            return self._event(
                "BUILD",
                f"{actor.name} built a bridge across the water.",
                True,
                actor.id,
                faction_id=actor.faction_id,
                metadata={"intent": decision.intent, "build_kind": build_kind, "x": action.target_x, "y": action.target_y, "structure_id": structure.id},
            )

        if distance > 0:
            actor.last_action_success = False
            return self._event("BUILD", f"{actor.name} must stand on the build tile to raise a home.", False, actor.id, faction_id=actor.faction_id)
        if actor.inventory.wood < 3 or actor.inventory.stone < 1 or not tile.buildable:
            actor.last_action_success = False
            return self._event("BUILD", f"{actor.name} could not build a home here.", False, actor.id, faction_id=actor.faction_id)
        actor.inventory.wood -= 3
        actor.inventory.stone -= 1
        structure = self._create_structure("home", action.target_x, action.target_y, actor, {"wood": 3, "stone": 1})
        tile.terrain = TileType.HOUSE
        tile.feature = "shelter"
        tile.structure_kind = "home"
        tile.structure_id = structure.id
        tile.owner_faction = actor.faction_id
        tile.decal = None
        self._remove_props_at(action.target_x, action.target_y, {"tree-cluster", "grove", "stone-outcrop"})
        self._sync_tile_resources(tile)
        actor.home_structure_id = structure.id
        actor.needs.safety = max(0, actor.needs.safety - 2)
        actor.last_action_success = True
        return self._event(
            "BUILD",
            f"{actor.name} built a home on the tile.",
            True,
            actor.id,
            faction_id=actor.faction_id,
            metadata={"intent": decision.intent, "build_kind": build_kind, "x": action.target_x, "y": action.target_y, "structure_id": structure.id},
        )

    def _apply_craft(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        craft_kind = decision.craft_kind or "weapon"
        if craft_kind != "weapon":
            actor.last_action_success = False
            return self._event("CRAFT", f"{actor.name} proposed an unsupported craft kind: {craft_kind}.", False, actor.id, faction_id=actor.faction_id)
        if actor.inventory.wood < 1 or actor.inventory.stone < 1:
            actor.last_action_success = False
            return self._event("CRAFT", f"{actor.name} lacks the wood and stone needed to craft a weapon.", False, actor.id, faction_id=actor.faction_id)
        if actor.weapon_kind == "crafted":
            actor.last_action_success = False
            return self._event("CRAFT", f"{actor.name} already has a crafted weapon.", False, actor.id, faction_id=actor.faction_id)
        actor.inventory.wood -= 1
        actor.inventory.stone -= 1
        actor.weapon_kind = "crafted"
        actor.needs.esteem = max(0, actor.needs.esteem - 1)
        actor.last_action_success = True
        return self._event(
            "CRAFT",
            f"{actor.name} crafted a weapon from gathered materials.",
            True,
            actor.id,
            faction_id=actor.faction_id,
            metadata={"craft_kind": craft_kind, "intent": decision.intent, "weapon_kind": actor.weapon_kind},
        )

    def _apply_interact(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        target = None if action.target_agent_id is None else self.world.agents.get(action.target_agent_id)
        if target is None or not target.alive:
            actor.last_action_success = False
            return self._event("INTERACT", f"{actor.name} could not find anyone close enough to interact with.", False, actor.id, faction_id=actor.faction_id)
        if abs(target.x - actor.x) + abs(target.y - actor.y) > 1:
            actor.last_action_success = False
            return self._event("INTERACT", f"{actor.name} is too far from {target.name} and needs another model decision to close the distance.", False, actor.id, faction_id=actor.faction_id)
        
        actor_extraversion = actor.personality.extraversion
        target_extraversion = target.personality.extraversion
        actor_agreeableness = actor.personality.agreeableness
        target_agreeableness = target.personality.agreeableness
        
        bond_modifier = 1.0
        if actor_extraversion >= 7:
            bond_modifier += 0.3
        if target_extraversion >= 7:
            bond_modifier += 0.3
        if actor_agreeableness >= 7:
            bond_modifier += 0.2
        if target_agreeableness >= 7:
            bond_modifier += 0.2
        
        bond_amount = max(1, int(bond_modifier))
        
        actor.needs.belonging = max(0, actor.needs.belonging - 2)
        actor.needs.safety = max(0, actor.needs.safety - 1)
        target.needs.belonging = max(0, target.needs.belonging - 2)
        target.needs.safety = max(0, target.needs.safety - 1)
        metadata = {"intent": decision.intent, "interaction_mode": decision.interaction_mode or "social", "bond_modifier": bond_modifier}
        if actor.faction_id == target.faction_id:
            bond_strength = self._increase_bond(actor, target, amount=bond_amount)
            metadata["bond_strength"] = bond_strength
            if actor.bonded_partner_id == target.id:
                metadata["bonded"] = True
            current_tile = self.world.get_tile(actor.x, actor.y)
            if current_tile.structure_kind == "home" and current_tile.structure_id:
                actor.home_structure_id = current_tile.structure_id
                target.home_structure_id = current_tile.structure_id
                metadata["shared_home"] = current_tile.structure_id
        actor.last_action_success = True
        description = f"{actor.name} spent time with {target.name}."
        if metadata.get("bonded"):
            description = f"{actor.name} and {target.name} deepened their bond."
        return self._event("INTERACT", description, True, actor.id, target_agent_id=target.id, faction_id=actor.faction_id, metadata=metadata)

    def _apply_attack(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        target = None if action.target_agent_id is None else self.world.agents.get(action.target_agent_id)
        if target is None or not target.alive:
            actor.last_action_success = False
            return self._event("ATTACK", f"{actor.name} could not find a living target to attack.", False, actor.id, faction_id=actor.faction_id)
        if abs(target.x - actor.x) + abs(target.y - actor.y) > 1:
            actor.last_action_success = False
            return self._event("ATTACK", f"{actor.name} is too far from {target.name} to attack.", False, actor.id, faction_id=actor.faction_id)
        
        base_damage = 2 + (2 if actor.weapon_kind == "crafted" else 0)
        
        attack_modifier = get_action_modifier("attack", actor.personality)
        damage = int(base_damage * attack_modifier)
        
        defense_modifier = get_action_modifier("flee", target.personality)
        damage = int(damage * max(0.5, 1.0 - (defense_modifier - 1.0) * 0.3))
        
        target.health = max(0, target.health - damage)
        actor.last_action_success = True
        metadata = {
            "intent": decision.intent,
            "damage": damage,
            "weapon_kind": actor.weapon_kind or "none",
            "interaction_mode": decision.interaction_mode or "hostile",
            "attacker_personality": {
                "agreeableness": actor.personality.agreeableness,
                "neuroticism": actor.personality.neuroticism,
            },
            "defender_personality": {
                "agreeableness": target.personality.agreeableness,
                "neuroticism": target.personality.neuroticism,
            },
        }
        if target.health == 0:
            target.alive = False
            self._drop_inventory_on_tile(target)
            self._clear_social_links_after_death(target)
            metadata["killed"] = True
            return self._event("ATTACK", f"{actor.name} killed {target.name}.", True, actor.id, target_agent_id=target.id, faction_id=actor.faction_id, metadata=metadata)
        return self._event("ATTACK", f"{actor.name} attacked {target.name} for {damage} damage.", True, actor.id, target_agent_id=target.id, faction_id=actor.faction_id, metadata=metadata)

    def _apply_reproduce(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        partner = None if action.target_agent_id is None else self.world.agents.get(action.target_agent_id)
        if partner is None or not partner.alive:
            actor.last_action_success = False
            return self._event("REPRODUCE", f"{actor.name} could not find a partner for reproduction.", False, actor.id, faction_id=actor.faction_id)
        if actor.faction_id != partner.faction_id:
            actor.last_action_success = False
            return self._event("REPRODUCE", f"{actor.name} and {partner.name} are not in the same group.", False, actor.id, faction_id=actor.faction_id)
        if abs(partner.x - actor.x) + abs(partner.y - actor.y) > 1:
            actor.last_action_success = False
            return self._event("REPRODUCE", f"{actor.name} needs to stand next to {partner.name} before reproducing.", False, actor.id, faction_id=actor.faction_id)
        if actor.bonded_partner_id != partner.id or partner.bonded_partner_id != actor.id:
            actor.last_action_success = False
            return self._event("REPRODUCE", f"{actor.name} and {partner.name} are not bonded strongly enough.", False, actor.id, faction_id=actor.faction_id)
        if not actor.home_structure_id or actor.home_structure_id != partner.home_structure_id:
            actor.last_action_success = False
            return self._event("REPRODUCE", f"{actor.name} and {partner.name} need a shared home before growing their household.", False, actor.id, faction_id=actor.faction_id)
        if actor.reproduction_cooldown_ticks > 0 or partner.reproduction_cooldown_ticks > 0 or actor.pregnancy_ticks_remaining > 0 or partner.pregnancy_ticks_remaining > 0:
            actor.last_action_success = False
            return self._event("REPRODUCE", f"{actor.name} and {partner.name} are not ready to grow their household again yet.", False, actor.id, faction_id=actor.faction_id)
        if actor.inventory.food + partner.inventory.food < 3:
            actor.last_action_success = False
            return self._event("REPRODUCE", f"{actor.name} and {partner.name} do not have enough food to support a new child.", False, actor.id, faction_id=actor.faction_id)
        if actor.needs.safety > 6 or partner.needs.safety > 6 or actor.needs.survival > 6 or partner.needs.survival > 6:
            actor.last_action_success = False
            return self._event("REPRODUCE", f"{actor.name} and {partner.name} do not feel safe or stable enough yet.", False, actor.id, faction_id=actor.faction_id)
        carrier = actor
        carrier.pregnancy_ticks_remaining = GESTATION_TICKS
        carrier.pregnancy_partner_id = partner.id
        actor.reproduction_cooldown_ticks = REPRODUCTION_COOLDOWN_TICKS
        partner.reproduction_cooldown_ticks = REPRODUCTION_COOLDOWN_TICKS
        if actor.inventory.food > 0:
            actor.inventory.food -= 1
        if partner.inventory.food > 0:
            partner.inventory.food -= 1
        actor.last_action_success = True
        return self._event(
            "REPRODUCE",
            f"{actor.name} and {partner.name} chose to grow their household.",
            True,
            actor.id,
            target_agent_id=partner.id,
            faction_id=actor.faction_id,
            metadata={"intent": decision.intent, "partner_id": partner.id, "home_structure_id": actor.home_structure_id},
        )

    def _apply_transfer(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        target = None if action.target_agent_id is None else self.world.agents.get(action.target_agent_id)
        if target is None or not target.alive:
            actor.last_action_success = False
            return self._event("TRANSFER", f"{actor.name} had no nearby person to share with.", False, actor.id, faction_id=actor.faction_id)
        if abs(target.x - actor.x) + abs(target.y - actor.y) > 1:
            actor.last_action_success = False
            return self._event("TRANSFER", f"{actor.name} is too far from {target.name} to share anything.", False, actor.id, faction_id=actor.faction_id)
        requested = (decision.target_resource_kind or "").strip().lower()
        if requested in {"food", "wood", "stone"}:
            resource = requested
            amount = getattr(actor.inventory, resource)
        else:
            resource, amount = actor.inventory.most_abundant()
        if amount <= 0:
            actor.last_action_success = False
            return self._event("TRANSFER", f"{actor.name} had nothing to share.", False, actor.id, target_agent_id=target.id, faction_id=actor.faction_id)
        setattr(actor.inventory, resource, getattr(actor.inventory, resource) - 1)
        setattr(target.inventory, resource, getattr(target.inventory, resource) + 1)
        actor.needs.belonging = max(0, actor.needs.belonging - 1)
        target.needs.survival = max(0, target.needs.survival - (1 if resource == "food" else 0))
        actor.last_action_success = True
        return self._event("TRANSFER", f"{actor.name} shared {resource} with {target.name}.", True, actor.id, target_agent_id=target.id, faction_id=actor.faction_id, metadata={"resource": resource, "intent": decision.intent})

    def _apply_communicate(self, actor: AgentState, action: EngineAction, decision: DecisionPayload) -> SimulationEvent:
        target = None if action.target_agent_id is None else self.world.agents.get(action.target_agent_id)
        actor.needs.belonging = max(0, actor.needs.belonging - 1)
        if target is not None and target.alive and abs(target.x - actor.x) + abs(target.y - actor.y) > 1:
            actor.last_action_success = False
            return self._event("COMMUNICATE", f"{actor.name} tried to talk to {target.name} from too far away.", False, actor.id, target_agent_id=target.id, faction_id=actor.faction_id, metadata={"intent": decision.intent, "speech": decision.speech})
        actor.last_action_success = True
        if target is None or not target.alive:
            return self._event("COMMUNICATE", f"{actor.name} broadcast a message to the group.", True, actor.id, faction_id=actor.faction_id, metadata={"intent": decision.intent, "speech": decision.speech})
        target.needs.belonging = max(0, target.needs.belonging - 1)
        return self._event("COMMUNICATE", f"{actor.name} communicated with {target.name}.", True, actor.id, target_agent_id=target.id, faction_id=actor.faction_id, metadata={"intent": decision.intent, "speech": decision.speech})

    def _record_event(self, event: SimulationEvent) -> None:
        if event.actor_id is not None:
            node = self.memory_store.add_memory(event.actor_id, "event", event.description, self.world.tick)
            actor = self.world.agents.get(event.actor_id)
            if actor is not None:
                if node: actor.accumulated_importance += node.importance
                self.culture_store.observe_outcome(actor.faction_id, event.description, event.success)
        if event.target_agent_id is not None:
            node = self.memory_store.add_memory(event.target_agent_id, "event", event.description, self.world.tick)
            target = self.world.agents.get(event.target_agent_id)
            if target is not None:
                if node: target.accumulated_importance += node.importance
                self.culture_store.observe_outcome(target.faction_id, event.description, event.success)
        if event.kind == "COMMUNICATION":
            target_faction_id = event.metadata.get("target_faction_id") if isinstance(event.metadata, dict) else None
            for agent in self.world.agents.values():
                if not agent.alive:
                    continue
                if agent.faction_id == event.faction_id or agent.faction_id == target_faction_id:
                    node = self.memory_store.add_memory(agent.id, "event", event.description, self.world.tick)
                    if node: agent.accumulated_importance += node.importance

    def _update_agent_step_memory(
        self,
        agent: AgentState,
        decision: DecisionPayload,
        action: EngineAction,
        action_events: list[SimulationEvent],
    ) -> None:
        primary = action_events[-1] if action_events else None
        if primary is not None and primary.success:
            agent.last_failed_action_reason = ""
            agent.last_success_summary = primary.description
            if primary.kind in {"GATHER", "BUILD", "CRAFT", "ATTACK", "REPRODUCE", "CONSUME", "TRANSFER"}:
                agent.last_world_action_summary = primary.description
        elif primary is not None:
            agent.last_failed_action_reason = primary.description

        message_text = ""
        if decision.outbound_message is not None and decision.outbound_message.text.strip():
            message_text = decision.outbound_message.text.strip()
        elif decision.speech.strip():
            message_text = decision.speech.strip()
        if message_text:
            agent.repeated_message_streak = (
                agent.repeated_message_streak + 1
                if message_text == agent.last_communication_text
                else 1
            )
            agent.last_communication_text = message_text
        else:
            agent.repeated_message_streak = 0

        if decision.intent.strip():
            agent.last_goal = decision.intent.strip()
        self._refresh_role(agent, primary)
        self._record_position(agent)

    def _refresh_role(self, agent: AgentState, primary: SimulationEvent | None) -> None:
        if primary is None or not primary.success:
            return
        next_role = {
            "GATHER": "forager",
            "BUILD": "builder",
            "CRAFT": "crafter",
            "ATTACK": "fighter",
            "REPRODUCE": "caretaker",
            "TRANSFER": "supporter",
            "COMMUNICATE": "messenger",
            "INTERACT": "socializer",
            "CONSUME": "survivor",
        }.get(primary.kind)
        if next_role:
            agent.role = next_role

    def _record_position(self, agent: AgentState) -> None:
        current = {"x": agent.x, "y": agent.y}
        previous = agent.position_history[-1] if agent.position_history else None
        second_previous = agent.position_history[-2] if len(agent.position_history) > 1 else None
        if previous and (previous["x"], previous["y"]) == (agent.x, agent.y):
            agent.stuck_steps += 1
        elif second_previous and (second_previous["x"], second_previous["y"]) == (agent.x, agent.y):
            agent.stuck_steps += 1
        else:
            agent.stuck_steps = max(0, agent.stuck_steps - 1)
        agent.position_history.append(current)
        if len(agent.position_history) > 12:
            agent.position_history = agent.position_history[-12:]
        tile_key = f"{agent.x},{agent.y}"
        agent.visited_tiles[tile_key] = int(agent.visited_tiles.get(tile_key, 0)) + 1

    def _increase_bond(self, actor: AgentState, target: AgentState, *, amount: int = 1) -> int:
        next_actor = min(100, int(actor.bond_levels.get(target.id, 0)) + amount)
        next_target = min(100, int(target.bond_levels.get(actor.id, 0)) + amount)
        actor.bond_levels[target.id] = next_actor
        target.bond_levels[actor.id] = next_target
        if next_actor >= BOND_THRESHOLD and next_target >= BOND_THRESHOLD:
            if actor.bonded_partner_id in {None, target.id} and target.bonded_partner_id in {None, actor.id}:
                actor.bonded_partner_id = target.id
                target.bonded_partner_id = actor.id
        return min(next_actor, next_target)

    def _tile_has_water_access(self, x: int, y: int) -> bool:
        if not self.world.in_bounds(x, y):
            return False
        tile = self.world.get_tile(x, y)
        if tile.water_access or tile.terrain == TileType.WATER:
            return True
        for dx, dy in MOVE_DELTAS.values():
            nx = x + dx
            ny = y + dy
            if not self.world.in_bounds(nx, ny):
                continue
            other = self.world.get_tile(nx, ny)
            if other.terrain == TileType.WATER or other.feature == "river":
                return True
        return False

    def _remove_props_at(self, x: int, y: int, kinds: set[str]) -> None:
        self.world.props = [
            prop
            for prop in self.world.props
            if not (prop.get("x") == x and prop.get("y") == y and str(prop.get("kind")) in kinds)
        ]

    def _sync_tile_resources(self, tile: TileState) -> None:
        tags: list[str] = []
        if tile.food_stock > 0:
            tags.append("food")
        if tile.wood_stock > 0 or tile.tree_cover > 0:
            tags.append("wood")
        if tile.stone_stock > 0:
            tags.append("stone")
        if tile.water_access or tile.terrain == TileType.WATER:
            tags.append("water")
        if tile.structure_kind:
            tags.append(tile.structure_kind)
        tile.resource_tags = tags
        if tile.food_stock > 0:
            tile.resource = "food"
        elif tile.wood_stock > 0 or tile.tree_cover > 0:
            tile.resource = "wood"
        elif tile.stone_stock > 0:
            tile.resource = "stone"
        else:
            tile.resource = None

    def _create_structure(
        self,
        kind: str,
        x: int,
        y: int,
        actor: AgentState,
        materials: dict[str, int],
    ) -> StructureState:
        structure = StructureState(
            id=self._next_structure_id(actor.faction_id, kind),
            kind=kind,
            x=x,
            y=y,
            owner_faction_id=actor.faction_id,
            builder_agent_id=actor.id,
            integrity=10,
            materials=dict(materials),
        )
        self.world.structures[structure.id] = structure
        return structure

    def _next_structure_id(self, faction_id: str, kind: str) -> str:
        slot = len(self.world.structures) + 1
        while True:
            candidate = f"{faction_id}-{kind}-{slot:03d}"
            if candidate not in self.world.structures:
                return candidate
            slot += 1

    def _drop_inventory_on_tile(self, target: AgentState) -> None:
        tile = self.world.get_tile(target.x, target.y)
        tile.food_stock += target.inventory.food
        tile.wood_stock += target.inventory.wood
        tile.stone_stock += target.inventory.stone
        target.inventory = Inventory()
        self._sync_tile_resources(tile)

    def _clear_social_links_after_death(self, target: AgentState) -> None:
        if target.bonded_partner_id:
            partner = self.world.agents.get(target.bonded_partner_id)
            if partner is not None:
                partner.bonded_partner_id = None
                partner.bond_levels.pop(target.id, None)
        for other in self.world.agents.values():
            if other.id == target.id:
                continue
            other.bond_levels.pop(target.id, None)
            if other.bonded_partner_id == target.id:
                other.bonded_partner_id = None

    def _complete_birth(self, carrier: AgentState) -> SimulationEvent | None:
        home_id = carrier.home_structure_id
        partner = self.world.agents.get(carrier.pregnancy_partner_id or "")
        carrier.pregnancy_partner_id = None
        carrier.pregnancy_ticks_remaining = 0
        if not home_id:
            return None
        structure = self.world.structures.get(home_id)
        if structure is None:
            return None
        spawn_x, spawn_y = self._find_spawn_near(structure.x, structure.y)
        if spawn_x is None or spawn_y is None:
            return None
        
        openness = self._inherit_trait(carrier.personality.openness, partner.personality.openness if partner else None)
        conscientiousness = self._inherit_trait(carrier.personality.conscientiousness, partner.personality.conscientiousness if partner else None)
        extraversion = self._inherit_trait(carrier.personality.extraversion, partner.personality.extraversion if partner else None)
        agreeableness = self._inherit_trait(carrier.personality.agreeableness, partner.personality.agreeableness if partner else None)
        neuroticism = self._inherit_trait(carrier.personality.neuroticism, partner.personality.neuroticism if partner else None)
        
        newborn_id = self._next_agent_id(carrier.faction_id)
        newborn_name = self._next_unique_name()
        newborn = AgentState(
            id=newborn_id,
            name=newborn_name,
            faction_id=carrier.faction_id,
            x=spawn_x,
            y=spawn_y,
            personality=BigFivePersonality(
                openness=openness,
                conscientiousness=conscientiousness,
                extraversion=extraversion,
                agreeableness=agreeableness,
                neuroticism=neuroticism,
            ),
            emotions=Emotions(joy=6, sadness=0, fear=1, anger=0, disgust=0, surprise=5),
            needs=Needs(survival=3, safety=2, belonging=2, esteem=1, self_actualization=1),
            persona_summary=f"A young human who is {self.rng.choice(PERSONA_TONE_POOL)} and gravitates toward {self.rng.choice(RESOURCE_BIAS_POOL)} first.",
            social_style=self.rng.choice(SOCIAL_STYLE_POOL),
            resource_bias=self.rng.choice(RESOURCE_BIAS_POOL),
            starting_drive=self.rng.choice(STARTING_DRIVE_POOL),
            inventory=Inventory(food=1, wood=0, stone=0),
            tick_born=self.world.tick,
            home_structure_id=home_id,
        )
        self.world.agents[newborn_id] = newborn
        carrier.last_world_action_summary = f"Welcomed {newborn.name} into the group."
        return self._event(
            "BIRTH",
            f"{carrier.name} and {partner.name if partner else 'their partner'} welcomed {newborn.name}.",
            True,
            actor_id=carrier.id,
            target_agent_id=newborn.id,
            faction_id=carrier.faction_id,
            metadata={"newborn_id": newborn.id, "newborn_name": newborn.name, "home_structure_id": home_id},
        )

    def _find_spawn_near(self, x: int, y: int) -> tuple[int | None, int | None]:
        candidates = [(x, y)]
        for radius in range(1, 4):
            for dx in range(-radius, radius + 1):
                for dy in range(-radius, radius + 1):
                    if abs(dx) + abs(dy) != radius:
                        continue
                    candidates.append((x + dx, y + dy))
        for nx, ny in candidates:
            if self.world.in_bounds(nx, ny) and self.world.get_tile(nx, ny).passable and not self.world.position_occupied(nx, ny):
                return nx, ny
        return None, None

    def _next_agent_id(self, faction_id: str) -> str:
        slot = len(self.world.agents) + 1
        while True:
            candidate = f"{faction_id}-human-{slot:02d}"
            if candidate not in self.world.agents:
                return candidate
            slot += 1

    def _inherit_trait(self, parent1_trait: int, parent2_trait: int | None) -> int:
        if parent2_trait is None:
            base = parent1_trait
        else:
            base = (parent1_trait + parent2_trait) // 2
        
        variation = self.rng.randint(-2, 2)
        inherited = base + variation
        
        return max(0, min(10, inherited))

    def _next_unique_name(self) -> str:
        used = {agent.name.strip().lower() for agent in self.world.agents.values() if agent.name.strip()}
        for first in NEWBORN_NAME_POOL:
            if first.lower() not in used:
                return first
        for first in NEWBORN_NAME_POOL:
            for surname in NEWBORN_SURNAME_POOL:
                candidate = f"{first} {surname}"
                if candidate.lower() not in used:
                    return candidate
        counter = len(used) + 1
        while True:
            candidate = f"Human {counter}"
            if candidate.lower() not in used:
                return candidate
            counter += 1

    def _prime_task(
        self,
        agent: AgentState,
        action: EngineAction,
        decision: DecisionPayload,
        *,
        step_time_ms: int,
    ) -> None:
        task_state = {
            "MOVE": "moving",
            "REST": "resting",
            "CONSUME": "consuming",
            "GATHER": "gathering",
            "BUILD": "building",
            "CRAFT": "crafting",
            "INTERACT": "interacting",
            "ATTACK": "engaging",
            "REPRODUCE": "bonding",
            "TRANSFER": "sharing",
            "COMMUNICATE": "communicating",
        }.get(action.kind, "idle")
        if decision.interaction_mode == "hostile":
            task_state = "engaging"
        agent.task_state = task_state
        agent.task_progress = 100
        agent.task_target_x = action.target_x
        agent.task_target_y = action.target_y
        agent.interaction_target_id = action.target_agent_id or decision.target_agent_id
        agent.last_decision_at_ms = step_time_ms
        agent.speaking_until_ms = step_time_ms + self.config.microstep_interval_ms if decision.speech.strip() else 0

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
        payload = dict(metadata or {})
        if actor_id is not None and "actor_name" not in payload:
            actor = self.world.agents.get(actor_id)
            if actor is not None:
                payload["actor_name"] = actor.name
        if target_agent_id is not None and "target_name" not in payload:
            target = self.world.agents.get(target_agent_id)
            if target is not None:
                payload["target_name"] = target.name
        return SimulationEvent(
            tick=self.world.tick,
            kind=kind,
            description=description,
            success=success,
            actor_id=actor_id,
            target_agent_id=target_agent_id,
            faction_id=faction_id,
            metadata=payload,
        )

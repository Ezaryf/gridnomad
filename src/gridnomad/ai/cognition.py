from __future__ import annotations

import json
from dataclasses import dataclass

from gridnomad.ai.adapters import LLMAdapter
from gridnomad.core.models import AgentState, DecisionPayload, OutboundMessage, WorldState
from gridnomad.core.memory import MemoryStore

@dataclass(slots=True)
class CognitionAdapter:
    adapter: LLMAdapter
    
    def generate_reflection(
        self,
        agent: AgentState,
        memory_stream: MemoryStore,
        world: WorldState,
        tick: int,
    ) -> list[str]:
        # Based on Generative Agents paper:
        # 1. Retrieve the last N memories (e.g. 100) or since last reflection
        recent_nodes = memory_stream.retrieve(agent.id, "reflection topic", current_tick=tick, limit=20)
        if not recent_nodes:
            return []
            
        memory_list = "\n".join(f"- {node.content}" for node in recent_nodes)
        
        prompt = f"""You are generating high-level insights for the human {agent.name}.
        
Recent memories:
{memory_list}

Based on these memories, what are 1 to 3 high-level insights or reflections that {agent.name} should remember?
Focus on relationships, persistent needs, or discovering patterns.
Return a JSON object with a single key "insights" mapping to an array of strings. Do not include markdown formatting or backticks around the JSON.
"""
        try:
            raw_response = self.adapter.provide_raw(prompt) # type: ignore
        except AttributeError:
            class _ProxyContext:
                def __init__(self, p):
                    self.prompt = p
                    self.agent = agent
            ctx = _ProxyContext(prompt)
            try:
                response = self.adapter.decide(ctx) # type: ignore
                if isinstance(response, DecisionPayload):
                    return [response.intent or "Reflected on recent events."]
                raw_response = str(response)
            except Exception:
                return ["Reflected on recent events."]
                
        try:
            data = json.loads(raw_response)
            insights = data.get("insights", [])
            if not isinstance(insights, list):
                return []
            return [str(i) for i in insights]
        except Exception:
            return ["Reflected on recent experiences."]

    def generate_daily_plan(
        self,
        agent: AgentState,
        memory_stream: MemoryStore,
        world: WorldState,
        tick: int,
    ) -> str:
        
        recent_nodes = memory_stream.retrieve(agent.id, agent.name, current_tick=tick, limit=10)
        memory_list = "\n".join(f"- {node.content}" for node in recent_nodes)
        
        prompt = f"""You are generating a daily plan for {agent.name}.
{agent.name} is a {agent.persona_summary}
        
Recent important memories:
{memory_list}

Current state:
Health: {agent.health}/10
Survival Need: {agent.needs.survival}/10
Safety Need: {agent.needs.safety}/10

What is {agent.name}'s plan for the day? Be concise (1-2 sentences). Return only the plan as raw text.
"""
        try:
            raw_response = self.adapter.provide_raw(prompt) # type: ignore
            return raw_response.strip()
        except AttributeError:
            class _ProxyContext:
                def __init__(self, p):
                    self.prompt = p
                    self.agent = agent
            ctx = _ProxyContext(prompt)
            try:
                response = self.adapter.decide(ctx) # type: ignore
                if isinstance(response, DecisionPayload):
                    return response.intent or "Survive and help the group."
                if isinstance(response, str):
                    return response[:200].strip()
            except Exception:
                pass
            return "Survive and help the group."

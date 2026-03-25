from __future__ import annotations

import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Literal

MemoryType = Literal["event", "thought", "reflection", "plan"]

@dataclass(slots=True)
class MemoryNode:
    id: str
    agent_id: str
    type: MemoryType
    content: str
    created_tick: int
    last_accessed_tick: int
    importance: int  # 1-10
    
    def calculate_retrieval_score(self, current_tick: int, query_terms: set[str], decay_factor: float = 0.995) -> float:
        # Recency (exponential decay based on ticks since last access)
        ticks_since_accessed = max(0, current_tick - self.last_accessed_tick)
        recency_score = math.pow(decay_factor, ticks_since_accessed)
        
        # Importance (normalize 1-10 to 0.1-1.0)
        importance_score = self.importance / 10.0
        
        # Relevance (simple token overlap heuristic)
        content_terms = set(re.findall(r'\b\w+\b', self.content.lower()))
        if not query_terms or not content_terms:
            relevance_score = 0.0
        else:
            overlap = len(query_terms.intersection(content_terms))
            relevance_score = min(1.0, overlap / max(1, len(query_terms)))
            
        # The Stanford paper uses weighting: a * recency + b * importance + c * relevance
        # We'll use 1.0 for all weights, but boost relevance to 2.0 to make topical queries matter
        return recency_score + importance_score + (relevance_score * 2.0)

@dataclass(slots=True)
class MemoryStore:
    # Keeping the class name MemoryStore as that is what simulation.py currently imports,
    # but the implementation is now a proper MemoryStream.
    thought_limit: int = 500
    event_limit: int = 500
    _nodes: dict[str, list[MemoryNode]] = field(init=False, repr=False)
    _next_id: int = field(init=False, default=1)

    def __post_init__(self) -> None:
        self._nodes = defaultdict(list)

    def add_memory(self, agent_id: str, type: MemoryType, content: str, tick: int, importance: int | None = None) -> MemoryNode | None:
        if not content.strip():
            return None
        
        # Heuristic importance if not provided
        if importance is None:
            importance = self._heuristic_importance(type, content)
            
        node = MemoryNode(
            id=f"mem_{self._next_id}",
            agent_id=agent_id,
            type=type,
            content=content.strip(),
            created_tick=tick,
            last_accessed_tick=tick,
            importance=importance
        )
        self._next_id += 1
        self._nodes[agent_id].append(node)
        
        # Enforce limits (primitive memory management for MVP)
        hard_limit = max(self.thought_limit, self.event_limit) * 2
        if len(self._nodes[agent_id]) > hard_limit:
            # Sort by retrieval score (decayed) and drop lowest
            self._nodes[agent_id].sort(key=lambda n: n.calculate_retrieval_score(tick, set()), reverse=True)
            self._nodes[agent_id] = self._nodes[agent_id][:hard_limit]
            
        return node

    def _heuristic_importance(self, type: MemoryType, content: str) -> int:
        if type == "reflection":
            return 8
        if type == "plan":
            return 7
            
        content_lower = content.lower()
        high_impact = {"died", "killed", "attacked", "birth", "bonded", "fire", "enemy", "starving"}
        med_impact = {"built", "crafted", "shared", "gathered", "explored", "found", "communicated", "spent time"}
        
        if any(word in content_lower for word in high_impact):
            return 8
        if any(word in content_lower for word in med_impact):
            return 5
        return 2

    def retrieve(self, agent_id: str, query: str, current_tick: int, limit: int = 5) -> list[MemoryNode]:
        if not self._nodes[agent_id]:
            return []
            
        stopwords = {"the", "a", "an", "is", "was", "to", "and", "or", "of", "in", "it", "with", "for", "on"}
        query_terms = set(re.findall(r'\b\w+\b', query.lower())) - stopwords
        
        scored_nodes = []
        for node in self._nodes[agent_id]:
            score = node.calculate_retrieval_score(current_tick, query_terms)
            scored_nodes.append((score, node))
            
        # Sort by score descending
        scored_nodes.sort(key=lambda x: x[0], reverse=True)
        
        # Take top `limit`, update access tick, return
        top_nodes = [n for score, n in scored_nodes[:limit]]
        for node in top_nodes:
            node.last_accessed_tick = current_tick
            
        # Chronological order for prompting
        top_nodes.sort(key=lambda n: n.created_tick)
        return top_nodes

    # Backwards compatibility and shims for existing simulation code
    def add_thought(self, agent_id: str, thought: str, tick: int = 0) -> None:
        self.add_memory(agent_id, "thought", thought, tick)

    def add_event(self, agent_id: str, event: str, tick: int = 0) -> None:
        self.add_memory(agent_id, "event", event, tick)

    def recent_thoughts(self, agent_id: str, limit: int = 5) -> list[str]:
        nodes = [n for n in self._nodes[agent_id] if n.type == "thought"]
        nodes.sort(key=lambda n: n.created_tick)
        return [n.content for n in nodes[-limit:]]

    def recent_events(self, agent_id: str, limit: int = 5) -> list[str]:
        nodes = [n for n in self._nodes[agent_id] if n.type == "event"]
        nodes.sort(key=lambda n: n.created_tick)
        return [n.content for n in nodes[-limit:]]


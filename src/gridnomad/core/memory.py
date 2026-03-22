from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field


@dataclass(slots=True)
class MemoryStore:
    thought_limit: int = 30
    event_limit: int = 30
    _thoughts: dict[str, deque[str]] = field(init=False, repr=False)
    _events: dict[str, deque[str]] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._thoughts: dict[str, deque[str]] = defaultdict(lambda: deque(maxlen=self.thought_limit))
        self._events: dict[str, deque[str]] = defaultdict(lambda: deque(maxlen=self.event_limit))

    def add_thought(self, agent_id: str, thought: str) -> None:
        if thought.strip():
            self._thoughts[agent_id].append(thought.strip())

    def add_event(self, agent_id: str, event: str) -> None:
        if event.strip():
            self._events[agent_id].append(event.strip())

    def recent_thoughts(self, agent_id: str, limit: int = 5) -> list[str]:
        return list(self._thoughts[agent_id])[-limit:]

    def recent_events(self, agent_id: str, limit: int = 5) -> list[str]:
        return list(self._events[agent_id])[-limit:]

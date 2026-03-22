from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from gridnomad.core.models import CulturalInnovation


@dataclass(slots=True)
class CultureElement:
    category: str
    element: str
    description: str
    strength: int
    origin_agent_id: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "category": self.category,
            "element": self.element,
            "description": self.description,
            "strength": self.strength,
            "origin_agent_id": self.origin_agent_id,
        }


class CultureStore:
    def __init__(self) -> None:
        self._elements: dict[str, dict[tuple[str, str], CultureElement]] = defaultdict(dict)

    def seed_faction(self, faction_id: str, elements: list[dict[str, object]]) -> None:
        for raw in elements:
            innovation = CulturalInnovation(
                element=str(raw["element"]),
                description=str(raw["description"]),
                strength=int(raw["strength"]),
                category=str(raw.get("category", "norm")),
            )
            self.add_innovation(faction_id, innovation)

    def add_innovation(
        self,
        faction_id: str,
        innovation: CulturalInnovation,
        *,
        origin_agent_id: str | None = None,
    ) -> None:
        key = (innovation.category, innovation.element.lower())
        existing = self._elements[faction_id].get(key)
        if existing is None:
            self._elements[faction_id][key] = CultureElement(
                category=innovation.category,
                element=innovation.element,
                description=innovation.description,
                strength=innovation.strength,
                origin_agent_id=origin_agent_id,
            )
            return
        existing.description = innovation.description
        existing.strength = min(100, max(existing.strength, innovation.strength))
        if origin_agent_id and existing.origin_agent_id is None:
            existing.origin_agent_id = origin_agent_id

    def observe_outcome(self, faction_id: str, event_summary: str, success: bool) -> None:
        summary = event_summary.lower()
        for element in self._elements[faction_id].values():
            if element.element.lower() in summary:
                delta = 2 if success else -2
                element.strength = max(0, min(100, element.strength + delta))

    def summarize(self, faction_id: str, limit: int = 4) -> str:
        elements = sorted(
            self._elements[faction_id].values(),
            key=lambda item: (-item.strength, item.category, item.element.lower()),
        )
        if not elements:
            return "No strong cultural norms are established yet."
        summaries = [
            f"{element.category.title()} '{element.element}' ({element.strength}): {element.description}"
            for element in elements[:limit]
        ]
        return "; ".join(summaries)

    def to_dict(self) -> dict[str, list[dict[str, object]]]:
        return {
            faction_id: [element.to_dict() for element in sorted(elements.values(), key=lambda item: item.element)]
            for faction_id, elements in sorted(self._elements.items())
        }

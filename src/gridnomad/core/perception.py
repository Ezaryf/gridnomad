from __future__ import annotations

from dataclasses import dataclass, field

from gridnomad.core.models import AgentState, TileType, WorldState, direction_from_delta


@dataclass(slots=True)
class PerceptionSnapshot:
    text: str
    signature: str
    hostile_agents: list[str] = field(default_factory=list)
    friendly_agents: list[str] = field(default_factory=list)
    visible_resources: list[str] = field(default_factory=list)
    nearby_water: list[tuple[int, int]] = field(default_factory=list)
    nearby_farmable: list[tuple[int, int]] = field(default_factory=list)


def build_perception(world: WorldState, agent: AgentState, radius: int) -> PerceptionSnapshot:
    points: list[str] = []
    signature_parts: list[str] = []
    hostile_agents: list[str] = []
    friendly_agents: list[str] = []
    visible_resources: list[str] = []
    nearby_water: list[tuple[int, int]] = []
    nearby_farmable: list[tuple[int, int]] = []

    common_biomes = {"grassland", "meadow", "island-grass", "orchard", "high-pasture", "vale"}

    for y in range(world.height):
        for x in range(world.width):
            distance = abs(x - agent.x) + abs(y - agent.y)
            if distance == 0 or distance > radius:
                continue
            tile = world.get_tile(x, y)
            relation = direction_from_delta(x - agent.x, y - agent.y)
            if tile.terrain != TileType.PLAIN or tile.resource or tile.farmable or tile.feature or tile.biome not in common_biomes:
                description = tile.describe()
                points.append(f"{description} {relation}")
                signature_parts.append(f"tile:{x},{y}:{description}")
            if tile.terrain == TileType.WATER:
                nearby_water.append((x, y))
            if tile.farmable and tile.terrain == TileType.PLAIN:
                nearby_farmable.append((x, y))
            if tile.resource:
                visible_resources.append(f"{tile.resource} at {relation}")

    for other in world.nearby_agents(agent.x, agent.y, radius, exclude_agent_id=agent.id):
        relation = direction_from_delta(other.x - agent.x, other.y - agent.y)
        is_friendly = other.faction_id == agent.faction_id
        descriptor = "friendly" if is_friendly else "foreign"
        points.append(f"{descriptor} human {other.name} [id={other.id}] of {other.faction_id} group {relation}")
        signature_parts.append(f"agent:{other.id}:{other.faction_id}:{other.x},{other.y}")
        if is_friendly:
            friendly_agents.append(other.id)
        else:
            hostile_agents.append(other.id)

    if not points:
        text = "Open plain terrain surrounds you. No notable agents, resources, or structures are nearby."
    else:
        text = "; ".join(sorted(points))
    signature = "|".join(sorted(signature_parts))
    return PerceptionSnapshot(
        text=text,
        signature=signature,
        hostile_agents=hostile_agents,
        friendly_agents=friendly_agents,
        visible_resources=visible_resources,
        nearby_water=nearby_water,
        nearby_farmable=nearby_farmable,
    )

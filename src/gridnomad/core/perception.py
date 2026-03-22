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
    adjacent_descriptions: list[str] = []

    common_biomes = {"grassland", "meadow", "island-grass", "orchard", "high-pasture", "vale"}

    cardinal_tiles = {
        "north": (agent.x, agent.y - 1),
        "east": (agent.x + 1, agent.y),
        "south": (agent.x, agent.y + 1),
        "west": (agent.x - 1, agent.y),
    }
    for label, (tx, ty) in cardinal_tiles.items():
        if not world.in_bounds(tx, ty):
            adjacent_descriptions.append(f"{label} is out of bounds")
            signature_parts.append(f"adjacent:{label}:out-of-bounds")
            continue
        tile = world.get_tile(tx, ty)
        occupant = world.agent_at(tx, ty, exclude_agent_id=agent.id)
        tile_status = tile.describe()
        if not tile.passable:
            adjacent_descriptions.append(f"{label} is blocked by {tile_status}")
            signature_parts.append(f"adjacent:{label}:blocked:{tile_status}")
            continue
        if occupant is not None:
            adjacent_descriptions.append(f"{label} is occupied by {occupant.name} [id={occupant.id}]")
            signature_parts.append(f"adjacent:{label}:occupied:{occupant.id}")
            continue
        adjacent_descriptions.append(f"{label} is open {tile_status}")
        signature_parts.append(f"adjacent:{label}:open:{tile_status}")

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

    local_status = [
        f"Adjacent tiles: {', '.join(adjacent_descriptions)}.",
        f"Inventory: food={agent.inventory.food}, wood={agent.inventory.wood}, stone={agent.inventory.stone}.",
    ]
    if not points:
        text = " ".join(local_status + ["Open plain terrain surrounds you. No notable agents, resources, or structures are nearby."])
    else:
        text = " ".join(local_status + ["Nearby context: " + "; ".join(sorted(points))])
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

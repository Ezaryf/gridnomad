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
    frontier_direction: str = ""
    frontier_distance: int = 0
    frontier_description: str = ""
    nearest_resource_hints: list[str] = field(default_factory=list)
    home_site_hints: list[str] = field(default_factory=list)
    bridge_hints: list[str] = field(default_factory=list)
    available_friendly_agents: list[str] = field(default_factory=list)
    busy_friendly_agents: list[str] = field(default_factory=list)


def build_perception(world: WorldState, agent: AgentState, radius: int) -> PerceptionSnapshot:
    points: list[str] = []
    signature_parts: list[str] = []
    hostile_agents: list[str] = []
    friendly_agents: list[str] = []
    visible_resources: list[str] = []
    nearby_water: list[tuple[int, int]] = []
    nearby_farmable: list[tuple[int, int]] = []
    adjacent_descriptions: list[str] = []
    nearest_resource_candidates: dict[str, tuple[int, int, int] | None] = {
        "food": None,
        "water": None,
        "wood": None,
        "stone": None,
        "shelter": None,
    }
    home_site_candidates: list[tuple[int, int, int]] = []
    bridge_candidates: list[tuple[int, int, int]] = []
    frontier_candidates: list[tuple[int, int, int, int]] = []
    available_friendly_agents: list[str] = []
    busy_friendly_agents: list[str] = []

    common_biomes = {"grassland", "meadow", "island-grass", "orchard", "high-pasture", "vale"}
    recent_positions = {
        (int(item.get("x", agent.x)), int(item.get("y", agent.y)))
        for item in agent.position_history[-6:]
        if isinstance(item, dict)
    }

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
            if tile.water_access:
                nearby_water.append((x, y))
            if tile.farmable and tile.terrain == TileType.PLAIN:
                nearby_farmable.append((x, y))
            if tile.resource:
                visible_resources.append(f"{tile.resource} at {relation}")
            if tile.tree_cover > 0:
                visible_resources.append(f"tree cover at {relation}")
            if tile.stone_stock > 0:
                visible_resources.append(f"stone at {relation}")
            if tile.food_stock > 0:
                visible_resources.append(f"food at {relation}")
            if tile.passable:
                visited_count = int(agent.visited_tiles.get(f"{x},{y}", 0))
                recent_penalty = 2 if (x, y) in recent_positions else 0
                frontier_candidates.append((visited_count + recent_penalty, -distance, x, y))
            if tile.buildable and tile.structure_kind is None and tile.terrain != TileType.WATER:
                home_site_candidates.append((distance, x, y))
            if _is_bridge_candidate(world, x, y):
                bridge_candidates.append((distance, x, y))
            resource_kind = _resource_kind_for_tile(tile)
            if resource_kind:
                current = nearest_resource_candidates.get(resource_kind)
                if current is None or distance < current[0]:
                    nearest_resource_candidates[resource_kind] = (distance, x, y)

    for other in world.nearby_agents(agent.x, agent.y, radius, exclude_agent_id=agent.id):
        relation = direction_from_delta(other.x - agent.x, other.y - agent.y)
        is_friendly = other.faction_id == agent.faction_id
        descriptor = "friendly" if is_friendly else "foreign"
        carrying = []
        if other.inventory.food:
            carrying.append(f"food={other.inventory.food}")
        if other.inventory.wood:
            carrying.append(f"wood={other.inventory.wood}")
        if other.inventory.stone:
            carrying.append(f"stone={other.inventory.stone}")
        status_bits = []
        if other.weapon_kind:
            status_bits.append(f"armed:{other.weapon_kind}")
        if other.bonded_partner_id:
            status_bits.append(f"bonded:{other.bonded_partner_id}")
        if other.home_structure_id:
            status_bits.append(f"home:{other.home_structure_id}")
        if carrying:
            status_bits.append("carrying " + ",".join(carrying))
        if other.task_state not in {"idle", "resting"}:
            status_bits.append(f"busy:{other.task_state}")
        details = f" ({'; '.join(status_bits)})" if status_bits else ""
        points.append(f"{descriptor} human {other.name} [id={other.id}] of {other.faction_id} group {relation}{details}")
        signature_parts.append(f"agent:{other.id}:{other.faction_id}:{other.x},{other.y}")
        if is_friendly:
            friendly_agents.append(other.id)
            availability = f"{other.name} [id={other.id}] {relation}"
            if other.task_state in {"idle", "resting"}:
                available_friendly_agents.append(availability)
            else:
                busy_friendly_agents.append(f"{availability} while {other.task_state}")
        else:
            hostile_agents.append(other.id)

    frontier_direction = ""
    frontier_distance = 0
    frontier_description = ""
    if frontier_candidates:
        _, neg_distance, frontier_x, frontier_y = min(frontier_candidates)
        frontier_distance = abs(neg_distance)
        frontier_direction = direction_from_delta(frontier_x - agent.x, frontier_y - agent.y)
        frontier_description = f"The least-explored nearby direction is {frontier_direction}."

    nearest_resource_hints: list[str] = []
    for label, candidate in nearest_resource_candidates.items():
        if candidate is None:
            continue
        distance, x, y = candidate
        nearest_resource_hints.append(
            f"{label} {direction_from_delta(x - agent.x, y - agent.y)} ({distance} away)"
        )

    home_site_hints = [
        f"home site {direction_from_delta(x - agent.x, y - agent.y)} ({distance} away)"
        for distance, x, y in sorted(home_site_candidates)[:2]
    ]
    bridge_hints = [
        f"bridge-worthy crossing {direction_from_delta(x - agent.x, y - agent.y)} ({distance} away)"
        for distance, x, y in sorted(bridge_candidates)[:2]
    ]

    local_status = [
        f"Adjacent tiles: {', '.join(adjacent_descriptions)}.",
        f"Inventory: food={agent.inventory.food}, wood={agent.inventory.wood}, stone={agent.inventory.stone}.",
    ]
    if nearest_resource_hints:
        local_status.append(f"Nearest useful things: {'; '.join(nearest_resource_hints)}.")
    if home_site_hints:
        local_status.append(f"Nearby home sites: {'; '.join(home_site_hints)}.")
    if bridge_hints:
        local_status.append(f"Nearby crossings that might need a bridge: {'; '.join(bridge_hints)}.")
    if frontier_description:
        local_status.append(f"Exploration hint: {frontier_description}")
    if agent.stuck_steps:
        local_status.append(f"Loop warning: you have been circling locally for {agent.stuck_steps} recent steps.")
    if agent.last_failed_action_reason:
        local_status.append(f"Last failed action: {agent.last_failed_action_reason}.")
    if agent.last_success_summary:
        local_status.append(f"Last successful outcome: {agent.last_success_summary}.")
    if agent.repeated_message_streak:
        local_status.append(f"Repeated message streak: {agent.repeated_message_streak}.")
    if available_friendly_agents:
        local_status.append(f"Available nearby humans: {'; '.join(available_friendly_agents)}.")
    if busy_friendly_agents:
        local_status.append(f"Busy nearby humans: {'; '.join(busy_friendly_agents)}.")
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
        frontier_direction=frontier_direction,
        frontier_distance=frontier_distance,
        frontier_description=frontier_description,
        nearest_resource_hints=nearest_resource_hints,
        home_site_hints=home_site_hints,
        bridge_hints=bridge_hints,
        available_friendly_agents=available_friendly_agents,
        busy_friendly_agents=busy_friendly_agents,
    )


def _resource_kind_for_tile(tile) -> str | None:
    if tile.terrain == TileType.WATER or tile.water_access:
        return "water"
    if tile.food_stock > 0 or tile.resource in {"berries", "fish", "fruit"} or tile.biome in {"grassland", "meadow", "fertile-plains", "coast"}:
        return "food"
    if tile.tree_cover > 0 or tile.wood_stock > 0 or tile.biome in {"forest", "jungle", "grove"} or tile.feature == "forest":
        return "wood"
    if tile.stone_stock > 0 or tile.biome in {"mountain", "alpine", "crystal", "highland"} or tile.feature == "mountain":
        return "stone"
    if tile.buildable:
        return "shelter"
    return None


def _is_bridge_candidate(world: WorldState, x: int, y: int) -> bool:
    if not world.in_bounds(x, y):
        return False
    tile = world.get_tile(x, y)
    if tile.terrain != TileType.WATER and tile.feature != "river":
        return False
    north = world.in_bounds(x, y - 1) and world.get_tile(x, y - 1).passable
    south = world.in_bounds(x, y + 1) and world.get_tile(x, y + 1).passable
    east = world.in_bounds(x + 1, y) and world.get_tile(x + 1, y).passable
    west = world.in_bounds(x - 1, y) and world.get_tile(x - 1, y).passable
    return (north and south) or (east and west)

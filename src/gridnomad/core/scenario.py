from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from gridnomad.core.culture import CultureStore
from gridnomad.core.generation import GeneratedWorldBundle, generate_seeded_world
from gridnomad.core.models import (
    AgentState,
    AnimalUnitState,
    BattleState,
    CityState,
    CommunicationMessage,
    FactionState,
    KingdomState,
    SimulationConfig,
    StructureState,
    TileState,
    WorldState,
)


@dataclass(slots=True)
class ScenarioBundle:
    config: SimulationConfig
    world: WorldState
    culture_store: CultureStore


def load_scenario(
    path: str | Path,
    *,
    seed_override: int | None = None,
    width_override: int | None = None,
    height_override: int | None = None,
    preset_override: str | None = None,
    coastline_bias_override: int | None = None,
    river_count_override: int | None = None,
    settlement_density_override: int | None = None,
    landmark_density_override: int | None = None,
    biome_density_override: int | None = None,
    fauna_density_override: int | None = None,
    kingdom_growth_intensity_override: int | None = None,
) -> ScenarioBundle:
    scenario_path = Path(path)
    data = json.loads(scenario_path.read_text(encoding="utf-8"))
    return load_scenario_data(
        data,
        seed_override=seed_override,
        width_override=width_override,
        height_override=height_override,
        preset_override=preset_override,
        coastline_bias_override=coastline_bias_override,
        river_count_override=river_count_override,
        settlement_density_override=settlement_density_override,
        landmark_density_override=landmark_density_override,
        biome_density_override=biome_density_override,
        fauna_density_override=fauna_density_override,
        kingdom_growth_intensity_override=kingdom_growth_intensity_override,
    )


def load_scenario_data(
    data: dict[str, Any],
    *,
    seed_override: int | None = None,
    width_override: int | None = None,
    height_override: int | None = None,
    preset_override: str | None = None,
    coastline_bias_override: int | None = None,
    river_count_override: int | None = None,
    settlement_density_override: int | None = None,
    landmark_density_override: int | None = None,
    biome_density_override: int | None = None,
    fauna_density_override: int | None = None,
    kingdom_growth_intensity_override: int | None = None,
) -> ScenarioBundle:
    config = SimulationConfig.from_dict(data["config"])
    snapshot_world = data.get("world") if isinstance(data.get("world"), dict) else None
    faction_payload = data.get("factions", snapshot_world.get("factions", {}) if snapshot_world else {})
    factions = {
        item["id"]: FactionState.from_dict(item)
        for item in _iter_payload_items(faction_payload)
    }
    generator = data.get("generator")

    if generator:
        config.world_seed = int(generator.get("seed", data.get("seed", config.world_seed)))
        config.generator_preset = str(generator.get("preset", config.generator_preset))
        config.map_width = int(generator.get("width", config.map_width or config.width))
        config.map_height = int(generator.get("height", config.map_height or config.height))
        config.width = config.map_width
        config.height = config.map_height
        config.coastline_bias = int(generator.get("coastline_bias", config.coastline_bias))
        config.river_count = int(generator.get("river_count", config.river_count))
        config.settlement_density = int(generator.get("settlement_density", config.settlement_density))
        config.landmark_density = int(generator.get("landmark_density", config.landmark_density))
        if coastline_bias_override is not None:
            config.coastline_bias = int(coastline_bias_override)
        if river_count_override is not None:
            config.river_count = int(river_count_override)
        if settlement_density_override is not None:
            config.settlement_density = int(settlement_density_override)
        if landmark_density_override is not None:
            config.landmark_density = int(landmark_density_override)
        if biome_density_override is not None:
            config.biome_density = int(biome_density_override)
        if fauna_density_override is not None:
            config.fauna_density = int(fauna_density_override)
        if kingdom_growth_intensity_override is not None:
            config.kingdom_growth_intensity = int(kingdom_growth_intensity_override)
        generated = generate_seeded_world(
            config,
            factions,
            generator=generator,
            seed_override=seed_override,
            width_override=width_override,
            height_override=height_override,
            preset_override=preset_override,
        )
        world = generated.world
        config.world_seed = world.seed
        config.width = world.width
        config.height = world.height
        config.map_width = world.width
        config.map_height = world.height
    else:
        world_payload = snapshot_world or data
        tiles = [[TileState() for _ in range(config.width)] for _ in range(config.height)]
        for tile_data in _flatten_tiles(world_payload.get("tiles", [])):
            x = int(tile_data["x"])
            y = int(tile_data["y"])
            tiles[y][x] = TileState.from_dict(tile_data)
        world = WorldState(
            width=config.width,
            height=config.height,
            tiles=tiles,
            agents={},
            factions=factions,
            tick=int(world_payload.get("tick", data.get("tick", 0))),
            seed=int(world_payload.get("seed", data.get("seed", 0) if seed_override is None else seed_override)),
        )
        world.props = [dict(item) for item in world_payload.get("props", [])]
        world.regions = {str(region_id): dict(payload) for region_id, payload in dict(world_payload.get("regions", {})).items()}
        world.settlements = [dict(item) for item in world_payload.get("settlements", [])]
        world.roads = [dict(item) for item in world_payload.get("roads", [])]
        world.territories = {
            str(faction_id): dict(payload)
            for faction_id, payload in dict(world_payload.get("territories", {})).items()
        }
        world.communications = [
            CommunicationMessage.from_dict(item)
            for item in world_payload.get("communications", [])
            if isinstance(item, dict)
        ]
        world.animals = {
            item["id"]: AnimalUnitState.from_dict(item)
            for item in _iter_payload_items(world_payload.get("animals", {}))
        }
        world.cities = {
            item["id"]: CityState.from_dict(item)
            for item in _iter_payload_items(world_payload.get("cities", {}))
        }
        world.kingdoms = {
            item["id"]: KingdomState.from_dict(item)
            for item in _iter_payload_items(world_payload.get("kingdoms", {}))
        }
        world.structures = {
            item["id"]: StructureState.from_dict(item)
            for item in _iter_payload_items(world_payload.get("structures", {}))
        }
        world.battles = {
            item["id"]: BattleState.from_dict(item)
            for item in _iter_payload_items(world_payload.get("battles", {}))
        }
        world.fauna_events = [dict(item) for item in world_payload.get("fauna_events", [])]
        world.time_of_day = int(world_payload.get("time_of_day", 8))
        world.weather = str(world_payload.get("weather", "clear"))
        if biome_density_override is not None:
            config.biome_density = int(biome_density_override)
        if fauna_density_override is not None:
            config.fauna_density = int(fauna_density_override)
        if kingdom_growth_intensity_override is not None:
            config.kingdom_growth_intensity = int(kingdom_growth_intensity_override)
        generated = None

    agent_payload = (
        snapshot_world.get("agents", snapshot_world.get("humans", {}))
        if snapshot_world
        else data.get("agents", data.get("humans", []))
    )
    world.agents = _build_agents(_iter_payload_items(agent_payload), world, generated)
    if generated is not None:
        world.kingdoms = {}
        world.cities = {}
        world.structures = {}
        world.animals = {}
        world.battles = {}
        world.fauna_events = []
    culture_store = CultureStore()
    culture_payload = data.get("culture", {})
    if isinstance(culture_payload, dict) and culture_payload:
        for faction_id, elements in culture_payload.items():
            culture_store.seed_faction(str(faction_id), list(elements))
    else:
        for faction in _iter_payload_items(faction_payload):
            culture_store.seed_faction(faction["id"], list(faction.get("culture", [])))

    return ScenarioBundle(config=config, world=world, culture_store=culture_store)


def dump_snapshot(path: str | Path, payload: dict[str, Any]) -> None:
    snapshot_path = Path(path)
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    snapshot_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def _build_agents(
    agent_specs: list[dict[str, Any]],
    world: WorldState,
    generated: GeneratedWorldBundle | None,
) -> dict[str, AgentState]:
    agents: dict[str, AgentState] = {}
    occupied: set[tuple[int, int]] = set()
    faction_cursor: defaultdict[str, int] = defaultdict(int)
    for spec in agent_specs:
        payload = dict(spec)
        needs_spawn = (
            "x" not in payload
            or "y" not in payload
            or not world.in_bounds(int(payload.get("x", -1)), int(payload.get("y", -1)))
            or not world.get_tile(int(payload.get("x", 0)), int(payload.get("y", 0))).passable
            or (int(payload.get("x", -1)), int(payload.get("y", -1))) in occupied
        )
        if needs_spawn:
            x, y = _resolve_spawn_point(
                payload["faction_id"],
                world,
                generated,
                occupied,
                faction_cursor,
            )
            payload["x"] = x
            payload["y"] = y
        agent = AgentState.from_dict(payload)
        occupied.add((agent.x, agent.y))
        agents[agent.id] = agent
    return agents


def _resolve_spawn_point(
    faction_id: str,
    world: WorldState,
    generated: GeneratedWorldBundle | None,
    occupied: set[tuple[int, int]],
    faction_cursor: defaultdict[str, int],
) -> tuple[int, int]:
    if generated is not None:
        spawn_points = generated.faction_spawns.get(faction_id, [])
        index = faction_cursor[faction_id]
        faction_cursor[faction_id] += 1
        for offset in range(len(spawn_points)):
            x, y = spawn_points[(index + offset) % len(spawn_points)]
            for candidate in _spawn_ring(world, x, y):
                if candidate not in occupied:
                    return candidate
    for y in range(world.height):
        for x in range(world.width):
            if (x, y) not in occupied and world.get_tile(x, y).passable:
                return x, y
    return 0, 0


def _iter_payload_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        return [dict(item) for item in payload.values() if isinstance(item, dict)]
    if isinstance(payload, list):
        return [dict(item) for item in payload if isinstance(item, dict)]
    return []


def _flatten_tiles(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, list):
        return []
    if payload and isinstance(payload[0], list):
        flattened: list[dict[str, Any]] = []
        for row in payload:
            if not isinstance(row, list):
                continue
            for item in row:
                if isinstance(item, dict):
                    flattened.append(dict(item))
        return flattened
    return [dict(item) for item in payload if isinstance(item, dict)]


def _spawn_ring(world: WorldState, x: int, y: int) -> list[tuple[int, int]]:
    candidates = [(x, y)]
    for radius in range(1, 4):
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                if abs(dx) + abs(dy) != radius:
                    continue
                nx = x + dx
                ny = y + dy
                if world.in_bounds(nx, ny) and world.get_tile(nx, ny).passable:
                    candidates.append((nx, ny))
    return candidates

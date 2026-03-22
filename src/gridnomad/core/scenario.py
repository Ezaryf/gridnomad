from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
import random
from typing import Any

from gridnomad.core.culture import CultureStore
from gridnomad.core.generation import GeneratedWorldBundle, generate_seeded_world
from gridnomad.core.models import (
    AgentState,
    AnimalUnitState,
    CityState,
    FactionState,
    KingdomState,
    SimulationConfig,
    StructureState,
    TileState,
    TileType,
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
    config = SimulationConfig.from_dict(data["config"])
    factions = {item["id"]: FactionState.from_dict(item) for item in data.get("factions", [])}
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
        tiles = [[TileState() for _ in range(config.width)] for _ in range(config.height)]
        for tile_data in data.get("tiles", []):
            x = int(tile_data["x"])
            y = int(tile_data["y"])
            tiles[y][x] = TileState.from_dict(tile_data)
        world = WorldState(
            width=config.width,
            height=config.height,
            tiles=tiles,
            agents={},
            factions=factions,
            seed=int(data.get("seed", 0) if seed_override is None else seed_override),
        )
        if biome_density_override is not None:
            config.biome_density = int(biome_density_override)
        if fauna_density_override is not None:
            config.fauna_density = int(fauna_density_override)
        if kingdom_growth_intensity_override is not None:
            config.kingdom_growth_intensity = int(kingdom_growth_intensity_override)
        generated = None

    world.agents = _build_agents(data.get("agents", []), world, generated)
    world.kingdoms = _build_kingdoms(data, world)
    world.cities = _build_cities(world)
    world.structures = _build_structures(world)
    world.animals = _build_animals(data.get("fauna"), world, config.world_seed, config.fauna_density)
    _refresh_worldbox_relationships(world)
    culture_store = CultureStore()
    for faction in data.get("factions", []):
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


def _build_kingdoms(data: dict[str, Any], world: WorldState) -> dict[str, KingdomState]:
    raw_kingdoms = {str(item["id"]): dict(item) for item in data.get("kingdoms", [])}
    kingdoms: dict[str, KingdomState] = {}
    for faction in world.factions.values():
        payload = raw_kingdoms.get(faction.id, {})
        controller = payload.get("controller") or {}
        kingdoms[faction.id] = KingdomState(
            id=faction.id,
            name=str(payload.get("name", faction.name)),
            race_kind=str(payload.get("race_kind", faction.race_kind)),
            color=payload.get("color", faction.banner_color),
            leader_id=faction.leader_id,
            capital_city_id=faction.capital_settlement_id,
            population=0,
            city_ids=[],
            controller_provider=controller.get("provider"),
            controller_model=controller.get("model"),
            auto_seeded=bool(payload.get("auto_seeded", False)),
        )
    return kingdoms


def _build_cities(world: WorldState) -> dict[str, CityState]:
    cities: dict[str, CityState] = {}
    for settlement in world.settlements:
        kingdom_id = str(settlement.get("owner_faction"))
        city_id = str(settlement["id"])
        district_kinds = [
            str(segment.get("district_kind", "ward"))
            for segment in settlement.get("footprint", [])
        ]
        race_kind = world.factions.get(kingdom_id, FactionState(id=kingdom_id, name=kingdom_id)).race_kind
        cities[city_id] = CityState(
            id=city_id,
            name=str(settlement.get("name", city_id)),
            kingdom_id=kingdom_id,
            race_kind=race_kind,
            x=int(settlement["x"]),
            y=int(settlement["y"]),
            population=0,
            level=2 if settlement.get("kind") == "capital" else 1,
            footprint=[dict(item) for item in settlement.get("footprint", [])],
            district_kinds=district_kinds,
        )
    return cities


def _build_structures(world: WorldState) -> dict[str, StructureState]:
    structures: dict[str, StructureState] = {}
    for settlement in world.settlements:
        kingdom_id = str(settlement.get("owner_faction"))
        city_id = str(settlement["id"])
        for index, segment in enumerate(settlement.get("footprint", [])):
            structure_id = f"{city_id}-structure-{index + 1:02d}"
            structures[structure_id] = StructureState(
                id=structure_id,
                kind=str(segment.get("district_kind", "district")),
                x=int(segment["x"]),
                y=int(segment["y"]),
                kingdom_id=kingdom_id,
                city_id=city_id,
                integrity=10,
            )
    return structures


def _build_animals(
    fauna: dict[str, Any] | None,
    world: WorldState,
    seed: int,
    density: int,
) -> dict[str, AnimalUnitState]:
    fauna = fauna or {}
    species_specs = fauna.get("species", [])
    if not species_specs:
        return {}
    rng = random.Random(seed + 991)
    animals: dict[str, AnimalUnitState] = {}
    occupied = {(agent.x, agent.y) for agent in world.agents.values() if agent.alive}
    next_index = 0
    for spec in species_specs:
        if spec.get("enabled", True) is False:
            continue
        count = max(0, int(round(int(spec.get("count", 0)) * max(0.15, density / 100.0))))
        species = str(spec.get("id", "sheep"))
        kind = str(spec.get("kind", "grazer"))
        candidates = _candidate_tiles_for_species(world, species)
        rng.shuffle(candidates)
        for x, y in candidates[:count]:
            if (x, y) in occupied:
                continue
            next_index += 1
            animal_id = f"{species}-{next_index:04d}"
            animals[animal_id] = AnimalUnitState(
                id=animal_id,
                species=species,
                name=str(spec.get("name", species.title())),
                kind=kind,
                x=x,
                y=y,
                hunger=4 if kind == "grazer" else 6,
                energy=6,
            )
            occupied.add((x, y))
    return animals


def _candidate_tiles_for_species(world: WorldState, species: str) -> list[tuple[int, int]]:
    candidates: list[tuple[int, int]] = []
    for y, row in enumerate(world.tiles):
        for x, tile in enumerate(row):
            if tile.terrain == TileType.WATER or not tile.passable:
                continue
            if species in {"sheep", "cows", "chickens"} and tile.biome in {"grassland", "meadow", "fertile-plains", "coast"}:
                candidates.append((x, y))
            elif species == "wolves" and tile.biome in {"forest", "scrub", "tundra", "alpine"}:
                candidates.append((x, y))
            elif species == "bears" and tile.biome in {"forest", "jungle", "alpine"}:
                candidates.append((x, y))
            elif species == "dragons" and tile.biome in {"volcanic", "mountain", "crystal", "alpine"}:
                candidates.append((x, y))
    if candidates:
        return candidates
    return [
        (x, y)
        for y, row in enumerate(world.tiles)
        for x, tile in enumerate(row)
        if tile.passable
    ]


def _refresh_worldbox_relationships(world: WorldState) -> None:
    city_ids = list(world.cities)
    for kingdom in world.kingdoms.values():
        kingdom.city_ids = []
        kingdom.population = 0
        if kingdom.id in world.factions:
            world.factions[kingdom.id].capital_settlement_id = None
    for city in world.cities.values():
        city.population = 0
        kingdom = world.kingdoms.get(city.kingdom_id)
        if kingdom is not None:
            kingdom.city_ids.append(city.id)
            if kingdom.capital_city_id is None or city.level > 1:
                kingdom.capital_city_id = city.id
                if city.kingdom_id in world.factions:
                    world.factions[city.kingdom_id].capital_settlement_id = city.id
    for agent in world.agents.values():
        agent.kingdom_id = agent.kingdom_id or agent.faction_id
        faction = world.factions.get(agent.faction_id)
        if faction is not None and not getattr(agent, "race_kind", None):
            agent.race_kind = faction.race_kind
        city_id = _nearest_city_id(world, agent.x, agent.y, agent.faction_id, city_ids)
        agent.home_city_id = city_id
        if city_id and city_id in world.cities:
            world.cities[city_id].population += 1
        kingdom = world.kingdoms.get(agent.faction_id)
        if kingdom is not None:
            kingdom.population += 1
            if kingdom.leader_id is None and agent.role == "leader":
                kingdom.leader_id = agent.id
    for kingdom_id, kingdom in world.kingdoms.items():
        faction = world.factions.get(kingdom_id)
        if faction is not None:
            faction.leader_id = kingdom.leader_id


def _nearest_city_id(
    world: WorldState,
    x: int,
    y: int,
    kingdom_id: str,
    city_ids: list[str],
) -> str | None:
    owned = [city for city in world.cities.values() if city.kingdom_id == kingdom_id]
    if not owned:
        return None
    city = min(owned, key=lambda item: (abs(item.x - x) + abs(item.y - y), item.id))
    return city.id

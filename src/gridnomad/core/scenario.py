from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from gridnomad.core.culture import CultureStore
from gridnomad.core.generation import GeneratedWorldBundle, generate_seeded_world
from gridnomad.core.models import AgentState, FactionState, SimulationConfig, TileState, WorldState


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
        generated = None

    world.agents = _build_agents(data.get("agents", []), world, generated)
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

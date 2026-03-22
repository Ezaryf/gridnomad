from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from gridnomad.core.culture import CultureStore
from gridnomad.core.models import AgentState, FactionState, SimulationConfig, TileState, WorldState


@dataclass(slots=True)
class ScenarioBundle:
    config: SimulationConfig
    world: WorldState
    culture_store: CultureStore


def load_scenario(path: str | Path, *, seed_override: int | None = None) -> ScenarioBundle:
    scenario_path = Path(path)
    data = json.loads(scenario_path.read_text(encoding="utf-8"))
    config = SimulationConfig.from_dict(data["config"])
    tiles = [[TileState() for _ in range(config.width)] for _ in range(config.height)]
    for tile_data in data.get("tiles", []):
        x = int(tile_data["x"])
        y = int(tile_data["y"])
        tiles[y][x] = TileState.from_dict(tile_data)

    factions = {item["id"]: FactionState.from_dict(item) for item in data.get("factions", [])}
    agents = {item["id"]: AgentState.from_dict(item) for item in data.get("agents", [])}
    world = WorldState(
        width=config.width,
        height=config.height,
        tiles=tiles,
        agents=agents,
        factions=factions,
        seed=int(data.get("seed", 0) if seed_override is None else seed_override),
    )

    culture_store = CultureStore()
    for faction in data.get("factions", []):
        culture_store.seed_faction(faction["id"], list(faction.get("culture", [])))

    return ScenarioBundle(config=config, world=world, culture_store=culture_store)


def dump_snapshot(path: str | Path, payload: dict[str, Any]) -> None:
    snapshot_path = Path(path)
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    snapshot_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

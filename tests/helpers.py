from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
src = str(SRC)
if src not in sys.path:
    sys.path.insert(0, src)

from gridnomad.ai.adapters import HeuristicLLMAdapter
from gridnomad.core.culture import CultureStore
from gridnomad.core.models import (
    AgentState,
    BigFivePersonality,
    Emotions,
    FactionState,
    Inventory,
    Needs,
    SimulationConfig,
    TileState,
    TileType,
    WorldState,
)
from gridnomad.core.simulation import Simulation


def build_agent(
    agent_id: str,
    faction_id: str,
    x: int,
    y: int,
    *,
    name: str | None = None,
    food: int = 2,
    wood: int = 2,
    stone: int = 1,
    health: int = 10,
    survival: int = 4,
    safety: int = 4,
    belonging: int = 4,
    esteem: int = 4,
    self_actualization: int = 4,
) -> AgentState:
    return AgentState(
        id=agent_id,
        name=name or agent_id.title(),
        faction_id=faction_id,
        x=x,
        y=y,
        personality=BigFivePersonality(
            openness=7,
            conscientiousness=6,
            extraversion=5,
            agreeableness=6,
            neuroticism=3,
        ),
        emotions=Emotions(joy=4, sadness=2, fear=1, anger=1, disgust=0, surprise=2),
        needs=Needs(
            survival=survival,
            safety=safety,
            belonging=belonging,
            esteem=esteem,
            self_actualization=self_actualization,
        ),
        inventory=Inventory(food=food, wood=wood, stone=stone),
        health=health,
    )


def build_world(
    *,
    width: int = 5,
    height: int = 5,
    agents: list[AgentState] | None = None,
    factions: list[FactionState] | None = None,
    tile_overrides: list[tuple[int, int, TileState]] | None = None,
    culture_seed: dict[str, list[dict[str, object]]] | None = None,
) -> tuple[SimulationConfig, WorldState, CultureStore]:
    config = SimulationConfig(width=width, height=height, perception_radius=2, snapshot_interval=10)
    tiles = [[TileState() for _ in range(width)] for _ in range(height)]
    for x, y, tile in tile_overrides or []:
        tiles[y][x] = tile
    faction_list = factions or [
        FactionState(id="red", name="Red"),
        FactionState(id="blue", name="Blue"),
    ]
    world = WorldState(
        width=width,
        height=height,
        tiles=tiles,
        agents={agent.id: agent for agent in (agents or [])},
        factions={faction.id: faction for faction in faction_list},
        seed=11,
    )
    culture = CultureStore()
    for faction_id, elements in (culture_seed or {}).items():
        culture.seed_faction(faction_id, elements)
    return config, world, culture


def build_simulation(
    *,
    agents: list[AgentState],
    tile_overrides: list[tuple[int, int, TileState]] | None = None,
    culture_seed: dict[str, list[dict[str, object]]] | None = None,
    adapter=None,
) -> Simulation:
    config, world, culture = build_world(
        agents=agents,
        tile_overrides=tile_overrides,
        culture_seed=culture_seed,
    )
    return Simulation(config, world, adapter or HeuristicLLMAdapter(), culture_store=culture)


def water_tile() -> TileState:
    return TileState(terrain=TileType.WATER)


def farmable_tile() -> TileState:
    return TileState(terrain=TileType.PLAIN, farmable=True)

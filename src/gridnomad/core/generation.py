from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass
import math
import random
from typing import Any

from gridnomad.core.models import FactionState, SimulationConfig, TileState, TileType, WorldState


CARDINALS = ((0, -1), (1, 0), (0, 1), (-1, 0))
MASK_BITS = ((0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8))

PROP_SPRITES = {
    "tree-cluster": "prop-tree-cluster",
    "grove": "prop-grove",
    "mountain": "prop-mountain-cluster",
    "stone-outcrop": "prop-stone-outcrop",
    "reed-bank": "prop-reeds",
    "ship": "prop-ship",
    "ford": "prop-ford",
    "lighthouse": "landmark-lighthouse",
    "observatory": "landmark-observatory",
    "palace": "landmark-palace",
    "market": "landmark-market",
    "shrine": "landmark-shrine",
    "river-trace": "trace-river",
}

PROP_LAYERS = {
    "tree-cluster": "flora",
    "grove": "flora",
    "mountain": "relief",
    "stone-outcrop": "detail",
    "reed-bank": "detail",
    "ship": "watercraft",
    "ford": "detail",
    "lighthouse": "landmark",
    "observatory": "landmark",
    "palace": "landmark",
    "market": "landmark",
    "shrine": "landmark",
    "river-trace": "trace",
}

SETTLEMENT_SPRITES = {
    "capital": "settlement-capital",
    "port": "settlement-port",
    "frontier": "settlement-frontier",
}


@dataclass(slots=True)
class GeneratedWorldBundle:
    world: WorldState
    faction_spawns: dict[str, list[tuple[int, int]]]


@dataclass(slots=True)
class GeneratorSettings:
    seed: int
    width: int
    height: int
    preset: str
    coastline_bias: int
    river_count: int
    settlement_density: int
    landmark_density: int
    biome_density: int
    fauna_density: int
    kingdom_growth_intensity: int

    @classmethod
    def from_sources(
        cls,
        config: SimulationConfig,
        generator: dict[str, Any] | None = None,
        *,
        seed_override: int | None = None,
        width_override: int | None = None,
        height_override: int | None = None,
        preset_override: str | None = None,
    ) -> "GeneratorSettings":
        generator = generator or {}
        return cls(
            seed=int(
                config.world_seed
                if seed_override is None
                else seed_override
            ),
            width=int(width_override or generator.get("width") or config.map_width or config.width),
            height=int(height_override or generator.get("height") or config.map_height or config.height),
            preset=str(preset_override or generator.get("preset") or config.generator_preset),
            coastline_bias=int(generator.get("coastline_bias", config.coastline_bias)),
            river_count=int(generator.get("river_count", config.river_count)),
            settlement_density=int(generator.get("settlement_density", config.settlement_density)),
            landmark_density=int(generator.get("landmark_density", config.landmark_density)),
            biome_density=int(generator.get("biome_density", config.biome_density)),
            fauna_density=int(generator.get("fauna_density", config.fauna_density)),
            kingdom_growth_intensity=int(generator.get("kingdom_growth_intensity", config.kingdom_growth_intensity)),
        )


def generate_seeded_world(
    config: SimulationConfig,
    factions: dict[str, FactionState],
    *,
    generator: dict[str, Any] | None = None,
    seed_override: int | None = None,
    width_override: int | None = None,
    height_override: int | None = None,
    preset_override: str | None = None,
) -> GeneratedWorldBundle:
    settings = GeneratorSettings.from_sources(
        config,
        generator,
        seed_override=seed_override,
        width_override=width_override,
        height_override=height_override,
        preset_override=preset_override,
    )
    rng = random.Random(settings.seed)
    width = settings.width
    height = settings.height
    tiles = [[TileState() for _ in range(width)] for _ in range(height)]

    biome_palette = _preset_palette(settings.preset)
    elevation_map = [[0 for _ in range(width)] for _ in range(height)]
    ridge_map = [[0.0 for _ in range(width)] for _ in range(height)]

    for y in range(height):
        for x in range(width):
            continent = _fractal_noise(settings.seed + 11, x, y, (96, 48, 24, 12), (1.0, 0.5, 0.25, 0.125))
            detail = _fractal_noise(settings.seed + 97, x, y, (64, 28, 14), (1.0, 0.45, 0.18))
            ridge = 1.0 - abs(_fractal_noise(settings.seed + 211, x, y, (56, 18, 8), (1.0, 0.55, 0.2)) * 2.0 - 1.0)
            nx = x / max(1, width - 1) * 2.0 - 1.0
            ny = y / max(1, height - 1) * 2.0 - 1.0
            radial = math.sqrt(nx * nx + ny * ny)
            bias = (settings.coastline_bias - 50) / 90.0
            elevation = (continent * 0.58) + (detail * 0.22) + (ridge * 0.16) + ((1.0 - radial) * 0.34) + bias
            elevation_map[y][x] = max(0, min(100, int(round(elevation * 100))))
            ridge_map[y][x] = ridge

    sea_level = _quantile(
        [elevation for row in elevation_map for elevation in row],
        max(0.22, min(0.68, 0.42 - ((settings.coastline_bias - 50) / 140.0))),
    )

    for y in range(height):
        for x in range(width):
            tile = tiles[y][x]
            tile.elevation = elevation_map[y][x]
            if elevation_map[y][x] <= sea_level:
                tile.terrain = TileType.WATER
                tile.biome = biome_palette["ocean"]
                tile.feature = "sea"
            else:
                tile.terrain = TileType.PLAIN
                tile.biome = biome_palette["grassland"]

    sea_distance = _distance_map(width, height, [(x, y) for y in range(height) for x in range(width) if tiles[y][x].terrain == TileType.WATER])
    river_paths = _generate_rivers(tiles, elevation_map, sea_distance, settings, rng)
    water_distance = _distance_map(width, height, [(x, y) for y in range(height) for x in range(width) if tiles[y][x].terrain == TileType.WATER])

    props: list[dict[str, Any]] = []
    regions: dict[str, dict[str, Any]] = {}
    settlements: list[dict[str, Any]] = []
    roads: list[dict[str, Any]] = []

    for y in range(height):
        for x in range(width):
            tile = tiles[y][x]
            if tile.terrain == TileType.WATER:
                if tile.feature == "river":
                    tile.biome = "river"
                elif sea_distance[y][x] <= 3:
                    tile.biome = biome_palette["coast"]
                else:
                    tile.biome = biome_palette["ocean"]
                tile.moisture = 100
                tile.fertility = 0
                tile.resource_tags = ["water"]
                tile.danger_tags = ["flood"]
                tile.race_affinity = {"human": 20, "orc": 10, "elf": 15, "dwarf": 5}
                tile.city_score = 0
                continue

            moisture_noise = _fractal_noise(settings.seed + 401, x, y, (52, 24, 12, 6), (1.0, 0.55, 0.24, 0.12))
            temperature_noise = _fractal_noise(settings.seed + 487, x, y, (64, 22, 10), (1.0, 0.42, 0.18))
            arcane_noise = _fractal_noise(settings.seed + 541, x, y, (44, 18, 8), (1.0, 0.48, 0.2))
            water_bonus = max(0.0, 1.0 - (water_distance[y][x] / 14.0))
            moisture = int(max(0.0, min(1.0, (moisture_noise * 0.62) + (water_bonus * 0.38))) * 100)
            tile.moisture = moisture
            fertility = int(max(0.0, min(1.0, ((moisture / 100.0) * 0.7) + (water_bonus * 0.3))) * 100)
            tile.fertility = fertility

            biome_bias = (settings.biome_density - 50) / 100.0

            if tile.elevation >= max(74, sea_level + 22) and ridge_map[y][x] >= 0.48:
                tile.feature = "mountain"
                tile.biome = "crystal" if arcane_noise > 0.81 else ("volcanic" if arcane_noise < 0.14 else biome_palette["alpine"])
                if _hash01(settings.seed + 923, x, y) > 0.35:
                    tile.resource = "stone"
                if _hash01(settings.seed + 517, x, y) > 0.44:
                    props.append(_prop("mountain", x, y, variant=_variant(settings.seed + 5, x, y, 4)))
            elif moisture >= (74 - biome_bias * 12) and temperature_noise >= 0.7 and tile.elevation < 66:
                tile.feature = "forest"
                tile.biome = "jungle"
            elif moisture >= (62 - biome_bias * 10) and tile.elevation < 78 and _hash01(settings.seed + 617, x, y) > 0.28:
                tile.feature = "forest"
                tile.biome = biome_palette["forest"]
                if _hash01(settings.seed + 771, x, y) > 0.42:
                    tile.resource = "wood"
                if _hash01(settings.seed + 557, x, y) > 0.46:
                    props.append(
                        _prop(
                            "tree-cluster",
                            x,
                            y,
                            variant=_variant(settings.seed + 19, x, y, 5),
                            density=1 + _variant(settings.seed + 23, x, y, 3),
                        )
                    )
            elif moisture <= 18 and temperature_noise >= 0.58:
                tile.biome = "desert"
                tile.resource = tile.resource or "stone"
            elif moisture <= 32 and temperature_noise >= 0.46:
                tile.biome = "savanna"
            elif moisture >= 72 and tile.elevation < 48:
                tile.biome = "swamp"
            elif temperature_noise <= 0.22:
                tile.biome = "snow" if tile.elevation >= 64 else "tundra"
            elif moisture <= 28:
                tile.biome = biome_palette["scrub"]
                if _hash01(settings.seed + 809, x, y) > 0.78:
                    props.append(_prop("stone-outcrop", x, y, variant=_variant(settings.seed + 43, x, y, 3)))
            elif sea_distance[y][x] <= 3:
                tile.biome = biome_palette["coast"]
                if _hash01(settings.seed + 877, x, y) > 0.83:
                    props.append(_prop("reed-bank", x, y, variant=_variant(settings.seed + 47, x, y, 3)))
            elif fertility >= 72:
                tile.biome = "fertile-plains"
            else:
                tile.biome = biome_palette["grassland"] if moisture < 58 else biome_palette["meadow"]
                if _hash01(settings.seed + 991, x, y) > 0.9:
                    props.append(_prop("grove", x, y, variant=_variant(settings.seed + 59, x, y, 4)))

            tile.farmable = (
                tile.terrain == TileType.PLAIN
                and tile.feature not in {"mountain"}
                and tile.biome in {biome_palette["grassland"], biome_palette["meadow"], biome_palette["coast"]}
                and moisture >= 28
            )
            if tile.resource is None and tile.farmable and _hash01(settings.seed + 1013, x, y) > 0.93:
                tile.resource = "food"
            tile.resource_tags = _resource_tags_for_tile(tile)
            tile.danger_tags = _danger_tags_for_tile(tile)
            tile.race_affinity = _race_affinity_for_tile(tile)
            tile.city_score = _city_score_for_tile(tile, water_distance[y][x])

    region_seeds = _choose_region_seeds(tiles, settings, rng)
    for index, (sx, sy) in enumerate(region_seeds):
        region_id = f"region-{index:02d}"
        tile = tiles[sy][sx]
        regions[region_id] = {
            "id": region_id,
            "name": _region_name(index, settings.seed),
            "center_x": sx,
            "center_y": sy,
            "biome": tile.biome,
        }
    _assign_regions(tiles, regions)

    settlements = _place_settlements(tiles, water_distance, factions, settings, rng)
    _decorate_settlement_footprints(tiles, settlements, settings)
    faction_spawns = _assign_territories(tiles, factions, settlements)
    roads = _build_roads(tiles, settlements, settings)
    _place_landmarks(tiles, settlements, props, settings, rng)
    _add_water_props(tiles, props, settings)
    _annotate_tile_visuals(tiles, settings)

    world = WorldState(
        width=width,
        height=height,
        tiles=tiles,
        agents={},
        factions=factions,
        seed=settings.seed,
        props=props,
        regions=regions,
        settlements=settlements,
        roads=roads,
        territories=_summarize_territories(tiles, settlements, factions),
    )
    _annotate_river_metadata(world, river_paths)
    return GeneratedWorldBundle(world=world, faction_spawns=faction_spawns)


def _preset_palette(preset: str) -> dict[str, str]:
    if preset == "archipelago":
        return {
            "ocean": "sea",
            "coast": "lagoon",
            "grassland": "island-grass",
            "meadow": "orchard",
            "forest": "rainforest",
            "scrub": "dune",
            "alpine": "volcanic-ridge",
        }
    if preset == "highland-realms":
        return {
            "ocean": "fjord",
            "coast": "shoreline",
            "grassland": "high-pasture",
            "meadow": "vale",
            "forest": "pinewood",
            "scrub": "moor",
            "alpine": "peak",
        }
    return {
        "ocean": "sea",
        "coast": "coast",
        "grassland": "grassland",
        "meadow": "meadow",
        "forest": "forest",
        "scrub": "scrub",
        "alpine": "alpine",
    }


def _generate_rivers(
    tiles: list[list[TileState]],
    elevation_map: list[list[int]],
    sea_distance: list[list[int]],
    settings: GeneratorSettings,
    rng: random.Random,
) -> list[list[tuple[int, int]]]:
    width = settings.width
    height = settings.height
    candidates = [
        (x, y)
        for y in range(height)
        for x in range(width)
        if tiles[y][x].terrain == TileType.PLAIN and elevation_map[y][x] >= 66 and sea_distance[y][x] >= 8
    ]
    candidates.sort(key=lambda point: (elevation_map[point[1]][point[0]], sea_distance[point[1]][point[0]]), reverse=True)
    rivers: list[list[tuple[int, int]]] = []
    chosen_sources: list[tuple[int, int]] = []
    for x, y in candidates:
        if len(rivers) >= settings.river_count:
            break
        if any(abs(x - ox) + abs(y - oy) < 18 for ox, oy in chosen_sources):
            continue
        path = _flow_to_water(tiles, elevation_map, sea_distance, (x, y), settings.seed + len(rivers) * 137)
        if len(path) < 9:
            continue
        chosen_sources.append((x, y))
        rivers.append(path)
        for px, py in path[1:-1]:
            tile = tiles[py][px]
            tile.terrain = TileType.WATER
            tile.biome = "river"
            tile.feature = "river"
            tile.farmable = False
    return rivers


def _flow_to_water(
    tiles: list[list[TileState]],
    elevation_map: list[list[int]],
    sea_distance: list[list[int]],
    start: tuple[int, int],
    river_seed: int,
) -> list[tuple[int, int]]:
    width = len(tiles[0])
    height = len(tiles)
    x, y = start
    path: list[tuple[int, int]] = []
    visited: set[tuple[int, int]] = set()
    steps = 0
    max_steps = width + height + 48
    while steps < max_steps:
        current = (x, y)
        if current in visited:
            break
        visited.add(current)
        path.append(current)
        if tiles[y][x].terrain == TileType.WATER and len(path) > 1:
            break
        neighbors: list[tuple[float, int, int]] = []
        for dx, dy in CARDINALS:
            nx = x + dx
            ny = y + dy
            if not (0 <= nx < width and 0 <= ny < height):
                continue
            downhill = elevation_map[ny][nx] - elevation_map[y][x]
            score = (
                elevation_map[ny][nx]
                + (sea_distance[ny][nx] * 3)
                + (downhill * 1.7)
                + (_hash01(river_seed, nx, ny) * 4.0)
            )
            neighbors.append((score, nx, ny))
        if not neighbors:
            break
        neighbors.sort(key=lambda item: item[0])
        _, x, y = neighbors[0]
        steps += 1
        if tiles[y][x].terrain == TileType.WATER:
            path.append((x, y))
            break
    return path


def _choose_region_seeds(
    tiles: list[list[TileState]],
    settings: GeneratorSettings,
    rng: random.Random,
) -> list[tuple[int, int]]:
    width = settings.width
    height = settings.height
    target = max(6, min(14, (width * height) // 2048 + 5))
    candidates = [
        (x, y)
        for y in range(height)
        for x in range(width)
        if tiles[y][x].terrain != TileType.WATER and tiles[y][x].feature != "mountain"
    ]
    rng.shuffle(candidates)
    chosen: list[tuple[int, int]] = []
    min_spacing = max(10, min(width, height) // 6)
    for x, y in candidates:
        if any(abs(x - ox) + abs(y - oy) < min_spacing for ox, oy in chosen):
            continue
        chosen.append((x, y))
        if len(chosen) >= target:
            break
    return chosen or [(width // 2, height // 2)]


def _assign_regions(tiles: list[list[TileState]], regions: dict[str, dict[str, Any]]) -> None:
    region_points = [
        (payload["id"], int(payload["center_x"]), int(payload["center_y"]))
        for payload in regions.values()
    ]
    for y, row in enumerate(tiles):
        for x, tile in enumerate(row):
            if tile.terrain == TileType.WATER:
                continue
            region_id = min(
                region_points,
                key=lambda item: (abs(item[1] - x) + abs(item[2] - y), item[0]),
            )[0]
            tile.region_id = region_id


def _place_settlements(
    tiles: list[list[TileState]],
    water_distance: list[list[int]],
    factions: dict[str, FactionState],
    settings: GeneratorSettings,
    rng: random.Random,
) -> list[dict[str, Any]]:
    width = settings.width
    height = settings.height
    target = max(len(factions) + 4, min(24, (width * height * settings.settlement_density) // 12288))
    candidates: list[tuple[float, int, int]] = []
    for y in range(height):
        for x in range(width):
            tile = tiles[y][x]
            if tile.terrain == TileType.WATER or tile.feature == "mountain":
                continue
            fertility = 1.0 if tile.farmable else 0.0
            moisture = tile.moisture / 100.0
            water_bonus = max(0.0, 1.0 - (water_distance[y][x] / 12.0))
            openness = 0.0 if tile.feature == "forest" else 0.35
            coastal = 0.2 if tile.biome in {"coast", "lagoon", "shoreline"} else 0.0
            score = (fertility * 1.8) + (moisture * 0.8) + (water_bonus * 1.4) + openness + coastal
            score += _hash01(settings.seed + 1229, x, y) * 0.3
            candidates.append((score, x, y))
    candidates.sort(reverse=True)

    settlements: list[dict[str, Any]] = []
    chosen: list[tuple[int, int]] = []
    capital_spacing = max(12, min(width, height) // 5)
    faction_ids = list(sorted(factions))
    for faction_id in faction_ids:
        faction = factions[faction_id]
        preferred = _manual_capital_candidate(tiles, faction)
        if preferred is not None:
            x, y = preferred
            chosen.append((x, y))
            settlement_id = f"{faction_id}-capital"
            settlements.append(
                {
                    "id": settlement_id,
                    "name": _settlement_name(settings.seed, len(settlements)),
                    "kind": "capital",
                    "x": x,
                    "y": y,
                    "owner_faction": faction_id,
                    "region_id": tiles[y][x].region_id,
                }
            )
            tiles[y][x].feature = "settlement"
            tiles[y][x].settlement_id = settlement_id
            tiles[y][x].owner_faction = faction_id
            continue
        for score, x, y in candidates:
            if any(abs(x - ox) + abs(y - oy) < capital_spacing for ox, oy in chosen):
                continue
            chosen.append((x, y))
            settlement_id = f"{faction_id}-capital"
            settlements.append(
                {
                    "id": settlement_id,
                    "name": _settlement_name(settings.seed, len(settlements)),
                    "kind": "capital",
                    "x": x,
                    "y": y,
                    "owner_faction": faction_id,
                    "region_id": tiles[y][x].region_id,
                }
            )
            tiles[y][x].feature = "settlement"
            tiles[y][x].settlement_id = settlement_id
            tiles[y][x].owner_faction = faction_id
            break

    neutral_spacing = max(8, min(width, height) // 7)
    for score, x, y in candidates:
        if len(settlements) >= target:
            break
        if any(abs(x - ox) + abs(y - oy) < neutral_spacing for ox, oy in chosen):
            continue
        chosen.append((x, y))
        owner = min(
            settlements[: len(faction_ids)],
            key=lambda settlement: abs(settlement["x"] - x) + abs(settlement["y"] - y),
        )["owner_faction"]
        settlement_id = f"settlement-{len(settlements):02d}"
        kind = "port" if tiles[y][x].biome in {"coast", "lagoon", "shoreline"} else "frontier"
        settlements.append(
            {
                "id": settlement_id,
                "name": _settlement_name(settings.seed, len(settlements)),
                "kind": kind,
                "x": x,
                "y": y,
                "owner_faction": owner,
                "region_id": tiles[y][x].region_id,
            }
        )
        tiles[y][x].feature = "settlement"
        tiles[y][x].settlement_id = settlement_id
        tiles[y][x].owner_faction = owner
    return settlements


def _decorate_settlement_footprints(
    tiles: list[list[TileState]],
    settlements: list[dict[str, Any]],
    settings: GeneratorSettings,
) -> None:
    occupied: set[tuple[int, int]] = set()
    width = settings.width
    height = settings.height
    for settlement in settlements:
        x = int(settlement["x"])
        y = int(settlement["y"])
        kind = str(settlement["kind"])
        settlement["district_kind"] = kind
        settlement["sprite_key"] = SETTLEMENT_SPRITES.get(kind, "settlement-frontier")
        footprint: list[dict[str, Any]] = []
        for index, (dx, dy, district_kind) in enumerate(_district_pattern(kind, tiles, x, y)):
            nx = x + dx
            ny = y + dy
            if not (0 <= nx < width and 0 <= ny < height):
                continue
            if (nx, ny) in occupied:
                continue
            tile = tiles[ny][nx]
            if tile.terrain == TileType.WATER or tile.feature == "mountain":
                continue
            footprint.append(
                {
                    "x": nx,
                    "y": ny,
                    "district_kind": district_kind,
                    "sprite_key": f"{settlement['sprite_key']}-{district_kind}",
                    "is_core": index == 0,
                }
            )
            occupied.add((nx, ny))
            tile.owner_faction = tile.owner_faction or settlement["owner_faction"]
            if tile.settlement_id is None:
                tile.settlement_id = settlement["id"]
            if index > 0 and tile.feature in {None, "forest", "road"}:
                tile.feature = "district"
        settlement["footprint"] = footprint


def _district_pattern(
    kind: str,
    tiles: list[list[TileState]],
    x: int,
    y: int,
) -> list[tuple[int, int, str]]:
    shoreline = _shore_direction(tiles, x, y)
    if kind == "capital":
        return [
            (0, 0, "core"),
            (-1, 0, "ward"),
            (1, 0, "ward"),
            (0, -1, "civic"),
            (0, 1, "garden"),
            (-1, 1, "garden"),
            (1, 1, "garden"),
        ]
    if kind == "port":
        if shoreline == "west":
            return [(0, 0, "core"), (1, 0, "market"), (0, -1, "dock"), (0, 1, "dock")]
        if shoreline == "east":
            return [(0, 0, "core"), (-1, 0, "market"), (0, -1, "dock"), (0, 1, "dock")]
        if shoreline == "north":
            return [(0, 0, "core"), (0, 1, "market"), (-1, 0, "dock"), (1, 0, "dock")]
        return [(0, 0, "core"), (0, -1, "market"), (-1, 0, "dock"), (1, 0, "dock")]
    return [(0, 0, "core"), (-1, 0, "homestead"), (0, 1, "homestead"), (1, 0, "store")]


def _assign_territories(
    tiles: list[list[TileState]],
    factions: dict[str, FactionState],
    settlements: list[dict[str, Any]],
) -> dict[str, list[tuple[int, int]]]:
    capitals = {
        settlement["owner_faction"]: (int(settlement["x"]), int(settlement["y"]))
        for settlement in settlements
        if settlement["kind"] == "capital"
    }
    spawns: dict[str, list[tuple[int, int]]] = {faction_id: [] for faction_id in factions}
    for y, row in enumerate(tiles):
        for x, tile in enumerate(row):
            if tile.terrain == TileType.WATER:
                continue
            faction_id = min(
                capitals.items(),
                key=lambda item: (abs(item[1][0] - x) + abs(item[1][1] - y), item[0]),
            )[0]
            tile.owner_faction = tile.owner_faction or faction_id
            if tile.settlement_id:
                spawns[faction_id].append((x, y))
    for faction_id, capital in capitals.items():
        spawns[faction_id].insert(0, capital)
    return spawns


def _annotate_tile_visuals(
    tiles: list[list[TileState]],
    settings: GeneratorSettings,
) -> None:
    for y, row in enumerate(tiles):
        for x, tile in enumerate(row):
            tile.visual_variant = _variant(settings.seed + 1459, x, y, 4)
            tile.edge_mask = _contrast_mask(tiles, x, y)
            tile.river_mask = _connection_mask(tiles, x, y, _is_river_connection)
            tile.road_mask = _connection_mask(tiles, x, y, _is_road_connection)
            tile.elevation_band = _elevation_band(tile.elevation, tile.biome)
            tile.decal = _choose_tile_decal(tile, settings.seed, x, y)


def _contrast_mask(tiles: list[list[TileState]], x: int, y: int) -> int:
    tile = tiles[y][x]
    mask = 0
    is_water = tile.terrain == TileType.WATER
    width = len(tiles[0])
    height = len(tiles)
    for dx, dy, bit in MASK_BITS:
        nx = x + dx
        ny = y + dy
        if not (0 <= nx < width and 0 <= ny < height):
            continue
        other = tiles[ny][nx]
        if is_water and other.terrain != TileType.WATER:
            mask |= bit
        elif not is_water and other.terrain == TileType.WATER:
            mask |= bit
    return mask


def _connection_mask(
    tiles: list[list[TileState]],
    x: int,
    y: int,
    predicate,
) -> int:
    if not predicate(tiles[y][x]):
        return 0
    mask = 0
    width = len(tiles[0])
    height = len(tiles)
    for dx, dy, bit in MASK_BITS:
        nx = x + dx
        ny = y + dy
        if not (0 <= nx < width and 0 <= ny < height):
            continue
        if predicate(tiles[ny][nx]):
            mask |= bit
    return mask


def _is_river_connection(tile: TileState) -> bool:
    return tile.terrain == TileType.WATER and tile.feature == "river"


def _is_road_connection(tile: TileState) -> bool:
    return tile.terrain == TileType.BRIDGE or tile.feature in {"road", "settlement"}


def _elevation_band(elevation: int, biome: str) -> str:
    if biome in {"sea", "fjord", "river"}:
        return "water"
    if elevation >= 86:
        return "summit"
    if elevation >= 68:
        return "highland"
    if elevation >= 48:
        return "upland"
    if biome in {"coast", "lagoon", "shoreline"}:
        return "coast"
    return "lowland"


def _resource_tags_for_tile(tile: TileState) -> list[str]:
    tags: list[str] = []
    if tile.resource:
        tags.append(tile.resource)
    if tile.farmable or tile.biome in {"fertile-plains", "grassland", "meadow"}:
        tags.append("food")
    if tile.feature == "forest" or tile.biome in {"forest", "jungle"}:
        tags.append("wood")
    if tile.feature == "mountain" or tile.biome in {"alpine", "crystal", "volcanic"}:
        tags.append("stone")
    if tile.biome == "crystal":
        tags.append("crystal")
    return sorted(dict.fromkeys(tags))


def _danger_tags_for_tile(tile: TileState) -> list[str]:
    tags: list[str] = []
    if tile.biome in {"volcanic", "swamp"}:
        tags.append("hazard")
    if tile.biome in {"crystal", "arcane"}:
        tags.append("arcane")
    if tile.feature == "mountain":
        tags.append("rough-terrain")
    if tile.terrain == TileType.WATER and tile.feature != "river":
        tags.append("flood")
    return tags


def _race_affinity_for_tile(tile: TileState) -> dict[str, int]:
    affinity = {"human": 55, "orc": 45, "elf": 45, "dwarf": 45}
    if tile.biome in {"grassland", "fertile-plains", "meadow", "coast"}:
        affinity["human"] += 25
    if tile.biome in {"forest", "jungle", "grove", "meadow"}:
        affinity["elf"] += 30
    if tile.biome in {"alpine", "crystal", "mountain"} or tile.feature == "mountain":
        affinity["dwarf"] += 34
    if tile.biome in {"scrub", "desert", "savanna", "volcanic"}:
        affinity["orc"] += 30
    if "hazard" in tile.danger_tags:
        affinity["human"] -= 12
        affinity["elf"] -= 8
    return {race: max(0, min(100, value)) for race, value in affinity.items()}


def _city_score_for_tile(tile: TileState, water_distance: int) -> int:
    base = 18
    base += tile.fertility // 3
    base += max(0, 18 - min(water_distance, 18))
    if tile.biome in {"coast", "lagoon", "shoreline"}:
        base += 12
    if tile.feature == "mountain":
        base -= 14
    if "hazard" in tile.danger_tags:
        base -= 12
    if tile.biome == "fertile-plains":
        base += 10
    return max(0, min(100, base))


def _manual_capital_candidate(
    tiles: list[list[TileState]],
    faction: FactionState,
) -> tuple[int, int] | None:
    if faction.spawn_x is None or faction.spawn_y is None:
        return None
    width = len(tiles[0])
    height = len(tiles)
    x = max(0, min(width - 1, faction.spawn_x))
    y = max(0, min(height - 1, faction.spawn_y))
    for radius in range(0, 5):
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                if abs(dx) + abs(dy) != radius:
                    continue
                nx = x + dx
                ny = y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    tile = tiles[ny][nx]
                    if tile.passable and tile.feature != "mountain":
                        return nx, ny
    return None


def _choose_tile_decal(tile: TileState, seed: int, x: int, y: int) -> str | None:
    value = _hash01(seed + 1601, x, y)
    if tile.terrain == TileType.WATER:
        if tile.feature == "river" and value > 0.8:
            return "water-glint"
        if tile.edge_mask and value > 0.72:
            return "sea-foam"
        return None
    if tile.settlement_id:
        return None
    if tile.feature == "forest" and value > 0.55:
        return "fern-cluster"
    if tile.feature == "mountain" and value > 0.44:
        return "snow-cap"
    if tile.biome in {"coast", "lagoon", "shoreline"} and value > 0.68:
        return "shell-bank"
    if tile.biome in {"grassland", "meadow", "island-grass", "orchard", "high-pasture", "vale"}:
        if value > 0.9:
            return "wildflowers"
        if value > 0.78:
            return "grass-tuft"
    if tile.biome in {"scrub", "dune", "moor"} and value > 0.82:
        return "pebbles"
    return None


def _shore_direction(tiles: list[list[TileState]], x: int, y: int) -> str:
    width = len(tiles[0])
    height = len(tiles)
    for dx, dy, _ in MASK_BITS:
        nx = x + dx
        ny = y + dy
        if 0 <= nx < width and 0 <= ny < height and tiles[ny][nx].terrain == TileType.WATER:
            if dx == -1:
                return "west"
            if dx == 1:
                return "east"
            if dy == -1:
                return "north"
            if dy == 1:
                return "south"
    return "south"


def _build_roads(
    tiles: list[list[TileState]],
    settlements: list[dict[str, Any]],
    settings: GeneratorSettings,
) -> list[dict[str, Any]]:
    capitals = {
        settlement["owner_faction"]: settlement
        for settlement in settlements
        if settlement["kind"] == "capital"
    }
    roads: list[dict[str, Any]] = []
    for settlement in settlements:
        owner = settlement["owner_faction"]
        if settlement["kind"] == "capital":
            continue
        target = capitals[owner]
        path = _greedy_path(
            tiles,
            (int(settlement["x"]), int(settlement["y"])),
            (int(target["x"]), int(target["y"])),
        )
        road_id = f"road-{len(roads):02d}"
        roads.append(
            {
                "id": road_id,
                "from_settlement_id": settlement["id"],
                "to_settlement_id": target["id"],
                "points": [{"x": x, "y": y} for x, y in path],
            }
        )
        for x, y in path:
            tile = tiles[y][x]
            if tile.terrain == TileType.WATER:
                tile.terrain = TileType.BRIDGE
                tile.feature = "bridge"
            elif tile.feature in {None, "forest"}:
                tile.feature = "road"
    return roads


def _greedy_path(
    tiles: list[list[TileState]],
    start: tuple[int, int],
    end: tuple[int, int],
) -> list[tuple[int, int]]:
    width = len(tiles[0])
    height = len(tiles)
    x, y = start
    path = [start]
    visited = {start}
    for _ in range(width + height + 64):
        if (x, y) == end:
            break
        options: list[tuple[float, int, int]] = []
        for dx, dy in CARDINALS:
            nx = x + dx
            ny = y + dy
            if not (0 <= nx < width and 0 <= ny < height):
                continue
            tile = tiles[ny][nx]
            if (nx, ny) in visited:
                continue
            water_penalty = 1.8 if tile.terrain == TileType.WATER else 0.0
            mountain_penalty = 4.0 if tile.feature == "mountain" else 0.0
            score = abs(end[0] - nx) + abs(end[1] - ny) + water_penalty + mountain_penalty
            options.append((score, nx, ny))
        if not options:
            break
        options.sort(key=lambda item: item[0])
        _, x, y = options[0]
        visited.add((x, y))
        path.append((x, y))
    return path


def _place_landmarks(
    tiles: list[list[TileState]],
    settlements: list[dict[str, Any]],
    props: list[dict[str, Any]],
    settings: GeneratorSettings,
    rng: random.Random,
) -> None:
    landmark_target = max(5, min(18, (settings.width * settings.height * settings.landmark_density) // 24576))
    candidates: list[tuple[float, int, int, str]] = []
    for settlement in settlements:
        x = int(settlement["x"])
        y = int(settlement["y"])
        kind = "palace" if settlement["kind"] == "capital" else "market"
        candidates.append((3.0, x, y, kind))
    for y, row in enumerate(tiles):
        for x, tile in enumerate(row):
            if tile.feature == "mountain":
                candidates.append((2.6, x, y, "observatory"))
            elif tile.biome in {"coast", "lagoon", "shoreline"} and tile.terrain != TileType.WATER:
                candidates.append((1.8, x, y, "lighthouse"))
            elif tile.feature == "forest":
                candidates.append((1.2, x, y, "shrine"))
    candidates.sort(reverse=True)
    used: set[tuple[int, int]] = set()
    for _, x, y, kind in candidates:
        if len(used) >= landmark_target:
            break
        if (x, y) in used:
            continue
        if any(abs(x - ox) + abs(y - oy) < 9 for ox, oy in used):
            continue
        props.append(_prop(kind, x, y, variant=_variant(settings.seed + 311, x, y, 4)))
        tile = tiles[y][x]
        if tile.feature in {None, "road", "forest"}:
            tile.feature = "landmark"
        used.add((x, y))


def _add_water_props(tiles: list[list[TileState]], props: list[dict[str, Any]], settings: GeneratorSettings) -> None:
    for y, row in enumerate(tiles):
        for x, tile in enumerate(row):
            if tile.terrain != TileType.WATER:
                continue
            if tile.feature == "sea" and tile.biome == "sea" and _hash01(settings.seed + 521, x, y) > 0.992:
                props.append(_prop("ship", x, y, variant=_variant(settings.seed + 607, x, y, 3)))
            elif tile.feature == "river" and _hash01(settings.seed + 653, x, y) > 0.985:
                props.append(_prop("ford", x, y, variant=_variant(settings.seed + 701, x, y, 2)))


def _summarize_territories(
    tiles: list[list[TileState]],
    settlements: list[dict[str, Any]],
    factions: dict[str, FactionState],
) -> dict[str, dict[str, Any]]:
    region_tracker: dict[str, set[str]] = {faction_id: set() for faction_id in factions}
    tile_count: Counter[str] = Counter()
    for row in tiles:
        for tile in row:
            if tile.owner_faction:
                tile_count[tile.owner_faction] += 1
                if tile.region_id:
                    region_tracker[tile.owner_faction].add(tile.region_id)
    capitals = {
        settlement["owner_faction"]: settlement["id"]
        for settlement in settlements
        if settlement["kind"] == "capital"
    }
    return {
        faction_id: {
            "capital_id": capitals.get(faction_id),
            "tile_count": tile_count.get(faction_id, 0),
            "region_ids": sorted(region_tracker.get(faction_id, set())),
        }
        for faction_id in sorted(factions)
    }


def _annotate_river_metadata(world: WorldState, river_paths: list[list[tuple[int, int]]]) -> None:
    for index, path in enumerate(river_paths):
        world.props.append(
            {
                "id": f"river-{index:02d}",
                "kind": "river-trace",
                "sprite_key": PROP_SPRITES["river-trace"],
                "layer": PROP_LAYERS["river-trace"],
                "points": [{"x": x, "y": y} for x, y in path],
            }
        )


def _distance_map(width: int, height: int, sources: list[tuple[int, int]]) -> list[list[int]]:
    distance = [[9999 for _ in range(width)] for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()
    for x, y in sources:
        if 0 <= x < width and 0 <= y < height and distance[y][x] > 0:
            distance[y][x] = 0
            queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for dx, dy in CARDINALS:
            nx = x + dx
            ny = y + dy
            if not (0 <= nx < width and 0 <= ny < height):
                continue
            nd = distance[y][x] + 1
            if nd < distance[ny][nx]:
                distance[ny][nx] = nd
                queue.append((nx, ny))
    return distance


def _settlement_name(seed: int, index: int) -> str:
    prefixes = ("Alder", "Cinder", "River", "Silver", "Stone", "North", "Bright", "Oak", "Glass", "Harbor")
    suffixes = ("fall", "reach", "mere", "watch", "ford", "cross", "haven", "crest", "hollow", "gate")
    rng = random.Random(seed * 31 + index * 17)
    return f"{rng.choice(prefixes)}{rng.choice(suffixes)}"


def _region_name(index: int, seed: int) -> str:
    left = ("Sun", "Moon", "Cedar", "Moss", "Granite", "Mirror", "River", "Amber", "Iron", "Pine")
    right = ("Vale", "March", "Step", "Basin", "Reach", "Wilds", "Lowlands", "Terrace", "Fields", "Crown")
    rng = random.Random(seed * 13 + index)
    return f"{rng.choice(left)} {rng.choice(right)}"


def _prop(kind: str, x: int, y: int, **extra: Any) -> dict[str, Any]:
    sprite_key = extra.pop("sprite_key", PROP_SPRITES.get(kind, kind))
    layer = extra.pop("layer", PROP_LAYERS.get(kind, "detail"))
    payload = {
        "id": f"{kind}-{x}-{y}-{extra.get('variant', 0)}",
        "kind": kind,
        "x": x,
        "y": y,
        "sprite_key": sprite_key,
        "layer": layer,
    }
    payload.update(extra)
    return payload


def _variant(seed: int, x: int, y: int, count: int) -> int:
    return int(_hash01(seed, x, y) * count) % max(1, count)


def _quantile(values: list[int], fraction: float) -> int:
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(len(ordered) * fraction)))
    return ordered[index]


def _fractal_noise(
    seed: int,
    x: int,
    y: int,
    scales: tuple[int, ...],
    weights: tuple[float, ...],
) -> float:
    total = 0.0
    weight_total = 0.0
    for octave, (scale, weight) in enumerate(zip(scales, weights)):
        total += _value_noise(seed + octave * 733, x, y, scale) * weight
        weight_total += weight
    return total / weight_total if weight_total else 0.0


def _value_noise(seed: int, x: int, y: int, scale: int) -> float:
    if scale <= 1:
        return _hash01(seed, x, y)
    gx0 = x // scale
    gy0 = y // scale
    gx1 = gx0 + 1
    gy1 = gy0 + 1
    tx = (x % scale) / scale
    ty = (y % scale) / scale
    sx = _smoothstep(tx)
    sy = _smoothstep(ty)
    v00 = _hash01(seed, gx0, gy0)
    v10 = _hash01(seed, gx1, gy0)
    v01 = _hash01(seed, gx0, gy1)
    v11 = _hash01(seed, gx1, gy1)
    top = _lerp(v00, v10, sx)
    bottom = _lerp(v01, v11, sx)
    return _lerp(top, bottom, sy)


def _smoothstep(value: float) -> float:
    return value * value * (3.0 - (2.0 * value))


def _lerp(start: float, end: float, amount: float) -> float:
    return start + ((end - start) * amount)


def _hash01(seed: int, x: int, y: int) -> float:
    value = (x * 374761393) + (y * 668265263) + (seed * 1442695041)
    value = (value ^ (value >> 13)) * 1274126177
    value ^= value >> 16
    return (value & 0xFFFFFFFF) / 0xFFFFFFFF

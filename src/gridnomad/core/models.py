from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


STATE_MIN = 0
STATE_MAX = 10


def require_int(
    name: str,
    value: Any,
    minimum: int | None = None,
    maximum: int | None = None,
    clamp: bool = False,
) -> int:
    try:
        integer = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be an integer, got {value!r}") from exc
    if minimum is not None and integer < minimum:
        if clamp:
            integer = minimum
        else:
            raise ValueError(f"{name} must be >= {minimum}, got {integer}")
    if maximum is not None and integer > maximum:
        if clamp:
            integer = maximum
        else:
            raise ValueError(f"{name} must be <= {maximum}, got {integer}")
    return integer


def direction_from_delta(dx: int, dy: int) -> str:
    if dx == 0 and dy == 0:
        return "here"
    if dx == 0:
        return f"{abs(dy)} tile{'s' if abs(dy) != 1 else ''} {'south' if dy > 0 else 'north'}"
    if dy == 0:
        return f"{abs(dx)} tile{'s' if abs(dx) != 1 else ''} {'east' if dx > 0 else 'west'}"
    return (
        f"{abs(dx)} tile{'s' if abs(dx) != 1 else ''} {'east' if dx > 0 else 'west'} and "
        f"{abs(dy)} tile{'s' if abs(dy) != 1 else ''} {'south' if dy > 0 else 'north'}"
    )


@dataclass(slots=True)
class BigFivePersonality:
    openness: int
    conscientiousness: int
    extraversion: int
    agreeableness: int
    neuroticism: int

    def __post_init__(self) -> None:
        self.openness = require_int("openness", self.openness, STATE_MIN, STATE_MAX)
        self.conscientiousness = require_int(
            "conscientiousness", self.conscientiousness, STATE_MIN, STATE_MAX
        )
        self.extraversion = require_int("extraversion", self.extraversion, STATE_MIN, STATE_MAX)
        self.agreeableness = require_int(
            "agreeableness", self.agreeableness, STATE_MIN, STATE_MAX
        )
        self.neuroticism = require_int("neuroticism", self.neuroticism, STATE_MIN, STATE_MAX)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BigFivePersonality":
        return cls(
            openness=data["openness"],
            conscientiousness=data["conscientiousness"],
            extraversion=data["extraversion"],
            agreeableness=data["agreeableness"],
            neuroticism=data["neuroticism"],
        )

    def to_dict(self) -> dict[str, int]:
        return {
            "openness": self.openness,
            "conscientiousness": self.conscientiousness,
            "extraversion": self.extraversion,
            "agreeableness": self.agreeableness,
            "neuroticism": self.neuroticism,
        }


@dataclass(slots=True)
class Emotions:
    joy: int
    sadness: int
    fear: int
    anger: int
    disgust: int
    surprise: int

    def __post_init__(self) -> None:
        self.joy = require_int("joy", self.joy, STATE_MIN, STATE_MAX)
        self.sadness = require_int("sadness", self.sadness, STATE_MIN, STATE_MAX)
        self.fear = require_int("fear", self.fear, STATE_MIN, STATE_MAX)
        self.anger = require_int("anger", self.anger, STATE_MIN, STATE_MAX)
        self.disgust = require_int("disgust", self.disgust, STATE_MIN, STATE_MAX)
        self.surprise = require_int("surprise", self.surprise, STATE_MIN, STATE_MAX)

    @classmethod
    def from_dict(cls, data: dict[str, Any], *, clamp: bool = False) -> "Emotions":
        return cls(
            joy=require_int("joy", data["Joy"] if "Joy" in data else data["joy"], STATE_MIN, STATE_MAX, clamp),
            sadness=require_int(
                "sadness",
                data["Sadness"] if "Sadness" in data else data["sadness"],
                STATE_MIN,
                STATE_MAX,
                clamp,
            ),
            fear=require_int("fear", data["Fear"] if "Fear" in data else data["fear"], STATE_MIN, STATE_MAX, clamp),
            anger=require_int(
                "anger",
                data["Anger"] if "Anger" in data else data["anger"],
                STATE_MIN,
                STATE_MAX,
                clamp,
            ),
            disgust=require_int(
                "disgust",
                data["Disgust"] if "Disgust" in data else data["disgust"],
                STATE_MIN,
                STATE_MAX,
                clamp,
            ),
            surprise=require_int(
                "surprise",
                data["Surprise"] if "Surprise" in data else data["surprise"],
                STATE_MIN,
                STATE_MAX,
                clamp,
            ),
        )

    def to_dict(self) -> dict[str, int]:
        return {
            "Joy": self.joy,
            "Sadness": self.sadness,
            "Fear": self.fear,
            "Anger": self.anger,
            "Disgust": self.disgust,
            "Surprise": self.surprise,
        }

    def dominant(self) -> tuple[str, int]:
        emotions = {
            "Joy": self.joy,
            "Sadness": self.sadness,
            "Fear": self.fear,
            "Anger": self.anger,
            "Disgust": self.disgust,
            "Surprise": self.surprise,
        }
        return max(emotions.items(), key=lambda item: item[1])


@dataclass(slots=True)
class Needs:
    survival: int
    safety: int
    belonging: int
    esteem: int
    self_actualization: int

    def __post_init__(self) -> None:
        self.survival = require_int("survival", self.survival, STATE_MIN, STATE_MAX)
        self.safety = require_int("safety", self.safety, STATE_MIN, STATE_MAX)
        self.belonging = require_int("belonging", self.belonging, STATE_MIN, STATE_MAX)
        self.esteem = require_int("esteem", self.esteem, STATE_MIN, STATE_MAX)
        self.self_actualization = require_int(
            "self_actualization", self.self_actualization, STATE_MIN, STATE_MAX
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any], *, clamp: bool = False) -> "Needs":
        return cls(
            survival=require_int(
                "survival",
                data["Survival"] if "Survival" in data else data["survival"],
                STATE_MIN,
                STATE_MAX,
                clamp,
            ),
            safety=require_int(
                "safety",
                data["Safety"] if "Safety" in data else data["safety"],
                STATE_MIN,
                STATE_MAX,
                clamp,
            ),
            belonging=require_int(
                "belonging",
                data["Belonging"] if "Belonging" in data else data["belonging"],
                STATE_MIN,
                STATE_MAX,
                clamp,
            ),
            esteem=require_int(
                "esteem",
                data["Esteem"] if "Esteem" in data else data["esteem"],
                STATE_MIN,
                STATE_MAX,
                clamp,
            ),
            self_actualization=require_int(
                "self_actualization",
                data["Self_Actualization"]
                if "Self_Actualization" in data
                else data["self_actualization"],
                STATE_MIN,
                STATE_MAX,
                clamp,
            ),
        )

    def to_dict(self) -> dict[str, int]:
        return {
            "Survival": self.survival,
            "Safety": self.safety,
            "Belonging": self.belonging,
            "Esteem": self.esteem,
            "Self_Actualization": self.self_actualization,
        }

    def any_at_or_above(self, threshold: int) -> bool:
        return any(
            value >= threshold
            for value in (
                self.survival,
                self.safety,
                self.belonging,
                self.esteem,
                self.self_actualization,
            )
        )


@dataclass(slots=True)
class Inventory:
    food: int = 0
    wood: int = 0
    stone: int = 0

    def __post_init__(self) -> None:
        self.food = require_int("food", self.food, 0)
        self.wood = require_int("wood", self.wood, 0)
        self.stone = require_int("stone", self.stone, 0)

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "Inventory":
        if data is None:
            return cls()
        return cls(
            food=data.get("food", 0),
            wood=data.get("wood", 0),
            stone=data.get("stone", 0),
        )

    def to_dict(self) -> dict[str, int]:
        return {"food": self.food, "wood": self.wood, "stone": self.stone}

    def most_abundant(self) -> tuple[str, int]:
        pool = {"food": self.food, "wood": self.wood, "stone": self.stone}
        return max(pool.items(), key=lambda item: item[1])


class TileType(StrEnum):
    PLAIN = "plain"
    WATER = "water"
    BRIDGE = "bridge"
    HOUSE = "house"
    FARM = "farm"


@dataclass(slots=True)
class TileState:
    terrain: TileType = TileType.PLAIN
    farmable: bool = False
    resource: str | None = None
    owner_faction: str | None = None
    farm_progress: int = 0
    biome: str = "grassland"
    elevation: int = 0
    moisture: int = 0
    feature: str | None = None
    region_id: str | None = None
    settlement_id: str | None = None
    visual_variant: int = 0
    edge_mask: int = 0
    river_mask: int = 0
    road_mask: int = 0
    decal: str | None = None
    elevation_band: str = "lowland"
    height_level: int = 0
    fertility: int = 0
    resource_tags: list[str] = field(default_factory=list)
    danger_tags: list[str] = field(default_factory=list)
    race_affinity: dict[str, int] = field(default_factory=dict)
    city_score: int = 0

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TileState":
        return cls(
            terrain=TileType(data.get("terrain", TileType.PLAIN)),
            farmable=bool(data.get("farmable", False)),
            resource=data.get("resource"),
            owner_faction=data.get("owner_faction", data.get("owner_faction_id")),
            farm_progress=require_int("farm_progress", data.get("farm_progress", 0), 0),
            biome=str(data.get("biome", "grassland")),
            elevation=require_int("elevation", data.get("elevation", 0), 0, 100, clamp=True),
            moisture=require_int("moisture", data.get("moisture", 0), 0, 100, clamp=True),
            feature=data.get("feature"),
            region_id=data.get("region_id"),
            settlement_id=data.get("settlement_id"),
            visual_variant=require_int("visual_variant", data.get("visual_variant", 0), 0, 16, clamp=True),
            edge_mask=require_int("edge_mask", data.get("edge_mask", 0), 0, 15, clamp=True),
            river_mask=require_int("river_mask", data.get("river_mask", 0), 0, 15, clamp=True),
            road_mask=require_int("road_mask", data.get("road_mask", 0), 0, 15, clamp=True),
            decal=data.get("decal"),
            elevation_band=str(data.get("elevation_band", "lowland")),
            height_level=require_int("height_level", data.get("height_level", 0), 0, 5, clamp=True),
            fertility=require_int("fertility", data.get("fertility", 0), 0, 100, clamp=True),
            resource_tags=[str(item) for item in data.get("resource_tags", [])],
            danger_tags=[str(item) for item in data.get("danger_tags", [])],
            race_affinity={str(key): require_int(f"race_affinity[{key}]", value, 0, 100, clamp=True) for key, value in data.get("race_affinity", {}).items()},
            city_score=require_int("city_score", data.get("city_score", 0), 0, 100, clamp=True),
        )

    @property
    def passable(self) -> bool:
        return self.terrain != TileType.WATER and self.feature not in {"mountain", "cliff"}

    @property
    def buildable(self) -> bool:
        return self.passable and self.feature not in {"mountain", "cliff", "landmark"}

    def describe(self) -> str:
        bits: list[str] = []
        if self.terrain == TileType.WATER and self.feature == "river":
            bits.append("river")
        elif self.terrain == TileType.WATER:
            bits.append(self.biome or "water")
        elif self.terrain == TileType.BRIDGE:
            bits.append("bridge")
        elif self.terrain == TileType.HOUSE:
            bits.append("house")
        elif self.terrain == TileType.FARM:
            bits.append("farm")
        elif self.feature:
            bits.append(self.feature)
        else:
            bits.append(self.biome or "plain")
        if self.biome and self.biome not in bits:
            bits.append(self.biome)
        if self.resource:
            bits.append(self.resource)
        if self.farmable and self.terrain == TileType.PLAIN:
            bits.append("farmable")
        if self.settlement_id:
            bits.append("settlement")
        return " ".join(dict.fromkeys(bits))

    def to_dict(self) -> dict[str, Any]:
        return {
            "terrain": self.terrain.value,
            "farmable": self.farmable,
            "resource": self.resource,
            "owner_faction": self.owner_faction,
            "farm_progress": self.farm_progress,
            "biome": self.biome,
            "elevation": self.elevation,
            "moisture": self.moisture,
            "feature": self.feature,
            "region_id": self.region_id,
            "settlement_id": self.settlement_id,
            "visual_variant": self.visual_variant,
            "edge_mask": self.edge_mask,
            "river_mask": self.river_mask,
            "road_mask": self.road_mask,
            "decal": self.decal,
            "elevation_band": self.elevation_band,
            "height_level": self.height_level,
            "fertility": self.fertility,
            "resource_tags": list(self.resource_tags),
            "danger_tags": list(self.danger_tags),
            "race_affinity": dict(self.race_affinity),
            "city_score": self.city_score,
        }


@dataclass(slots=True)
class FactionState:
    id: str
    name: str
    banner_color: str | None = None
    race_kind: str = "human"
    spawn_x: int | None = None
    spawn_y: int | None = None
    leader_id: str | None = None
    capital_settlement_id: str | None = None
    alliances: set[str] = field(default_factory=set)
    wars: set[str] = field(default_factory=set)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FactionState":
        return cls(
            id=data["id"],
            name=data.get("name", data["id"].title()),
            banner_color=data.get("banner_color", data.get("color")),
            race_kind=str(data.get("race_kind", "human")),
            spawn_x=None if data.get("spawn_x") is None else require_int("spawn_x", data.get("spawn_x")),
            spawn_y=None if data.get("spawn_y") is None else require_int("spawn_y", data.get("spawn_y")),
            leader_id=data.get("leader_id"),
            capital_settlement_id=data.get("capital_settlement_id"),
            alliances=set(data.get("alliances", [])),
            wars=set(data.get("wars", [])),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "banner_color": self.banner_color,
            "race_kind": self.race_kind,
            "spawn_x": self.spawn_x,
            "spawn_y": self.spawn_y,
            "leader_id": self.leader_id,
            "capital_settlement_id": self.capital_settlement_id,
            "alliances": sorted(self.alliances),
            "wars": sorted(self.wars),
        }


@dataclass(slots=True)
class IntentState:
    action: str
    target_x: int | None = None
    target_y: int | None = None
    target_agent_id: str | None = None
    reason: str = ""
    intent: str = ""
    interaction_mode: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "target_x": self.target_x,
            "target_y": self.target_y,
            "target_agent_id": self.target_agent_id,
            "reason": self.reason,
            "intent": self.intent,
            "interaction_mode": self.interaction_mode,
        }


@dataclass(slots=True)
class AgentState:
    id: str
    name: str
    faction_id: str
    x: int
    y: int
    personality: BigFivePersonality
    emotions: Emotions
    needs: Needs
    inventory: Inventory = field(default_factory=Inventory)
    entity_kind: str = "human"
    race_kind: str = "human"
    kingdom_id: str | None = None
    role: str = "citizen"
    home_city_id: str | None = None
    health: int = STATE_MAX
    alive: bool = True
    last_reasoned_tick: int = -999
    last_action_success: bool = True
    last_perception_signature: str = ""
    last_intent: IntentState | None = None
    last_goal: str | None = None
    current_intent: str = ""
    last_speech: str = ""
    last_thought: str = ""
    age_ticks: int = 0
    tick_born: int = 0
    critical_survival_ticks: int = 0
    render_x: float | None = None
    render_y: float | None = None
    task_state: str = "idle"
    task_progress: int = 0
    task_target_x: int | None = None
    task_target_y: int | None = None
    interaction_target_id: str | None = None
    speaking_until_ms: int = 0
    last_decision_at_ms: int = 0

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AgentState":
        return cls(
            id=data["id"],
            name=data.get("name", data["id"].title()),
            faction_id=data["faction_id"],
            x=require_int("x", data["x"]),
            y=require_int("y", data["y"]),
            entity_kind=str(data.get("entity_kind", "human")),
            race_kind=str(data.get("race_kind", "human")),
            kingdom_id=data.get("kingdom_id", data.get("faction_id")),
            role=str(data.get("role", "citizen")),
            home_city_id=data.get("home_city_id"),
            personality=BigFivePersonality.from_dict(data["personality"]),
            emotions=Emotions.from_dict(data["emotions"]),
            needs=Needs.from_dict(data["needs"]),
            inventory=Inventory.from_dict(data.get("inventory")),
            health=require_int("health", data.get("health", STATE_MAX), 0, STATE_MAX),
            alive=bool(data.get("alive", True)),
            last_reasoned_tick=require_int("last_reasoned_tick", data.get("last_reasoned_tick", -999)),
            last_action_success=bool(data.get("last_action_success", True)),
            last_perception_signature=str(data.get("last_perception_signature", "")),
            last_goal=data.get("last_goal"),
            current_intent=str(data.get("current_intent", "")),
            last_speech=str(data.get("last_speech", "")),
            last_thought=str(data.get("last_thought", "")),
            age_ticks=require_int("age_ticks", data.get("age_ticks", 0), 0),
            tick_born=require_int("tick_born", data.get("tick_born", 0), 0),
            critical_survival_ticks=require_int("critical_survival_ticks", data.get("critical_survival_ticks", 0), 0),
            render_x=None if data.get("render_x") is None else float(data.get("render_x")),
            render_y=None if data.get("render_y") is None else float(data.get("render_y")),
            task_state=str(data.get("task_state", "idle")),
            task_progress=require_int("task_progress", data.get("task_progress", 0), 0, 100, clamp=True),
            task_target_x=None if data.get("task_target_x") is None else require_int("task_target_x", data.get("task_target_x")),
            task_target_y=None if data.get("task_target_y") is None else require_int("task_target_y", data.get("task_target_y")),
            interaction_target_id=data.get("interaction_target_id"),
            speaking_until_ms=require_int("speaking_until_ms", data.get("speaking_until_ms", 0), 0),
            last_decision_at_ms=require_int("last_decision_at_ms", data.get("last_decision_at_ms", 0), 0),
        )

    @property
    def position(self) -> tuple[int, int]:
        return self.x, self.y

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "faction_id": self.faction_id,
            "x": self.x,
            "y": self.y,
            "entity_kind": self.entity_kind,
            "race_kind": self.race_kind,
            "kingdom_id": self.kingdom_id,
            "role": self.role,
            "home_city_id": self.home_city_id,
            "personality": self.personality.to_dict(),
            "emotions": self.emotions.to_dict(),
            "needs": self.needs.to_dict(),
            "inventory": self.inventory.to_dict(),
            "health": self.health,
            "alive": self.alive,
            "last_reasoned_tick": self.last_reasoned_tick,
            "last_action_success": self.last_action_success,
            "last_perception_signature": self.last_perception_signature,
            "last_intent": self.last_intent.to_dict() if self.last_intent else None,
            "last_goal": self.last_goal,
            "current_intent": self.current_intent,
            "last_speech": self.last_speech,
            "last_thought": self.last_thought,
            "age_ticks": self.age_ticks,
            "tick_born": self.tick_born,
            "critical_survival_ticks": self.critical_survival_ticks,
            "render_x": self.x if self.render_x is None else self.render_x,
            "render_y": self.y if self.render_y is None else self.render_y,
            "task_state": self.task_state,
            "task_progress": self.task_progress,
            "task_target_x": self.task_target_x,
            "task_target_y": self.task_target_y,
            "interaction_target_id": self.interaction_target_id,
            "speaking_until_ms": self.speaking_until_ms,
            "last_decision_at_ms": self.last_decision_at_ms,
        }


@dataclass(slots=True)
class AnimalUnitState:
    id: str
    species: str
    name: str
    kind: str
    x: int
    y: int
    health: int = STATE_MAX
    hunger: int = 4
    energy: int = 6
    alive: bool = True
    target_kind: str | None = None
    target_id: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AnimalUnitState":
        return cls(
            id=str(data["id"]),
            species=str(data.get("species", "sheep")),
            name=str(data.get("name", data.get("species", "Animal").title())),
            kind=str(data.get("kind", "grazer")),
            x=require_int("x", data["x"]),
            y=require_int("y", data["y"]),
            health=require_int("health", data.get("health", STATE_MAX), 0, STATE_MAX, clamp=True),
            hunger=require_int("hunger", data.get("hunger", 4), 0, STATE_MAX, clamp=True),
            energy=require_int("energy", data.get("energy", 6), 0, STATE_MAX, clamp=True),
            alive=bool(data.get("alive", True)),
            target_kind=data.get("target_kind"),
            target_id=data.get("target_id"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "species": self.species,
            "name": self.name,
            "kind": self.kind,
            "x": self.x,
            "y": self.y,
            "health": self.health,
            "hunger": self.hunger,
            "energy": self.energy,
            "alive": self.alive,
            "target_kind": self.target_kind,
            "target_id": self.target_id,
        }


@dataclass(slots=True)
class CityState:
    id: str
    name: str
    kingdom_id: str
    race_kind: str
    x: int
    y: int
    population: int
    level: int = 1
    food_stores: int = 0
    footprint: list[dict[str, Any]] = field(default_factory=list)
    district_kinds: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CityState":
        return cls(
            id=str(data["id"]),
            name=str(data.get("name", data["id"])),
            kingdom_id=str(data.get("kingdom_id", data.get("owner_faction"))),
            race_kind=str(data.get("race_kind", "human")),
            x=require_int("x", data["x"]),
            y=require_int("y", data["y"]),
            population=require_int("population", data.get("population", 0), 0),
            level=require_int("level", data.get("level", 1), 1, 10, clamp=True),
            food_stores=require_int("food_stores", data.get("food_stores", 0), 0),
            footprint=[dict(item) for item in data.get("footprint", [])],
            district_kinds=[str(item) for item in data.get("district_kinds", [])],
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "kingdom_id": self.kingdom_id,
            "race_kind": self.race_kind,
            "x": self.x,
            "y": self.y,
            "population": self.population,
            "level": self.level,
            "food_stores": self.food_stores,
            "footprint": [dict(item) for item in self.footprint],
            "district_kinds": list(self.district_kinds),
        }


@dataclass(slots=True)
class KingdomState:
    id: str
    name: str
    race_kind: str
    color: str | None = None
    leader_id: str | None = None
    capital_city_id: str | None = None
    population: int = 0
    city_ids: list[str] = field(default_factory=list)
    controller_provider: str | None = None
    controller_model: str | None = None
    auto_seeded: bool = False

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "KingdomState":
        return cls(
            id=str(data["id"]),
            name=str(data.get("name", data["id"])),
            race_kind=str(data.get("race_kind", "human")),
            color=data.get("color"),
            leader_id=data.get("leader_id"),
            capital_city_id=data.get("capital_city_id"),
            population=require_int("population", data.get("population", 0), 0),
            city_ids=[str(item) for item in data.get("city_ids", [])],
            controller_provider=data.get("controller_provider"),
            controller_model=data.get("controller_model"),
            auto_seeded=bool(data.get("auto_seeded", False)),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "race_kind": self.race_kind,
            "color": self.color,
            "leader_id": self.leader_id,
            "capital_city_id": self.capital_city_id,
            "population": self.population,
            "city_ids": list(self.city_ids),
            "controller_provider": self.controller_provider,
            "controller_model": self.controller_model,
            "auto_seeded": self.auto_seeded,
        }


@dataclass(slots=True)
class StructureState:
    id: str
    kind: str
    x: int
    y: int
    kingdom_id: str | None = None
    city_id: str | None = None
    integrity: int = 10

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "StructureState":
        return cls(
            id=str(data["id"]),
            kind=str(data.get("kind", "structure")),
            x=require_int("x", data["x"]),
            y=require_int("y", data["y"]),
            kingdom_id=data.get("kingdom_id"),
            city_id=data.get("city_id"),
            integrity=require_int("integrity", data.get("integrity", 10), 0, 10, clamp=True),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            "x": self.x,
            "y": self.y,
            "kingdom_id": self.kingdom_id,
            "city_id": self.city_id,
            "integrity": self.integrity,
        }


@dataclass(slots=True)
class BattleState:
    id: str
    x: int
    y: int
    attacker_kingdom_id: str
    defender_kingdom_id: str
    intensity: int
    tick_started: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BattleState":
        return cls(
            id=str(data["id"]),
            x=require_int("x", data["x"]),
            y=require_int("y", data["y"]),
            attacker_kingdom_id=str(data["attacker_kingdom_id"]),
            defender_kingdom_id=str(data["defender_kingdom_id"]),
            intensity=require_int("intensity", data.get("intensity", 1), 1, 10, clamp=True),
            tick_started=require_int("tick_started", data.get("tick_started", 0), 0),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "attacker_kingdom_id": self.attacker_kingdom_id,
            "defender_kingdom_id": self.defender_kingdom_id,
            "intensity": self.intensity,
            "tick_started": self.tick_started,
        }


@dataclass(slots=True)
class SimulationConfig:
    width: int
    height: int
    perception_radius: int = 2
    snapshot_interval: int = 10
    thought_memory_limit: int = 30
    event_memory_limit: int = 30
    reason_interval: int = 5
    world_seed: int = 0
    generator_preset: str = "grand-continent"
    map_width: int | None = None
    map_height: int | None = None
    coastline_bias: int = 54
    river_count: int = 7
    settlement_density: int = 18
    landmark_density: int = 14
    biome_density: int = 62
    fauna_density: int = 54
    kingdom_growth_intensity: int = 60
    run_duration_seconds: int = 80
    decision_interval_ms: int = 2000
    microstep_interval_ms: int = 125
    playback_speed: int = 1

    def __post_init__(self) -> None:
        self.width = require_int("width", self.width, 1)
        self.height = require_int("height", self.height, 1)
        self.perception_radius = require_int("perception_radius", self.perception_radius, 1)
        self.snapshot_interval = require_int("snapshot_interval", self.snapshot_interval, 1)
        self.thought_memory_limit = require_int("thought_memory_limit", self.thought_memory_limit, 1)
        self.event_memory_limit = require_int("event_memory_limit", self.event_memory_limit, 1)
        self.reason_interval = require_int("reason_interval", self.reason_interval, 1)
        self.world_seed = require_int("world_seed", self.world_seed)
        self.map_width = self.width if self.map_width is None else require_int("map_width", self.map_width, 1)
        self.map_height = self.height if self.map_height is None else require_int("map_height", self.map_height, 1)
        self.coastline_bias = require_int("coastline_bias", self.coastline_bias, 0, 100, clamp=True)
        self.river_count = require_int("river_count", self.river_count, 0, 64, clamp=True)
        self.settlement_density = require_int(
            "settlement_density", self.settlement_density, 1, 100, clamp=True
        )
        self.landmark_density = require_int(
            "landmark_density", self.landmark_density, 0, 100, clamp=True
        )
        self.biome_density = require_int("biome_density", self.biome_density, 0, 100, clamp=True)
        self.fauna_density = require_int("fauna_density", self.fauna_density, 0, 100, clamp=True)
        self.kingdom_growth_intensity = require_int(
            "kingdom_growth_intensity", self.kingdom_growth_intensity, 0, 100, clamp=True
        )
        self.run_duration_seconds = require_int(
            "run_duration_seconds", self.run_duration_seconds, 5, 3600, clamp=True
        )
        self.decision_interval_ms = require_int(
            "decision_interval_ms", self.decision_interval_ms, 250, 30000, clamp=True
        )
        self.microstep_interval_ms = require_int(
            "microstep_interval_ms", self.microstep_interval_ms, 16, 5000, clamp=True
        )
        self.playback_speed = require_int("playback_speed", self.playback_speed, 1, 8, clamp=True)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SimulationConfig":
        return cls(
            width=data.get("map_width", data["width"]),
            height=data.get("map_height", data["height"]),
            perception_radius=data.get("perception_radius", 2),
            snapshot_interval=data.get("snapshot_interval", 10),
            thought_memory_limit=data.get("thought_memory_limit", 30),
            event_memory_limit=data.get("event_memory_limit", 30),
            reason_interval=data.get("reason_interval", 5),
            world_seed=data.get("world_seed", data.get("seed", 0)),
            generator_preset=data.get("generator_preset", "grand-continent"),
            map_width=data.get("map_width", data.get("width")),
            map_height=data.get("map_height", data.get("height")),
            coastline_bias=data.get("coastline_bias", 54),
            river_count=data.get("river_count", 7),
            settlement_density=data.get("settlement_density", 18),
            landmark_density=data.get("landmark_density", 14),
            biome_density=data.get("biome_density", 62),
            fauna_density=data.get("fauna_density", 54),
            kingdom_growth_intensity=data.get("kingdom_growth_intensity", 60),
            run_duration_seconds=data.get("run_duration_seconds", 80),
            decision_interval_ms=data.get("decision_interval_ms", 2000),
            microstep_interval_ms=data.get("microstep_interval_ms", 125),
            playback_speed=data.get("playback_speed", 1),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "width": self.width,
            "height": self.height,
            "perception_radius": self.perception_radius,
            "snapshot_interval": self.snapshot_interval,
            "thought_memory_limit": self.thought_memory_limit,
            "event_memory_limit": self.event_memory_limit,
            "reason_interval": self.reason_interval,
            "world_seed": self.world_seed,
            "generator_preset": self.generator_preset,
            "map_width": self.map_width,
            "map_height": self.map_height,
            "coastline_bias": self.coastline_bias,
            "river_count": self.river_count,
            "settlement_density": self.settlement_density,
            "landmark_density": self.landmark_density,
            "biome_density": self.biome_density,
            "fauna_density": self.fauna_density,
            "kingdom_growth_intensity": self.kingdom_growth_intensity,
            "run_duration_seconds": self.run_duration_seconds,
            "decision_interval_ms": self.decision_interval_ms,
            "microstep_interval_ms": self.microstep_interval_ms,
            "playback_speed": self.playback_speed,
        }


@dataclass(slots=True)
class WorldState:
    width: int
    height: int
    tiles: list[list[TileState]]
    agents: dict[str, AgentState]
    factions: dict[str, FactionState]
    tick: int = 0
    seed: int = 0
    props: list[dict[str, Any]] = field(default_factory=list)
    regions: dict[str, dict[str, Any]] = field(default_factory=dict)
    settlements: list[dict[str, Any]] = field(default_factory=list)
    roads: list[dict[str, Any]] = field(default_factory=list)
    territories: dict[str, dict[str, Any]] = field(default_factory=dict)
    communications: list[CommunicationMessage] = field(default_factory=list)
    animals: dict[str, AnimalUnitState] = field(default_factory=dict)
    cities: dict[str, CityState] = field(default_factory=dict)
    kingdoms: dict[str, KingdomState] = field(default_factory=dict)
    structures: dict[str, StructureState] = field(default_factory=dict)
    battles: dict[str, BattleState] = field(default_factory=dict)
    fauna_events: list[dict[str, Any]] = field(default_factory=list)

    def in_bounds(self, x: int, y: int) -> bool:
        return 0 <= x < self.width and 0 <= y < self.height

    def get_tile(self, x: int, y: int) -> TileState:
        if not self.in_bounds(x, y):
            raise IndexError(f"Tile ({x}, {y}) is out of bounds")
        return self.tiles[y][x]

    def set_tile(self, x: int, y: int, tile: TileState) -> None:
        if not self.in_bounds(x, y):
            raise IndexError(f"Tile ({x}, {y}) is out of bounds")
        self.tiles[y][x] = tile

    def agent_at(self, x: int, y: int, *, exclude_agent_id: str | None = None) -> AgentState | None:
        for agent in self.agents.values():
            if not agent.alive or agent.id == exclude_agent_id:
                continue
            if agent.x == x and agent.y == y:
                return agent
        return None

    def position_occupied(self, x: int, y: int, *, exclude_agent_id: str | None = None) -> bool:
        return self.agent_at(x, y, exclude_agent_id=exclude_agent_id) is not None

    def nearby_agents(
        self, x: int, y: int, radius: int, *, exclude_agent_id: str | None = None
    ) -> list[AgentState]:
        nearby: list[AgentState] = []
        for agent in self.agents.values():
            if not agent.alive or agent.id == exclude_agent_id:
                continue
            distance = abs(agent.x - x) + abs(agent.y - y)
            if distance <= radius:
                nearby.append(agent)
        nearby.sort(key=lambda item: (abs(item.x - x) + abs(item.y - y), item.id))
        return nearby

    def to_dict(self) -> dict[str, Any]:
        return {
            "width": self.width,
            "height": self.height,
            "tick": self.tick,
            "seed": self.seed,
            "tiles": [
                [{"x": x, "y": y, **tile.to_dict()} for x, tile in enumerate(row)]
                for y, row in enumerate(self.tiles)
            ],
            "agents": {agent_id: agent.to_dict() for agent_id, agent in sorted(self.agents.items())},
            "humans": {agent_id: agent.to_dict() for agent_id, agent in sorted(self.agents.items())},
            "factions": {
                faction_id: faction.to_dict()
                for faction_id, faction in sorted(self.factions.items())
            },
            "groups": {
                faction_id: faction.to_dict()
                for faction_id, faction in sorted(self.factions.items())
            },
            "props": list(self.props),
            "regions": {region_id: dict(payload) for region_id, payload in sorted(self.regions.items())},
            "settlements": [dict(settlement) for settlement in self.settlements],
            "roads": [dict(road) for road in self.roads],
            "territories": {
                faction_id: dict(payload) for faction_id, payload in sorted(self.territories.items())
            },
            "communications": [message.to_dict() for message in self.communications],
            "animals": {animal_id: animal.to_dict() for animal_id, animal in sorted(self.animals.items())},
            "cities": {city_id: city.to_dict() for city_id, city in sorted(self.cities.items())},
            "kingdoms": {kingdom_id: kingdom.to_dict() for kingdom_id, kingdom in sorted(self.kingdoms.items())},
            "structures": {structure_id: structure.to_dict() for structure_id, structure in sorted(self.structures.items())},
            "battles": {battle_id: battle.to_dict() for battle_id, battle in sorted(self.battles.items())},
            "fauna_events": [dict(item) for item in self.fauna_events],
        }


@dataclass(slots=True)
class CulturalInnovation:
    element: str
    description: str
    strength: int
    category: str = "norm"

    def __post_init__(self) -> None:
        self.strength = require_int("strength", self.strength, 0, 100, clamp=True)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CulturalInnovation":
        return cls(
            element=data["element"],
            description=data["description"],
            strength=data["strength"],
            category=data.get("category", "norm"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "element": self.element,
            "description": self.description,
            "strength": self.strength,
            "category": self.category,
        }


@dataclass(slots=True)
class ActionProposal:
    name: str
    description: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ActionProposal":
        return cls(
            name=data.get("name", data.get("action", "UNKNOWN")),
            description=data.get("description", ""),
        )

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "description": self.description}


@dataclass(slots=True)
class OutboundMessage:
    scope: str
    text: str
    target_faction_id: str | None = None
    target_agent_id: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "OutboundMessage":
        scope = str(data.get("scope", "civilization"))
        if scope not in {"civilization", "diplomacy"}:
            scope = "civilization"
        return cls(
            scope=scope,
            text=str(data.get("text", "")).strip(),
            target_faction_id=data.get("target_faction_id", data.get("targetFactionId")),
            target_agent_id=data.get("target_agent_id", data.get("targetAgentId")),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "scope": self.scope,
            "text": self.text,
            "target_faction_id": self.target_faction_id,
            "target_agent_id": self.target_agent_id,
        }


@dataclass(slots=True)
class DecisionPayload:
    action: str
    target_x: int | None
    target_y: int | None
    reason: str
    intent: str
    speech: str
    updated_emotions: Emotions
    updated_needs: Needs
    thought: str
    target_agent_id: str | None = None
    target_resource_kind: str | None = None
    interaction_mode: str | None = None
    desired_distance: int | None = None
    cultural_innovation: CulturalInnovation | None = None
    action_proposal: ActionProposal | None = None
    outbound_message: OutboundMessage | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any], *, clamp_states: bool = False) -> "DecisionPayload":
        innovation = data.get("cultural_innovation")
        proposal = data.get("action_proposal")
        outbound_message = data.get("outbound_message")
        return cls(
            action=str(data["action"]),
            target_x=None if data.get("target_x") is None else require_int("target_x", data["target_x"]),
            target_y=None if data.get("target_y") is None else require_int("target_y", data["target_y"]),
            target_agent_id=None if data.get("target_agent_id") is None else str(data.get("target_agent_id")),
            reason=str(data["reason"]),
            intent=str(data.get("intent", data.get("reason", ""))),
            speech=str(data.get("speech", "")),
            updated_emotions=Emotions.from_dict(data["updated_emotions"], clamp=clamp_states),
            updated_needs=Needs.from_dict(data["updated_needs"], clamp=clamp_states),
            thought=str(data["thought"]),
            target_resource_kind=None if data.get("target_resource_kind") is None else str(data.get("target_resource_kind")),
            interaction_mode=None if data.get("interaction_mode") is None else str(data.get("interaction_mode")),
            desired_distance=None if data.get("desired_distance") is None else require_int("desired_distance", data.get("desired_distance"), 0, 8, clamp=True),
            cultural_innovation=None if innovation is None else CulturalInnovation.from_dict(innovation),
            action_proposal=None if proposal is None else ActionProposal.from_dict(proposal),
            outbound_message=None if outbound_message is None else OutboundMessage.from_dict(outbound_message),
        )

    def ensure_action_proposal_for_unknown(self) -> None:
        if self.action_proposal is None:
            self.action_proposal = ActionProposal(
                name=self.action,
                description=self.reason or "Proposed novel action from model output.",
            )

    def to_intent(self) -> IntentState:
        return IntentState(
            action=self.action,
            target_x=self.target_x,
            target_y=self.target_y,
            target_agent_id=self.target_agent_id,
            reason=self.reason,
            intent=self.intent,
            interaction_mode=self.interaction_mode or "",
        )

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "action": self.action,
            "target_x": self.target_x,
            "target_y": self.target_y,
            "target_agent_id": self.target_agent_id,
            "reason": self.reason,
            "intent": self.intent,
            "speech": self.speech,
            "updated_emotions": self.updated_emotions.to_dict(),
            "updated_needs": self.updated_needs.to_dict(),
            "thought": self.thought,
        }
        if self.target_resource_kind is not None:
            data["target_resource_kind"] = self.target_resource_kind
        if self.interaction_mode is not None:
            data["interaction_mode"] = self.interaction_mode
        if self.desired_distance is not None:
            data["desired_distance"] = self.desired_distance
        if self.cultural_innovation is not None:
            data["cultural_innovation"] = self.cultural_innovation.to_dict()
        if self.action_proposal is not None:
            data["action_proposal"] = self.action_proposal.to_dict()
        if self.outbound_message is not None:
            data["outbound_message"] = self.outbound_message.to_dict()
        return data


@dataclass(slots=True)
class CommunicationMessage:
    tick: int
    scope: str
    sender_agent_id: str
    sender_faction_id: str
    text: str
    target_faction_id: str | None = None
    target_agent_id: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CommunicationMessage":
        return cls(
            tick=require_int("tick", data.get("tick", 0), 0),
            scope=str(data.get("scope", "civilization")),
            sender_agent_id=str(data["sender_agent_id"]),
            sender_faction_id=str(data["sender_faction_id"]),
            text=str(data.get("text", "")).strip(),
            target_faction_id=data.get("target_faction_id"),
            target_agent_id=data.get("target_agent_id"),
        )

    def visible_to_faction(self, faction_id: str) -> bool:
        if self.scope == "civilization":
            return self.sender_faction_id == faction_id
        return faction_id in {self.sender_faction_id, self.target_faction_id}

    def to_dict(self) -> dict[str, Any]:
        return {
            "tick": self.tick,
            "scope": self.scope,
            "sender_agent_id": self.sender_agent_id,
            "sender_faction_id": self.sender_faction_id,
            "text": self.text,
            "target_faction_id": self.target_faction_id,
            "target_agent_id": self.target_agent_id,
        }


@dataclass(slots=True)
class EngineAction:
    kind: str
    actor_id: str
    target_x: int | None = None
    target_y: int | None = None
    target_agent_id: str | None = None
    target_faction_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class SimulationEvent:
    tick: int
    kind: str
    description: str
    success: bool
    actor_id: str | None = None
    target_agent_id: str | None = None
    faction_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "tick": self.tick,
            "kind": self.kind,
            "description": self.description,
            "success": self.success,
            "actor_id": self.actor_id,
            "target_agent_id": self.target_agent_id,
            "faction_id": self.faction_id,
            "metadata": self.metadata,
        }

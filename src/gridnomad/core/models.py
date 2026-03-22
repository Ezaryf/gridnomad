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
        }


@dataclass(slots=True)
class FactionState:
    id: str
    name: str
    banner_color: str | None = None
    leader_id: str | None = None
    alliances: set[str] = field(default_factory=set)
    wars: set[str] = field(default_factory=set)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FactionState":
        return cls(
            id=data["id"],
            name=data.get("name", data["id"].title()),
            banner_color=data.get("banner_color", data.get("color")),
            leader_id=data.get("leader_id"),
            alliances=set(data.get("alliances", [])),
            wars=set(data.get("wars", [])),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "banner_color": self.banner_color,
            "leader_id": self.leader_id,
            "alliances": sorted(self.alliances),
            "wars": sorted(self.wars),
        }


@dataclass(slots=True)
class IntentState:
    action: str
    target_x: int | None = None
    target_y: int | None = None
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "target_x": self.target_x,
            "target_y": self.target_y,
            "reason": self.reason,
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
    health: int = STATE_MAX
    alive: bool = True
    last_reasoned_tick: int = -999
    last_action_success: bool = True
    last_perception_signature: str = ""
    last_intent: IntentState | None = None
    last_goal: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AgentState":
        return cls(
            id=data["id"],
            name=data.get("name", data["id"].title()),
            faction_id=data["faction_id"],
            x=require_int("x", data["x"]),
            y=require_int("y", data["y"]),
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
            "factions": {
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
    updated_emotions: Emotions
    updated_needs: Needs
    thought: str
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
            reason=str(data["reason"]),
            updated_emotions=Emotions.from_dict(data["updated_emotions"], clamp=clamp_states),
            updated_needs=Needs.from_dict(data["updated_needs"], clamp=clamp_states),
            thought=str(data["thought"]),
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
            reason=self.reason,
        )

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "action": self.action,
            "target_x": self.target_x,
            "target_y": self.target_y,
            "reason": self.reason,
            "updated_emotions": self.updated_emotions.to_dict(),
            "updated_needs": self.updated_needs.to_dict(),
            "thought": self.thought,
        }
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

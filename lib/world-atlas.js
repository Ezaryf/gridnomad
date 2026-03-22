export const TILE_SIZE = 16;
export const MIN_ZOOM = 0.22;
export const MAX_ZOOM = 5.2;

export const FACTION_COLORS = {
  red: 0xe67f79,
  blue: 0x85b8f9,
  gold: 0xe0c173
};

const TERRAIN_ASSETS = {
  "terrain-land": "/atlas/terrain-land.svg",
  "terrain-meadow": "/atlas/terrain-meadow.svg",
  "terrain-forest": "/atlas/terrain-forest.svg",
  "terrain-scrub": "/atlas/terrain-scrub.svg",
  "terrain-highland": "/atlas/terrain-highland.svg",
  "terrain-coast": "/atlas/terrain-coast.svg",
  "terrain-water": "/atlas/terrain-water.svg",
  "terrain-river-bed": "/atlas/terrain-river-bed.svg",
  "terrain-bridge": "/atlas/terrain-bridge.svg",
  "terrain-farm": "/atlas/terrain-farm.svg",
  "terrain-house": "/atlas/terrain-house.svg",
  "foam-edge": "/atlas/overlay-foam-edge.svg",
  "foam-corner": "/atlas/overlay-foam-corner.svg",
  "path-straight": "/atlas/path-straight.svg",
  "path-turn": "/atlas/path-turn.svg",
  "path-tee": "/atlas/path-tee.svg",
  "path-cross": "/atlas/path-cross.svg",
  "path-end": "/atlas/path-end.svg",
  "decal-grass-tuft": "/atlas/decal-sprig.svg",
  "decal-wildflowers": "/atlas/decal-sprig.svg",
  "decal-shell-bank": "/atlas/decal-speckles.svg",
  "decal-pebbles": "/atlas/decal-speckles.svg",
  "decal-fern-cluster": "/atlas/decal-sprig.svg",
  "decal-snow-cap": "/atlas/decal-speckles.svg",
  "decal-water-glint": "/atlas/decal-water-glint.svg",
  "decal-sea-foam": "/atlas/decal-speckles.svg",
  "prop-tree-cluster": "/atlas/prop-tree-cluster.svg",
  "prop-mountain-cluster": "/atlas/prop-mountain-cluster.svg",
  "prop-stone-outcrop": "/atlas/prop-stone-outcrop.svg",
  "prop-reeds": "/atlas/prop-reeds.svg",
  "prop-ship": "/atlas/prop-ship.svg",
  "prop-ford": "/atlas/prop-ford.svg",
  "landmark-palace": "/atlas/landmark-palace.svg",
  "landmark-market": "/atlas/landmark-market.svg",
  "landmark-shrine": "/atlas/landmark-shrine.svg",
  "landmark-lighthouse": "/atlas/landmark-lighthouse.svg",
  "landmark-observatory": "/atlas/landmark-observatory.svg",
  "settlement-capital": "/atlas/settlement-capital.svg",
  "settlement-port": "/atlas/settlement-port.svg",
  "settlement-frontier": "/atlas/settlement-frontier.svg",
  agent: "/atlas/agent.svg",
  "overlay-tint": "/atlas/overlay-tint.svg",
  "focus-ring": "/atlas/focus-ring.svg",
  fog: "/atlas/fog.svg"
};

const SPRITE_ALIASES = {
  "prop-grove": "prop-tree-cluster",
  "trace-river": "overlay-tint",
  "settlement-capital-core": "settlement-capital",
  "settlement-capital-ward": "settlement-capital",
  "settlement-capital-civic": "settlement-capital",
  "settlement-capital-garden": "settlement-capital",
  "settlement-port-core": "settlement-port",
  "settlement-port-market": "settlement-port",
  "settlement-port-dock": "settlement-port",
  "settlement-frontier-core": "settlement-frontier",
  "settlement-frontier-homestead": "settlement-frontier",
  "settlement-frontier-store": "settlement-frontier"
};

const BIOME_STYLES = {
  "deep-ocean": { tint: 0x163c7a },
  ocean: { tint: 0x23539a },
  "shallow-ocean": { tint: 0x2f77c0 },
  lagoon: { tint: 0x43a6d7 },
  "close-ocean": { tint: 0x4db1df },
  sand: { tint: 0xe7c990 },
  coast: { tint: 0xe7c990 },
  grass: { tint: 0x7bae46 },
  grassland: { tint: 0x7bae46 },
  "fertile-plains": { tint: 0x6ea23f },
  meadow: { tint: 0x98cc5b },
  forest: { tint: 0x437b32 },
  jungle: { tint: 0x2f6c39 },
  savanna: { tint: 0xc9b159 },
  desert: { tint: 0xd3a458 },
  tundra: { tint: 0xa6c0be },
  snow: { tint: 0xf2f9ff },
  swamp: { tint: 0x5f8565 },
  crystal: { tint: 0x8cd3ff },
  volcanic: { tint: 0xa24d35 },
  lava: { tint: 0xdf4825 },
  arcane: { tint: 0x86c67a },
  corrupted: { tint: 0x8a235b },
  hills: { tint: 0x8e8a62 },
  mountain: { tint: 0x6d7277 },
  river: { tint: 0x46b8f1 }
};

const DECAL_TINTS = {
  "grass-tuft": 0xbef0b8,
  wildflowers: 0xffd0df,
  "shell-bank": 0xeed9b1,
  pebbles: 0xd7d9de,
  "fern-cluster": 0x70d59e,
  "snow-cap": 0xf8fafc,
  "water-glint": 0xcff4ff,
  "sea-foam": 0xffffff
};

const PROP_TINTS = {
  "prop-tree-cluster": 0xffffff,
  "prop-mountain-cluster": 0xffffff,
  "prop-stone-outcrop": 0xf1f5f9,
  "prop-reeds": 0xf5e7a1,
  "prop-ship": 0xffffff,
  "prop-ford": 0xf5e7a1,
  "landmark-palace": 0xf1ece0,
  "landmark-market": 0xf0c19a,
  "landmark-shrine": 0xe8e0ff,
  "landmark-lighthouse": 0xf7fafc,
  "landmark-observatory": 0xe2ebf5
};

const DISTRICT_TINTS = {
  core: 0xf2eee4,
  civic: 0xece6d8,
  ward: 0xe4d4c7,
  garden: 0xcbe5be,
  market: 0xe7b986,
  dock: 0x94c6cf,
  homestead: 0xf0dcc9,
  store: 0xd4c19f
};

const VARIANT_FACTORS = [0.88, 0.96, 1.03, 1.1];

export function atlasAssetUrls() {
  return [...new Set(Object.values(TERRAIN_ASSETS))];
}

export function resolveAtlasAsset(key) {
  const resolved = SPRITE_ALIASES[key] ?? key;
  return TERRAIN_ASSETS[resolved] ?? TERRAIN_ASSETS["overlay-tint"];
}

export function terrainPresentation(tile) {
  if (tile.terrain === "bridge") {
    return { tint: 0xffffff };
  }
  if (tile.terrain === "farm") {
    return { tint: 0xffffff };
  }
  if (tile.terrain === "house") {
    return { tint: 0xffffff };
  }
  const baseStyle = BIOME_STYLES[tile.biome] ?? BIOME_STYLES.grass;
  return {
    tint: applyVariant(baseStyle.tint, VARIANT_FACTORS[tile.visual_variant ?? 0] ?? 1)
  };
}

export function terrainTextureKey(tile) {
  const biome = tile?.biome ?? "grassland";
  if (tile?.terrain === "water") {
    if (biome === "deep-ocean") return "terrain-water-deep";
    if (biome === "lagoon" || biome === "shallow-ocean") return "terrain-water-shallow";
    return "terrain-water";
  }
  if (biome === "coast" || biome === "sand") return "terrain-sand";
  if (biome === "forest" || biome === "jungle") return "terrain-forest-floor";
  if (biome === "swamp") return "terrain-swamp";
  if (biome === "desert" || biome === "savanna") return "terrain-desert";
  if (biome === "snow" || biome === "tundra") return "terrain-snow";
  if (biome === "crystal" || biome === "arcane") return "terrain-crystal";
  if (biome === "volcanic" || biome === "corrupted") return "terrain-volcanic";
  if (biome === "mountain" || biome === "hills") return "terrain-highland";
  if (biome === "fertile-plains" || biome === "meadow") return "terrain-meadow";
  return "terrain-grass";
}

export function settlementSegments(settlement) {
  if (settlement?.footprint?.length) {
    return settlement.footprint;
  }
  return settlement
    ? [{
        x: settlement.x,
        y: settlement.y,
        district_kind: "core",
        sprite_key: settlement.sprite_key ?? "settlement-frontier",
        is_core: true
      }]
    : [];
}

export function settlementPresentation(segment) {
  return {
    asset: resolveAtlasAsset(segment.sprite_key ?? "settlement-frontier"),
    tint: DISTRICT_TINTS[segment.district_kind] ?? 0xf2e9dc,
  };
}

export function propPresentation(prop) {
  const key = SPRITE_ALIASES[prop.sprite_key ?? prop.kind] ?? (prop.sprite_key ?? prop.kind);
  return {
    asset: resolveAtlasAsset(key),
    tint: PROP_TINTS[key] ?? 0xffffff
  };
}

export function decalPresentation(decal) {
  return {
    asset: resolveAtlasAsset(`decal-${decal}`),
    tint: DECAL_TINTS[decal] ?? 0xffffff
  };
}

export function roadPresentation(mask) {
  return {
    ...maskPresentation(mask),
    tint: 0x6e5e49,
    scale: 0.9
  };
}

export function riverPresentation(mask) {
  return {
    ...maskPresentation(mask),
    tint: 0x53d0ff,
    scale: 1
  };
}

export function coastOverlays(mask) {
  const overlays = [];
  for (const [bit, rotation] of [[1, 0], [2, Math.PI / 2], [4, Math.PI], [8, -Math.PI / 2]]) {
    if (mask & bit) {
      overlays.push({ asset: resolveAtlasAsset("foam-edge"), rotation });
    }
  }
  if ((mask & 3) === 3) {
    overlays.push({ asset: resolveAtlasAsset("foam-corner"), rotation: 0 });
  }
  if ((mask & 6) === 6) {
    overlays.push({ asset: resolveAtlasAsset("foam-corner"), rotation: Math.PI / 2 });
  }
  if ((mask & 12) === 12) {
    overlays.push({ asset: resolveAtlasAsset("foam-corner"), rotation: Math.PI });
  }
  if ((mask & 9) === 9) {
    overlays.push({ asset: resolveAtlasAsset("foam-corner"), rotation: -Math.PI / 2 });
  }
  return overlays;
}

export function factionTint(factionId) {
  if (FACTION_COLORS[factionId]) {
    return FACTION_COLORS[factionId];
  }
  let hash = 0;
  for (const char of String(factionId ?? "")) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  const red = 120 + (Math.abs(hash) % 96);
  const green = 120 + (Math.abs(hash >> 3) % 96);
  const blue = 120 + (Math.abs(hash >> 6) % 96);
  return (red << 16) | (green << 8) | blue;
}

export function agentPresentation(agent) {
  return {
    asset: resolveAtlasAsset("agent"),
    tint: factionTint(agent.faction_id)
  };
}

export function resourcePresentation(resource) {
  const tint = {
    wood: 0x78472f,
    stone: 0xf3f5f7,
    food: 0xf4d867
  }[resource] ?? 0xffffff;
  return {
    asset: resolveAtlasAsset("overlay-tint"),
    tint
  };
}

function maskPresentation(mask) {
  if (mask === 15) {
    return { asset: resolveAtlasAsset("path-cross"), rotation: 0 };
  }
  if ([7, 11, 13, 14].includes(mask)) {
    return { asset: resolveAtlasAsset("path-tee"), rotation: teeRotation(mask) };
  }
  if (mask === 5 || mask === 10) {
    return { asset: resolveAtlasAsset("path-straight"), rotation: mask === 5 ? Math.PI / 2 : 0 };
  }
  if ([3, 6, 9, 12].includes(mask)) {
    return { asset: resolveAtlasAsset("path-turn"), rotation: turnRotation(mask) };
  }
  if ([1, 2, 4, 8].includes(mask)) {
    return { asset: resolveAtlasAsset("path-end"), rotation: endRotation(mask) };
  }
  return { asset: resolveAtlasAsset("path-cross"), rotation: 0 };
}

function turnRotation(mask) {
  if (mask === 3) {
    return 0;
  }
  if (mask === 6) {
    return Math.PI / 2;
  }
  if (mask === 12) {
    return Math.PI;
  }
  return -Math.PI / 2;
}

function teeRotation(mask) {
  if (mask === 11) {
    return 0;
  }
  if (mask === 7) {
    return Math.PI / 2;
  }
  if (mask === 14) {
    return Math.PI;
  }
  return -Math.PI / 2;
}

function endRotation(mask) {
  if (mask === 1) {
    return 0;
  }
  if (mask === 2) {
    return Math.PI / 2;
  }
  if (mask === 4) {
    return Math.PI;
  }
  return -Math.PI / 2;
}

function applyVariant(color, factor) {
  const red = Math.min(255, Math.round(((color >> 16) & 255) * factor));
  const green = Math.min(255, Math.round(((color >> 8) & 255) * factor));
  const blue = Math.min(255, Math.round((color & 255) * factor));
  return (red << 16) + (green << 8) + blue;
}

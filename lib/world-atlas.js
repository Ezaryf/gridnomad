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
  sea: { asset: "terrain-water", tint: 0x2297de },
  fjord: { asset: "terrain-water", tint: 0x1a7ec0 },
  river: { asset: "terrain-river-bed", tint: 0x2397d4 },
  coast: { asset: "terrain-coast", tint: 0x7ed7b0 },
  lagoon: { asset: "terrain-coast", tint: 0x86dfc0 },
  shoreline: { asset: "terrain-coast", tint: 0x7fd7c2 },
  grassland: { asset: "terrain-land", tint: 0x72d88b },
  meadow: { asset: "terrain-meadow", tint: 0x93e29d },
  "island-grass": { asset: "terrain-land", tint: 0x80e09d },
  orchard: { asset: "terrain-meadow", tint: 0x9be1a0 },
  "high-pasture": { asset: "terrain-meadow", tint: 0x92caa0 },
  vale: { asset: "terrain-meadow", tint: 0x98d8ae },
  forest: { asset: "terrain-forest", tint: 0x2f9d63 },
  rainforest: { asset: "terrain-forest", tint: 0x24986b },
  pinewood: { asset: "terrain-forest", tint: 0x287853 },
  scrub: { asset: "terrain-scrub", tint: 0xbecb86 },
  dune: { asset: "terrain-scrub", tint: 0xd8c58a },
  moor: { asset: "terrain-scrub", tint: 0x799974 },
  alpine: { asset: "terrain-highland", tint: 0x8ea5ae },
  peak: { asset: "terrain-highland", tint: 0x9eaeb5 },
  "volcanic-ridge": { asset: "terrain-highland", tint: 0x7d8b92 }
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
    return { asset: "terrain-bridge", tint: 0xffffff };
  }
  if (tile.terrain === "farm") {
    return { asset: "terrain-farm", tint: 0xffffff };
  }
  if (tile.terrain === "house") {
    return { asset: "terrain-house", tint: 0xffffff };
  }
  const baseStyle = BIOME_STYLES[tile.biome] ?? BIOME_STYLES.grassland;
  return {
    asset: baseStyle.asset,
    tint: applyVariant(baseStyle.tint, VARIANT_FACTORS[tile.visual_variant ?? 0] ?? 1)
  };
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
  return FACTION_COLORS[factionId] ?? 0xe5e7eb;
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

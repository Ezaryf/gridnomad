export const MIN_STARTER_KINGDOMS = 0;
export const MAX_STARTER_KINGDOMS = 16;
export const MIN_POPULATION_PER_KINGDOM = 1;
export const MAX_POPULATION_PER_KINGDOM = 96;
export const DEFAULT_POPULATION = 14;

export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-exp"];
export const GEMINI_API_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-exp"];
export const OPENAI_MODELS = ["gpt-5", "gpt-5-mini", "gpt-4.1-mini"];
export const ANTHROPIC_MODELS = ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-7-sonnet-latest"];

export const DIRECT_API_PROVIDERS = ["openai", "anthropic", "gemini-api"];

export const PROVIDER_OPTIONS = [
  { value: "heuristic", label: "Heuristic" },
  { value: "gemini-cli", label: "Gemini CLI" },
  { value: "gemini-api", label: "Gemini API" },
  { value: "openai", label: "OpenAI API" },
  { value: "anthropic", label: "Anthropic API" },
  { value: "opencode", label: "OpenCode CLI" }
];

export const RACE_OPTIONS = [
  { value: "human", label: "Humans" },
  { value: "orc", label: "Orcs" },
  { value: "elf", label: "Elves" },
  { value: "dwarf", label: "Dwarves" }
];

export const DEFAULT_PROVIDER = {
  provider: "heuristic",
  model: "",
  apiKey: "",
  googleApiKey: "",
  authMode: "existing-cli-auth",
  googleCloudProject: "",
  useVertex: false,
  opencodeProvider: "",
  cliHome: "",
  timeoutSeconds: 120,
  baseUrl: "",
  availableModels: [],
  supportsModelListing: false,
  supportsManualModelEntry: false
};

const DEFAULT_WORLD_SETTINGS = {
  seed: 240315,
  generatorPreset: "grand-continent",
  width: 128,
  height: 128,
  coastlineBias: 58,
  riverCount: 8,
  settlementDensity: 18,
  landmarkDensity: 16,
  biomeDensity: 62,
  faunaDensity: 54,
  kingdomGrowthIntensity: 60
};

const RACE_LIBRARY = [
  {
    id: "human",
    name: "Humans",
    color: "#d9b891",
    autoSeedCount: 1,
    startingPopulation: 18,
    biomeAffinity: ["grassland", "fertile-plains", "meadow", "coast"],
    culture: [
      {
        category: "norm",
        element: "Harbor Assembly",
        description: "Humans gather by torchlight to decide roads, markets, and treaties.",
        strength: 76
      }
    ],
    kingdomNames: ["Amber Crown", "Harbor March", "Silver Reach", "Sunfield Pact", "Ivory Quay"],
    humanNames: ["Ada", "Marin", "Orin", "Suri", "Bo", "Lio", "Mira", "Juno", "Cato", "Tala"],
    personalityBias: { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 3 },
    inventory: { food: 4, wood: 3, stone: 2 }
  },
  {
    id: "orc",
    name: "Orcs",
    color: "#c97162",
    autoSeedCount: 1,
    startingPopulation: 16,
    biomeAffinity: ["scrub", "desert", "volcanic", "highland-frontier"],
    culture: [
      {
        category: "norm",
        element: "War Drum Oath",
        description: "Orc councils rally around force, loyalty, and frontier honor.",
        strength: 81
      }
    ],
    kingdomNames: ["Ashmaw Clan", "Red Tusk Host", "Basalt March", "Iron Howl", "Cinder Banner"],
    humanNames: ["Gor", "Maka", "Ruk", "Tharn", "Vorga", "Dru", "Krag", "Skar", "Urla", "Mog"],
    personalityBias: { openness: 3, conscientiousness: 4, extraversion: 6, agreeableness: 2, neuroticism: 4 },
    inventory: { food: 3, wood: 2, stone: 3 }
  },
  {
    id: "elf",
    name: "Elves",
    color: "#6fbd98",
    autoSeedCount: 1,
    startingPopulation: 14,
    biomeAffinity: ["forest", "jungle", "grove", "meadow"],
    culture: [
      {
        category: "ritual",
        element: "Canopy Accord",
        description: "Elves treat forest stewardship, patience, and harmony as sacred law.",
        strength: 84
      }
    ],
    kingdomNames: ["Verdant Choir", "Moonleaf Vale", "Canopy Accord", "Silver Root", "Whispering Bough"],
    humanNames: ["Ael", "Lira", "Thalen", "Nyra", "Faen", "Ilya", "Serin", "Elar", "Mirael", "Tovan"],
    personalityBias: { openness: 7, conscientiousness: 5, extraversion: 4, agreeableness: 7, neuroticism: 2 },
    inventory: { food: 4, wood: 4, stone: 1 }
  },
  {
    id: "dwarf",
    name: "Dwarves",
    color: "#9fa7c8",
    autoSeedCount: 1,
    startingPopulation: 15,
    biomeAffinity: ["alpine", "mountain", "crystal", "highland"],
    culture: [
      {
        category: "ritual",
        element: "Foundry Vigil",
        description: "Dwarves honor stonecraft, mining, and lineage through shared forges.",
        strength: 83
      }
    ],
    kingdomNames: ["Iron Hall", "Granite Crown", "Deepforge", "Crystal Bastion", "Emberdelve"],
    humanNames: ["Brom", "Kelda", "Torin", "Marn", "Dagna", "Fenn", "Korin", "Bera", "Rurik", "Tova"],
    personalityBias: { openness: 4, conscientiousness: 7, extraversion: 3, agreeableness: 5, neuroticism: 3 },
    inventory: { food: 3, wood: 1, stone: 4 }
  }
];

const FAUNA_LIBRARY = [
  { id: "sheep", name: "Sheep", color: "#f2eee8", count: 18, kind: "grazer", rarity: "common" },
  { id: "cows", name: "Cattle", color: "#c79b7b", count: 12, kind: "grazer", rarity: "common" },
  { id: "chickens", name: "Chickens", color: "#f0d678", count: 14, kind: "grazer", rarity: "common" },
  { id: "wolves", name: "Wolves", color: "#7d8494", count: 9, kind: "predator", rarity: "uncommon" },
  { id: "bears", name: "Bears", color: "#735947", count: 5, kind: "predator", rarity: "uncommon" },
  { id: "dragons", name: "Dragons", color: "#b35f5f", count: 1, kind: "apex", rarity: "rare" }
];

const FALLBACK_COLORS = [
  "#dd6f6a",
  "#6aa8e7",
  "#d8bf67",
  "#6fd39d",
  "#d68ad9",
  "#5ec9c1",
  "#f08d63",
  "#87a8ff"
];

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function defaultWorldSettings(baseScenario) {
  return {
    ...DEFAULT_WORLD_SETTINGS,
    seed: Number(baseScenario?.generator?.seed ?? baseScenario?.config?.world_seed ?? baseScenario?.seed ?? DEFAULT_WORLD_SETTINGS.seed),
    generatorPreset: baseScenario?.generator?.preset ?? baseScenario?.config?.generator_preset ?? DEFAULT_WORLD_SETTINGS.generatorPreset,
    width: Number(baseScenario?.generator?.width ?? baseScenario?.config?.map_width ?? baseScenario?.config?.width ?? DEFAULT_WORLD_SETTINGS.width),
    height: Number(baseScenario?.generator?.height ?? baseScenario?.config?.map_height ?? baseScenario?.config?.height ?? DEFAULT_WORLD_SETTINGS.height),
    coastlineBias: Number(baseScenario?.generator?.coastline_bias ?? baseScenario?.config?.coastline_bias ?? DEFAULT_WORLD_SETTINGS.coastlineBias),
    riverCount: Number(baseScenario?.generator?.river_count ?? baseScenario?.config?.river_count ?? DEFAULT_WORLD_SETTINGS.riverCount),
    settlementDensity: Number(baseScenario?.generator?.settlement_density ?? baseScenario?.config?.settlement_density ?? DEFAULT_WORLD_SETTINGS.settlementDensity),
    landmarkDensity: Number(baseScenario?.generator?.landmark_density ?? baseScenario?.config?.landmark_density ?? DEFAULT_WORLD_SETTINGS.landmarkDensity),
    biomeDensity: Number(baseScenario?.generator?.biome_density ?? baseScenario?.config?.biome_density ?? DEFAULT_WORLD_SETTINGS.biomeDensity),
    faunaDensity: Number(baseScenario?.generator?.fauna_density ?? baseScenario?.config?.fauna_density ?? DEFAULT_WORLD_SETTINGS.faunaDensity),
    kingdomGrowthIntensity: Number(baseScenario?.generator?.kingdom_growth_intensity ?? baseScenario?.config?.kingdom_growth_intensity ?? DEFAULT_WORLD_SETTINGS.kingdomGrowthIntensity)
  };
}

export function buildDefaultSettings(baseScenario) {
  const world = defaultWorldSettings(baseScenario);
  const races = RACE_LIBRARY.map((race, index) => normalizeRace(baseScenario, null, race.id, index));
  const starterKingdoms = resolveLegacyStarterKingdoms(baseScenario, {}).map((kingdom, index) =>
    normalizeStarterKingdom(baseScenario, races, kingdom, index)
  );
  const fauna = normalizeFauna({}, world.faunaDensity);
  return { world, races, starter_kingdoms: starterKingdoms, fauna };
}

export function normalizeProviderConfig(config = {}) {
  const provider = String(config.provider ?? DEFAULT_PROVIDER.provider);
  const normalized = {
    ...DEFAULT_PROVIDER,
    ...config,
    provider,
    model: String(config.model ?? ""),
    apiKey: String(config.apiKey ?? config.api_key ?? ""),
    googleApiKey: String(config.googleApiKey ?? config.google_api_key ?? ""),
    authMode: String(config.authMode ?? config.auth_mode ?? DEFAULT_PROVIDER.authMode),
    googleCloudProject: String(config.googleCloudProject ?? config.google_cloud_project ?? ""),
    useVertex: Boolean(config.useVertex ?? config.use_vertex ?? false),
    opencodeProvider: String(config.opencodeProvider ?? config.opencode_provider ?? ""),
    cliHome: String(config.cliHome ?? config.cli_home ?? ""),
    timeoutSeconds: clamp(Number(config.timeoutSeconds ?? config.timeout_seconds ?? DEFAULT_PROVIDER.timeoutSeconds), 15, 600),
    baseUrl: String(config.baseUrl ?? config.base_url ?? ""),
    availableModels: Array.isArray(config.availableModels) ? config.availableModels.map(String) : [],
    supportsModelListing: Boolean(config.supportsModelListing ?? false),
    supportsManualModelEntry: Boolean(config.supportsManualModelEntry ?? false)
  };
  return applyProviderCapabilities(normalized);
}

export function applyProviderCapabilities(config) {
  if (config.provider === "gemini-cli") {
    return {
      ...config,
      availableModels: config.availableModels.length ? config.availableModels : [...GEMINI_MODELS],
      supportsModelListing: true,
      supportsManualModelEntry: true
    };
  }
  if (config.provider === "opencode") {
    return {
      ...config,
      supportsModelListing: true,
      supportsManualModelEntry: true
    };
  }
  if (config.provider === "gemini-api") {
    return {
      ...config,
      availableModels: config.availableModels.length ? config.availableModels : [...GEMINI_API_MODELS],
      supportsModelListing: true,
      supportsManualModelEntry: true
    };
  }
  if (config.provider === "openai") {
    return {
      ...config,
      availableModels: config.availableModels.length ? config.availableModels : [...OPENAI_MODELS],
      supportsModelListing: true,
      supportsManualModelEntry: true
    };
  }
  if (config.provider === "anthropic") {
    return {
      ...config,
      availableModels: config.availableModels.length ? config.availableModels : [...ANTHROPIC_MODELS],
      supportsModelListing: true,
      supportsManualModelEntry: true
    };
  }
  return {
    ...config,
    availableModels: [],
    supportsModelListing: false,
    supportsManualModelEntry: false,
    model: ""
  };
}

export function providerUsesApiKey(provider) {
  return DIRECT_API_PROVIDERS.includes(provider);
}

export function providerUsesLogin(provider) {
  return provider === "opencode" || provider === "gemini-cli";
}

export function providerSupportsBaseUrl(provider) {
  return provider === "openai" || provider === "anthropic";
}

export function providerDisplayName(provider) {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

export function normalizeSettings(baseScenario, rawSettings = {}) {
  const defaults = buildDefaultSettings(baseScenario);
  const races = reconcileRaces(baseScenario, resolveLegacyRaces(rawSettings), defaults.races);
  const world = {
    ...defaults.world,
    ...(rawSettings?.world ?? {})
  };
  const starterKingdoms = reconcileStarterKingdoms(
    baseScenario,
    races,
    resolveLegacyStarterKingdoms(baseScenario, rawSettings),
  );
  const fauna = normalizeFauna(rawSettings?.fauna, world.faunaDensity);
  return { world, races, starter_kingdoms: starterKingdoms, fauna };
}

export function addStarterKingdom(settings, baseScenario) {
  const kingdoms = [...(settings.starter_kingdoms ?? [])];
  if (kingdoms.length >= MAX_STARTER_KINGDOMS) {
    return settings;
  }
  const next = [...kingdoms, undefined];
  return {
    ...settings,
    starter_kingdoms: reconcileStarterKingdoms(baseScenario, settings.races ?? [], next)
  };
}

export function removeStarterKingdom(settings, baseScenario, kingdomId) {
  return {
    ...settings,
    starter_kingdoms: reconcileStarterKingdoms(
      baseScenario,
      settings.races ?? [],
      (settings.starter_kingdoms ?? []).filter((kingdom) => kingdom.id !== kingdomId)
    )
  };
}

export function updateStarterKingdom(settings, baseScenario, kingdomId, patch) {
  return {
    ...settings,
    starter_kingdoms: reconcileStarterKingdoms(
      baseScenario,
      settings.races ?? [],
      (settings.starter_kingdoms ?? []).map((kingdom, index) => (
        kingdom.id === kingdomId ? normalizeStarterKingdom(baseScenario, settings.races ?? [], { ...kingdom, ...patch }, index) : kingdom
      ))
    )
  };
}

export function updateRace(settings, baseScenario, raceId, patch) {
  return {
    ...settings,
    races: reconcileRaces(
      baseScenario,
      (settings.races ?? []).map((race, index) => (
        race.id === raceId ? normalizeRace(baseScenario, { ...race, ...patch }, race.id, index) : race
      ))
    )
  };
}

export function updateRaceController(settings, baseScenario, raceId, patch) {
  return updateRace(settings, baseScenario, raceId, {
    controller: applyProviderCapabilities({
      ...(settings.races ?? []).find((race) => race.id === raceId)?.controller,
      ...patch
    })
  });
}

export function updateKingdomController(settings, baseScenario, kingdomId, patch) {
  return updateStarterKingdom(settings, baseScenario, kingdomId, {
    controller: applyProviderCapabilities({
      ...(settings.starter_kingdoms ?? []).find((kingdom) => kingdom.id === kingdomId)?.controller,
      ...patch
    })
  });
}

export function updateFauna(settings, patch) {
  return {
    ...settings,
    fauna: normalizeFauna({ ...(settings.fauna ?? {}), ...patch }, settings.world?.faunaDensity ?? DEFAULT_WORLD_SETTINGS.faunaDensity)
  };
}

export function synthesizeScenario(baseScenario, settings) {
  const normalized = normalizeSettings(baseScenario, settings);
  const world = normalized.world;
  const resolvedKingdoms = buildResolvedKingdoms(normalized);
  return {
    ...baseScenario,
    seed: world.seed,
    config: {
      ...baseScenario.config,
      width: world.width,
      height: world.height,
      map_width: world.width,
      map_height: world.height,
      world_seed: world.seed,
      generator_preset: world.generatorPreset,
      coastline_bias: world.coastlineBias,
      river_count: world.riverCount,
      settlement_density: world.settlementDensity,
      landmark_density: world.landmarkDensity,
      biome_density: world.biomeDensity,
      fauna_density: world.faunaDensity,
      kingdom_growth_intensity: world.kingdomGrowthIntensity
    },
    generator: {
      seed: world.seed,
      preset: world.generatorPreset,
      width: world.width,
      height: world.height,
      coastline_bias: world.coastlineBias,
      river_count: world.riverCount,
      settlement_density: world.settlementDensity,
      landmark_density: world.landmarkDensity,
      biome_density: world.biomeDensity,
      fauna_density: world.faunaDensity,
      kingdom_growth_intensity: world.kingdomGrowthIntensity
    },
    worldbox_mode: true,
    races: normalized.races.map((race) => ({
      id: race.id,
      name: race.name,
      enabled: race.enabled,
      auto_seed_count: race.auto_seed_count,
      starting_population: race.starting_population,
      color: race.color,
      biome_affinity: race.biome_affinity,
      culture: race.culture
    })),
    starter_kingdoms: normalized.starter_kingdoms,
    kingdoms: resolvedKingdoms.map((kingdom) => ({
      id: kingdom.id,
      name: kingdom.name,
      race_kind: kingdom.race_kind,
      color: kingdom.color,
      population: kingdom.population,
      auto_seeded: kingdom.auto_seeded,
      manual_position: kingdom.manual_position,
      x: kingdom.manual_position ? kingdom.x : null,
      y: kingdom.manual_position ? kingdom.y : null
    })),
    fauna: normalized.fauna,
    factions: resolvedKingdoms.map((kingdom) => ({
      id: kingdom.id,
      name: kingdom.name,
      color: kingdom.color,
      banner_color: kingdom.color,
      race_kind: kingdom.race_kind,
      culture: kingdom.culture,
      controller: kingdom.controller,
      auto_seeded: kingdom.auto_seeded,
      spawn_x: kingdom.manual_position ? kingdom.x : null,
      spawn_y: kingdom.manual_position ? kingdom.y : null,
      starting_population: kingdom.population
    })),
    agents: resolvedKingdoms.flatMap((kingdom) => generateHumanUnits(kingdom))
  };
}

export function buildResolvedKingdoms(settings) {
  const racesById = new Map((settings.races ?? []).map((race) => [race.id, race]));
  const manual = (settings.starter_kingdoms ?? []).map((kingdom, index) =>
    normalizeResolvedKingdom(kingdom, racesById.get(kingdom.race_kind), index, false)
  );
  const usedIds = new Set(manual.map((kingdom) => kingdom.id));
  const autoSeeded = [];
  for (const race of settings.races ?? []) {
    if (!race.enabled) {
      continue;
    }
    for (let index = 0; index < race.auto_seed_count; index += 1) {
      const baseName = race.kingdom_name_pool[index % race.kingdom_name_pool.length];
      const id = uniqueId(`${race.id}-kingdom-${String(index + 1).padStart(2, "0")}`, usedIds);
      autoSeeded.push(
        normalizeResolvedKingdom(
          {
            id,
            name: baseName,
            race_kind: race.id,
            color: race.color,
            population: race.starting_population,
            culture: race.culture,
            controller: race.controller,
            manual_position: false,
            x: null,
            y: null
          },
          race,
          index,
          true
        )
      );
      usedIds.add(id);
    }
  }
  return [...manual, ...autoSeeded];
}

function reconcileRaces(baseScenario, races = [], defaults = null) {
  const seed = defaults ?? RACE_LIBRARY.map((race, index) => normalizeRace(baseScenario, null, race.id, index));
  return seed.map((defaultRace, index) => {
    const incoming = races.find((race) => race?.id === defaultRace.id);
    return normalizeRace(baseScenario, { ...defaultRace, ...incoming }, defaultRace.id, index);
  });
}

function resolveLegacyRaces(rawSettings) {
  if (Array.isArray(rawSettings?.races)) {
    return rawSettings.races;
  }
  return [];
}

function normalizeRace(baseScenario, race, raceId, index) {
  const library = raceDefinition(raceId) ?? RACE_LIBRARY[index % RACE_LIBRARY.length];
  const source = race ?? {};
  return {
    id: library.id,
    name: String(source.name ?? library.name),
    enabled: source.enabled !== false,
    auto_seed_count: clamp(Number(source.auto_seed_count ?? source.autoSeedCount ?? library.autoSeedCount), 0, 4),
    starting_population: clamp(Number(source.starting_population ?? source.startingPopulation ?? library.startingPopulation), MIN_POPULATION_PER_KINGDOM, MAX_POPULATION_PER_KINGDOM),
    color: String(source.color ?? library.color),
    biome_affinity: Array.isArray(source.biome_affinity ?? source.biomeAffinity) ? (source.biome_affinity ?? source.biomeAffinity).map(String) : [...library.biomeAffinity],
    culture: cloneCulture(source.culture ?? library.culture, index),
    controller: normalizeProviderConfig(source.controller ?? {}),
    kingdom_name_pool: Array.isArray(source.kingdom_name_pool ?? source.kingdomNamePool) ? (source.kingdom_name_pool ?? source.kingdomNamePool).map(String) : [...library.kingdomNames],
    human_name_pool: Array.isArray(source.human_name_pool ?? source.humanNamePool) ? (source.human_name_pool ?? source.humanNamePool).map(String) : [...library.humanNames],
    personality_bias: { ...library.personalityBias, ...(source.personality_bias ?? source.personalityBias ?? {}) },
    default_inventory: { ...library.inventory, ...(source.default_inventory ?? source.defaultInventory ?? {}) }
  };
}

function reconcileStarterKingdoms(baseScenario, races, kingdoms = []) {
  return (kingdoms ?? []).map((kingdom, index) => normalizeStarterKingdom(baseScenario, races, kingdom, index));
}

function resolveLegacyStarterKingdoms(baseScenario, rawSettings) {
  if (Array.isArray(rawSettings?.starter_kingdoms)) {
    return rawSettings.starter_kingdoms;
  }
  if (Array.isArray(rawSettings?.groups)) {
    return rawSettings.groups.map((group, index) => legacyGroupToKingdom(group, index));
  }
  if (Array.isArray(rawSettings?.civilizations)) {
    return rawSettings.civilizations.map((group, index) => legacyGroupToKingdom(group, index));
  }
  if (Array.isArray(rawSettings?.kingdoms)) {
    return rawSettings.kingdoms;
  }
  if (baseScenario?.factions?.length) {
    return baseScenario.factions.map((faction, index) => {
      const humans = humansForFaction(baseScenario, faction.id);
      return {
        id: faction.id,
        name: faction.name,
        race_kind: faction.race_kind ?? "human",
        color: faction.color ?? faction.banner_color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        culture: cloneCulture(faction.culture, index),
        population: humans.length || DEFAULT_POPULATION,
        controller: normalizeProviderConfig(faction.controller ?? {}),
        manual_position: false,
        x: faction.spawn_x ?? null,
        y: faction.spawn_y ?? null
      };
    });
  }
  return [];
}

function legacyGroupToKingdom(group, index) {
  return {
    id: String(group.id ?? `kingdom-${String(index + 1).padStart(2, "0")}`),
    name: String(group.name ?? `Kingdom ${index + 1}`),
    race_kind: String(group.race_kind ?? group.raceKind ?? "human"),
    color: String(group.color ?? group.banner_color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]),
    culture: cloneCulture(group.culture, index),
    population: Number(group.population ?? group.population_count ?? group.agent_count ?? group.populationCount ?? DEFAULT_POPULATION),
    controller: normalizeProviderConfig(group.controller ?? group.provider ?? {}),
    manual_position: Boolean(group.manual_position ?? group.manualPosition ?? false),
    x: group.x ?? null,
    y: group.y ?? null
  };
}

function normalizeStarterKingdom(baseScenario, races, kingdom, index) {
  const race = (races ?? []).find((item) => item.id === (kingdom?.race_kind ?? kingdom?.raceKind ?? "human")) ?? raceDefinition("human");
  const source = kingdom ?? {};
  return {
    id: String(source.id ?? `starter-${String(index + 1).padStart(2, "0")}`),
    name: String(source.name ?? `${race.name} Kingdom ${index + 1}`),
    race_kind: String(source.race_kind ?? source.raceKind ?? race.id),
    color: String(source.color ?? race.color),
    population: clamp(Number(source.population ?? source.population_count ?? source.populationCount ?? DEFAULT_POPULATION), MIN_POPULATION_PER_KINGDOM, MAX_POPULATION_PER_KINGDOM),
    culture: cloneCulture(source.culture ?? race.culture, index),
    controller: normalizeProviderConfig(source.controller ?? race.controller ?? {}),
    manual_position: Boolean(source.manual_position ?? source.manualPosition ?? false),
    x: source.x == null ? null : Number(source.x),
    y: source.y == null ? null : Number(source.y)
  };
}

function normalizeResolvedKingdom(kingdom, race, index, autoSeeded) {
  const source = kingdom ?? {};
  const raceDef = race ?? raceDefinition(source.race_kind ?? source.raceKind ?? "human");
  return {
    id: String(source.id),
    name: String(source.name),
    race_kind: String(source.race_kind ?? source.raceKind ?? raceDef.id),
    color: String(source.color ?? raceDef.color),
    population: clamp(Number(source.population ?? DEFAULT_POPULATION), MIN_POPULATION_PER_KINGDOM, MAX_POPULATION_PER_KINGDOM),
    culture: cloneCulture(source.culture ?? raceDef.culture, index),
    controller: normalizeProviderConfig(source.controller ?? raceDef.controller ?? {}),
    manual_position: Boolean(source.manual_position ?? source.manualPosition ?? false),
    x: source.x == null ? null : Number(source.x),
    y: source.y == null ? null : Number(source.y),
    auto_seeded: autoSeeded,
    race: raceDef
  };
}

function normalizeFauna(fauna, density) {
  const source = fauna ?? {};
  return {
    density: clamp(Number(source.density ?? density ?? DEFAULT_WORLD_SETTINGS.faunaDensity), 0, 100),
    species: FAUNA_LIBRARY.map((species) => ({
      id: species.id,
      name: species.name,
      kind: species.kind,
      rarity: species.rarity,
      color: species.color,
      enabled: source.species?.find?.((item) => item.id === species.id)?.enabled !== false,
      count: clamp(
        Number(source.species?.find?.((item) => item.id === species.id)?.count ?? species.count),
        0,
        species.id === "dragons" ? 8 : 200
      )
    }))
  };
}

function generateHumanUnits(kingdom) {
  const race = kingdom.race ?? raceDefinition(kingdom.race_kind);
  const humans = [];
  for (let index = 0; index < kingdom.population; index += 1) {
    const namePool = race.human_name_pool ?? race.humanNames ?? race.human_name_pool ?? [];
    const name = namePool[index % namePool.length] ?? `${race.name} ${index + 1}`;
    humans.push({
      id: `${kingdom.id}-human-${String(index + 1).padStart(3, "0")}`,
      name: index === 0 ? `${name} of ${kingdom.name}` : name,
      faction_id: kingdom.id,
      kingdom_id: kingdom.id,
      race_kind: kingdom.race_kind,
      entity_kind: "human",
      role: index === 0 ? "leader" : (index < 4 ? "builder" : "citizen"),
      personality: generatePersonality(race.personality_bias ?? race.personalityBias, index),
      emotions: {
        Joy: 4,
        Sadness: 1,
        Fear: 2,
        Anger: kingdom.race_kind === "orc" ? 3 : 1,
        Disgust: 0,
        Surprise: 3
      },
      needs: {
        Survival: 4,
        Safety: 4,
        Belonging: 5,
        Esteem: 4,
        Self_Actualization: kingdom.race_kind === "elf" ? 6 : 4
      },
      inventory: {
        food: Number(race.default_inventory?.food ?? 2),
        wood: Number(race.default_inventory?.wood ?? 1),
        stone: Number(race.default_inventory?.stone ?? 1)
      },
      health: 10,
      alive: true,
      last_reasoned_tick: -(index % 5),
      x: kingdom.manual_position ? kingdom.x : undefined,
      y: kingdom.manual_position ? kingdom.y : undefined
    });
  }
  return humans;
}

function generatePersonality(bias, index) {
  const source = bias ?? {};
  return {
    openness: clamp(Number(source.openness ?? 5) + ((index + 1) % 2), 0, 10),
    conscientiousness: clamp(Number(source.conscientiousness ?? 5) + (index % 2), 0, 10),
    extraversion: clamp(Number(source.extraversion ?? 5) + ((index % 3) - 1), 0, 10),
    agreeableness: clamp(Number(source.agreeableness ?? 5) + (((index + 1) % 3) - 1), 0, 10),
    neuroticism: clamp(Number(source.neuroticism ?? 3) + ((index % 2) ? 0 : 1), 0, 10)
  };
}

function cloneCulture(culture, index) {
  if (!Array.isArray(culture) || !culture.length) {
    const race = RACE_LIBRARY[index % RACE_LIBRARY.length];
    return race.culture.map((entry) => ({ ...entry }));
  }
  return culture.map((entry) => ({
    category: String(entry.category ?? "norm"),
    element: String(entry.element ?? "Custom Rite"),
    description: String(entry.description ?? "A defining cultural idea."),
    strength: clamp(Number(entry.strength ?? 70), 0, 100)
  }));
}

function humansForFaction(baseScenario, factionId) {
  return (baseScenario?.agents ?? []).filter((agent) => (agent.kingdom_id ?? agent.faction_id) === factionId);
}

function raceDefinition(raceId) {
  return RACE_LIBRARY.find((race) => race.id === raceId) ?? RACE_LIBRARY[0];
}

function uniqueId(base, used) {
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

export function labelForRace(raceId) {
  return raceDefinition(raceId)?.name ?? raceId;
}

export function totalConfiguredPopulation(settings) {
  return buildResolvedKingdoms(settings).reduce((sum, kingdom) => sum + kingdom.population, 0);
}

export function totalAutoSeededKingdoms(settings) {
  return (settings.races ?? []).reduce((sum, race) => sum + (race.enabled ? race.auto_seed_count : 0), 0);
}

export function totalEnabledFauna(settings) {
  return (settings.fauna?.species ?? []).reduce((sum, species) => sum + (species.enabled ? species.count : 0), 0);
}

export function buildRuntimeControllerMap(settings) {
  const controllers = {};
  for (const kingdom of buildResolvedKingdoms(settings)) {
    controllers[kingdom.id] = normalizeProviderConfig(kingdom.controller);
  }
  return { factions: controllers };
}

export const addGroup = addStarterKingdom;
export const removeGroup = removeStarterKingdom;
export const updateGroup = updateStarterKingdom;
export const updateGroupController = updateKingdomController;
export const updateGroupPopulation = (settings, baseScenario, kingdomId, population) =>
  updateStarterKingdom(settings, baseScenario, kingdomId, { population });
export function updateHumanBlueprint(settings) {
  return settings;
}

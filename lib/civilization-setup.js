export const MIN_GROUPS = 1;
export const MAX_GROUPS = 12;
export const MIN_POPULATION_PER_GROUP = 1;
export const MAX_POPULATION_PER_GROUP = 48;
export const DEFAULT_POPULATION = 6;

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
  landmarkDensity: 16
};

const FALLBACK_COLORS = [
  "#dd6f6a",
  "#6aa8e7",
  "#d8bf67",
  "#6fd39d",
  "#d68ad9",
  "#5ec9c1",
  "#f08d63",
  "#87a8ff",
  "#d7dd7a",
  "#c77f60",
  "#8bc6a0",
  "#c98db8"
];

const FALLBACK_GROUP_NAMES = [
  "Crimson Reach",
  "Azure House",
  "Verdant Crown",
  "Silver Harbor",
  "Cedar March",
  "Obsidian Tide",
  "Amber Vale",
  "Storm Chorus",
  "Iron Bloom",
  "Moss Lantern",
  "Sunken Court",
  "Pine Bastion"
];

const CULTURE_SEEDS = [
  {
    category: "norm",
    element: "River Pact",
    description: "Builders who reconnect land are honored at dusk.",
    strength: 82
  },
  {
    category: "ritual",
    element: "Harbor Supper",
    description: "Food is shared after every safe return from the coast.",
    strength: 76
  },
  {
    category: "taboo",
    element: "Silent Peaks",
    description: "Mountain sanctuaries should not be disturbed without council approval.",
    strength: 71
  },
  {
    category: "norm",
    element: "Lantern Council",
    description: "Plans are spoken aloud before the first road is laid.",
    strength: 67
  },
  {
    category: "ritual",
    element: "Foundry Toast",
    description: "New tools are welcomed with a communal vow of stewardship.",
    strength: 73
  }
];

const HUMAN_NAMES = [
  "Ada",
  "Orin",
  "Bo",
  "Marin",
  "Suri",
  "Cael",
  "Iris",
  "Kellan",
  "Nia",
  "Tarin",
  "Veya",
  "Lio",
  "Arden",
  "Mira",
  "Sable",
  "Rowan",
  "Tala",
  "Eren",
  "Juno",
  "Cato"
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
    landmarkDensity: Number(baseScenario?.generator?.landmark_density ?? baseScenario?.config?.landmark_density ?? DEFAULT_WORLD_SETTINGS.landmarkDensity)
  };
}

export function buildDefaultSettings(baseScenario) {
  const world = defaultWorldSettings(baseScenario);
  const groups = reconcileGroups(baseScenario, [], inferDesiredGroupCount(baseScenario, null));
  return { world, groups };
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
  const sourceGroups = resolveLegacyGroups(baseScenario, rawSettings);
  const world = {
    ...defaults.world,
    ...(rawSettings?.world ?? {})
  };
  const desiredCount = inferDesiredGroupCount(baseScenario, rawSettings);
  const groups = reconcileGroups(baseScenario, sourceGroups, desiredCount);
  return { world, groups };
}

export function addGroup(settings, baseScenario) {
  const groups = [...(settings.groups ?? [])];
  if (groups.length >= MAX_GROUPS) {
    return settings;
  }
  const nextGroups = reconcileGroups(baseScenario, [...groups, undefined], groups.length + 1);
  return {
    ...settings,
    groups: nextGroups
  };
}

export function removeGroup(settings, baseScenario, groupId) {
  const groups = (settings.groups ?? []).filter((group) => group.id !== groupId);
  if (groups.length < MIN_GROUPS) {
    return settings;
  }
  return {
    ...settings,
    groups: reconcileGroups(baseScenario, groups, groups.length)
  };
}

export function updateGroup(settings, baseScenario, groupId, patch) {
  return {
    ...settings,
    groups: (settings.groups ?? []).map((group, index) => (
      group.id === groupId
        ? normalizeGroup(baseScenario, { ...group, ...patch }, index)
        : group
    ))
  };
}

export function updateGroupController(settings, baseScenario, groupId, patch) {
  return {
    ...settings,
    groups: (settings.groups ?? []).map((group, index) => (
      group.id === groupId
        ? normalizeGroup(baseScenario, {
            ...group,
            controller: applyProviderCapabilities({
              ...group.controller,
              ...patch
            })
          }, index)
        : group
    ))
  };
}

export function updateGroupPopulation(settings, baseScenario, groupId, populationCount) {
  return {
    ...settings,
    groups: (settings.groups ?? []).map((group, index) => (
      group.id === groupId
        ? normalizeGroup(baseScenario, { ...group, population_count: populationCount }, index)
        : group
    ))
  };
}

export function updateHumanBlueprint(settings, groupId, humanId, patch) {
  return {
    ...settings,
    groups: (settings.groups ?? []).map((group) => (
      group.id === groupId
        ? {
            ...group,
            humans: group.humans.map((human) => (
              human.id === humanId ? { ...human, ...patch } : human
            ))
          }
        : group
    ))
  };
}

export function reconcileGroups(baseScenario, groups = [], desiredCount = null) {
  const count = desiredCount == null
    ? clamp(groups.length || inferDesiredGroupCount(baseScenario, null), MIN_GROUPS, MAX_GROUPS)
    : clamp(Number(desiredCount), MIN_GROUPS, MAX_GROUPS);
  const next = [];
  for (let index = 0; index < count; index += 1) {
    next.push(normalizeGroup(baseScenario, groups[index], index));
  }
  return next;
}

export function normalizeGroup(baseScenario, group, index) {
  const baseFaction = baseScenario?.factions?.[index];
  const existing = group ?? {};
  const id = String(existing.id ?? baseFaction?.id ?? `group-${String(index + 1).padStart(2, "0")}`);
  const culture = cloneCulture(existing.culture ?? baseFaction?.culture, index);
  const populationCount = clamp(
    Number(
      existing.population_count ??
      existing.populationCount ??
      existing.agent_count ??
      existing.humans?.length ??
      existing.agents?.length ??
      humansForGroup(baseScenario, id).length ??
      DEFAULT_POPULATION
    ),
    MIN_POPULATION_PER_GROUP,
    MAX_POPULATION_PER_GROUP
  );
  const normalized = {
    id,
    name: String(existing.name ?? baseFaction?.name ?? FALLBACK_GROUP_NAMES[index % FALLBACK_GROUP_NAMES.length]),
    color: String(existing.color ?? existing.banner_color ?? baseFaction?.color ?? baseFaction?.banner_color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]),
    culture,
    population_count: populationCount,
    controller: normalizeProviderConfig(existing.controller ?? existing.provider ?? {}),
    humans: []
  };
  normalized.humans = reconcileHumans(
    baseScenario,
    normalized,
    existing.humans ?? existing.agents,
    populationCount,
    index
  );
  return normalized;
}

export function reconcileHumans(baseScenario, group, humans = [], populationCount = DEFAULT_POPULATION, groupIndex = 0) {
  const sourceHumans = Array.isArray(humans) && humans.length
    ? humans
    : humansForGroup(baseScenario, group.id);
  const next = [];
  for (let index = 0; index < populationCount; index += 1) {
    next.push(normalizeHumanBlueprint(sourceHumans[index], group.id, index, group.name, groupIndex));
  }
  return next;
}

export function normalizeHumanBlueprint(human, groupId, humanIndex, groupName = "Group", groupIndex = 0) {
  const source = human ?? {};
  const id = String(source.id ?? `${groupId}-human-${String(humanIndex + 1).padStart(2, "0")}`);
  const name = String(source.name ?? defaultHumanName(groupIndex, humanIndex, groupName));
  return {
    id,
    name,
    group_id: groupId,
    personality: normalizePersonality(source.personality, groupIndex, humanIndex),
    emotions: normalizeEmotions(source.emotions),
    needs: normalizeNeeds(source.needs),
    inventory: normalizeInventory(source.inventory),
    health: clamp(Number(source.health ?? 10), 0, 10),
    alive: source.alive !== false,
    last_reasoned_tick: Number(source.last_reasoned_tick ?? source.lastReasonedTick ?? -(humanIndex % 5))
  };
}

export function synthesizeScenario(baseScenario, settings) {
  const normalized = normalizeSettings(baseScenario, settings);
  const world = normalized.world;
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
      landmark_density: world.landmarkDensity
    },
    generator: {
      seed: world.seed,
      preset: world.generatorPreset,
      width: world.width,
      height: world.height,
      coastline_bias: world.coastlineBias,
      river_count: world.riverCount,
      settlement_density: world.settlementDensity,
      landmark_density: world.landmarkDensity
    },
    factions: normalized.groups.map((group) => ({
      id: group.id,
      name: group.name,
      color: group.color,
      banner_color: group.color,
      culture: group.culture
    })),
    agents: normalized.groups.flatMap((group) => group.humans.map((human, index) => ({
      id: human.id,
      name: human.name,
      faction_id: group.id,
      personality: human.personality,
      emotions: human.emotions,
      needs: human.needs,
      inventory: human.inventory,
      health: human.health,
      alive: human.alive,
      last_reasoned_tick: Number(human.last_reasoned_tick ?? -(index % 5))
    })))
  };
}

function resolveLegacyGroups(baseScenario, rawSettings) {
  if (Array.isArray(rawSettings?.groups)) {
    return rawSettings.groups;
  }
  if (Array.isArray(rawSettings?.civilizations)) {
    return rawSettings.civilizations.map((civilization, index) => normalizeLegacyCivilization(baseScenario, civilization, index));
  }
  if (rawSettings?.factions && !Array.isArray(rawSettings?.groups)) {
    return migrateLegacyFactions(baseScenario, rawSettings.factions);
  }
  return [];
}

function migrateLegacyFactions(baseScenario, legacyFactions = {}) {
  const factions = baseScenario?.factions ?? [];
  return factions.map((faction, index) => {
    const controller = normalizeProviderConfig(legacyFactions[faction.id] ?? {});
    const scenarioHumans = humansForGroup(baseScenario, faction.id);
    return normalizeGroup(baseScenario, {
      id: faction.id,
      name: faction.name,
      color: faction.color ?? faction.banner_color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      culture: cloneCulture(faction.culture, index),
      population_count: scenarioHumans.length || DEFAULT_POPULATION,
      controller,
      humans: scenarioHumans
    }, index);
  });
}

function normalizeLegacyCivilization(baseScenario, civilization, index) {
  return normalizeGroup(baseScenario, {
    ...civilization,
    population_count: civilization.population_count ?? civilization.agent_count ?? civilization.populationCount,
    humans: civilization.humans ?? civilization.agents
  }, index);
}

function inferDesiredGroupCount(baseScenario, rawSettings) {
  const rawCount = rawSettings?.world?.groupCount ??
    rawSettings?.world?.civilizationCount ??
    rawSettings?.groups?.length ??
    rawSettings?.civilizations?.length ??
    baseScenario?.factions?.length ??
    3;
  return clamp(Number(rawCount || 3), MIN_GROUPS, MAX_GROUPS);
}

function humansForGroup(baseScenario, groupId) {
  return (baseScenario?.agents ?? []).filter((human) => (human.group_id ?? human.faction_id) === groupId);
}

function cloneCulture(culture, index) {
  const items = Array.isArray(culture) && culture.length ? culture : [CULTURE_SEEDS[index % CULTURE_SEEDS.length]];
  return items.map((item, itemIndex) => ({
    category: String(item.category ?? CULTURE_SEEDS[(index + itemIndex) % CULTURE_SEEDS.length].category),
    element: String(item.element ?? CULTURE_SEEDS[(index + itemIndex) % CULTURE_SEEDS.length].element),
    description: String(item.description ?? CULTURE_SEEDS[(index + itemIndex) % CULTURE_SEEDS.length].description),
    strength: clamp(Number(item.strength ?? CULTURE_SEEDS[(index + itemIndex) % CULTURE_SEEDS.length].strength), 0, 100)
  }));
}

function normalizePersonality(personality, groupIndex, humanIndex) {
  const basis = personality ?? {};
  return {
    openness: clamp(Number(basis.openness ?? 5 + ((groupIndex + humanIndex) % 4)), 0, 10),
    conscientiousness: clamp(Number(basis.conscientiousness ?? 5 + ((groupIndex + humanIndex + 2) % 3)), 0, 10),
    extraversion: clamp(Number(basis.extraversion ?? 4 + ((humanIndex + 1) % 5)), 0, 10),
    agreeableness: clamp(Number(basis.agreeableness ?? 5 + ((groupIndex + 1) % 4)), 0, 10),
    neuroticism: clamp(Number(basis.neuroticism ?? 2 + ((humanIndex + groupIndex) % 3)), 0, 10)
  };
}

function normalizeEmotions(emotions) {
  const basis = emotions ?? {};
  return {
    Joy: clamp(Number(basis.Joy ?? basis.joy ?? 4), 0, 10),
    Sadness: clamp(Number(basis.Sadness ?? basis.sadness ?? 1), 0, 10),
    Fear: clamp(Number(basis.Fear ?? basis.fear ?? 2), 0, 10),
    Anger: clamp(Number(basis.Anger ?? basis.anger ?? 1), 0, 10),
    Disgust: clamp(Number(basis.Disgust ?? basis.disgust ?? 0), 0, 10),
    Surprise: clamp(Number(basis.Surprise ?? basis.surprise ?? 3), 0, 10)
  };
}

function normalizeNeeds(needs) {
  const basis = needs ?? {};
  return {
    Survival: clamp(Number(basis.Survival ?? basis.survival ?? 4), 0, 10),
    Safety: clamp(Number(basis.Safety ?? basis.safety ?? 4), 0, 10),
    Belonging: clamp(Number(basis.Belonging ?? basis.belonging ?? 5), 0, 10),
    Esteem: clamp(Number(basis.Esteem ?? basis.esteem ?? 4), 0, 10),
    Self_Actualization: clamp(Number(basis.Self_Actualization ?? basis.self_actualization ?? 5), 0, 10)
  };
}

function normalizeInventory(inventory) {
  const basis = inventory ?? {};
  return {
    food: Math.max(0, Math.trunc(Number(basis.food ?? 3))),
    wood: Math.max(0, Math.trunc(Number(basis.wood ?? 2))),
    stone: Math.max(0, Math.trunc(Number(basis.stone ?? 1)))
  };
}

function defaultHumanName(groupIndex, humanIndex, groupName) {
  const name = HUMAN_NAMES[(groupIndex * 3 + humanIndex) % HUMAN_NAMES.length];
  if (humanIndex < 3) {
    return name;
  }
  return `${name} ${groupName.split(" ")[0]}`;
}

export const MIN_GROUPS = 1;
export const MAX_GROUPS = 12;
export const MIN_POPULATION_PER_GROUP = 1;
export const MAX_POPULATION_PER_GROUP = 24;
export const DEFAULT_POPULATION = 6;

export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-exp"];
export const GEMINI_API_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-exp"];
export const OPENAI_MODELS = ["gpt-5", "gpt-5-mini", "gpt-4.1-mini"];
export const ANTHROPIC_MODELS = ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-7-sonnet-latest"];

export const DIRECT_API_PROVIDERS = ["openai", "anthropic", "gemini-api"];

export const PROVIDER_OPTIONS = [
  { value: "heuristic", label: "Heuristic (debug)" },
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
  settlementDensity: 10,
  landmarkDensity: 16,
  biomeDensity: 62
};

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

const GROUP_NAME_POOL = [
  "Harbor Collective",
  "Northplain Camp",
  "Glass River Group",
  "Stone Path Circle",
  "Dawn Market Crew",
  "Moonridge People",
  "Canal Street Kin",
  "Wild Coast Neighbors"
];

const HUMAN_NAME_POOL = [
  "Ada",
  "Milo",
  "Nora",
  "Jae",
  "Lina",
  "Oren",
  "Tala",
  "Bram",
  "Iris",
  "Soren",
  "Kaia",
  "Mina",
  "Rian",
  "Cleo",
  "Vera",
  "Pax",
  "Mara",
  "Arlo",
  "Noel",
  "Yuna"
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
    biomeDensity: Number(baseScenario?.generator?.biome_density ?? baseScenario?.config?.biome_density ?? DEFAULT_WORLD_SETTINGS.biomeDensity)
  };
}

export function normalizeProviderConfig(config = {}) {
  const normalized = {
    ...DEFAULT_PROVIDER,
    ...config,
    provider: String(config.provider ?? DEFAULT_PROVIDER.provider),
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
    supportsModelListing: Boolean(config.supportsModelListing ?? config.supports_model_listing ?? false),
    supportsManualModelEntry: Boolean(config.supportsManualModelEntry ?? config.supports_manual_model_entry ?? false)
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
    supportsManualModelEntry: false
  };
}

export function providerDisplayName(provider) {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

export function providerUsesLogin(provider) {
  return provider === "opencode" || provider === "gemini-cli";
}

export function providerUsesApiKey(provider) {
  return DIRECT_API_PROVIDERS.includes(provider) || provider === "gemini-cli";
}

export function providerSupportsBaseUrl(provider) {
  return provider === "openai" || provider === "anthropic" || provider === "gemini-api";
}

export function buildDefaultSettings(baseScenario) {
  const world = defaultWorldSettings(baseScenario);
  const legacyGroups = resolveLegacyGroups(baseScenario);
  const groups = legacyGroups.length
    ? reconcileGroups(baseScenario, legacyGroups)
    : reconcileGroups(baseScenario, Array.from({ length: 2 }, () => ({})));
  return { world, groups };
}

export function normalizeSettings(baseScenario, rawSettings = {}) {
  const world = normalizeWorldSettings(baseScenario, rawSettings.world);
  const settingsGroups = resolveLegacyGroups(rawSettings);
  const scenarioGroups = settingsGroups.length ? settingsGroups : resolveLegacyGroups(baseScenario);
  const resolved = scenarioGroups.length ? scenarioGroups : Array.from({ length: 2 }, () => ({}));
  const groups = reconcileGroups(baseScenario, resolved);
  return { world, groups };
}

export function addGroup(settings, baseScenario) {
  const groups = [...(settings.groups ?? [])];
  if (groups.length >= MAX_GROUPS) {
    return settings;
  }
  groups.push({});
  return {
    ...settings,
    groups: reconcileGroups(baseScenario, groups)
  };
}

export function removeGroup(settings, baseScenario, groupId) {
  const remaining = (settings.groups ?? []).filter((group) => group.id !== groupId);
  const safeGroups = remaining.length ? remaining : [{}];
  return {
    ...settings,
    groups: reconcileGroups(baseScenario, safeGroups)
  };
}

export function updateGroup(settings, baseScenario, groupId, patch) {
  return {
    ...settings,
    groups: reconcileGroups(
      baseScenario,
      (settings.groups ?? []).map((group) => (group.id === groupId ? { ...group, ...patch } : group))
    )
  };
}

export function updateGroupController(settings, baseScenario, groupId, patch) {
  return updateGroup(settings, baseScenario, groupId, {
    controller: {
      ...(settings.groups ?? []).find((group) => group.id === groupId)?.controller,
      ...patch
    }
  });
}

export function totalConfiguredPopulation(settings) {
  return (settings.groups ?? []).reduce((total, group) => total + Number(group.population_count ?? 0), 0);
}

export function buildRuntimeControllerMap(settings) {
  const normalized = normalizeSettings({}, settings);
  return {
    factions: Object.fromEntries(
      normalized.groups.map((group) => [group.id, normalizeProviderConfig(group.controller)])
    )
  };
}

export function synthesizeScenario(baseScenario, settings) {
  const normalized = normalizeSettings(baseScenario, settings);
  const world = normalized.world;
  const groups = normalized.groups;
  const config = {
    ...(baseScenario?.config ?? {}),
    width: Number(world.width),
    height: Number(world.height),
    map_width: Number(world.width),
    map_height: Number(world.height),
    world_seed: Number(world.seed),
    generator_preset: String(world.generatorPreset),
    coastline_bias: Number(world.coastlineBias),
    river_count: Number(world.riverCount),
    settlement_density: Number(world.settlementDensity),
    landmark_density: Number(world.landmarkDensity),
    biome_density: Number(world.biomeDensity),
    reason_interval: Number(world.reason_interval ?? baseScenario?.config?.reason_interval ?? 5),
    perception_radius: Number(world.perception_radius ?? baseScenario?.config?.perception_radius ?? 3),
    fauna_density: Number(world.fauna_density ?? baseScenario?.config?.fauna_density ?? 12)
  };
  const generator = {
    ...(baseScenario?.generator ?? {}),
    seed: Number(world.seed),
    preset: String(world.generatorPreset),
    width: Number(world.width),
    height: Number(world.height),
    coastline_bias: Number(world.coastlineBias),
    river_count: Number(world.riverCount),
    settlement_density: Number(world.settlementDensity),
    landmark_density: Number(world.landmarkDensity),
    biome_density: Number(world.biomeDensity)
  };

  const factions = groups.map((group) => ({
    id: group.id,
    name: group.name,
    color: group.color,
    banner_color: group.color,
    culture: cultureElementsForGroup(group),
    controller: normalizeProviderConfig(group.controller)
  }));
  const agents = groups.flatMap((group) => group.humans.map((human) => humanToAgent(group, human)));

  const scenario = {
    seed: Number(world.seed),
    config,
    generator,
    groups,
    factions,
    agents,
    fauna: { species: [] }
  };

  if (!baseScenario?.generator && Array.isArray(baseScenario?.tiles)) {
    scenario.tiles = baseScenario.tiles;
  }

  return scenario;
}

function normalizeWorldSettings(baseScenario, world = {}) {
  const defaults = defaultWorldSettings(baseScenario);
  return {
    ...defaults,
    ...world,
    seed: Math.trunc(Number(world.seed ?? defaults.seed)),
    generatorPreset: String(world.generatorPreset ?? defaults.generatorPreset),
    width: clamp(Math.trunc(Number(world.width ?? defaults.width)), 24, 256),
    height: clamp(Math.trunc(Number(world.height ?? defaults.height)), 24, 256),
    coastlineBias: clamp(Math.trunc(Number(world.coastlineBias ?? defaults.coastlineBias)), 0, 100),
    riverCount: clamp(Math.trunc(Number(world.riverCount ?? defaults.riverCount)), 0, 32),
    settlementDensity: clamp(Math.trunc(Number(world.settlementDensity ?? defaults.settlementDensity)), 0, 40),
    landmarkDensity: clamp(Math.trunc(Number(world.landmarkDensity ?? defaults.landmarkDensity)), 0, 40),
    biomeDensity: clamp(Math.trunc(Number(world.biomeDensity ?? defaults.biomeDensity)), 0, 100),
    reason_interval: clamp(Math.trunc(Number(world.reason_interval ?? defaults.reason_interval ?? 5)), 1, 60),
    perception_radius: clamp(Math.trunc(Number(world.perception_radius ?? defaults.perception_radius ?? 3)), 1, 8),
    fauna_density: clamp(Math.trunc(Number(world.fauna_density ?? defaults.fauna_density ?? 12)), 0, 100)
  };
}

function reconcileGroups(baseScenario, groups = []) {
  const sourceGroups = (groups ?? []).slice(0, MAX_GROUPS);
  const usedIds = new Set(sourceGroups.map((g) => g?.id).filter(Boolean));
  return sourceGroups.map((group, index) => normalizeGroup(baseScenario, group, index, usedIds));
}

function normalizeGroup(baseScenario, group, index, usedIds) {
  const source = group ?? {};
  let id = source.id ? String(source.id) : null;
  if (!id) {
    let slot = index + 1;
    do {
      id = `group-${String(slot).padStart(2, "0")}`;
      slot += 1;
    } while (usedIds.has(id));
  }
  usedIds.add(id);
  const normalized = {
    id,
    name: String(source.name ?? GROUP_NAME_POOL[index % GROUP_NAME_POOL.length] ?? `Group ${index + 1}`),
    color: String(source.color ?? source.banner_color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]),
    population_count: clamp(
      Number(source.population_count ?? source.population ?? source.populationCount ?? source.agent_count ?? DEFAULT_POPULATION),
      MIN_POPULATION_PER_GROUP,
      MAX_POPULATION_PER_GROUP
    ),
    culture_summary: String(
      source.culture_summary
      ?? source.cultureSummary
      ?? source.culture?.[0]?.description
      ?? "A small human group trying to survive, cooperate, and find meaning together."
    ),
    controller: normalizeProviderConfig(source.controller ?? {}),
    humans: []
  };
  normalized.humans = reconcileHumans(source.humans, normalized);
  return normalized;
}

function reconcileHumans(existingHumans, group) {
  const prior = Array.isArray(existingHumans) ? existingHumans : [];
  const humans = [];
  for (let index = 0; index < group.population_count; index += 1) {
    const previous = prior[index] ?? {};
    const id = `${group.id}-human-${String(index + 1).padStart(2, "0")}`;
    humans.push({
      id,
      name: String(previous.name ?? HUMAN_NAME_POOL[(index + hashString(group.id)) % HUMAN_NAME_POOL.length] ?? `Human ${index + 1}`),
      personality: normalizePersonality(previous.personality, group.id, index),
      emotions: normalizeEmotions(previous.emotions, { Joy: 5, Sadness: 1, Fear: 2, Anger: 1, Disgust: 0, Surprise: 3 }),
      needs: normalizeNeeds(previous.needs, { Survival: 3, Safety: 3, Belonging: 4, Esteem: 4, Self_Actualization: 4 }),
      inventory: {
        food: clamp(Math.trunc(Number(previous.inventory?.food ?? 2)), 0, 10),
        wood: clamp(Math.trunc(Number(previous.inventory?.wood ?? 1)), 0, 10),
        stone: clamp(Math.trunc(Number(previous.inventory?.stone ?? 0)), 0, 10)
      }
    });
  }
  return humans;
}

function normalizePersonality(personality, groupId, index) {
  const fallback = seedPersonality(groupId, index);
  const source = personality ?? {};
  return {
    openness: clamp(Math.trunc(Number(source.openness ?? fallback.openness)), 0, 10),
    conscientiousness: clamp(Math.trunc(Number(source.conscientiousness ?? fallback.conscientiousness)), 0, 10),
    extraversion: clamp(Math.trunc(Number(source.extraversion ?? fallback.extraversion)), 0, 10),
    agreeableness: clamp(Math.trunc(Number(source.agreeableness ?? fallback.agreeableness)), 0, 10),
    neuroticism: clamp(Math.trunc(Number(source.neuroticism ?? fallback.neuroticism)), 0, 10)
  };
}

function normalizeEmotions(value, fallback) {
  const source = value ?? {};
  return {
    Joy: clamp(Math.trunc(Number(source.Joy ?? source.joy ?? fallback.Joy)), 0, 10),
    Sadness: clamp(Math.trunc(Number(source.Sadness ?? source.sadness ?? fallback.Sadness)), 0, 10),
    Fear: clamp(Math.trunc(Number(source.Fear ?? source.fear ?? fallback.Fear)), 0, 10),
    Anger: clamp(Math.trunc(Number(source.Anger ?? source.anger ?? fallback.Anger)), 0, 10),
    Disgust: clamp(Math.trunc(Number(source.Disgust ?? source.disgust ?? fallback.Disgust)), 0, 10),
    Surprise: clamp(Math.trunc(Number(source.Surprise ?? source.surprise ?? fallback.Surprise)), 0, 10)
  };
}

function normalizeNeeds(value, fallback) {
  const source = value ?? {};
  return {
    Survival: clamp(Math.trunc(Number(source.Survival ?? source.survival ?? fallback.Survival ?? 3)), 0, 10),
    Safety: clamp(Math.trunc(Number(source.Safety ?? source.safety ?? fallback.Safety ?? 3)), 0, 10),
    Belonging: clamp(Math.trunc(Number(source.Belonging ?? source.belonging ?? fallback.Belonging ?? 4)), 0, 10),
    Esteem: clamp(Math.trunc(Number(source.Esteem ?? source.esteem ?? fallback.Esteem ?? 4)), 0, 10),
    Self_Actualization: clamp(
      Math.trunc(Number(source.Self_Actualization ?? source.self_actualization ?? fallback.Self_Actualization ?? 4)),
      0,
      10
    )
  };
}

function seedPersonality(groupId, index) {
  const base = hashString(`${groupId}:${index}`);
  return {
    openness: 3 + (base % 5),
    conscientiousness: 3 + ((base >> 3) % 5),
    extraversion: 2 + ((base >> 5) % 6),
    agreeableness: 3 + ((base >> 7) % 5),
    neuroticism: 1 + ((base >> 9) % 5)
  };
}

function resolveLegacyGroups(rawSettings = {}) {
  if (Array.isArray(rawSettings.groups) && rawSettings.groups.length) {
    return rawSettings.groups.map((group) => legacyGroupToGroup(group));
  }
  if (Array.isArray(rawSettings.starter_kingdoms) && rawSettings.starter_kingdoms.length) {
    return rawSettings.starter_kingdoms.map((kingdom) => legacyKingdomToGroup(kingdom));
  }
  if (Array.isArray(rawSettings.civilizations) && rawSettings.civilizations.length) {
    return rawSettings.civilizations.map((civilization) => legacyCivilizationToGroup(civilization));
  }
  if (Array.isArray(rawSettings.factions) && rawSettings.factions.length) {
    return rawSettings.factions.map((faction) => legacyFactionToGroup(faction, rawSettings.agents ?? []));
  }
  return [];
}

function legacyGroupToGroup(group) {
  return {
    id: group.id,
    name: group.name,
    color: group.color,
    population_count: group.population_count ?? group.population ?? group.populationCount ?? group.agent_count,
    culture_summary: group.culture_summary ?? group.cultureSummary ?? group.culture?.[0]?.description ?? "",
    controller: group.controller ?? {},
    humans: Array.isArray(group.humans) ? group.humans : Array.isArray(group.agents) ? group.agents : []
  };
}

function legacyKingdomToGroup(kingdom) {
  return {
    id: kingdom.id,
    name: kingdom.name,
    color: kingdom.color,
    population_count: kingdom.population ?? kingdom.population_count,
    culture_summary: kingdom.culture_summary ?? kingdom.cultureSummary ?? kingdom.culture?.[0]?.description ?? "",
    controller: kingdom.controller ?? {},
    humans: Array.isArray(kingdom.humans) ? kingdom.humans : []
  };
}

function legacyCivilizationToGroup(civilization) {
  return {
    id: civilization.id,
    name: civilization.name,
    color: civilization.color ?? civilization.banner_color,
    population_count: civilization.population_count ?? civilization.population ?? civilization.agent_count,
    culture_summary: civilization.culture_summary ?? civilization.cultureSummary ?? civilization.culture?.[0]?.description ?? "",
    controller: civilization.controller ?? {},
    humans: civilization.agents ?? civilization.humans ?? []
  };
}

function legacyFactionToGroup(faction, agents = []) {
  const factionAgents = agents.filter((agent) => agent.faction_id === faction.id);
  return {
    id: faction.id,
    name: faction.name,
    color: faction.color ?? faction.banner_color,
    population_count: (faction.starting_population ?? faction.population ?? faction.population_count ?? factionAgents.length) || DEFAULT_POPULATION,
    culture_summary: faction.culture_summary ?? faction.culture?.[0]?.description ?? "",
    controller: faction.controller ?? {},
    humans: factionAgents
  };
}

function humanToAgent(group, human) {
  return {
    id: human.id,
    name: human.name,
    faction_id: group.id,
    entity_kind: "human",
    personality: human.personality,
    emotions: {
      Joy: human.emotions?.Joy ?? 5,
      Sadness: human.emotions?.Sadness ?? 1,
      Fear: human.emotions?.Fear ?? 2,
      Anger: human.emotions?.Anger ?? 1,
      Disgust: human.emotions?.Disgust ?? 0,
      Surprise: human.emotions?.Surprise ?? 3
    },
    needs: {
      Survival: human.needs?.Survival ?? 3,
      Safety: human.needs?.Safety ?? 3,
      Belonging: human.needs?.Belonging ?? 4,
      Esteem: human.needs?.Esteem ?? 4,
      Self_Actualization: human.needs?.Self_Actualization ?? 4
    },
    inventory: {
      food: human.inventory?.food ?? 2,
      wood: human.inventory?.wood ?? 1,
      stone: human.inventory?.stone ?? 0
    }
  };
}

function cultureElementsForGroup(group) {
  const summary = String(group.culture_summary ?? "").trim();
  if (!summary) {
    return [];
  }
  return [
    {
      category: "norm",
      element: `${group.name} Custom`,
      description: summary,
      strength: 72
    }
  ];
}

function hashString(value) {
  let hash = 0;
  for (const character of String(value)) {
    hash = ((hash << 5) - hash) + character.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

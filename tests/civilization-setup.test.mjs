import test from "node:test";
import assert from "node:assert/strict";

import {
  PROVIDER_OPTIONS,
  buildRuntimeControllerMap,
  normalizeSettings,
  synthesizeScenario
} from "../lib/civilization-setup.js";


const BASE_SCENARIO = {
  seed: 44,
  config: {
    width: 64,
    height: 64,
    world_seed: 44,
    generator_preset: "grand-continent",
    map_width: 64,
    map_height: 64,
    coastline_bias: 58,
    river_count: 8,
    settlement_density: 18,
    landmark_density: 16
  },
  generator: {
    seed: 44,
    preset: "grand-continent",
    width: 64,
    height: 64,
    coastline_bias: 58,
    river_count: 8,
    settlement_density: 18,
    landmark_density: 16
  },
  factions: [
    { id: "red", name: "Crimson Reach", color: "#dd6f6a", culture: [{ category: "norm", element: "River Pact", description: "Build together.", strength: 80 }] },
    { id: "blue", name: "Azure House", color: "#6aa8e7", culture: [{ category: "ritual", element: "Harbor Supper", description: "Eat together.", strength: 75 }] }
  ],
  agents: [
    {
      id: "ada",
      name: "Ada",
      faction_id: "red",
      personality: { openness: 7, conscientiousness: 6, extraversion: 5, agreeableness: 6, neuroticism: 3 },
      emotions: { Joy: 4, Sadness: 1, Fear: 2, Anger: 1, Disgust: 0, Surprise: 3 },
      needs: { Survival: 4, Safety: 4, Belonging: 5, Esteem: 4, Self_Actualization: 5 },
      inventory: { food: 3, wood: 2, stone: 1 }
    },
    {
      id: "bo",
      name: "Bo",
      faction_id: "blue",
      personality: { openness: 6, conscientiousness: 6, extraversion: 6, agreeableness: 6, neuroticism: 3 },
      emotions: { Joy: 4, Sadness: 1, Fear: 2, Anger: 1, Disgust: 0, Surprise: 3 },
      needs: { Survival: 4, Safety: 4, Belonging: 5, Esteem: 4, Self_Actualization: 5 },
      inventory: { food: 3, wood: 2, stone: 1 }
    }
  ]
};


test("normalizeSettings migrates legacy groups into starter kingdoms", () => {
  const normalized = normalizeSettings(BASE_SCENARIO, {
    groups: [
      {
        id: "red",
        name: "Crimson Reach",
        color: "#dd6f6a",
        population_count: 6,
        controller: { provider: "opencode", model: "gpt-5/open" }
      }
    ]
  });

  assert.ok(Array.isArray(normalized.races));
  assert.ok(Array.isArray(normalized.starter_kingdoms));
  assert.equal(normalized.starter_kingdoms[0].controller.provider, "opencode");
  assert.equal(normalized.starter_kingdoms[0].race_kind, "human");
});


test("synthesizeScenario expands races, kingdoms, and fauna into runtime factions and humans", () => {
  const normalized = normalizeSettings(BASE_SCENARIO, {
    world: { seed: 91, width: 80, height: 80, faunaDensity: 70 },
    races: [
      { id: "human", enabled: true, auto_seed_count: 1, starting_population: 12 },
      { id: "orc", enabled: true, auto_seed_count: 1, starting_population: 10 },
      { id: "elf", enabled: false, auto_seed_count: 0 },
      { id: "dwarf", enabled: false, auto_seed_count: 0 }
    ],
    starter_kingdoms: [
      {
        id: "manual-keep",
        name: "Manual Keep",
        race_kind: "human",
        population: 8,
        controller: { provider: "heuristic" }
      }
    ],
    fauna: {
      species: [
        { id: "wolves", enabled: true, count: 5 },
        { id: "dragons", enabled: true, count: 1 }
      ]
    }
  });

  const runtimeScenario = synthesizeScenario(BASE_SCENARIO, normalized);

  assert.equal(runtimeScenario.config.world_seed, 91);
  assert.equal(runtimeScenario.generator.width, 80);
  assert.ok(runtimeScenario.factions.some((faction) => faction.id === "manual-keep"));
  assert.ok(runtimeScenario.factions.some((faction) => faction.race_kind === "orc"));
  assert.ok(runtimeScenario.agents.some((agent) => agent.race_kind === "human"));
  assert.ok(runtimeScenario.agents.some((agent) => agent.faction_id === "manual-keep"));
  assert.equal(runtimeScenario.fauna.species.find((item) => item.id === "wolves")?.count, 5);
});


test("runtime controller map resolves kingdoms into faction controller config", () => {
  const normalized = normalizeSettings(BASE_SCENARIO, {
    races: [
      { id: "human", enabled: true, auto_seed_count: 1, controller: { provider: "gemini-cli", model: "gemini-2.5-pro" } },
      { id: "orc", enabled: false, auto_seed_count: 0 },
      { id: "elf", enabled: false, auto_seed_count: 0 },
      { id: "dwarf", enabled: false, auto_seed_count: 0 }
    ],
    starter_kingdoms: [
      { id: "manual-keep", name: "Manual Keep", race_kind: "human", population: 6, controller: { provider: "openai", model: "gpt-5-mini", apiKey: "sk" } }
    ]
  });

  const runtime = buildRuntimeControllerMap(normalized);
  assert.equal(runtime.factions["manual-keep"].provider, "openai");
  const autoFactionIds = Object.keys(runtime.factions).filter((id) => id !== "manual-keep");
  assert.equal(runtime.factions[autoFactionIds[0]].provider, "gemini-cli");
});


test("provider options include direct APIs and CLI providers", () => {
  const values = PROVIDER_OPTIONS.map((option) => option.value);
  assert.ok(values.includes("heuristic"));
  assert.ok(values.includes("opencode"));
  assert.ok(values.includes("gemini-cli"));
  assert.ok(values.includes("openai"));
  assert.ok(values.includes("anthropic"));
  assert.ok(values.includes("gemini-api"));
});

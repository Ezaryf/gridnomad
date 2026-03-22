import test from "node:test";
import assert from "node:assert/strict";

import {
  PROVIDER_OPTIONS,
  addGroup,
  buildRuntimeControllerMap,
  controllerReadiness,
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
    settlement_density: 10,
    landmark_density: 16
  },
  generator: {
    seed: 44,
    preset: "grand-continent",
    width: 64,
    height: 64,
    coastline_bias: 58,
    river_count: 8,
    settlement_density: 10,
    landmark_density: 16
  },
  factions: [
    { id: "red", name: "Crimson Reach", color: "#dd6f6a", culture: [{ category: "norm", element: "River Pact", description: "Stay together.", strength: 80 }] },
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


test("normalizeSettings keeps groups and migrates kingdoms into groups", () => {
  const normalized = normalizeSettings(BASE_SCENARIO, {
    starter_kingdoms: [
      {
        id: "manual-keep",
        name: "Manual Keep",
        color: "#dd6f6a",
        population: 6,
        controller: { provider: "opencode", model: "gpt-5/open" }
      }
    ]
  });

  assert.ok(Array.isArray(normalized.groups));
  assert.equal(normalized.groups[0].controller.provider, "opencode");
  assert.equal(normalized.groups[0].population_count, 6);
});


test("synthesizeScenario expands groups into runtime factions and humans", () => {
  const normalized = normalizeSettings(BASE_SCENARIO, {
    world: { seed: 91, width: 80, height: 80 },
    groups: [
      {
        id: "manual-keep",
        name: "Manual Keep",
        color: "#dd6f6a",
        population_count: 8,
        culture_summary: "Share food and stay close.",
        controller: { provider: "heuristic" }
      },
      {
        id: "blue-circle",
        name: "Blue Circle",
        color: "#6aa8e7",
        population_count: 4,
        culture_summary: "Keep exploring and report back.",
        controller: { provider: "gemini-cli", model: "gemini-2.5-pro" }
      }
    ]
  });

  const runtimeScenario = synthesizeScenario(BASE_SCENARIO, normalized);

  assert.equal(runtimeScenario.config.world_seed, 91);
  assert.equal(runtimeScenario.generator.width, 80);
  assert.ok(runtimeScenario.factions.some((faction) => faction.id === "manual-keep"));
  assert.ok(runtimeScenario.agents.some((agent) => agent.faction_id === "manual-keep"));
  assert.ok(runtimeScenario.agents[0].persona_summary !== undefined);
  assert.equal(runtimeScenario.fauna.species.length, 0);
});


test("runtime controller map resolves groups into faction controller config", () => {
  const normalized = normalizeSettings(BASE_SCENARIO, {
    groups: [
      { id: "manual-keep", name: "Manual Keep", population_count: 6, controller: { provider: "openai", model: "gpt-5-mini", apiKey: "sk" } },
      { id: "blue-circle", name: "Blue Circle", population_count: 4, controller: { provider: "gemini-cli", model: "gemini-2.5-pro" } }
    ]
  });

  const runtime = buildRuntimeControllerMap(normalized);
  assert.equal(runtime.factions["manual-keep"].provider, "openai");
  assert.equal(runtime.factions["blue-circle"].provider, "gemini-cli");
});


test("opencode groups default to batch execution and humans gain personas", () => {
  const normalized = normalizeSettings(BASE_SCENARIO, {
    groups: [
      { id: "manual-keep", name: "Manual Keep", population_count: 2, controller: { provider: "opencode", cliHome: "C:/tmp/opencode-home" } }
    ]
  });

  assert.equal(normalized.groups[0].controller.executionMode, "group_batch");
  assert.ok(normalized.groups[0].humans[0].persona_summary);
  assert.ok(normalized.groups[0].humans[0].starting_drive);
});


test("opencode readiness blocks groups without a managed home", () => {
  const readiness = controllerReadiness({ provider: "opencode", model: "opencode/minimax-m2.5-free" }, null);
  assert.equal(readiness.state, "home_required");
});


test("addGroup appends a new default group", () => {
  const normalized = normalizeSettings(BASE_SCENARIO, { groups: [{ id: "group-01", name: "A", population_count: 2 }] });
  const next = addGroup(normalized, BASE_SCENARIO);
  assert.equal(next.groups.length, 2);
  assert.ok(next.groups[1].id.startsWith("group-"));
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

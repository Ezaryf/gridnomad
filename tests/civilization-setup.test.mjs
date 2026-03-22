import test from "node:test";
import assert from "node:assert/strict";

import {
  PROVIDER_OPTIONS,
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


test("normalizeSettings migrates legacy controller settings into groups", () => {
  const normalized = normalizeSettings(BASE_SCENARIO, {
    world: { civilizationCount: 3 },
    factions: {
      red: { provider: "opencode", model: "gpt-5/open" },
      blue: { provider: "gemini-cli", model: "gemini-2.5-pro" }
    }
  });

  assert.equal(normalized.groups.length, 3);
  assert.equal(normalized.groups[0].controller.provider, "opencode");
  assert.equal(normalized.groups[1].controller.provider, "gemini-cli");
  assert.equal(normalized.groups[2].population_count, 1);
});


test("synthesizeScenario reflects groups and generated human rosters", () => {
  const normalized = normalizeSettings(BASE_SCENARIO, {
    world: { civilizationCount: 4, seed: 91, width: 80, height: 80 },
    groups: [
      {
        id: "red",
        name: "Crimson Reach",
        color: "#dd6f6a",
        culture: [{ category: "norm", element: "River Pact", description: "Build together.", strength: 80 }],
        population_count: 2,
        controller: { provider: "heuristic" },
        humans: [{ id: "ada", name: "Ada" }]
      }
    ]
  });

  const runtimeScenario = synthesizeScenario(BASE_SCENARIO, normalized);

  assert.equal(runtimeScenario.factions.length, 4);
  assert.equal(runtimeScenario.config.world_seed, 91);
  assert.equal(runtimeScenario.generator.width, 80);
  assert.equal(runtimeScenario.agents.filter((agent) => agent.faction_id === "red").length, 2);
  assert.ok(runtimeScenario.agents.some((agent) => agent.faction_id !== "red"));
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

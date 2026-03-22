import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";


const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const RUNS_DIR = path.join(ROOT, "runs");
const SCENARIO_PATH = path.join(ROOT, "scenarios", "frontier_seeded.json");
const SETTINGS_PATH = path.join(DATA_DIR, "civilization-settings.json");
const CLI_RUNTIME_ROOT = path.join(DATA_DIR, "cli-runtime");


const DEFAULT_PROVIDER = {
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
  baseUrl: ""
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


export async function ensureProjectData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await fs.mkdir(CLI_RUNTIME_ROOT, { recursive: true });
  try {
    await fs.access(SETTINGS_PATH);
  } catch {
    const scenario = await readScenario();
    const settings = buildDefaultSettings(scenario);
    await writeSettings(settings);
  }
}


export async function readScenario() {
  const raw = await fs.readFile(SCENARIO_PATH, "utf-8");
  return JSON.parse(raw);
}


function scenarioWorldDefaults(scenario) {
  return {
    seed: Number(scenario.generator?.seed ?? scenario.config?.world_seed ?? scenario.seed ?? DEFAULT_WORLD_SETTINGS.seed),
    generatorPreset: scenario.generator?.preset ?? scenario.config?.generator_preset ?? DEFAULT_WORLD_SETTINGS.generatorPreset,
    width: Number(scenario.generator?.width ?? scenario.config?.map_width ?? scenario.config?.width ?? DEFAULT_WORLD_SETTINGS.width),
    height: Number(scenario.generator?.height ?? scenario.config?.map_height ?? scenario.config?.height ?? DEFAULT_WORLD_SETTINGS.height),
    coastlineBias: Number(scenario.generator?.coastline_bias ?? scenario.config?.coastline_bias ?? DEFAULT_WORLD_SETTINGS.coastlineBias),
    riverCount: Number(scenario.generator?.river_count ?? scenario.config?.river_count ?? DEFAULT_WORLD_SETTINGS.riverCount),
    settlementDensity: Number(
      scenario.generator?.settlement_density ?? scenario.config?.settlement_density ?? DEFAULT_WORLD_SETTINGS.settlementDensity
    ),
    landmarkDensity: Number(
      scenario.generator?.landmark_density ?? scenario.config?.landmark_density ?? DEFAULT_WORLD_SETTINGS.landmarkDensity
    )
  };
}


export function buildDefaultSettings(scenario) {
  const factions = Object.fromEntries(
    (scenario.factions ?? []).map((faction) => [faction.id, { ...DEFAULT_PROVIDER }])
  );
  return {
    world: { ...DEFAULT_WORLD_SETTINGS, ...scenarioWorldDefaults(scenario) },
    factions
  };
}


function mergeSettingsWithScenario(settings, scenario) {
  const defaults = buildDefaultSettings(scenario);
  const merged = {
    world: {
      ...defaults.world,
      ...(settings?.world ?? {})
    },
    factions: { ...defaults.factions }
  };
  for (const [factionId, config] of Object.entries(settings?.factions ?? {})) {
    merged.factions[factionId] = { ...DEFAULT_PROVIDER, ...config };
  }
  for (const faction of scenario.factions ?? []) {
    if (!merged.factions[faction.id]) {
      merged.factions[faction.id] = { ...DEFAULT_PROVIDER };
    }
  }
  return merged;
}


export async function readSettings() {
  await ensureProjectData();
  const [scenario, raw] = await Promise.all([
    readScenario(),
    fs.readFile(SETTINGS_PATH, "utf-8")
  ]);
  return mergeSettingsWithScenario(JSON.parse(raw), scenario);
}


export async function writeSettings(settings) {
  await ensureProjectData();
  const scenario = await readScenario();
  const merged = mergeSettingsWithScenario(settings, scenario);
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}


export function getCliEnvironment() {
  const configHome = path.join(CLI_RUNTIME_ROOT, "config");
  const dataHome = path.join(CLI_RUNTIME_ROOT, "data");
  const stateHome = path.join(CLI_RUNTIME_ROOT, "state");
  const localAppData = path.join(CLI_RUNTIME_ROOT, "localapp");
  return {
    ...process.env,
    XDG_CONFIG_HOME: configHome,
    XDG_DATA_HOME: dataHome,
    XDG_STATE_HOME: stateHome,
    LOCALAPPDATA: localAppData
  };
}


export async function runCommand(command, args, { cwd = ROOT, env = process.env, timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const executable = isWindows ? (process.env.ComSpec || "cmd.exe") : command;
    const spawnArgs = isWindows
      ? ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArgument).join(" ")]
      : args;
    const child = spawn(executable, spawnArgs, {
      cwd,
      env,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill();
        settled = true;
        resolve({ code: 124, stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms`.trim() });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }
      clearTimeout(timer);
      settled = true;
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}


function quoteWindowsArgument(value) {
  if (!value.includes(" ") && !value.includes('"')) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}


export function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}


export function parseOpencodeCredentials(output) {
  return stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("•"))
    .map((line) => line.replace(/^•\s+/, "").split(/\s{2,}/)[0].trim())
    .filter(Boolean);
}


export function parseOpencodeModels(output) {
  return stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("ERROR") && !line.includes("Database migration"))
    .filter((line) => line.includes("/"));
}


export function buildScenarioPreview(scenario) {
  const width = scenario.config?.width ?? 0;
  const height = scenario.config?.height ?? 0;
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      x,
      y,
      terrain: "plain",
      biome: "grassland",
      feature: null,
      farmable: false,
      resource: null
    }))
  );

  for (const tile of scenario.tiles ?? []) {
    tiles[tile.y][tile.x] = {
      x: tile.x,
      y: tile.y,
      terrain: tile.terrain ?? "plain",
      biome: tile.biome ?? "grassland",
      feature: tile.feature ?? null,
      farmable: Boolean(tile.farmable),
      resource: tile.resource ?? null
    };
  }

  return {
    width,
    height,
    tiles,
    agents: scenario.agents ?? [],
    factions: scenario.factions ?? [],
    props: [],
    regions: {},
    settlements: [],
    roads: [],
    territories: {}
  };
}


export async function generateWorld({ settings } = {}) {
  await ensureProjectData();
  const mergedSettings = settings ? await writeSettings(settings) : await readSettings();
  const args = [
    "-m",
    "gridnomad",
    "generate-world",
    "--scenario",
    SCENARIO_PATH,
    ...worldArgsFromSettings(mergedSettings.world)
  ];
  const result = await runCommand("python", args, {
    cwd: ROOT,
    env: process.env,
    timeoutMs: 120000
  });
  if (result.code !== 0) {
    return {
      ok: false,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }
  return JSON.parse(result.stdout);
}


export async function runSimulation({ ticks, settings }) {
  await ensureProjectData();
  const mergedSettings = settings ? await writeSettings(settings) : await readSettings();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(RUNS_DIR, `web-${stamp}`);
  await fs.mkdir(runDir, { recursive: true });
  const args = [
    "-m",
    "gridnomad",
    "run",
    "--scenario",
    SCENARIO_PATH,
    "--ticks",
    String(ticks),
    "--out",
    runDir,
    "--settings",
    SETTINGS_PATH,
    ...worldArgsFromSettings(mergedSettings.world)
  ];
  const result = await runCommand("python", args, { cwd: ROOT, env: process.env, timeoutMs: 120000 });
  if (result.code !== 0) {
    return {
      ok: false,
      runDir,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  const eventPath = path.join(runDir, "events.jsonl");
  const files = await fs.readdir(runDir);
  const snapshotFiles = files.filter((file) => file.startsWith("snapshot-") && file.endsWith(".json")).sort();
  const latestSnapshotPath = path.join(runDir, snapshotFiles.at(-1));
  const [eventsText, snapshotText] = await Promise.all([
    fs.readFile(eventPath, "utf-8"),
    fs.readFile(latestSnapshotPath, "utf-8")
  ]);
  const events = eventsText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return {
    ok: true,
    runDir,
    stdout: result.stdout,
    stderr: result.stderr,
    events,
    snapshot: JSON.parse(snapshotText)
  };
}


function worldArgsFromSettings(world) {
  const settings = { ...DEFAULT_WORLD_SETTINGS, ...(world ?? {}) };
  return [
    "--seed",
    String(Math.trunc(Number(settings.seed) || DEFAULT_WORLD_SETTINGS.seed)),
    "--generator-preset",
    String(settings.generatorPreset || DEFAULT_WORLD_SETTINGS.generatorPreset),
    "--map-width",
    String(Math.max(24, Math.trunc(Number(settings.width) || DEFAULT_WORLD_SETTINGS.width))),
    "--map-height",
    String(Math.max(24, Math.trunc(Number(settings.height) || DEFAULT_WORLD_SETTINGS.height))),
    "--coastline-bias",
    String(Math.max(0, Math.min(100, Math.trunc(Number(settings.coastlineBias) || DEFAULT_WORLD_SETTINGS.coastlineBias)))),
    "--river-count",
    String(Math.max(0, Math.trunc(Number(settings.riverCount) || DEFAULT_WORLD_SETTINGS.riverCount))),
    "--settlement-density",
    String(Math.max(1, Math.trunc(Number(settings.settlementDensity) || DEFAULT_WORLD_SETTINGS.settlementDensity))),
    "--landmark-density",
    String(Math.max(0, Math.trunc(Number(settings.landmarkDensity) || DEFAULT_WORLD_SETTINGS.landmarkDensity)))
  ];
}


export async function launchDetachedCli(command, args) {
  const child = spawn("powershell", [
    "-NoProfile",
    "-Command",
    `Start-Process '${command}' -ArgumentList '${args.join("','")}'`
  ], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
}


export {
  ROOT,
  SCENARIO_PATH,
  SETTINGS_PATH
};

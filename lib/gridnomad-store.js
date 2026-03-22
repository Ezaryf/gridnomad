import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  buildDefaultSettings,
  buildRuntimeControllerMap,
  defaultWorldSettings,
  normalizeSettings,
  synthesizeScenario
} from "@/lib/civilization-setup";


const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const RUNS_DIR = path.join(ROOT, "runs");
const SCENARIO_PATH = path.join(ROOT, "scenarios", "frontier_seeded.json");
const SETTINGS_PATH = path.join(DATA_DIR, "civilization-settings.json");
const CLI_RUNTIME_ROOT = path.join(DATA_DIR, "cli-runtime");
const RUNTIME_SCENARIO_DIR = path.join(DATA_DIR, "runtime-scenarios");


export async function ensureProjectData() {
  await ensureProjectDirectories();
  try {
    await fs.access(SETTINGS_PATH);
  } catch {
    const scenario = await readScenario();
    const settings = buildDefaultSettings(scenario);
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
  }
}


async function ensureProjectDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await fs.mkdir(CLI_RUNTIME_ROOT, { recursive: true });
  await fs.mkdir(RUNTIME_SCENARIO_DIR, { recursive: true });
}


export async function readScenario() {
  const raw = await fs.readFile(SCENARIO_PATH, "utf-8");
  return JSON.parse(raw);
}


export async function readSettings() {
  await ensureProjectData();
  const [scenario, raw] = await Promise.all([
    readScenario(),
    fs.readFile(SETTINGS_PATH, "utf-8")
  ]);
  return normalizeSettings(scenario, JSON.parse(raw));
}


export async function writeSettings(settings) {
  await ensureProjectDirectories();
  const scenario = await readScenario();
  const merged = normalizeSettings(scenario, settings);
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}


export async function writeRuntimeControllers(settings) {
  await ensureProjectDirectories();
  const filePath = path.join(
    RUNTIME_SCENARIO_DIR,
    `runtime-settings-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.json`
  );
  await fs.writeFile(filePath, JSON.stringify(buildRuntimeControllerMap(settings), null, 2), "utf-8");
  return filePath;
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


export async function readSynthesizedScenario(settings = null) {
  const scenario = await readScenario();
  const normalizedSettings = settings ? normalizeSettings(scenario, settings) : await readSettings();
  return synthesizeScenario(scenario, normalizedSettings);
}


export async function generateWorld({ settings } = {}) {
  await ensureProjectData();
  const mergedSettings = settings ? await writeSettings(settings) : await readSettings();
  const baseScenario = await readScenario();
  const synthesizedScenario = synthesizeScenario(baseScenario, mergedSettings);
  const runtimeScenarioPath = await writeRuntimeScenario(synthesizedScenario);
  const args = [
    "-m",
    "gridnomad",
    "generate-world",
    "--scenario",
    runtimeScenarioPath,
    ...worldArgsFromSettings(mergedSettings.world)
  ];
  try {
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
  } finally {
    await fs.unlink(runtimeScenarioPath).catch(() => {});
  }
}


export async function runSimulation({ ticks, settings }) {
  await ensureProjectData();
  const mergedSettings = settings ? await writeSettings(settings) : await readSettings();
  const baseScenario = await readScenario();
  const synthesizedScenario = synthesizeScenario(baseScenario, mergedSettings);
  const runtimeScenarioPath = await writeRuntimeScenario(synthesizedScenario);
  const runtimeSettingsPath = await writeRuntimeControllers(mergedSettings);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(RUNS_DIR, `web-${stamp}`);
  await fs.mkdir(runDir, { recursive: true });
  const args = [
    "-m",
    "gridnomad",
    "run",
    "--scenario",
    runtimeScenarioPath,
    "--ticks",
    String(ticks),
    "--out",
    runDir,
    "--settings",
    runtimeSettingsPath,
    ...worldArgsFromSettings(mergedSettings.world)
  ];
  try {
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
    
    const [eventsText, ...snapshotsText] = await Promise.all([
      fs.readFile(eventPath, "utf-8").catch(() => ""),
      ...snapshotFiles.map(file => fs.readFile(path.join(runDir, file), "utf-8"))
    ]);
    
    const events = eventsText
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
      
    const snapshots = snapshotsText.map(t => JSON.parse(t));
    
    return {
      ok: true,
      runDir,
      stdout: result.stdout,
      stderr: result.stderr,
      events,
      snapshots,
      snapshot: snapshots.at(-1)
    };
  } finally {
    await fs.unlink(runtimeScenarioPath).catch(() => {});
    await fs.unlink(runtimeSettingsPath).catch(() => {});
  }
}


export function worldArgsFromSettings(world) {
  const defaults = defaultWorldSettings({});
  const settings = { ...defaults, ...(world ?? {}) };
  return [
    "--seed",
    String(Math.trunc(Number(settings.seed) || defaults.seed)),
    "--generator-preset",
    String(settings.generatorPreset || defaults.generatorPreset),
    "--map-width",
    String(Math.max(24, Math.trunc(Number(settings.width) || defaults.width))),
    "--map-height",
    String(Math.max(24, Math.trunc(Number(settings.height) || defaults.height))),
    "--coastline-bias",
    String(Math.max(0, Math.min(100, Math.trunc(Number(settings.coastlineBias) || defaults.coastlineBias)))),
    "--river-count",
    String(Math.max(0, Math.trunc(Number(settings.riverCount) || defaults.riverCount))),
    "--settlement-density",
    String(Math.max(1, Math.trunc(Number(settings.settlementDensity) || defaults.settlementDensity))),
    "--landmark-density",
    String(Math.max(0, Math.trunc(Number(settings.landmarkDensity) || defaults.landmarkDensity))),
    "--biome-density",
    String(Math.max(0, Math.trunc(Number(settings.biomeDensity) || defaults.biomeDensity))),
    "--fauna-density",
    String(Math.max(0, Math.trunc(Number(settings.faunaDensity) || defaults.faunaDensity))),
    "--kingdom-growth-intensity",
    String(Math.max(0, Math.trunc(Number(settings.kingdomGrowthIntensity) || defaults.kingdomGrowthIntensity)))
  ];
}


export async function writeRuntimeScenario(scenario) {
  await fs.mkdir(RUNTIME_SCENARIO_DIR, { recursive: true });
  const filePath = path.join(
    RUNTIME_SCENARIO_DIR,
    `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.json`
  );
  await fs.writeFile(filePath, JSON.stringify(scenario, null, 2), "utf-8");
  return filePath;
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

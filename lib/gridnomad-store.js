import { promises as fs } from "node:fs";
import os from "node:os";
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
const OPENCODE_FALLBACK_ROOT = path.join(CLI_RUNTIME_ROOT, "opencode");


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


async function ensureCliHomeDirectories(cliHome) {
  if (!cliHome) {
    return;
  }
  await Promise.all([
    fs.mkdir(path.join(cliHome, "config"), { recursive: true }),
    fs.mkdir(path.join(cliHome, "data"), { recursive: true }),
    fs.mkdir(path.join(cliHome, "state"), { recursive: true }),
    fs.mkdir(path.join(cliHome, "localapp"), { recursive: true })
  ]);
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


export function getCliEnvironment({ cliHome = "", isolated = false } = {}) {
  const resolvedCliHome = cliHome || (isolated ? OPENCODE_FALLBACK_ROOT : "");
  if (!isolated && !resolvedCliHome) {
    return { ...process.env };
  }
  const baseRoot = resolvedCliHome;
  const configHome = path.join(baseRoot, "config");
  const dataHome = path.join(baseRoot, "data");
  const stateHome = path.join(baseRoot, "state");
  const localAppData = path.join(baseRoot, "localapp");
  return {
    ...process.env,
    XDG_CONFIG_HOME: configHome,
    XDG_DATA_HOME: dataHome,
    XDG_STATE_HOME: stateHome,
    LOCALAPPDATA: localAppData
  };
}


export async function runCommand(command, args, { cwd = ROOT, env = process.env, timeoutMs = 20000, input = "" } = {}) {
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

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
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

export function detectOpencodeHealthState({ authResult, modelsResult, credentials, models }) {
  const combined = stripAnsi([
    authResult?.stdout ?? "",
    authResult?.stderr ?? "",
    modelsResult?.stdout ?? "",
    modelsResult?.stderr ?? ""
  ].join("\n"));

  if (/\bis not recognized\b|ENOENT|command not found|was not found/i.test(combined)) {
    return "not_installed";
  }
  if (/EEXIST|EPERM|EACCES|Access is denied|Database migration failed|permission denied/i.test(combined)) {
    return "broken_environment";
  }
  if ((authResult?.code ?? 1) !== 0 && credentials.length === 0) {
    return "broken_environment";
  }
  if (!credentials.length) {
    return "login_required";
  }
  if (!models.length) {
    return "connected_no_models";
  }
  return "ready";
}

export function detectOpencodeCliHome(cliHome = "") {
  if (cliHome) {
    return path.join(cliHome, "config", "opencode");
  }
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "opencode");
  }
  return path.join(os.homedir(), ".config", "opencode");
}

async function inspectSingleOpencode({ credential = "", cliHome = "", isolated = false } = {}) {
  await ensureProjectDirectories();
  const resolvedCliHome = cliHome || (isolated ? OPENCODE_FALLBACK_ROOT : "");
  if (resolvedCliHome) {
    await ensureCliHomeDirectories(resolvedCliHome);
  }
  const env = getCliEnvironment({ cliHome: resolvedCliHome, isolated });
  const [authResult, modelsResult] = await Promise.all([
    runCommand("opencode", ["auth", "list"], { env, timeoutMs: 20000 }),
    runCommand("opencode", credential ? ["models", credential] : ["models"], { env, timeoutMs: 20000 })
  ]);
  const credentials = parseOpencodeCredentials(authResult.stdout);
  const models = parseOpencodeModels(modelsResult.stdout);
  const health_state = detectOpencodeHealthState({ authResult, modelsResult, credentials, models });
  return {
    ok: health_state === "ready" || health_state === "login_required" || health_state === "connected_no_models",
    provider: "opencode",
    credentials,
    models,
    auth_status: credentials.length ? "connected" : "login-required",
    health_state,
    cli_home_root: resolvedCliHome,
    environment_source: resolvedCliHome ? "project-local" : "user-global",
    detected_cli_home: detectOpencodeCliHome(resolvedCliHome),
    stdout: stripAnsi(modelsResult.stdout || authResult.stdout),
    stderr: stripAnsi(modelsResult.stderr || authResult.stderr),
    login_hint:
      health_state === "not_installed"
        ? "OpenCode CLI was not found on this machine."
        : health_state === "broken_environment"
          ? "OpenCode CLI is installed, but its auth/config environment is broken."
          : credentials.length
            ? "OpenCode credentials detected."
            : "Launch OpenCode login to connect your account."
  };
}

export async function inspectOpencode({ credential = "", cliHome = "", isolated = false } = {}) {
  const primary = await inspectSingleOpencode({ credential, cliHome, isolated });
  if (cliHome || isolated || primary.health_state !== "broken_environment") {
    return primary;
  }

  const fallback = await inspectSingleOpencode({
    credential,
    cliHome: OPENCODE_FALLBACK_ROOT,
    isolated: true
  });

  if (fallback.health_state === "not_installed") {
    return primary;
  }

  return {
    ...fallback,
    recovery_source: "project-local-fallback",
    global_stdout: primary.stdout,
    global_stderr: primary.stderr,
    login_hint:
      fallback.credentials.length
        ? "Using a project-local OpenCode home because the global OpenCode config is broken on this machine."
        : "OpenCode CLI is installed, but the global config is broken. GridNomad will use a project-local OpenCode login instead. Click Login and finish auth in the terminal/browser, then refresh models."
  };
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
    humans: scenario.agents ?? [],
    factions: scenario.factions ?? [],
    groups: scenario.factions ?? [],
    props: [],
    regions: {},
    settlements: [],
    roads: [],
    territories: {},
    communications: []
  };
}


export async function readSynthesizedScenario(settings = null) {
  const scenario = await readScenario();
  const normalizedSettings = settings ? normalizeSettings(scenario, settings) : await readSettings();
  return synthesizeScenario(scenario, normalizedSettings);
}


export async function generateWorld({ settings } = {}) {
  await ensureProjectData();
  const baseScenario = await readScenario();
  const mergedSettings = settings ? normalizeSettings(baseScenario, settings) : await readSettings();
  const synthesizedScenario = synthesizeScenario(baseScenario, mergedSettings);
  const args = [
    "-m",
    "gridnomad",
    "generate-world",
    "--request-stdin",
    ...worldArgsFromSettings(mergedSettings.world)
  ];
  const result = await runCommand("python", args, {
    cwd: ROOT,
    env: process.env,
    timeoutMs: 120000,
    input: JSON.stringify({ scenario: synthesizedScenario })
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
  const baseScenario = await readScenario();
  const mergedSettings = settings ? normalizeSettings(baseScenario, settings) : await readSettings();
  const synthesizedScenario = synthesizeScenario(baseScenario, mergedSettings);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(RUNS_DIR, `web-${stamp}`);
  await fs.mkdir(runDir, { recursive: true });
  const args = [
    "-m",
    "gridnomad",
    "run",
    "--request-stdin",
    "--ticks",
    String(ticks),
    "--out",
    runDir,
    ...worldArgsFromSettings(mergedSettings.world)
  ];
  const result = await runCommand("python", args, {
    cwd: ROOT,
    env: process.env,
    timeoutMs: 120000,
    input: JSON.stringify({
      scenario: synthesizedScenario,
      settings: buildRuntimeControllerMap(mergedSettings)
    })
  });
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
    String(Math.max(0, Math.trunc(Number(settings.settlementDensity) || defaults.settlementDensity))),
    "--landmark-density",
    String(Math.max(0, Math.trunc(Number(settings.landmarkDensity) || defaults.landmarkDensity))),
    "--biome-density",
    String(Math.max(0, Math.trunc(Number(settings.biomeDensity) || defaults.biomeDensity)))
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


export async function launchDetachedCli(command, args, { env = process.env } = {}) {
  const child = spawn("powershell", [
    "-NoProfile",
    "-Command",
    `Start-Process '${command}' -ArgumentList '${args.join("','")}'`
  ], {
    cwd: ROOT,
    env,
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

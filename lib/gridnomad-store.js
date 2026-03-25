import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  DEFAULT_OPENCODE_CONNECTION,
  GEMINI_MODELS,
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
const MACHINE_RUNTIME_ROOT = path.join(
  process.env.LOCALAPPDATA || os.tmpdir(),
  "GridNomad",
  "cli-runtime"
);
const RUNTIME_SCENARIO_DIR = path.join(DATA_DIR, "runtime-scenarios");
const MANAGED_OPENCODE_PREFIX = "gridnomad-opencode-home-";
const OPENCODE_ZEN_STORAGE_TARGET = DEFAULT_OPENCODE_CONNECTION.storage_target;
const OPENCODE_ZEN_HOME_NAME = "opencode-zen-default";


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
  await fs.mkdir(MACHINE_RUNTIME_ROOT, { recursive: true });
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


function managedOpencodeHomePath(managedHomeId) {
  return path.join(os.tmpdir(), `${MANAGED_OPENCODE_PREFIX}${managedHomeId}`);
}

function opencodeZenHomePath() {
  return path.join(MACHINE_RUNTIME_ROOT, OPENCODE_ZEN_HOME_NAME);
}

function isManagedOpencodeHome(cliHome = "") {
  if (!cliHome) {
    return false;
  }
  const resolved = path.resolve(cliHome);
  return (
    resolved.startsWith(path.resolve(os.tmpdir(), MANAGED_OPENCODE_PREFIX))
    || resolved === path.resolve(opencodeZenHomePath())
  );
}

function detectEnvironmentSource(cliHome = "") {
  if (!cliHome) {
    return "user-global";
  }
  if (isManagedOpencodeHome(cliHome)) {
    return "managed-home";
  }
  return "custom-home";
}

function escapePowerShellValue(value) {
  return String(value).replace(/'/g, "''");
}

function escapeCmdValue(value) {
  return String(value).replace(/"/g, '""');
}

function joinCommandSegments(segments) {
  return segments.filter(Boolean).join("; ");
}

function buildOpencodeManualCommands({ cliHome = "", credential = "" } = {}) {
  const envValues = cliHome
    ? {
        XDG_CONFIG_HOME: path.join(cliHome, "config"),
        XDG_DATA_HOME: path.join(cliHome, "data"),
        XDG_STATE_HOME: path.join(cliHome, "state"),
        LOCALAPPDATA: path.join(cliHome, "localapp")
      }
    : {};

  const powershellEnv = Object.entries(envValues).map(
    ([key, value]) => `$env:${key}='${escapePowerShellValue(value)}'`
  );
  const cmdEnv = Object.entries(envValues).map(
    ([key, value]) => `set "${key}=${escapeCmdValue(value)}"`
  );
  const modelsCommand = credential ? `opencode models ${credential}` : "opencode models";

  return {
    powershell: {
      login: joinCommandSegments([...powershellEnv, "opencode auth login"]),
      verify: joinCommandSegments([...powershellEnv, "opencode auth list"]),
      models: joinCommandSegments([...powershellEnv, modelsCommand])
    },
    cmd: {
      login: `${cmdEnv.join(" && ")} && opencode auth login`,
      verify: `${cmdEnv.join(" && ")} && opencode auth list`,
      models: `${cmdEnv.join(" && ")} && ${modelsCommand}`
    }
  };
}

function buildOpencodeZenManualCommands({ cliHome = "" } = {}) {
  const envValues = cliHome
    ? {
        XDG_CONFIG_HOME: path.join(cliHome, "config"),
        XDG_DATA_HOME: path.join(cliHome, "data"),
        XDG_STATE_HOME: path.join(cliHome, "state"),
        LOCALAPPDATA: path.join(cliHome, "localapp"),
      }
    : {};
  const powershellEnv = Object.entries(envValues).map(
    ([key, value]) => `$env:${key}='${escapePowerShellValue(value)}'`
  );
  const cmdEnv = Object.entries(envValues).map(
    ([key, value]) => `set "${key}=${escapeCmdValue(value)}"`
  );
  return {
    powershell: {
      verify: joinCommandSegments([...powershellEnv, "opencode auth list"]),
      models: joinCommandSegments([...powershellEnv, "opencode models"]),
    },
    cmd: {
      verify: `${cmdEnv.join(" && ")} && opencode auth list`,
      models: `${cmdEnv.join(" && ")} && opencode models`,
    },
  };
}

function parseNdjsonLines(output = "") {
  return stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function extractOpencodeProbeError(output = "") {
  const records = parseNdjsonLines(output);
  for (const record of records) {
    if (record?.type !== "error") {
      continue;
    }
    const message =
      record?.error?.data?.message ||
      record?.error?.message ||
      record?.message ||
      "";
    if (message) {
      return String(message).trim();
    }
  }
  const stripped = stripAnsi(output).trim();
  if (/Unable to connect|Failed to fetch|not authenticated|login|required|credential|unauthorized/i.test(stripped)) {
    return stripped.split(/\r?\n/).find(Boolean) ?? stripped;
  }
  return "";
}

function classifyOpencodeModel(modelId = "") {
  const normalized = String(modelId || "").trim();
  if (!normalized) {
    return "unknown";
  }
  if (normalized.startsWith("opencode/")) {
    return "hosted";
  }
  if (normalized.includes("/")) {
    return "provider_backed";
  }
  return "unknown";
}

function buildOpencodeModelLabel(modelId = "") {
  const normalized = String(modelId || "").trim();
  if (!normalized) {
    return "";
  }
  const [provider, model] = normalized.split("/", 2);
  if (!model) {
    return normalized;
  }
  if (provider === "opencode") {
    return model
      .split("-")
      .map((part) => (/^\d/.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(" ");
  }
  return `${model} (${provider})`;
}

function categorizeOpencodeRuntimeError(message = "") {
  const text = String(message || "").trim();
  if (!text) {
    return "";
  }
  if (/rate limit|quota|freeusagelimit|too many requests/i.test(text)) {
    return "quota_limited";
  }
  if (/login|required|not authenticated|credential|unauthorized|forbidden/i.test(text)) {
    return "auth_required";
  }
  if (/unable to connect|failed to fetch|network|dns|timeout|timed out|econn|enet/i.test(text)) {
    return "network_issue";
  }
  if (/connection refused|provider unavailable|temporarily unavailable/i.test(text)) {
    return "provider_unavailable";
  }
  if (/eexist|eperm|eacces|access is denied|broken environment|migration/i.test(text)) {
    return "broken_environment";
  }
  return "unknown_runtime_error";
}

function mapOpencodeHealthState({ environmentHealth = "", selectedModel = "", decisionProbe = null, credentials = [] } = {}) {
  if (!selectedModel) {
    return "model_required";
  }
  if (environmentHealth === "not_installed") {
    return "not_installed";
  }
  if (environmentHealth === "broken_environment") {
    return "broken_environment";
  }
  if (decisionProbe?.ok) {
    return "ready";
  }
  if (decisionProbe && !decisionProbe.ok) {
    const sourceType = classifyOpencodeModel(selectedModel);
    const errorCategory = categorizeOpencodeRuntimeError(decisionProbe.error);
    if (errorCategory === "quota_limited") {
      return "rate_limited";
    }
    if (!credentials.length && errorCategory === "auth_required") {
      return "login_required";
    }
    if (sourceType === "hosted") {
      return "hosted_model_unavailable";
    }
    if (sourceType === "provider_backed") {
      return "provider_backed_model_unavailable";
    }
    return "runtime_unavailable";
  }
  if (!credentials.length && environmentHealth === "login_required") {
    return "login_required";
  }
  if (environmentHealth === "connected_no_models") {
    return "connected_no_models";
  }
  return "ready";
}

function buildOpencodeModelEntries({ models = [], selectedModel = "", decisionProbe = null, credentials = [] } = {}) {
  const selected = String(selectedModel || "").trim();
  return Array.from(new Set(models.filter(Boolean))).map((modelId) => {
    const sourceType = classifyOpencodeModel(modelId);
    const isSelected = modelId === selected;
    const errorCategory = isSelected ? categorizeOpencodeRuntimeError(decisionProbe?.error ?? "") : "";
    const runtimeStatus = isSelected
      ? (decisionProbe?.ok ? "ready" : (errorCategory === "quota_limited"
        ? "rate_limited"
        : sourceType === "hosted"
          ? "hosted_model_unavailable"
          : sourceType === "provider_backed"
            ? "provider_backed_model_unavailable"
            : "unknown"))
      : "unverified";
    return {
      id: modelId,
      label: buildOpencodeModelLabel(modelId),
      source_type: sourceType,
      credential_requirement: sourceType === "provider_backed" ? (credentials.length ? "optional" : "likely_required") : "none",
      runtime_status: runtimeStatus,
      error_category: errorCategory || "",
      selected: isSelected,
    };
  });
}

async function probeOpencodeDecision({ cliHome = "", model = "", credential = "" } = {}) {
  if (!model) {
    return null;
  }
  const env = getCliEnvironment({ cliHome });
  const args = ["run", "--dir", ROOT, "--format", "json", "--title", "GridNomad probe", "-m", model];
  if (credential) {
    env.OPENCODE_PROVIDER = credential;
  }
  args.push("Reply with READY and nothing else.");
  const result = await runCommand("opencode", args, { env, timeoutMs: 30000 });
  const extractedError = extractOpencodeProbeError(result.stdout || result.stderr || "");
  const ok = (result.code ?? 1) === 0 && !extractedError;
  return {
    ok,
    exit_code: result.code ?? 1,
    stdout: stripAnsi(result.stdout),
    stderr: stripAnsi(result.stderr),
    error: extractedError,
  };
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
  const resolvedCliHome = cliHome || "";
  if (!resolvedCliHome) {
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
    const child = spawn(command, args, {
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
    }
    if (child.stdin) {
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
    .filter((line) => /^[•●*]/.test(line))
    .map((line) => line.replace(/^[•●*]\s+/, "").split(/\s{2,}/)[0].trim())
    .filter(Boolean);
}


export function parseOpencodeModels(output) {
  return Array.from(new Set(stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("ERROR") && !line.includes("Database migration"))
    .filter((line) => line.includes("/"))));
}

async function upsertWindowsCredential(target, secret, username = "GridNomad") {
  if (process.platform !== "win32") {
    return { ok: false, message: "Windows Credential Manager is only available on Windows." };
  }
  const result = await runCommand("cmdkey", [
    `/generic:${target}`,
    `/user:${username}`,
    `/pass:${secret}`,
  ], {
    cwd: ROOT,
    env: process.env,
    timeoutMs: 15000,
  });
  return {
    ok: (result.code ?? 1) === 0,
    stdout: stripAnsi(result.stdout),
    stderr: stripAnsi(result.stderr),
    code: result.code ?? 1,
  };
}

async function deleteWindowsCredential(target) {
  if (process.platform !== "win32") {
    return { ok: false, message: "Windows Credential Manager is only available on Windows." };
  }
  const result = await runCommand("cmdkey", [`/delete:${target}`], {
    cwd: ROOT,
    env: process.env,
    timeoutMs: 15000,
  });
  const combined = `${result.stdout}\n${result.stderr}`.trim();
  const missing = /cannot find|not found|does not exist/i.test(combined);
  return {
    ok: (result.code ?? 1) === 0 || missing,
    stdout: stripAnsi(result.stdout),
    stderr: stripAnsi(result.stderr),
    code: result.code ?? 1,
  };
}

async function hasWindowsCredential(target) {
  if (process.platform !== "win32") {
    return false;
  }
  const result = await runCommand("cmdkey", [`/list:${target}`], {
    cwd: ROOT,
    env: process.env,
    timeoutMs: 15000,
  });
  const combined = stripAnsi(`${result.stdout}\n${result.stderr}`);
  return (result.code ?? 1) === 0 && combined.toLowerCase().includes(target.toLowerCase());
}

async function resolveOpencodeExecutablePath() {
  const locator = process.platform === "win32" ? "where" : "which";
  const result = await runCommand(locator, ["opencode"], {
    cwd: ROOT,
    env: process.env,
    timeoutMs: 10000,
  });
  const first = stripAnsi(result.stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return first ?? "";
}

async function resolveGeminiExecutablePath() {
  if (process.platform === "win32") {
    for (const candidate of ["gemini.cmd", "gemini.exe", "gemini.bat", "gemini.ps1", "gemini"]) {
      const result = await runCommand("where", [candidate], {
        cwd: ROOT,
        env: process.env,
        timeoutMs: 10000,
      });
      const first = stripAnsi(result.stdout)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      if (first) {
        return first;
      }
    }
    return "";
  }

  const result = await runCommand("which", ["gemini"], {
    cwd: ROOT,
    env: process.env,
    timeoutMs: 10000,
  });
  const first = stripAnsi(result.stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return first ?? "";
}

function detectGeminiCliHome() {
  const baseHome = process.env.GEMINI_CLI_HOME || os.homedir();
  return path.join(baseHome, ".gemini");
}

function buildGeminiManualCommands({ googleCloudProject = "", geminiPath = "" } = {}) {
  const env = googleCloudProject
    ? {
        powershell: `$env:GOOGLE_CLOUD_PROJECT='${escapePowerShellValue(googleCloudProject)}'`,
        cmd: `set "GOOGLE_CLOUD_PROJECT=${escapeCmdValue(googleCloudProject)}"`
      }
    : null;
  const resolvedPath = geminiPath || "gemini";
  const powershellExecutable = resolvedPath
    ? (resolvedPath.toLowerCase().endsWith(".ps1")
      ? `& '${escapePowerShellValue(resolvedPath)}'`
      : `& '${escapePowerShellValue(resolvedPath)}'`)
    : "gemini";
  const cmdExecutable = resolvedPath ? `"${escapeCmdValue(resolvedPath)}"` : "gemini";

  return {
    powershell: {
      login: joinCommandSegments([env?.powershell, powershellExecutable]),
      verify: joinCommandSegments([env?.powershell, `${powershellExecutable} -p "Reply with READY and nothing else."`]),
    },
    cmd: {
      login: [env?.cmd, cmdExecutable].filter(Boolean).join(" && "),
      verify: [env?.cmd, `${cmdExecutable} -p "Reply with READY and nothing else."`].filter(Boolean).join(" && "),
    }
  };
}

export function detectOpencodeHealthState({ authResult, modelsResult, credentials, models, decisionProbe = null }) {
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
  if (decisionProbe && !decisionProbe.ok) {
    const detail = String(decisionProbe.error ?? "").trim();
    if (/rate limit|quota|freeusagelimit|too many requests/i.test(detail)) {
      return "rate_limited";
    }
    if (!credentials.length && /login|required|credential|auth|unauthorized/i.test(detail)) {
      return "login_required";
    }
    return "runtime_unavailable";
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

async function inspectSingleOpencode({ credential = "", cliHome = "", isolated = false, model = "" } = {}) {
  await ensureProjectDirectories();
  const resolvedCliHome = cliHome || "";
  if (resolvedCliHome) {
    await fs.mkdir(resolvedCliHome, { recursive: true });
  }
  const env = getCliEnvironment({ cliHome: resolvedCliHome, isolated });
  const opencodePathPromise = resolveOpencodeExecutablePath();
  // OpenCode performs one-time local database setup inside a managed home.
  // Running multiple CLI commands in parallel against a fresh home can race
  // that setup and produce "unable to open database file" errors.
  const authResult = await runCommand("opencode", ["auth", "list"], { env, timeoutMs: 20000 });
  const baseModelsResult = await runCommand("opencode", ["models"], { env, timeoutMs: 20000 });
  const credentialModelsResult = credential
    ? await runCommand("opencode", ["models", credential], { env, timeoutMs: 20000 })
    : null;
  const opencodePath = await opencodePathPromise;
  const credentials = parseOpencodeCredentials(authResult.stdout);
  const baseModels = parseOpencodeModels(baseModelsResult.stdout);
  const credentialModels = credentialModelsResult ? parseOpencodeModels(credentialModelsResult.stdout) : [];
  const models = Array.from(new Set([...credentialModels, ...baseModels]));
  const combinedModelsResult = {
    code: credentialModelsResult?.code ?? baseModelsResult.code,
    stdout: [baseModelsResult.stdout, credentialModelsResult?.stdout ?? ""].filter(Boolean).join("\n"),
    stderr: [baseModelsResult.stderr, credentialModelsResult?.stderr ?? ""].filter(Boolean).join("\n")
  };
  const probeModel = model || "";
  const decision_probe = probeModel
    ? await probeOpencodeDecision({ cliHome: resolvedCliHome, model: probeModel, credential })
    : null;
  const environment_health = detectOpencodeHealthState({
    authResult,
    modelsResult: combinedModelsResult,
    credentials,
    models,
    decisionProbe: decision_probe,
  });
  const selected_model_status = mapOpencodeHealthState({
    environmentHealth: environment_health,
    selectedModel: probeModel,
    decisionProbe: decision_probe,
    credentials,
  });
  const selected_model_source_type = classifyOpencodeModel(probeModel);
  const selected_model_error_category = decision_probe?.ok ? "" : categorizeOpencodeRuntimeError(decision_probe?.error ?? "");
  const health_state = probeModel ? selected_model_status : environment_health;
  const environment_source = detectEnvironmentSource(resolvedCliHome);
  const manual_commands = buildOpencodeManualCommands({ cliHome: resolvedCliHome, credential });
  const models_scope = credential && credentialModels.length ? "credential+base" : baseModels.length ? "base" : "none";
  const model_entries = buildOpencodeModelEntries({
    models,
    selectedModel: probeModel,
    decisionProbe: decision_probe,
    credentials,
  });
  return {
    ok: health_state === "ready" || health_state === "login_required" || health_state === "connected_no_models",
    provider: "opencode",
    credentials,
    models,
    model_entries,
    base_models: baseModels,
    credential_models: credentialModels,
    models_scope,
    auth_status: credentials.length || decision_probe?.ok ? "connected" : "login-required",
    health_state,
    environment_health,
    selected_model_status,
    selected_model_source_type,
    selected_model_error_category,
    cli_home_root: resolvedCliHome,
    resolved_cli_home: resolvedCliHome,
    environment_source,
    detected_cli_home: detectOpencodeCliHome(resolvedCliHome),
    opencode_path: opencodePath,
    stdout: stripAnsi(combinedModelsResult.stdout || authResult.stdout),
    stderr: stripAnsi(combinedModelsResult.stderr || authResult.stderr),
    probes: {
      auth: {
        exit_code: authResult.code ?? 0,
        stdout: stripAnsi(authResult.stdout),
        stderr: stripAnsi(authResult.stderr),
      },
      base_models: {
        exit_code: baseModelsResult.code ?? 0,
        stdout: stripAnsi(baseModelsResult.stdout),
        stderr: stripAnsi(baseModelsResult.stderr),
      },
      credential_models: credentialModelsResult
        ? {
            exit_code: credentialModelsResult.code ?? 0,
            stdout: stripAnsi(credentialModelsResult.stdout),
            stderr: stripAnsi(credentialModelsResult.stderr),
          }
        : null,
      decision_probe: decision_probe,
    },
    decision_probe,
    manual_commands,
    last_probe_at: new Date().toISOString(),
    login_hint:
      health_state === "not_installed"
        ? "OpenCode CLI was not found on this machine."
      : health_state === "broken_environment"
          ? "OpenCode CLI is installed, but this OpenCode home is broken. Reset the managed home and try again."
        : health_state === "hosted_model_unavailable"
          ? `The selected OpenCode-hosted model could not run right now: ${decision_probe?.error || "runtime probe failed"}.`
        : health_state === "rate_limited"
          ? `The selected OpenCode Zen model is rate limited right now: ${decision_probe?.error || "runtime probe failed"}.`
        : health_state === "provider_backed_model_unavailable"
          ? `The selected provider-backed OpenCode model could not run right now: ${decision_probe?.error || "runtime probe failed"}.`
        : health_state === "runtime_unavailable"
          ? `OpenCode can list models, but the selected runtime model could not answer a test prompt: ${decision_probe?.error || "runtime probe failed"}. If you are using an OpenCode-hosted model, this usually means quota, provider availability, or account access is blocking the run.`
        : decision_probe?.ok
            ? "The selected OpenCode model answered a live verification prompt and is ready to run."
        : credentials.length
            ? "OpenCode credentials detected."
            : "Run the manual login command in your own terminal, finish login in the browser if prompted, then refresh credentials and models."
  };
}

export async function inspectOpencode({ credential = "", cliHome = "", isolated = false, model = "" } = {}) {
  return inspectSingleOpencode({ credential, cliHome, isolated, model });
}

function buildDisconnectedZenState() {
  const cliHome = opencodeZenHomePath();
  return {
    ok: false,
    provider: "opencode",
    connected_provider: "opencode",
    storage_target: OPENCODE_ZEN_STORAGE_TARGET,
    cli_home: cliHome,
    resolved_cli_home: cliHome,
    environment_source: "managed-home",
    health_state: "not_connected",
    selected_model_status: "not_connected",
    selected_model_source_type: "",
    selected_model_error_category: "",
    models: [],
    model_entries: [],
    credentials: [],
    has_stored_credential: false,
    manual_commands: buildOpencodeZenManualCommands({ cliHome }),
    login_hint: "Paste an OpenCode Zen API key and connect GridNomad before using OpenCode-hosted models.",
    last_probe_at: new Date().toISOString(),
  };
}

export async function inspectOpencodeZen({ model = "" } = {}) {
  await ensureProjectDirectories();
  const cliHome = opencodeZenHomePath();
  const hasStoredCredential = await hasWindowsCredential(OPENCODE_ZEN_STORAGE_TARGET);
  const hasCliHome = await fs.access(cliHome).then(() => true).catch(() => false);
  if (!hasStoredCredential && !hasCliHome) {
    return buildDisconnectedZenState();
  }
  const inspection = await inspectOpencode({ cliHome, model });
  const nextHealthState =
    inspection.health_state === "login_required" && !hasStoredCredential
      ? "not_connected"
      : inspection.health_state;
  return {
    ...inspection,
    provider: "opencode",
    connected_provider: "opencode",
    storage_target: OPENCODE_ZEN_STORAGE_TARGET,
    cli_home: cliHome,
    resolved_cli_home: cliHome,
    environment_source: "managed-home",
    has_stored_credential: hasStoredCredential,
    health_state: nextHealthState,
    selected_model_status: model ? nextHealthState : inspection.selected_model_status,
    manual_commands: buildOpencodeZenManualCommands({ cliHome }),
    login_hint:
      nextHealthState === "not_connected"
        ? "Paste an OpenCode Zen API key and connect GridNomad before using OpenCode-hosted models."
        : inspection.login_hint,
  };
}

export async function connectOpencodeZen({ apiKey = "", model = "" } = {}) {
  await ensureProjectDirectories();
  const trimmed = String(apiKey ?? "").trim();
  if (!trimmed) {
    return {
      ...buildDisconnectedZenState(),
      message: "An OpenCode Zen API key is required.",
    };
  }
  const credentialResult = await upsertWindowsCredential(OPENCODE_ZEN_STORAGE_TARGET, trimmed);
  if (!credentialResult.ok) {
    return {
      ...buildDisconnectedZenState(),
      health_state: "connection_failed",
      message: "Could not store the OpenCode Zen key in Windows Credential Manager.",
      stderr: credentialResult.stderr,
      stdout: credentialResult.stdout,
    };
  }
  const cliHome = opencodeZenHomePath();
  await fs.rm(cliHome, { recursive: true, force: true }).catch(() => {});
  await ensureCliHomeDirectories(cliHome);
  const env = getCliEnvironment({ cliHome, isolated: true });
  const loginResult = await runCommand("opencode", ["auth", "login", "-p", "opencode"], {
    cwd: ROOT,
    env,
    timeoutMs: 30000,
    input: `${trimmed}\n`,
  });
  const inspection = await inspectOpencodeZen({ model });
  return {
    ...inspection,
    login_result: {
      exit_code: loginResult.code ?? 1,
      stdout: stripAnsi(loginResult.stdout),
      stderr: stripAnsi(loginResult.stderr),
    },
    message:
      inspection.health_state === "ready" || inspection.health_state === "model_required" || inspection.health_state === "rate_limited"
        ? "OpenCode Zen connected."
        : "OpenCode Zen connection completed, but runtime verification still needs attention.",
  };
}

export async function disconnectOpencodeZen() {
  await ensureProjectDirectories();
  const cliHome = opencodeZenHomePath();
  const deleteResult = await deleteWindowsCredential(OPENCODE_ZEN_STORAGE_TARGET);
  await fs.rm(cliHome, { recursive: true, force: true }).catch(() => {});
  return {
    ...buildDisconnectedZenState(),
    message: deleteResult.ok ? "OpenCode Zen was disconnected." : "Could not fully disconnect OpenCode Zen.",
    stdout: deleteResult.stdout,
    stderr: deleteResult.stderr,
  };
}

export async function inspectGemini({ googleCloudProject = "" } = {}) {
  await ensureProjectDirectories();
  const geminiPath = await resolveGeminiExecutablePath();
  const geminiHome = detectGeminiCliHome();
  const accountsPath = path.join(geminiHome, "google_accounts.json");
  const oauthPath = path.join(geminiHome, "oauth_creds.json");
  const [accountsExists, oauthExists] = await Promise.all([
    fs.access(accountsPath).then(() => true).catch(() => false),
    fs.access(oauthPath).then(() => true).catch(() => false),
  ]);

  const storedAuth = accountsExists || oauthExists;
  const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const manual_commands = buildGeminiManualCommands({ googleCloudProject, geminiPath });

  let health_state = "login_required";
  let login_hint = "Run the Gemini CLI login command in your own terminal, finish Google login, then refresh status.";
  let stdout = "";
  let stderr = "";

  if (!geminiPath) {
    health_state = "not_installed";
    login_hint = "Gemini CLI was not found on this machine.";
  } else if (apiKeyConfigured) {
    health_state = "ready";
    login_hint = "Gemini CLI can use the configured API key.";
    stdout = "Detected Gemini API key environment configuration.";
  } else if (storedAuth) {
    health_state = "ready";
    login_hint = "Gemini CLI authentication evidence was found in the user-global Gemini home.";
    stdout = [
      accountsExists ? `Found ${accountsPath}` : "",
      oauthExists ? `Found ${oauthPath}` : "",
    ].filter(Boolean).join("\n");
  } else {
    stdout = `No cached Gemini auth evidence found in ${geminiHome}.`;
  }

  return {
    ok: health_state === "ready" || health_state === "login_required",
    provider: "gemini-cli",
    models: GEMINI_MODELS,
    supports_model_listing: true,
    supports_manual_model_entry: true,
    auth_status: health_state === "ready" ? "connected" : "login-required",
    health_state,
    login_hint,
    gemini_path: geminiPath,
    resolved_cli_home: geminiHome,
    environment_source: "user-global",
    stdout,
    stderr,
    manual_commands,
    last_probe_at: new Date().toISOString(),
  };
}

export async function createManagedOpencodeHome({ currentCliHome = "", model = "" } = {}) {
  const current = currentCliHome ? path.resolve(currentCliHome) : "";
  if (current && isManagedOpencodeHome(current)) {
    await fs.rm(current, { recursive: true, force: true }).catch(() => {});
  }
  const managedHomeId = randomUUID();
  const cliHome = managedOpencodeHomePath(managedHomeId);
  await fs.mkdir(cliHome, { recursive: true });
  const inspection = await inspectOpencode({ cliHome, model });
  return {
    managed_home_id: managedHomeId,
    ...inspection,
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


function resolveRunDir(runId) {
  const resolvedRoot = path.resolve(RUNS_DIR);
  const resolvedRun = path.resolve(RUNS_DIR, runId);
  if (resolvedRun !== resolvedRoot && !resolvedRun.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Invalid run id.");
  }
  return resolvedRun;
}


async function readJsonFile(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}


function countJsonLines(text = "") {
  return text.split(/\r?\n/).filter(Boolean).length;
}


export function snapshotToScenario(snapshot) {
  const world = snapshot?.world ?? {};
  const tileRows = Array.isArray(world.tiles) ? world.tiles : [];
  const tiles = tileRows.flatMap((row) => (Array.isArray(row) ? row : [])).filter(Boolean);
  return {
    config: snapshot?.config ?? {},
    seed: world.seed ?? snapshot?.seed ?? 0,
    tick: world.tick ?? snapshot?.tick ?? 0,
    tiles,
    agents: Object.values(world.agents ?? world.humans ?? {}),
    factions: Object.values(world.factions ?? world.groups ?? {}),
    props: world.props ?? [],
    regions: world.regions ?? {},
    settlements: world.settlements ?? [],
    roads: world.roads ?? [],
    territories: world.territories ?? {},
    communications: world.communications ?? [],
    animals: Object.values(world.animals ?? {}),
    cities: Object.values(world.cities ?? {}),
    kingdoms: Object.values(world.kingdoms ?? {}),
    structures: Object.values(world.structures ?? {}),
    battles: Object.values(world.battles ?? {}),
    fauna_events: world.fauna_events ?? [],
    time_of_day: world.time_of_day ?? 8,
    weather: world.weather ?? "clear",
    culture: snapshot?.culture ?? {},
  };
}


export async function listRuns() {
  await ensureProjectDirectories();
  const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true }).catch(() => []);
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const runDir = resolveRunDir(entry.name);
    const stat = await fs.stat(runDir).catch(() => null);
    const files = await fs.readdir(runDir).catch(() => []);
    const snapshotFiles = files.filter((file) => file.startsWith("snapshot-") && file.endsWith(".json")).sort();
    const latestSnapshotFile = snapshotFiles.at(-1);
    const latestSnapshot = latestSnapshotFile
      ? await readJsonFile(path.join(runDir, latestSnapshotFile), null)
      : null;
    const eventsText = await fs.readFile(path.join(runDir, "events.jsonl"), "utf-8").catch(() => "");
    runs.push({
      id: entry.name,
      path: runDir,
      updated_at: stat?.mtime?.toISOString?.() ?? null,
      snapshot_count: snapshotFiles.length,
      event_count: countJsonLines(eventsText),
      final_tick: latestSnapshot?.tick ?? latestSnapshot?.world?.tick ?? 0,
      seed: latestSnapshot?.world?.seed ?? null,
      width: latestSnapshot?.world?.width ?? null,
      height: latestSnapshot?.world?.height ?? null,
      source: entry.name.startsWith("web-stream-") ? "stream" : entry.name.startsWith("web-") ? "batch" : "unknown",
    });
  }
  runs.sort((left, right) => String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? "")));
  return runs;
}


export async function readRunArtifacts(runId) {
  await ensureProjectDirectories();
  const runDir = resolveRunDir(runId);
  const files = await fs.readdir(runDir).catch(() => []);
  const snapshotFiles = files.filter((file) => file.startsWith("snapshot-") && file.endsWith(".json")).sort();
  const [eventsText, ...snapshotTexts] = await Promise.all([
    fs.readFile(path.join(runDir, "events.jsonl"), "utf-8").catch(() => ""),
    ...snapshotFiles.map((file) => fs.readFile(path.join(runDir, file), "utf-8")),
  ]);
  const events = eventsText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const snapshots = snapshotTexts.map((text) => JSON.parse(text));
  const snapshot = snapshots.at(-1) ?? null;
  return {
    ok: true,
    runId,
    runDir,
    events,
    snapshots,
    snapshot,
    summary: {
      snapshot_count: snapshotFiles.length,
      event_count: events.length,
      final_tick: snapshot?.tick ?? snapshot?.world?.tick ?? 0,
      seed: snapshot?.world?.seed ?? null,
      width: snapshot?.world?.width ?? null,
      height: snapshot?.world?.height ?? null,
    },
    resumeScenario: snapshot ? snapshotToScenario(snapshot) : null,
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
  RUNS_DIR,
  SCENARIO_PATH,
  SETTINGS_PATH
};

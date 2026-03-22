import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import { buildRuntimeControllerMap, normalizeSettings, STRICT_MAX_TOTAL_POPULATION, synthesizeScenario } from "@/lib/civilization-setup";
import {
  ROOT,
  ensureProjectData,
  inspectOpencode,
  readScenario,
  readSettings,
  worldArgsFromSettings
} from "@/lib/gridnomad-store";


export const runtime = "nodejs";


export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  await ensureProjectData();
  const baseScenario = await readScenario();
  const mergedSettings = payload.settings ? normalizeSettings(baseScenario, payload.settings) : await readSettings();
  const readiness = await validateStrictSimulationSetup(mergedSettings);
  if (!readiness.ok) {
    return NextResponse.json(readiness, { status: 400 });
  }
  const synthesizedScenario = synthesizeScenario(baseScenario, mergedSettings);
  const durationSeconds = Math.max(10, Number(mergedSettings.world?.run_duration_seconds ?? 80));
  const microstepIntervalMs = Math.max(16, Number(mergedSettings.world?.microstep_interval_ms ?? 125));
  const ticks = Math.max(1, Math.ceil((durationSeconds * 1000) / microstepIntervalMs));
  const runDir = path.join(ROOT, "runs", `web-stream-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await fs.mkdir(runDir, { recursive: true });

  const encoder = new TextEncoder();
  const command = "python";
  const args = [
    "-m",
    "gridnomad",
    "run-stream",
    "--request-stdin",
    "--ticks",
    String(ticks),
    "--out",
    runDir,
    ...worldArgsFromSettings(mergedSettings.world)
  ];

  const isWindows = process.platform === "win32";
  const executable = isWindows ? (process.env.ComSpec || "cmd.exe") : command;
  const spawnArgs = isWindows
    ? ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArgument).join(" ")]
    : args;

  const stream = new ReadableStream({
    start(controller) {
      const child = spawn(executable, spawnArgs, {
        cwd: ROOT,
        env: process.env,
        shell: false,
        windowsHide: true
      });

      child.stdin.write(JSON.stringify({
        scenario: synthesizedScenario,
        settings: buildRuntimeControllerMap(mergedSettings)
      }));
      child.stdin.end();

      const enqueueObject = (message) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
      };

      child.stdout.on("data", (chunk) => {
        controller.enqueue(encoder.encode(chunk.toString()));
      });

      child.stderr.on("data", (chunk) => {
        enqueueObject({
          type: "stderr",
          text: String(chunk).trim()
        });
      });

      child.on("error", async (error) => {
        enqueueObject({
          type: "error",
          message: error.message
        });
        controller.close();
      });

      child.on("close", async (code) => {
        if (code !== 0) {
          enqueueObject({
            type: "error",
            message: `Simulation stream exited with code ${code}.`,
            code
          });
        }
        controller.close();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}


function quoteWindowsArgument(value) {
  if (!value.includes(" ") && !value.includes('"')) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}


async function validateStrictSimulationSetup(settings) {
  const groups = settings.groups ?? [];
  const totalPopulation = groups.reduce((sum, group) => sum + Number(group.population_count ?? 0), 0);
  if (totalPopulation > STRICT_MAX_TOTAL_POPULATION) {
    return {
      ok: false,
      reason: "population_limit",
      message: `Strict mode supports at most ${STRICT_MAX_TOTAL_POPULATION} humans total.`,
      total_population: totalPopulation,
      limit: STRICT_MAX_TOTAL_POPULATION,
    };
  }

  for (const group of groups) {
    const controller = group.controller ?? {};
    const provider = String(controller.provider ?? "heuristic");
    const model = String(controller.model ?? "").trim();
    if (provider === "heuristic") {
      continue;
    }
    if (provider === "opencode") {
      if (!String(controller.cliHome ?? "").trim()) {
        return {
          ok: false,
          reason: "home_required",
          message: `${group.name} must create a GridNomad-managed OpenCode home before starting a strict run.`,
          group_id: group.id,
          provider,
        };
      }
      const inspection = await inspectOpencode({
        credential: controller.opencodeProvider ?? "",
        cliHome: controller.cliHome ?? "",
        isolated: Boolean(controller.cliHome),
      });
      if (inspection.health_state !== "ready") {
        return {
          ok: false,
          reason: inspection.health_state,
          message: `${group.name} is not ready for OpenCode: ${inspection.login_hint}`,
          group_id: group.id,
          provider,
          health_state: inspection.health_state,
          detected_cli_home: inspection.detected_cli_home,
        };
      }
      if (!model) {
        return {
          ok: false,
          reason: "model_required",
          message: `${group.name} must choose an OpenCode model before starting a strict run.`,
          group_id: group.id,
          provider,
        };
      }
      continue;
    }
    if (["openai", "anthropic", "gemini-api"].includes(provider) && !String(controller.apiKey ?? controller.googleApiKey ?? "").trim()) {
      return {
        ok: false,
        reason: "missing_api_key",
        message: `${group.name} is using ${provider} without an API key.`,
        group_id: group.id,
        provider,
      };
    }
    if (!model) {
      return {
        ok: false,
        reason: "model_required",
        message: `${group.name} must choose a model before starting a strict run.`,
        group_id: group.id,
        provider,
      };
    }
  }

  return { ok: true };
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import { buildRuntimeControllerMap, normalizeSettings, synthesizeScenario } from "@/lib/civilization-setup";
import {
  ROOT,
  ensureProjectData,
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
  const synthesizedScenario = synthesizeScenario(baseScenario, mergedSettings);
  const durationSeconds = Math.max(10, Number(mergedSettings.world?.run_duration_seconds ?? 80));
  const decisionIntervalMs = Math.max(250, Number(mergedSettings.world?.decision_interval_ms ?? 2000));
  const ticks = Math.max(1, Math.ceil((durationSeconds * 1000) / decisionIntervalMs));
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

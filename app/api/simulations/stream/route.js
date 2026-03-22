import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import { synthesizeScenario } from "@/lib/civilization-setup";
import {
  ROOT,
  SETTINGS_PATH,
  ensureProjectData,
  readScenario,
  readSettings,
  worldArgsFromSettings,
  writeRuntimeScenario,
  writeSettings
} from "@/lib/gridnomad-store";


export const runtime = "nodejs";


export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const ticks = Math.max(1, Number(payload.ticks ?? 10));

  await ensureProjectData();
  const mergedSettings = payload.settings ? await writeSettings(payload.settings) : await readSettings();
  const baseScenario = await readScenario();
  const synthesizedScenario = synthesizeScenario(baseScenario, mergedSettings);
  const runtimeScenarioPath = await writeRuntimeScenario(synthesizedScenario);
  const runDir = path.join(ROOT, "runs", `web-stream-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await fs.mkdir(runDir, { recursive: true });

  const encoder = new TextEncoder();
  const command = "python";
  const args = [
    "-m",
    "gridnomad",
    "run-stream",
    "--scenario",
    runtimeScenarioPath,
    "--ticks",
    String(ticks),
    "--out",
    runDir,
    "--settings",
    SETTINGS_PATH,
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
        await fs.unlink(runtimeScenarioPath).catch(() => {});
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
        await fs.unlink(runtimeScenarioPath).catch(() => {});
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

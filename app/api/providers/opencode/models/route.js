import { NextResponse } from "next/server";

import {
  ensureProjectData,
  getCliEnvironment,
  parseOpencodeModels,
  runCommand,
  stripAnsi
} from "@/lib/gridnomad-store";


export async function GET(request) {
  await ensureProjectData();
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const args = ["models"];
  if (provider) {
    args.push(provider);
  }
  const result = await runCommand("opencode", args, {
    env: getCliEnvironment()
  });
  return NextResponse.json({
    ok: result.code === 0,
    models: parseOpencodeModels(result.stdout),
    stdout: stripAnsi(result.stdout),
    stderr: stripAnsi(result.stderr)
  });
}

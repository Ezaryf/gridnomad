import { NextResponse } from "next/server";

import {
  ensureProjectData,
  getCliEnvironment,
  parseOpencodeCredentials,
  runCommand,
  stripAnsi
} from "@/lib/gridnomad-store";


export async function GET() {
  await ensureProjectData();
  const result = await runCommand("opencode", ["auth", "list"], {
    env: getCliEnvironment()
  });
  return NextResponse.json({
    ok: result.code === 0,
    credentials: parseOpencodeCredentials(result.stdout),
    stdout: stripAnsi(result.stdout),
    stderr: stripAnsi(result.stderr)
  });
}

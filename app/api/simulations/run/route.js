import { NextResponse } from "next/server";

import { runSimulation } from "@/lib/gridnomad-store";


export async function POST(request) {
  const payload = await request.json();
  const ticks = Math.max(1, Number(payload.ticks ?? 10));
  const result = await runSimulation({
    ticks,
    settings: payload.settings
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        stdout: result.stdout,
        stderr: result.stderr,
        runDir: result.runDir
      },
      { status: 500 }
    );
  }
  return NextResponse.json(result);
}

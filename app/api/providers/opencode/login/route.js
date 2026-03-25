import { NextResponse } from "next/server";

import { ensureProjectData, inspectOpencode } from "@/lib/gridnomad-store";


export async function POST(request) {
  await ensureProjectData();
  const payload = await request.json().catch(() => ({}));
  const cliHome = payload.cliHome ?? "";
  const credential = payload.credential ?? "";
  const inspection = await inspectOpencode({ cliHome, credential });
  return NextResponse.json({
    ok: false,
    message: "GridNomad now uses the shared OpenCode Zen connection flow. Paste a Zen API key in the OpenCode card, connect it once, then refresh model verification.",
    ...inspection,
  }, { status: 409 });
}

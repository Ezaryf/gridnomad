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
    message: "GridNomad now uses a manual OpenCode login flow. Copy the login command and run it in your own terminal, then refresh credentials and models.",
    ...inspection,
  }, { status: 409 });
}

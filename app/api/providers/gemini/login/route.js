import { NextResponse } from "next/server";

import { ensureProjectData, inspectGemini } from "@/lib/gridnomad-store";


export async function POST(request) {
  await ensureProjectData();
  const payload = await request.json().catch(() => ({}));
  const googleCloudProject = payload.googleCloudProject ?? "";
  const inspection = await inspectGemini({ googleCloudProject });
  return NextResponse.json({
    ok: false,
    message: "GridNomad now uses a manual Gemini CLI login flow. Copy the login command, run it in your own terminal, then refresh status and models.",
    ...inspection,
  }, { status: 409 });
}

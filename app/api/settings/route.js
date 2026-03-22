import { NextResponse } from "next/server";

import { buildScenarioPreview, readScenario, readSettings, writeSettings } from "@/lib/gridnomad-store";


export async function GET() {
  const [scenario, settings] = await Promise.all([readScenario(), readSettings()]);
  return NextResponse.json({
    scenario,
    preview: buildScenarioPreview(scenario),
    settings
  });
}


export async function POST(request) {
  const payload = await request.json();
  const settings = await writeSettings(payload);
  return NextResponse.json({ settings });
}

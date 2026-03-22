import { NextResponse } from "next/server";

import { buildScenarioPreview, readScenario, readSettings, writeSettings } from "@/lib/gridnomad-store";
import { synthesizeScenario } from "@/lib/civilization-setup";


export async function GET() {
  const [templateScenario, settings] = await Promise.all([readScenario(), readSettings()]);
  const scenario = synthesizeScenario(templateScenario, settings);
  return NextResponse.json({
    templateScenario,
    scenario,
    preview: scenario.generator ? null : buildScenarioPreview(scenario),
    settings
  });
}


export async function POST(request) {
  const payload = await request.json();
  const settings = await writeSettings(payload);
  const templateScenario = await readScenario();
  return NextResponse.json({
    settings,
    templateScenario,
    scenario: synthesizeScenario(templateScenario, settings)
  });
}

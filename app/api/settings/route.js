import { NextResponse } from "next/server";

import { buildScenarioPreview, readScenario, readSettings, writeSettings } from "@/lib/gridnomad-store";
import { humanNameValidation, synthesizeScenario } from "@/lib/civilization-setup";


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
  const validation = humanNameValidation(payload);
  if (!validation.valid) {
    return NextResponse.json({
      ok: false,
      message: validation.message,
      validation,
    }, { status: 400 });
  }
  const settings = await writeSettings(payload);
  const templateScenario = await readScenario();
  return NextResponse.json({
    ok: true,
    settings,
    templateScenario,
    scenario: synthesizeScenario(templateScenario, settings)
  });
}

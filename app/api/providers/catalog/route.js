import { NextResponse } from "next/server";

import {
  ANTHROPIC_MODELS,
  GEMINI_API_MODELS,
  GEMINI_MODELS,
  OPENAI_MODELS
} from "@/lib/civilization-setup";
import {
  ensureProjectData,
  inspectGemini,
  inspectOpencode
} from "@/lib/gridnomad-store";


export async function GET(request) {
  await ensureProjectData();
  const url = new URL(request.url);
  const provider = String(url.searchParams.get("provider") ?? "heuristic");

  if (provider === "gemini-cli") {
    const googleCloudProject = url.searchParams.get("googleCloudProject") ?? "";
    const inspection = await inspectGemini({ googleCloudProject });
    return NextResponse.json({
      ...inspection,
      models: GEMINI_MODELS,
      supports_model_listing: true,
      supports_manual_model_entry: true,
    });
  }

  if (provider === "gemini-api") {
    return NextResponse.json({
      ok: true,
      provider,
      models: GEMINI_API_MODELS,
      supports_model_listing: true,
      supports_manual_model_entry: true,
      auth_status: "api-key-required",
      login_hint: "Enter a Gemini API key to let this provider control the group."
    });
  }

  if (provider === "openai") {
    return NextResponse.json({
      ok: true,
      provider,
      models: OPENAI_MODELS,
      supports_model_listing: true,
      supports_manual_model_entry: true,
      auth_status: "api-key-required",
      login_hint: "Enter an OpenAI API key to let this provider control the group."
    });
  }

  if (provider === "anthropic") {
    return NextResponse.json({
      ok: true,
      provider,
      models: ANTHROPIC_MODELS,
      supports_model_listing: true,
      supports_manual_model_entry: true,
      auth_status: "api-key-required",
      login_hint: "Enter an Anthropic API key to let this provider control the group."
    });
  }

  if (provider === "opencode") {
    const credential = url.searchParams.get("credential") ?? "";
    const cliHome = url.searchParams.get("cliHome") ?? "";
    const model = url.searchParams.get("model") ?? "";
    const inspection = await inspectOpencode({ credential, cliHome, model });
    return NextResponse.json({
      ...inspection,
      supports_model_listing: true,
      supports_manual_model_entry: true
    });
  }

  return NextResponse.json({
    ok: true,
    provider,
    models: [],
    supports_model_listing: false,
    supports_manual_model_entry: false,
    auth_status: "local",
    login_hint: "The heuristic adapter does not require authentication."
  });
}

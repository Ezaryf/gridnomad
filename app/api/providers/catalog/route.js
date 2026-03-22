import { NextResponse } from "next/server";

import {
  ANTHROPIC_MODELS,
  GEMINI_API_MODELS,
  GEMINI_MODELS,
  OPENAI_MODELS
} from "@/lib/civilization-setup";
import {
  ensureProjectData,
  inspectOpencode
} from "@/lib/gridnomad-store";


export async function GET(request) {
  await ensureProjectData();
  const url = new URL(request.url);
  const provider = String(url.searchParams.get("provider") ?? "heuristic");

  if (provider === "gemini-cli") {
    return NextResponse.json({
      ok: true,
      provider,
      models: GEMINI_MODELS,
      supports_model_listing: true,
      supports_manual_model_entry: true,
      auth_status: "cli-login-or-api-key",
      login_hint: "Use Gemini CLI login or enter an API key."
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
    const providerFilter = url.searchParams.get("credential") ?? "";
    const inspection = await inspectOpencode({ credential: providerFilter });
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

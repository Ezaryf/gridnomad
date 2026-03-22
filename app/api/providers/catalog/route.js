import { NextResponse } from "next/server";

import {
  ANTHROPIC_MODELS,
  GEMINI_API_MODELS,
  GEMINI_MODELS,
  OPENAI_MODELS
} from "@/lib/civilization-setup";
import {
  ensureProjectData,
  getCliEnvironment,
  parseOpencodeCredentials,
  parseOpencodeModels,
  runCommand,
  stripAnsi
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
      login_hint: "Enter a Gemini API key to let this provider control the kingdom."
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
      login_hint: "Enter an OpenAI API key to let this provider control the kingdom."
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
      login_hint: "Enter an Anthropic API key to let this provider control the kingdom."
    });
  }

  if (provider === "opencode") {
    const providerFilter = url.searchParams.get("credential") ?? "";
    const [authResult, modelsResult] = await Promise.all([
      runCommand("opencode", ["auth", "list"], {
        env: getCliEnvironment(),
        timeoutMs: 20000
      }),
      runCommand("opencode", providerFilter ? ["models", providerFilter] : ["models"], {
        env: getCliEnvironment(),
        timeoutMs: 20000
      })
    ]);
    const credentials = parseOpencodeCredentials(authResult.stdout);
    return NextResponse.json({
      ok: authResult.code === 0 && modelsResult.code === 0,
      provider,
      models: parseOpencodeModels(modelsResult.stdout),
      credentials,
      supports_model_listing: true,
      supports_manual_model_entry: true,
      auth_status: credentials.length ? "connected" : "login-required",
      login_hint: credentials.length ? "OpenCode credentials detected." : "Launch OpenCode login to unlock provider models.",
      stdout: stripAnsi(modelsResult.stdout),
      stderr: stripAnsi(modelsResult.stderr || authResult.stderr)
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

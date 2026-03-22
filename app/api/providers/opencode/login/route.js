import { NextResponse } from "next/server";

import { inspectOpencode, launchDetachedCli } from "@/lib/gridnomad-store";


export async function POST() {
  const health = await inspectOpencode();
  if (health.health_state === "not_installed" || health.health_state === "broken_environment") {
    return NextResponse.json({
      ok: false,
      health_state: health.health_state,
      message: health.login_hint,
      stdout: health.stdout,
      stderr: health.stderr,
      detected_cli_home: health.detected_cli_home
    }, { status: 400 });
  }

  await launchDetachedCli("opencode", ["auth", "login"]);
  return NextResponse.json({
    ok: true,
    health_state: health.health_state,
    detected_cli_home: health.detected_cli_home,
    message: "OpenCode login launched in a separate terminal window."
  });
}

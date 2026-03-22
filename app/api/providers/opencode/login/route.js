import { NextResponse } from "next/server";

import {
  getCliEnvironment,
  inspectOpencode,
  launchDetachedCli
} from "@/lib/gridnomad-store";


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

  await launchDetachedCli(
    "opencode",
    ["auth", "login"],
    {
      env: getCliEnvironment({
        cliHome: health.cli_home_root ?? "",
        isolated: Boolean(health.cli_home_root)
      })
    }
  );
  return NextResponse.json({
    ok: true,
    health_state: health.health_state,
    cli_home_root: health.cli_home_root ?? "",
    environment_source: health.environment_source ?? "user-global",
    detected_cli_home: health.detected_cli_home,
    message:
      health.environment_source === "project-local"
        ? "OpenCode login launched in a separate terminal window. Finish login in the terminal/browser, then refresh credentials and models."
        : "OpenCode login launched in a separate terminal window. Finish login in the terminal/browser, then refresh credentials and models."
  });
}

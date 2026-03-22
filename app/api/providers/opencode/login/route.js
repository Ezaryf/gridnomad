import { NextResponse } from "next/server";

import { launchDetachedCli } from "@/lib/gridnomad-store";


export async function POST() {
  await launchDetachedCli("opencode", ["auth", "login"]);
  return NextResponse.json({
    ok: true,
    message: "OpenCode login launched in a separate terminal window."
  });
}

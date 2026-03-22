import { NextResponse } from "next/server";

import { launchDetachedCli } from "@/lib/gridnomad-store";


export async function POST() {
  await launchDetachedCli("gemini", []);
  return NextResponse.json({
    ok: true,
    message: "Gemini CLI launched in a separate terminal window. Choose your login flow there."
  });
}

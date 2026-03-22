import { NextResponse } from "next/server";

import { ensureProjectData, inspectOpencode } from "@/lib/gridnomad-store";


export async function GET(request) {
  await ensureProjectData();
  const url = new URL(request.url);
  const credential = url.searchParams.get("credential") ?? "";
  const cliHome = url.searchParams.get("cliHome") ?? "";
  return NextResponse.json(await inspectOpencode({ credential, cliHome }));
}

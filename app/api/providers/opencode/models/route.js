import { NextResponse } from "next/server";

import {
  ensureProjectData,
  inspectOpencode
} from "@/lib/gridnomad-store";


export async function GET(request) {
  await ensureProjectData();
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  return NextResponse.json(await inspectOpencode({ credential: provider ?? "" }));
}

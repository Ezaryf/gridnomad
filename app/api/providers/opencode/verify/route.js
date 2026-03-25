import { NextResponse } from "next/server";

import { ensureProjectData, inspectOpencodeZen } from "@/lib/gridnomad-store";


export async function GET(request) {
  await ensureProjectData();
  const url = new URL(request.url);
  const model = String(url.searchParams.get("model") ?? "");
  return NextResponse.json(await inspectOpencodeZen({ model }));
}

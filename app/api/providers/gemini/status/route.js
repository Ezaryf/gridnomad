import { NextResponse } from "next/server";

import { ensureProjectData, inspectGemini } from "@/lib/gridnomad-store";


export async function GET(request) {
  await ensureProjectData();
  const url = new URL(request.url);
  const googleCloudProject = url.searchParams.get("googleCloudProject") ?? "";
  return NextResponse.json(await inspectGemini({ googleCloudProject }));
}

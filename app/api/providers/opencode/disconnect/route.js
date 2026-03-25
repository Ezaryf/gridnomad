import { NextResponse } from "next/server";

import { disconnectOpencodeZen, ensureProjectData } from "@/lib/gridnomad-store";


export async function POST() {
  await ensureProjectData();
  const inspection = await disconnectOpencodeZen();
  return NextResponse.json({
    ok: true,
    ...inspection,
  });
}

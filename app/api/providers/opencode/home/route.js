import { NextResponse } from "next/server";

import { createManagedOpencodeHome, ensureProjectData } from "@/lib/gridnomad-store";


export async function POST(request) {
  await ensureProjectData();
  const payload = await request.json().catch(() => ({}));
  const currentCliHome = payload.currentCliHome ?? "";
  const inspection = await createManagedOpencodeHome({ currentCliHome });
  return NextResponse.json({
    ok: true,
    supports_model_listing: true,
    supports_manual_model_entry: true,
    ...inspection,
  });
}

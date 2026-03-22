import { NextResponse } from "next/server";

import {
  ensureProjectData,
  inspectOpencode
} from "@/lib/gridnomad-store";


export async function GET() {
  await ensureProjectData();
  return NextResponse.json(await inspectOpencode());
}

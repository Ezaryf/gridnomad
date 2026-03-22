import { NextResponse } from "next/server";

import { generateWorld } from "@/lib/gridnomad-store";


export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const result = await generateWorld({ settings: payload.settings });
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        stdout: result.stdout,
        stderr: result.stderr
      },
      { status: 500 }
    );
  }
  return NextResponse.json(result);
}

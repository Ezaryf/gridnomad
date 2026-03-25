import { NextResponse } from "next/server";

import { connectOpencodeZen, ensureProjectData } from "@/lib/gridnomad-store";


export async function POST(request) {
  await ensureProjectData();
  const payload = await request.json().catch(() => ({}));
  const apiKey = String(payload.apiKey ?? "");
  const model = String(payload.model ?? "");
  const inspection = await connectOpencodeZen({ apiKey, model });
  const connectableStates = [
    "ready",
    "model_required",
    "rate_limited",
    "connected_no_models",
    "runtime_unavailable",
    "hosted_model_unavailable",
    "provider_backed_model_unavailable",
    "network_issue",
    "login_required",
    "broken_environment",
  ];
  const connection_completed = connectableStates.includes(inspection.health_state) || Boolean(inspection.has_stored_credential);
  const ok = connection_completed;
  return NextResponse.json({
    ok,
    connection_completed,
    ...inspection,
  }, { status: ok ? 200 : 400 });
}

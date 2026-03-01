import { NextRequest, NextResponse } from "next/server";
import { getBackToBackConnectionDb } from "src/lib/backToBackConnectionDb";

export const runtime = "nodejs";

type CallStatus = "pending" | "played_track_a" | "played_track_b" | "discussion" | "revealed" | "scored" | "skipped";

type PatchBody = {
  status?: CallStatus;
  host_notes?: string | null;
};

const ALLOWED_STATUSES = new Set<CallStatus>([
  "pending",
  "played_track_a",
  "played_track_b",
  "discussion",
  "revealed",
  "scored",
  "skipped",
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const callId = Number(id);
  if (!Number.isFinite(callId)) {
    return NextResponse.json({ error: "Invalid call id" }, { status: 400 });
  }

  const body = (await request.json()) as PatchBody;
  const patch: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
    const now = new Date().toISOString();
    if (body.status === "revealed") patch.revealed_at = now;
    if (body.status === "scored") patch.scored_at = now;
  }

  if (typeof body.host_notes === "string" || body.host_notes === null) {
    patch.host_notes = body.host_notes;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const db = getBackToBackConnectionDb();
  const { data, error } = await db
    .from("b2bc_session_calls")
    .update(patch)
    .eq("id", callId)
    .select("id, session_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  return NextResponse.json({ ok: true, call_id: data.id, session_id: data.session_id }, { status: 200 });
}

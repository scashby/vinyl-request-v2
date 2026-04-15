import { NextRequest, NextResponse } from "next/server";
import { getNameThatTuneDb } from "src/lib/nameThatTuneDb";

export const runtime = "nodejs";

type CallPatchBody = {
  status?: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
  artist_answer?: string;
  title_answer?: string;
  source_label?: string | null;
  host_notes?: string | null;
  metadata_locked?: boolean;
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
  round_number: number;
};

type SessionRow = {
  id: number;
  started_at: string | null;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const callId = Number(id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const body = (await request.json()) as CallPatchBody;
  const hasMetadataPatch =
    typeof body.artist_answer === "string" ||
    typeof body.title_answer === "string" ||
    typeof body.source_label === "string" ||
    body.source_label === null ||
    typeof body.host_notes === "string" ||
    body.host_notes === null ||
    typeof body.metadata_locked === "boolean";
  if (!body.status && !hasMetadataPatch) return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });

  const db = getNameThatTuneDb();
  const { data: call, error: callError } = await db
    .from("ntt_session_calls")
    .select("id, session_id, call_index, round_number")
    .eq("id", callId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  type NttCallPatch = {
    status?: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
    asked_at?: string | null;
    answer_revealed_at?: string | null;
    scored_at?: string | null;
    artist_answer?: string;
    title_answer?: string;
    source_label?: string | null;
    host_notes?: string | null;
    metadata_locked?: boolean;
    metadata_synced_at?: string | null;
  };
  const patch: NttCallPatch = {};
  if (body.status) {
    patch.status = body.status;
    if (body.status === "asked") patch.asked_at = now;
    if (body.status === "answer_revealed") patch.answer_revealed_at = now;
    if (body.status === "scored") patch.scored_at = now;
  }
  if (typeof body.artist_answer === "string") patch.artist_answer = body.artist_answer.trim();
  if (typeof body.title_answer === "string") patch.title_answer = body.title_answer.trim();
  if (typeof body.source_label === "string" || body.source_label === null) {
    patch.source_label = typeof body.source_label === "string" ? body.source_label.trim() || null : null;
  }
  if (typeof body.host_notes === "string" || body.host_notes === null) {
    patch.host_notes = typeof body.host_notes === "string" ? body.host_notes.trim() || null : null;
  }
  if (typeof body.metadata_locked === "boolean") {
    patch.metadata_locked = body.metadata_locked;
  } else if (hasMetadataPatch) {
    patch.metadata_locked = true;
  }
  if (hasMetadataPatch) {
    patch.metadata_synced_at = now;
  }

  const { error: patchError } = await db.from("ntt_session_calls").update(patch).eq("id", callId);
  if (patchError) return NextResponse.json({ error: patchError.message }, { status: 500 });

  if (body.status === "asked") {
    const { data: session } = await db
      .from("ntt_sessions")
      .select("id, started_at")
      .eq("id", typedCall.session_id)
      .maybeSingle();
    const typedSession = session as SessionRow | null;

    const { error: sessionUpdateError } = await db
      .from("ntt_sessions")
      .update({
        current_call_index: typedCall.call_index,
        current_round: typedCall.round_number,
        status: "running",
        countdown_started_at: now,
        paused_at: null,
        paused_remaining_seconds: null,
        ended_at: null,
        started_at: typedSession?.started_at ?? now,
      })
      .eq("id", typedCall.session_id);

    if (sessionUpdateError) {
      return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

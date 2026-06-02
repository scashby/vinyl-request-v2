import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { rehydrateBingoCardLabels } from "src/lib/playlistMetadataSync";

export const runtime = "nodejs";

type BingoCallPatch = {
  status?: string;
  prep_started_at?: string | null;
  called_at?: string | null;
  completed_at?: string | null;
  track_title?: string;
  artist_name?: string;
  album_name?: string | null;
  side?: string | null;
  position?: string | null;
  metadata_locked?: boolean;
  metadata_synced_at?: string | null;
};

type CallPatchBody = {
  status?: "pending" | "prep_started" | "called" | "completed" | "skipped";
  track_title?: string;
  artist_name?: string;
  album_name?: string | null;
  side?: string | null;
  position?: string | null;
  metadata_locked?: boolean;
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
};

type SessionRow = { id: number; started_at: string | null };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const callId = Number(id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const body = (await request.json()) as CallPatchBody;
  const hasMetadataPatch =
    typeof body.track_title === "string" ||
    typeof body.artist_name === "string" ||
    typeof body.album_name === "string" ||
    body.album_name === null ||
    typeof body.side === "string" ||
    body.side === null ||
    typeof body.position === "string" ||
    body.position === null ||
    typeof body.metadata_locked === "boolean";
  if (!body.status && !hasMetadataPatch) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const db = getBingoDb();
  const { data: call, error: callError } = await db
    .from("bingo_session_calls")
    .select("id, session_id, call_index")
    .eq("id", callId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  const patch: BingoCallPatch = {};
  if (body.status) {
    patch.status = body.status;
    if (body.status === "prep_started") patch.prep_started_at = now;
    if (body.status === "called") patch.called_at = now;
    if (body.status === "completed" || body.status === "skipped") patch.completed_at = now;
  }
  if (typeof body.track_title === "string") patch.track_title = body.track_title.trim();
  if (typeof body.artist_name === "string") patch.artist_name = body.artist_name.trim();
  if (typeof body.album_name === "string" || body.album_name === null) {
    patch.album_name = typeof body.album_name === "string" ? body.album_name.trim() || null : null;
  }
  if (typeof body.side === "string" || body.side === null) {
    patch.side = typeof body.side === "string" ? body.side.trim().toUpperCase() || null : null;
  }
  if (typeof body.position === "string" || body.position === null) {
    patch.position = typeof body.position === "string" ? body.position.trim() || null : null;
  }
  if (typeof body.metadata_locked === "boolean") {
    patch.metadata_locked = body.metadata_locked;
  } else if (hasMetadataPatch) {
    patch.metadata_locked = true;
  }
  if (hasMetadataPatch) {
    patch.metadata_synced_at = now;
  }

  const { error } = await db.from("bingo_session_calls").update(patch).eq("id", callId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (hasMetadataPatch && (typeof body.track_title === "string" || typeof body.artist_name === "string")) {
    await rehydrateBingoCardLabels(typedCall.session_id);
  }

  if (body.status === "called") {
    const { data: session } = await db
      .from("bingo_sessions")
      .select("id, started_at")
      .eq("id", typedCall.session_id)
      .maybeSingle();

    const typedSession = session as SessionRow | null;
    await db
      .from("bingo_sessions")
      .update({
        current_call_index: typedCall.call_index,
        status: "running",
        countdown_started_at: now,
        paused_at: null,
        paused_remaining_seconds: null,
        started_at: typedSession?.started_at ?? now,
      })
      .eq("id", typedCall.session_id);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

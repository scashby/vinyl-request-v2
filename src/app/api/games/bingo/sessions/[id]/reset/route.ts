import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { planRoundSessionCalls, resolvePlaylistTracks } from "src/lib/bingoEngine";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  playlist_id: number;
};

type ExistingCallRow = {
  id: number;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBingoDb();
  const now = new Date().toISOString();

  const { data: session, error: sessionReadError } = await db
    .from("bingo_sessions")
    .select("id, playlist_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionReadError) return NextResponse.json({ error: sessionReadError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  const tracks = await resolvePlaylistTracks(db, typedSession.playlist_id);
  const plannedCalls = planRoundSessionCalls(tracks, sessionId, 1);

  const { data: existingCalls, error: existingError } = await db
    .from("bingo_session_calls")
    .select("id")
    .eq("session_id", sessionId)
    .order("id", { ascending: true });

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const typedExisting = (existingCalls ?? []) as ExistingCallRow[];
  if (typedExisting.length !== plannedCalls.length) {
    return NextResponse.json({ error: "Session call rows are not initialized for reset" }, { status: 400 });
  }

  // First pass: neutralize unique key conflicts before rewriting round 1 mapping.
  const prepErrors = await Promise.all(
    typedExisting.map(async (existing, index) => {
      const { error } = await db
        .from("bingo_session_calls")
        .update({
          call_index: 1000 + index + 1,
          ball_number: null,
          status: "pending",
          called_at: null,
          completed_at: null,
        })
        .eq("id", existing.id);

      return error?.message ?? null;
    })
  );

  const firstPrepError = prepErrors.find((message) => !!message);
  if (firstPrepError) return NextResponse.json({ error: firstPrepError }, { status: 500 });

  const updateErrors = await Promise.all(
    plannedCalls.map(async (planned, index) => {
      const callId = typedExisting[index]?.id;
      if (!callId) return "Call row mismatch while resetting round";

      const { error } = await db
        .from("bingo_session_calls")
        .update({
          playlist_track_key: planned.playlist_track_key,
          call_index: planned.call_index,
          ball_number: planned.ball_number,
          column_letter: planned.column_letter,
          track_title: planned.track_title,
          artist_name: planned.artist_name,
          album_name: planned.album_name,
          side: planned.side,
          position: planned.position,
          status: "pending",
          called_at: null,
          completed_at: null,
        })
        .eq("id", callId);

      return error?.message ?? null;
    })
  );

  const firstUpdateError = updateErrors.find((message) => !!message);
  if (firstUpdateError) return NextResponse.json({ error: firstUpdateError }, { status: 500 });

  const { error: clearEventsError } = await db
    .from("bingo_session_events")
    .delete()
    .eq("session_id", sessionId);

  if (clearEventsError) return NextResponse.json({ error: clearEventsError.message }, { status: 500 });

  const { error: sessionError } = await db
    .from("bingo_sessions")
    .update({
      status: "pending",
      current_call_index: 0,
      current_round: 1,
      started_at: null,
      ended_at: null,
      paused_at: null,
      paused_remaining_seconds: null,
      countdown_started_at: now,
      transport_queue_call_ids: [],
      call_reveal_at: null,
      bingo_overlay: "none",
      next_game_scheduled_at: null,
      next_game_rules_text: null,
    })
    .eq("id", sessionId);

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

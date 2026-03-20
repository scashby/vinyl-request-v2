import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { planRoundSessionCalls, resolvePlaylistTracks } from "src/lib/bingoEngine";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  playlist_id: number;
  round_count: number;
};

type ExistingCallRow = {
  id: number;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { round?: unknown; intermission_seconds?: unknown };
  const requestedRound = Number(body.round);
  if (!Number.isFinite(requestedRound) || requestedRound < 1) {
    return NextResponse.json({ error: "round is required" }, { status: 400 });
  }

  const db = getBingoDb();

  const { data: session, error: sessionError } = await db
    .from("bingo_sessions")
    .select("id, playlist_id, round_count")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  if (requestedRound > typedSession.round_count) {
    return NextResponse.json({ error: `round must be between 1 and ${typedSession.round_count}` }, { status: 400 });
  }

  const tracks = await resolvePlaylistTracks(db, typedSession.playlist_id);
  const plannedCalls = planRoundSessionCalls(tracks, sessionId, requestedRound);

  const { data: existingCalls, error: existingError } = await db
    .from("bingo_session_calls")
    .select("id")
    .eq("session_id", sessionId)
    .order("id", { ascending: true });

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const typedExisting = (existingCalls ?? []) as ExistingCallRow[];
  if (typedExisting.length !== plannedCalls.length) {
    return NextResponse.json({ error: "Session call rows are not initialized for round activation" }, { status: 400 });
  }

  // First pass: move rows to a temporary safe state to avoid unique collisions
  // on call_index/ball_number while we remap the round ordering.
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
  if (firstPrepError) {
    return NextResponse.json({ error: firstPrepError }, { status: 500 });
  }

  const now = new Date();
  const intermissionSecondsRaw = Number(body.intermission_seconds);
  const intermissionSeconds = Number.isFinite(intermissionSecondsRaw) ? Math.max(0, intermissionSecondsRaw) : 0;
  const nextGameAt = intermissionSeconds > 0
    ? new Date(now.getTime() + intermissionSeconds * 1000).toISOString()
    : null;

  const updateErrors = await Promise.all(
    plannedCalls.map(async (planned, index) => {
      const callId = typedExisting[index]?.id;
      if (!callId) return "Call row mismatch while activating round";
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
  if (firstUpdateError) {
    return NextResponse.json({ error: firstUpdateError }, { status: 500 });
  }

  // Reset queue/cue history so transport lane starts clean for the new round.
  const { error: clearEventsError } = await db
    .from("bingo_session_events")
    .delete()
    .eq("session_id", sessionId);

  if (clearEventsError) return NextResponse.json({ error: clearEventsError.message }, { status: 500 });

  const { error: updateSessionError } = await db
    .from("bingo_sessions")
    .update({
      current_round: requestedRound,
      current_call_index: 0,
      status: "paused",
      paused_at: now.toISOString(),
      paused_remaining_seconds: null,
      countdown_started_at: now.toISOString(),
      call_reveal_at: null,
      bingo_overlay: "none",
      next_game_scheduled_at: nextGameAt,
    })
    .eq("id", sessionId);

  if (updateSessionError) return NextResponse.json({ error: updateSessionError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { backfillMissingLegacyPlaylists, getPlaylistsForSession, getPlaylistByLetter } from "src/lib/bingoCrateModel";
import { planRoundSessionCalls, resolvePlaylistTracksForPlaylists } from "src/lib/bingoEngine";
import { getRoundSnapshotTracks } from "src/lib/bingoGameModel";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  playlist_id: number;
  playlist_ids: number[] | null;
};

function resolveSessionPlaylistIds(session: SessionRow): number[] {
  if (Array.isArray(session.playlist_ids) && session.playlist_ids.length > 0) {
    return session.playlist_ids;
  }
  return [session.playlist_id];
}

type ExistingCallRow = {
  id: number;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  const initialNextCallSeconds = 45;

  const db = getBingoDb();
  const now = new Date().toISOString();

  const sessionQuery = (db
    .from("bingo_sessions")
    .select("id, playlist_id, playlist_ids") as unknown as {
      eq: (column: string, value: number) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    });

  const { data: session, error: sessionReadError } = await sessionQuery.eq("id", sessionId).maybeSingle();

  if (sessionReadError) return NextResponse.json({ error: sessionReadError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;

  // Determine active playlist for round 1 and use its saved call_order if available.
  // This ensures reset restores the exact call order the host configured, not a re-randomised plan.
  await backfillMissingLegacyPlaylists(db, sessionId);
  const playlists = await getPlaylistsForSession(db, sessionId);
  const defaultActivePlaylistsByRound = Array.from(
    playlists.reduce((map, pl) => {
      const existing = map.get(pl.round_number);
      if (!existing || pl.crate_letter.localeCompare(existing) < 0) {
        map.set(pl.round_number, pl.crate_letter);
      }
      return map;
    }, new Map<number, string>())
  )
    .map(([round, letter]) => ({ round, letter }))
    .sort((left, right) => left.round - right.round);

  const round1Letter = defaultActivePlaylistsByRound.find((e) => e.round === 1)?.letter ?? null;
  const activePlaylistForRound1 = round1Letter ? await getPlaylistByLetter(db, sessionId, round1Letter) : null;
  const playlistCallOrder = Array.isArray(activePlaylistForRound1?.call_order)
    ? (activePlaylistForRound1.call_order as Array<Record<string, unknown>>)
    : [];

  let plannedCalls;
  if (playlistCallOrder.length > 0) {
    plannedCalls = playlistCallOrder.map((row, index) => ({
      playlist_track_key:
        typeof row.playlist_track_key === "string" && row.playlist_track_key.length > 0
          ? row.playlist_track_key
          : `playlist:${sessionId}:${round1Letter}:1:${index + 1}`,
      call_index: Number(row.call_index) || index + 1,
      ball_number: (() => { const n = Math.floor(Number(row.ball_number)); return Number.isFinite(n) ? Math.max(1, Math.min(75, n)) : index + 1; })(),
      column_letter: (typeof row.column_letter === "string" && ["B","G","I","N","O"].includes(row.column_letter.toUpperCase()) ? row.column_letter.toUpperCase() : "B") as "B"|"G"|"I"|"N"|"O",
      track_title: typeof row.track_title === "string" ? row.track_title : "",
      artist_name: typeof row.artist_name === "string" ? row.artist_name : "",
      album_name: typeof row.album_name === "string" ? row.album_name : null,
      side: typeof row.side === "string" ? row.side : null,
      position: typeof row.position === "string" ? row.position : null,
    }));
  } else {
    const snapshotTracks = await getRoundSnapshotTracks(db, sessionId, 1);
    const tracks = snapshotTracks.length > 0
      ? snapshotTracks
      : await resolvePlaylistTracksForPlaylists(db, resolveSessionPlaylistIds(typedSession));
    plannedCalls = planRoundSessionCalls(tracks, sessionId, 1);
  }

  const { data: existingCalls, error: existingError } = await db
    .from("bingo_session_calls")
    .select("id")
    .eq("session_id", sessionId)
    .order("id", { ascending: true });

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const typedExisting = (existingCalls ?? []) as ExistingCallRow[];
  if (typedExisting.length !== plannedCalls.length) {
    const { error: deleteCallsError } = await db
      .from("bingo_session_calls")
      .delete()
      .eq("session_id", sessionId);

    if (deleteCallsError) return NextResponse.json({ error: deleteCallsError.message }, { status: 500 });

    const rebuiltRows = plannedCalls.map((planned) => ({
      session_id: sessionId,
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
    }));

    const { error: insertCallsError } = await db.from("bingo_session_calls").insert(rebuiltRows);
    if (insertCallsError) return NextResponse.json({ error: insertCallsError.message }, { status: 500 });
  } else {
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
  }

  const { error: clearEventsError } = await db
    .from("bingo_session_events")
    .delete()
    .eq("session_id", sessionId);

  if (clearEventsError) return NextResponse.json({ error: clearEventsError.message }, { status: 500 });

  // defaultActiveCratesByRound already computed above.

  const { error: sessionError } = await db
    .from("bingo_sessions")
    .update({
      status: "pending",
      current_call_index: 0,
      current_round: 1,
      seconds_to_next_call: initialNextCallSeconds,
      started_at: null,
      ended_at: null,
      paused_at: null,
      paused_remaining_seconds: null,
      countdown_started_at: null,
      call_reveal_at: null,
      bingo_overlay: "welcome",
      next_game_scheduled_at: null,
      next_game_rules_text: null,
      active_crate_letter_by_round: defaultActivePlaylistsByRound,
    })
    .eq("id", sessionId);

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

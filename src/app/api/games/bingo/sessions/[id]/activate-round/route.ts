import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { planRoundSessionCalls, resolvePlaylistTracksForPlaylists } from "src/lib/bingoEngine";
import { getRoundSnapshotTracks } from "src/lib/bingoGameModel";
import { resolveRoundPlaylistIds, type RoundPlaylistEntry } from "src/lib/bingoRoundPlaylists";

export const runtime = "nodejs";

const BINGO_COLUMNS = ["B", "G", "I", "N", "O"] as const;
type BingoColumn = (typeof BINGO_COLUMNS)[number];

function coerceBingoColumn(value: unknown): BingoColumn {
  if (typeof value !== "string") return "B";
  const normalized = value.toUpperCase().trim();
  return (BINGO_COLUMNS as readonly string[]).includes(normalized)
    ? (normalized as BingoColumn)
    : "B";
}

function coerceBallNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return Math.max(1, Math.min(75, rounded));
}

type SessionRow = {
  id: number;
  playlist_id: number;
  playlist_ids: number[] | null;
  round_playlist_ids: RoundPlaylistEntry[] | null;
  round_count: number;
  active_crate_letter_by_round: { round: number; letter: string }[] | null;
};

type ExistingCallRow = {
  id: number;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    const sessionQuery = (db
      .from("bingo_sessions")
      .select("id, playlist_id, playlist_ids, round_playlist_ids, round_count, active_crate_letter_by_round") as unknown as {
        eq: (column: string, value: number) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      });

    const { data: session, error: sessionError } = await sessionQuery.eq("id", sessionId).maybeSingle();

    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const typedSession = session as SessionRow;
    if (requestedRound > typedSession.round_count) {
      return NextResponse.json({ error: `round must be between 1 and ${typedSession.round_count}` }, { status: 400 });
    }

    let plannedCalls = [] as ReturnType<typeof planRoundSessionCalls>;

    const activeCrateLetter = (typedSession.active_crate_letter_by_round ?? []).find((entry) => entry.round === requestedRound)?.letter ?? null;
    if (activeCrateLetter) {
      const { data: selectedCrate, error: selectedCrateError } = await db
        .from("bingo_session_crates")
        .select("crate_letter, call_order")
        .eq("session_id", sessionId)
        .eq("crate_letter", activeCrateLetter)
        .maybeSingle();

      if (selectedCrateError) {
        return NextResponse.json({ error: selectedCrateError.message }, { status: 500 });
      }

      const callOrder = Array.isArray(selectedCrate?.call_order)
        ? (selectedCrate.call_order as Array<Record<string, unknown>>)
        : [];

      if (callOrder.length > 0) {
        plannedCalls = callOrder.map((row, index) => ({
          playlist_track_key:
            typeof row.playlist_track_key === "string" && row.playlist_track_key.length > 0
              ? row.playlist_track_key
              : `crate:${sessionId}:${activeCrateLetter}:${requestedRound}:${index + 1}`,
          call_index: Number(row.call_index) || index + 1,
          ball_number: coerceBallNumber(row.ball_number, index + 1),
          column_letter: coerceBingoColumn(row.column_letter),
          track_title: typeof row.track_title === "string" ? row.track_title : "",
          artist_name: typeof row.artist_name === "string" ? row.artist_name : "",
          album_name: typeof row.album_name === "string" ? row.album_name : null,
          side: typeof row.side === "string" ? row.side : null,
          position: typeof row.position === "string" ? row.position : null,
        }));
      }
    }

    if (plannedCalls.length === 0) {
      const snapshotTracks = await getRoundSnapshotTracks(db, sessionId, requestedRound);
      const tracks = snapshotTracks.length > 0
        ? snapshotTracks
        : await resolvePlaylistTracksForPlaylists(db, resolveRoundPlaylistIds(typedSession, requestedRound));
      plannedCalls = planRoundSessionCalls(tracks, sessionId, requestedRound);
    }

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
    for (let index = 0; index < typedExisting.length; index += 1) {
      const existing = typedExisting[index];
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

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const now = new Date();
    const intermissionSecondsRaw = Number(body.intermission_seconds);
    const intermissionSeconds = Number.isFinite(intermissionSecondsRaw) ? Math.max(0, intermissionSecondsRaw) : 0;
    const nextGameAt = intermissionSeconds > 0
      ? new Date(now.getTime() + intermissionSeconds * 1000).toISOString()
      : null;

    for (let index = 0; index < plannedCalls.length; index += 1) {
      const planned = plannedCalls[index];
      const callId = typedExisting[index]?.id;
      if (!callId) {
        return NextResponse.json({ error: "Call row mismatch while activating round" }, { status: 500 });
      }

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

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate round";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

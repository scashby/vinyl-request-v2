import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { planRoundSessionCalls, resolvePlaylistTracksForPlaylists } from "src/lib/bingoEngine";
import { getRoundSnapshotTracks } from "src/lib/bingoGameModel";
import { autoSyncSessionPlaylistMetadata } from "src/lib/playlistMetadataSync";
import { resolveRoundPlaylistIds, type RoundPlaylistEntry } from "src/lib/bingoRoundPlaylists";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  playlist_id: number;
  playlist_ids: number[] | null;
  round_playlist_ids: RoundPlaylistEntry[] | null;
  round_count: number;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const parsedUrl = new URL(request.url);
  const roundParam = parsedUrl.searchParams.get("round");
  const requestedRound = roundParam ? Number.parseInt(roundParam, 10) : null;

  const db = getBingoDb();

  const sessionQuery = (db
    .from("bingo_sessions")
    .select("id, playlist_id, playlist_ids, round_playlist_ids, round_count") as unknown as {
      eq: (column: string, value: number) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    });

  const { data: session, error: sessionError } = await sessionQuery.eq("id", sessionId).maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const typedSession = session as SessionRow;

  if (requestedRound !== null) {
    if (!Number.isFinite(requestedRound) || requestedRound < 1) {
      return NextResponse.json({ error: "Invalid round parameter" }, { status: 400 });
    }

    const roundCount = Math.max(1, Number(typedSession.round_count ?? 1));
    if (requestedRound > roundCount) {
      return NextResponse.json({ error: `Round must be between 1 and ${roundCount}` }, { status: 400 });
    }

    const playlistIdsForRound = resolveRoundPlaylistIds(typedSession, requestedRound);
    if (playlistIdsForRound.length === 0) {
      return NextResponse.json({ error: "Session playlist has been deleted and cannot generate a round sheet." }, { status: 400 });
    }

    try {
      const snapshotTracks = await getRoundSnapshotTracks(db, sessionId, requestedRound);
      const tracks = snapshotTracks.length > 0
        ? snapshotTracks
        : await resolvePlaylistTracksForPlaylists(db, playlistIdsForRound);
      const rows = planRoundSessionCalls(tracks, sessionId, requestedRound).map((call, index) => ({
        id: -(index + 1),
        session_id: sessionId,
        playlist_track_key: call.playlist_track_key,
        call_index: call.call_index,
        ball_number: call.ball_number,
        column_letter: call.column_letter,
        track_title: call.track_title,
        artist_name: call.artist_name,
        album_name: call.album_name,
        side: call.side,
        position: call.position,
        metadata_locked: false,
        metadata_synced_at: null,
        status: "pending",
        prep_started_at: null,
        called_at: null,
        completed_at: null,
        created_at: new Date(0).toISOString(),
      }));
      return NextResponse.json({ data: rows }, { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate round call sheet";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    await autoSyncSessionPlaylistMetadata("bingo", sessionId);
  } catch {
    // Fail-open: returning existing calls is better than blocking host view.
  }

  const { data, error } = await db
    .from("bingo_session_calls")
    .select("id, session_id, playlist_track_key, call_index, ball_number, column_letter, track_title, artist_name, album_name, side, position, metadata_locked, metadata_synced_at, status, prep_started_at, called_at, completed_at, created_at")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

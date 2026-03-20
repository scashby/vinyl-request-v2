import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { planRoundSessionCalls, resolvePlaylistTracks } from "src/lib/bingoEngine";
import { autoSyncSessionPlaylistMetadata } from "src/lib/playlistMetadataSync";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  playlist_id: number;
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

  const { data: session, error: sessionError } = await db
    .from("bingo_sessions")
    .select("id, playlist_id, round_count")
    .eq("id", sessionId)
    .maybeSingle();

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

    const playlistId = Number(typedSession.playlist_id);
    const tracks = await resolvePlaylistTracks(db, playlistId);
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

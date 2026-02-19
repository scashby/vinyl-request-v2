import { NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  playlist_id: number;
  session_code: string;
  status: string;
  created_at: string;
};

type PlaylistRow = { id: number; name: string };

export async function GET() {
  const db = getBingoDb();
  const { data: sessions, error } = await db
    .from("bingo_sessions")
    .select("id, playlist_id, session_code, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (sessions ?? []) as SessionRow[];
  const playlistIds = Array.from(new Set(rows.map((row) => row.playlist_id)));

  const { data: playlists } = playlistIds.length
    ? await db.from("collection_playlists").select("id, name").in("id", playlistIds)
    : { data: [] as PlaylistRow[] };
  const playlistById = new Map<number, string>(((playlists ?? []) as PlaylistRow[]).map((row) => [row.id, row.name]));

  const hydrated = await Promise.all(
    rows.map(async (row) => {
      const { count } = await db
        .from("bingo_session_calls")
        .select("id", { count: "exact", head: true })
        .eq("session_id", row.id)
        .in("status", ["called", "completed", "skipped"]);

      return {
        id: row.id,
        session_code: row.session_code,
        playlist_name: playlistById.get(row.playlist_id) ?? "Unknown Playlist",
        status: row.status,
        created_at: row.created_at,
        calls_played: count ?? 0,
      };
    })
  );

  return NextResponse.json({ data: hydrated }, { status: 200 });
}

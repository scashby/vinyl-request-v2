import { NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { getPlaylistTrackCount } from "src/lib/bingoEngine";

export const runtime = "nodejs";

type PlaylistRow = {
  id: number;
  name: string;
  is_smart: boolean;
};

export async function GET() {
  const db = getBingoDb();

  const { data: playlists, error } = await db
    .from("collection_playlists")
    .select("id, name, is_smart")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withCounts = await Promise.all(
    ((playlists ?? []) as PlaylistRow[]).map(async (playlist) => {
      return {
        id: playlist.id,
        name: playlist.name,
        is_smart: playlist.is_smart,
        track_count: await getPlaylistTrackCount(db, playlist.id),
      };
    })
  );

  return NextResponse.json({ data: withCounts }, { status: 200 });
}

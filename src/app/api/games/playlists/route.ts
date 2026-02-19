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
      try {
        const smartCount = await getPlaylistTrackCount(db, playlist.id);
        return {
          id: playlist.id,
          name: playlist.name,
          is_smart: playlist.is_smart,
          track_count: smartCount,
        };
      } catch {
        // Fail-open per playlist so one bad smart playlist never blanks the whole dropdown.
        const { count } = await db
          .from("collection_playlist_items")
          .select("id", { count: "exact", head: true })
          .eq("playlist_id", playlist.id);

        return {
          id: playlist.id,
          name: playlist.name,
          is_smart: playlist.is_smart,
          track_count: count ?? 0,
        };
      }
    })
  );

  return NextResponse.json({ data: withCounts }, { status: 200 });
}

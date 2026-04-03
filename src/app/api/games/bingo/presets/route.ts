import { NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

type PresetRow = {
  id: number;
  name: string;
  source_playlist_ids: number[] | null;
  pool_size: number;
  created_from_session_id: number | null;
  note: string | null;
  archived: boolean;
  created_at: string;
};

type PlaylistRow = {
  id: number;
  name: string;
};

export async function GET() {
  const db = getBingoDb();

  const { data, error } = await db
    .from("bingo_game_presets")
    .select("id, name, source_playlist_ids, pool_size, created_from_session_id, note, archived, created_at")
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const presets = (data ?? []) as PresetRow[];
  const playlistIds = Array.from(
    new Set(
      presets.flatMap((preset) =>
        (Array.isArray(preset.source_playlist_ids) ? preset.source_playlist_ids : []).filter((value): value is number => Number.isFinite(value))
      )
    )
  );

  const { data: playlists, error: playlistsError } = playlistIds.length
    ? await db.from("collection_playlists").select("id, name").in("id", playlistIds)
    : { data: [] as PlaylistRow[], error: null };

  if (playlistsError) {
    return NextResponse.json({ error: playlistsError.message }, { status: 500 });
  }

  const playlistNameById = new Map<number, string>(((playlists ?? []) as PlaylistRow[]).map((row) => [row.id, row.name]));

  return NextResponse.json(
    {
      data: presets.map((preset) => {
        const sourcePlaylistIds = Array.isArray(preset.source_playlist_ids) ? preset.source_playlist_ids : [];
        return {
          ...preset,
          source_playlist_ids: sourcePlaylistIds,
          source_playlist_names: sourcePlaylistIds.map((id) => playlistNameById.get(id) ?? `Playlist ${id}`),
        };
      }),
    },
    { status: 200 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { resolvePlaylistTracks } from "src/lib/bingoEngine";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const playlistId = Number(id);
  if (!Number.isFinite(playlistId) || playlistId <= 0) {
    return NextResponse.json({ error: "Invalid playlist id" }, { status: 400 });
  }

  const db = getBingoDb();

  try {
    const resolved = await resolvePlaylistTracks(db, playlistId);
    const items = resolved.map((track, index) => ({
      track_key: track.trackKey,
      sort_order: Number.isFinite(track.sortOrder) ? track.sortOrder : index,
      track_title: track.trackTitle ?? null,
      artist_name: track.artistName ?? null,
      album_name: track.albumName ?? null,
      side: track.side ?? null,
      position: track.position ?? null,
    }));
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve playlist tracks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

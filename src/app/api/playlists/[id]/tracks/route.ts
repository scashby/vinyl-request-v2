import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { resolvePlaylistTracks } from "src/lib/bingoEngine";
import { propagateDisplayTitleChangesForPlaylist } from "src/lib/playlistDisplayTitlePropagation";

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
      display_title: track.displayTitle ?? null,
      artist_name: track.artistName ?? null,
      album_name: track.albumName ?? null,
      side: track.side ?? null,
      position: track.position ?? null,
      link_group: track.linkGroup ?? null,
      theme_hint: track.themeHint ?? null,
    }));
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve playlist tracks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/playlists/[id]/tracks
 *  Body: { track_key: string; display_title: string | null }
 *  Sets (or clears) the per-playlist display title for a single track item.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const playlistId = Number(id);
  if (!Number.isFinite(playlistId) || playlistId <= 0) {
    return NextResponse.json({ error: "Invalid playlist id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const { track_key, display_title } = body as Record<string, unknown>;

  if (typeof track_key !== "string" || !track_key.trim()) {
    return NextResponse.json({ error: "track_key is required" }, { status: 400 });
  }

  if (display_title !== null && typeof display_title !== "string") {
    return NextResponse.json({ error: "display_title must be a string or null" }, { status: 400 });
  }

  const normalizedTitle =
    display_title === null ? null : (display_title as string).trim() || null;

  const db = getBingoDb();

  const { error } = await db
    .from("collection_playlist_items")
    .update({ display_title: normalizedTitle })
    .eq("playlist_id", playlistId)
    .eq("track_key", track_key.trim());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await propagateDisplayTitleChangesForPlaylist(playlistId);

  return NextResponse.json({ ok: true }, { status: 200 });
}

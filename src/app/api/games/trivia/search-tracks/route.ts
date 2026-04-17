// @ts-nocheck — release_tracks / releases / inventory / masters not in TriviaDatabase; use supabaseAdmin
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { isForSaleInventory } from "src/lib/saleUtils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const qLower = q.toLowerCase();

  // Start from inventory and join outward — same pattern as library/albums.
  // This handles tracks where title_override is null (fall back to recording.title)
  // and avoids the reverse-direction lookup that misses those tracks.
  const { data: inventoryRows, error } = await supabaseAdmin
    .from("inventory")
    .select(
      "id, status, discogs_folder_name, discogs_folder_id, discogs_instance_id, release_id, release:releases(id, release_tracks(id, recording_id, position, side, title_override, recordings(id, title, track_artist)), master:masters(id, title, artist:artists(name)))"
    )
    .limit(800);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deduplicate: same recording_id = same song (LP + compilation = one result)
  const seenRecordingKeys = new Set<string>();
  const results: Array<{
    inventory_id: number;
    release_id: number | null;
    release_track_id: number;
    artist: string;
    album: string;
    title: string;
    side: string | null;
    position: string | null;
    track_key: string;
  }> = [];

  for (const row of inventoryRows ?? []) {
    if (isForSaleInventory(row)) continue;

    const release = row.release;
    if (!release || !release.release_tracks) continue;

    const master = release.master;
    const albumTitle = master?.title ?? "";
    const artistName = master?.artist?.name ?? "";

    for (const track of release.release_tracks) {
      const recording = track.recordings;
      const trackTitle = track.title_override || recording?.title || "";
      if (!trackTitle) continue;
      if (!trackTitle.toLowerCase().includes(qLower)) continue;

      // Same recording on multiple releases = one dedup key
      const dedupeKey = track.recording_id
        ? `rec:${track.recording_id}`
        : `title:${trackTitle.toLowerCase().trim()}:rel:${release.id}`;
      if (seenRecordingKeys.has(dedupeKey)) continue;
      seenRecordingKeys.add(dedupeKey);

      const trackArtist = recording?.track_artist ?? artistName;

      results.push({
        inventory_id: row.id,
        release_id: release.id,
        release_track_id: track.id,
        artist: trackArtist,
        album: albumTitle,
        title: trackTitle,
        side: track.side,
        position: track.position,
        track_key: `rt-${track.id}`,
      });

      if (results.length >= 20) break;
    }

    if (results.length >= 20) break;
  }

  return NextResponse.json({ data: results });
}

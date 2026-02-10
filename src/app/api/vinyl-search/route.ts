import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

const VINYL_SIZES = ['7"', '10"', '12"'];
const DEFAULT_LIMIT = 200;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  if (!query) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const { data: inventoryRows, error } = await supabaseAdmin
    .from("inventory")
    .select(
      "id, releases ( id, media_type, format_details, release_tracks ( id, position, side, title_override, recordings ( id, title, track_artist ) ) )"
    )
    .eq("releases.media_type", "Vinyl")
    .overlaps("releases.format_details", VINYL_SIZES)
    .limit(DEFAULT_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: {
    inventory_id: number;
    recording_id: number | null;
    title: string;
    artist: string;
    side: string | null;
    position: string | null;
  }[] = [];

  for (const row of inventoryRows ?? []) {
    const release = row.releases;
    if (!release || !release.release_tracks) continue;

    for (const track of release.release_tracks) {
      const recording = track.recordings;
      const title = track.title_override || recording?.title;
      const artist = recording?.track_artist || "Unknown Artist";
      if (!title) continue;

      const haystack = `${title} ${artist}`.toLowerCase();
      if (!haystack.includes(query)) continue;

      results.push({
        inventory_id: row.id,
        recording_id: recording?.id ?? null,
        title,
        artist,
        side: track.side ?? null,
        position: track.position ?? null,
      });

      if (results.length >= DEFAULT_LIMIT) break;
    }
    if (results.length >= DEFAULT_LIMIT) break;
  }

  return NextResponse.json({ data: results }, { status: 200 });
}

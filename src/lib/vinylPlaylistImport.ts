import { supabaseAdmin } from "src/lib/supabaseAdmin";

const VINYL_SIZES = ['7"', '10"', '12"'];
const PAGE_SIZE = 1000;

export type InventoryTrack = {
  inventory_id: number | null;
  recording_id: number | null;
  title: string;
  artist: string;
  side: string | null;
  position: string | null;
};

const normalizeValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const buildInventoryIndex = (tracks: InventoryTrack[]) => {
  const index = new Map<string, InventoryTrack>();
  for (const track of tracks) {
    const titleKey = normalizeValue(track.title);
    const artistKey = normalizeValue(track.artist);
    if (!titleKey) continue;
    const fullKey = `${titleKey}::${artistKey}`;
    if (!index.has(fullKey)) {
      index.set(fullKey, track);
    }

    const titleOnlyKey = `${titleKey}::`;
    if (!index.has(titleOnlyKey)) {
      index.set(titleOnlyKey, track);
    }
  }
  return index;
};

export const matchTracks = (
  rows: { title?: string; artist?: string }[],
  index: Map<string, InventoryTrack>
) => {
  const matched: InventoryTrack[] = [];
  const missing: { title?: string; artist?: string }[] = [];

  for (const row of rows) {
    const titleKey = normalizeValue(row.title ?? "");
    const artistKey = normalizeValue(row.artist ?? "");
    if (!titleKey) continue;
    const fullKey = `${titleKey}::${artistKey}`;
    const titleOnlyKey = `${titleKey}::`;
    const track = index.get(fullKey) ?? index.get(titleOnlyKey);
    if (track) {
      matched.push(track);
    } else {
      missing.push(row);
    }
  }

  return { matched, missing };
};

export const fetchInventoryTracks = async (limit?: number) => {
  const tracks: InventoryTrack[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: inventoryRows, error } = await supabaseAdmin
      .from("inventory")
      .select(
        "id, releases ( id, media_type, format_details, release_tracks ( id, position, side, title_override, recordings ( id, title, track_artist ) ) )"
      )
      .eq("releases.media_type", "Vinyl")
      .overlaps("releases.format_details", VINYL_SIZES)
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const rows = inventoryRows ?? [];
    for (const row of rows) {
      const release = row.releases;
      if (!release || !release.release_tracks) continue;

      for (const track of release.release_tracks) {
        const recording = track.recordings;
        const title = track.title_override || recording?.title;
        const artist = recording?.track_artist || "Unknown Artist";
        if (!title) continue;

        tracks.push({
          inventory_id: row.id ?? null,
          recording_id: recording?.id ?? null,
          title,
          artist,
          side: track.side ?? null,
          position: track.position ?? null,
        });
      }
    }

    if (rows.length < PAGE_SIZE) break;
    if (limit && tracks.length >= limit) break;
    page += 1;
  }

  return tracks;
};

export const sanitizePlaylistName = (value?: string) => {
  const cleaned = value?.trim();
  if (!cleaned) return "Custom Playlist";
  return cleaned.slice(0, 80);
};

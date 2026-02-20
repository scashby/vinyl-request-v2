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

  // Step 1: fetch vinyl release ids first (cheap filter on releases table).
  const releaseIds: number[] = [];
  let releasePage = 0;
  let useFormatDetailsFilter = true;
  while (true) {
    const from = releasePage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let releaseQuery = supabaseAdmin
      .from("releases")
      .select("id")
      .eq("media_type", "Vinyl");

    if (useFormatDetailsFilter) {
      releaseQuery = releaseQuery.overlaps("format_details", VINYL_SIZES);
    }

    let { data: releases, error: releasesError } = await releaseQuery.range(from, to);

    // Some legacy rows have malformed array literals in format_details.
    // Fall back to media_type-only filtering so imports can proceed.
    if (
      releasesError &&
      useFormatDetailsFilter &&
      /malformed array literal/i.test(releasesError.message)
    ) {
      useFormatDetailsFilter = false;
      const fallback = await supabaseAdmin
        .from("releases")
        .select("id")
        .eq("media_type", "Vinyl")
        .range(from, to);
      releases = fallback.data;
      releasesError = fallback.error;
    }

    if (releasesError) {
      throw new Error(`Failed loading vinyl releases: ${releasesError.message}`);
    }

    const rows = releases ?? [];
    for (const row of rows) {
      if (typeof row.id === "number") {
        releaseIds.push(row.id);
      }
    }
    if (rows.length < PAGE_SIZE) break;
    releasePage += 1;
  }

  if (releaseIds.length === 0) return tracks;

  // Step 2: prefetch release tracks for those releases in chunks.
  const trackMap = new Map<number, Array<{
    recording_id: number | null;
    title: string;
    artist: string;
    side: string | null;
    position: string | null;
  }>>();

  const releaseChunkSize = 250;
  for (let i = 0; i < releaseIds.length; i += releaseChunkSize) {
    const chunk = releaseIds.slice(i, i + releaseChunkSize);
    const { data: releaseTracks, error: releaseTracksError } = await supabaseAdmin
      .from("release_tracks")
      .select("release_id, position, side, title_override, recordings ( id, title, track_artist )")
      .in("release_id", chunk);

    if (releaseTracksError) {
      throw new Error(`Failed loading release tracks: ${releaseTracksError.message}`);
    }

    for (const row of releaseTracks ?? []) {
      const releaseId = row.release_id;
      if (typeof releaseId !== "number") continue;
      const recording = Array.isArray(row.recordings) ? row.recordings[0] : row.recordings;
      const title = row.title_override || recording?.title;
      if (!title) continue;
      const trackRow = {
        recording_id: recording?.id ?? null,
        title,
        artist: recording?.track_artist || "Unknown Artist",
        side: row.side ?? null,
        position: row.position ?? null,
      };
      if (!trackMap.has(releaseId)) {
        trackMap.set(releaseId, []);
      }
      trackMap.get(releaseId)!.push(trackRow);
    }
  }

  // Step 3: fetch inventory rows and project the preloaded tracks.
  for (let i = 0; i < releaseIds.length; i += releaseChunkSize) {
    const chunk = releaseIds.slice(i, i + releaseChunkSize);
    const { data: inventoryRows, error: inventoryError } = await supabaseAdmin
      .from("inventory")
      .select("id, release_id")
      .in("release_id", chunk);

    if (inventoryError) {
      throw new Error(`Failed loading inventory rows: ${inventoryError.message}`);
    }

    for (const row of inventoryRows ?? []) {
      const inventoryId = row.id ?? null;
      const releaseId = row.release_id;
      if (!releaseId || !trackMap.has(releaseId)) continue;
      const releaseTracks = trackMap.get(releaseId)!;
      for (const track of releaseTracks) {
        tracks.push({
          inventory_id: inventoryId,
          recording_id: track.recording_id,
          title: track.title,
          artist: track.artist,
          side: track.side,
          position: track.position,
        });
      }
    }

    if (limit && tracks.length >= limit) {
      return tracks.slice(0, limit);
    }
  }

  return tracks;
};

export const sanitizePlaylistName = (value?: string) => {
  const cleaned = value?.trim();
  if (!cleaned) return "Custom Playlist";
  return cleaned.slice(0, 80);
};

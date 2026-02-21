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

export type MatchCandidate = {
  track_key: string;
  title: string;
  artist: string;
  score: number;
};

export type MissingTrackRow = {
  title?: string;
  artist?: string;
  candidates: MatchCandidate[];
};

type InventoryIndex = {
  exact: Map<string, InventoryTrack>;
  titleOnly: Map<string, InventoryTrack[]>;
  byToken: Map<string, InventoryTrack[]>;
};

const normalizeValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (value: string) =>
  normalizeValue(value)
    .split(/\s+/)
    .map((v) => v.trim())
    .filter(Boolean);

const getTrackKey = (track: InventoryTrack) =>
  track.inventory_id && track.position ? `${track.inventory_id}:${track.position}` : "";

const addToListMap = (map: Map<string, InventoryTrack[]>, key: string, track: InventoryTrack) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(track);
};

const diceCoefficient = (a: string, b: string) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aBigrams = new Map<string, number>();
  const bBigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2);
    aBigrams.set(gram, (aBigrams.get(gram) ?? 0) + 1);
  }
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2);
    bBigrams.set(gram, (bBigrams.get(gram) ?? 0) + 1);
  }
  let overlap = 0;
  for (const [gram, countA] of aBigrams) {
    const countB = bBigrams.get(gram) ?? 0;
    overlap += Math.min(countA, countB);
  }
  const total = [...aBigrams.values()].reduce((s, n) => s + n, 0) + [...bBigrams.values()].reduce((s, n) => s + n, 0);
  return total ? (2 * overlap) / total : 0;
};

const scoreCandidate = (rowTitle: string, rowArtist: string, track: InventoryTrack) => {
  const tTitle = normalizeValue(track.title);
  const tArtist = normalizeValue(track.artist);
  const titleScore = diceCoefficient(rowTitle, tTitle);
  const artistScore = rowArtist ? diceCoefficient(rowArtist, tArtist) : 0;
  const exactTitleBoost = rowTitle === tTitle ? 0.15 : 0;
  const exactArtistBoost = rowArtist && rowArtist === tArtist ? 0.1 : 0;
  return Math.min(1, titleScore * 0.75 + artistScore * 0.25 + exactTitleBoost + exactArtistBoost);
};

const collectCandidates = (rowTitle: string, rowArtist: string, index: InventoryIndex): InventoryTrack[] => {
  const pool = new Map<string, InventoryTrack>();
  for (const token of new Set([...tokenize(rowTitle), ...tokenize(rowArtist)])) {
    const tracks = index.byToken.get(token) ?? [];
    for (const track of tracks) {
      const key = getTrackKey(track);
      if (!key) continue;
      pool.set(key, track);
      if (pool.size >= 500) break;
    }
    if (pool.size >= 500) break;
  }
  // Fallback for sparse token hits
  if (pool.size === 0) {
    const prefix = rowTitle.slice(0, 6);
    for (const [titleKey, tracks] of index.titleOnly) {
      if (!titleKey.startsWith(prefix)) continue;
      for (const track of tracks) {
        const key = getTrackKey(track);
        if (!key) continue;
        pool.set(key, track);
      }
      if (pool.size >= 500) break;
    }
  }
  return Array.from(pool.values());
};

const fuzzyCandidates = (
  row: { title?: string; artist?: string },
  index: InventoryIndex,
  maxCandidates = 3
): MatchCandidate[] => {
  const rowTitle = normalizeValue(row.title ?? "");
  const rowArtist = normalizeValue(row.artist ?? "");
  if (!rowTitle) return [];
  const candidates = collectCandidates(rowTitle, rowArtist, index)
    .map((track) => ({
      track,
      score: scoreCandidate(rowTitle, rowArtist, track),
    }))
    .filter((entry) => entry.score >= 0.62)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates)
    .map((entry) => ({
      track_key: getTrackKey(entry.track),
      title: entry.track.title,
      artist: entry.track.artist,
      score: Number(entry.score.toFixed(3)),
    }));
  return candidates.filter((c) => !!c.track_key);
};

export const buildInventoryIndex = (tracks: InventoryTrack[]): InventoryIndex => {
  const exact = new Map<string, InventoryTrack>();
  const titleOnly = new Map<string, InventoryTrack[]>();
  const byToken = new Map<string, InventoryTrack[]>();
  for (const track of tracks) {
    const titleKey = normalizeValue(track.title);
    const artistKey = normalizeValue(track.artist);
    if (!titleKey) continue;
    const fullKey = `${titleKey}::${artistKey}`;
    if (!exact.has(fullKey)) {
      exact.set(fullKey, track);
    }

    addToListMap(titleOnly, titleKey, track);

    for (const token of new Set([...tokenize(track.title), ...tokenize(track.artist)])) {
      addToListMap(byToken, token, track);
    }
  }
  return { exact, titleOnly, byToken };
};

export const matchTracks = (
  rows: { title?: string; artist?: string }[],
  index: InventoryIndex
) => {
  const matched: InventoryTrack[] = [];
  const missing: MissingTrackRow[] = [];
  let fuzzyMatchedCount = 0;

  for (const row of rows) {
    const titleKey = normalizeValue(row.title ?? "");
    const artistKey = normalizeValue(row.artist ?? "");
    if (!titleKey) continue;
    const fullKey = `${titleKey}::${artistKey}`;
    const exact = index.exact.get(fullKey);
    const titleMatches = index.titleOnly.get(titleKey) ?? [];
    const track = exact ?? titleMatches[0];
    if (track) {
      matched.push(track);
    } else {
      const candidates = fuzzyCandidates(row, index);
      if (candidates.length > 0 && candidates[0].score >= 0.86) {
        const best = candidates[0];
        const bestTrack = index.exact.get(`${normalizeValue(best.title)}::${normalizeValue(best.artist)}`) ??
          (index.titleOnly.get(normalizeValue(best.title)) ?? []).find((t) => getTrackKey(t) === best.track_key);
        if (bestTrack) {
          matched.push(bestTrack);
          fuzzyMatchedCount += 1;
          continue;
        }
      }
      missing.push({ ...row, candidates });
    }
  }

  return { matched, missing, fuzzyMatchedCount };
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

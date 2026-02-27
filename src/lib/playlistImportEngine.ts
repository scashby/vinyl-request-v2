import Papa from "papaparse";
import { supabaseServer } from "src/lib/supabaseServer";

export type SourceRow = {
  title?: string;
  artist?: string;
};

export type MatchCandidate = {
  track_key: string;
  inventory_id: number | null;
  title: string;
  artist: string;
  side: string | null;
  position: string | null;
  score: number;
};

export type MissingRow = {
  title?: string;
  artist?: string;
  candidates: MatchCandidate[];
};

export type ImportResult = {
  playlistId: number;
  playlistName: string;
  sourceCount: number;
  matchedCount: number;
  fuzzyMatchedCount: number;
  unmatchedCount: number;
  unmatchedSample: MissingRow[];
  duplicatesSkipped: number;
};

type ImportOptions = {
  authHeader?: string;
  rows: SourceRow[];
  playlistName: string;
  existingPlaylistId?: number;
  icon: string;
  color: string;
};

type InventoryTrack = {
  trackKey: string;
  inventoryId: number;
  title: string;
  artist: string;
  side: string | null;
  position: string | null;
  normalizedTitle: string;
  normalizedArtist: string;
};

type InventoryIndex = {
  exact: Map<string, InventoryTrack[]>;
  byTitle: Map<string, InventoryTrack[]>;
  byToken: Map<string, InventoryTrack[]>;
};

const PAGE_SIZE = 1000;
const TITLE_KEYS = ["title", "track", "track_title", "song", "name"];
const ARTIST_KEYS = ["artist", "track_artist", "performer", "band"];

const normalizeHeader = (value: string) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const strip = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const sanitizePlaylistName = (value?: string) => {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return "Custom Playlist";
  return cleaned.slice(0, 80);
};

const normalizeText = (value: string) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (value: string) =>
  normalizeText(value)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

const dice = (a: string, b: string) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const aMap = new Map<string, number>();
  const bMap = new Map<string, number>();

  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2);
    aMap.set(gram, (aMap.get(gram) ?? 0) + 1);
  }
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2);
    bMap.set(gram, (bMap.get(gram) ?? 0) + 1);
  }

  let overlap = 0;
  for (const [gram, countA] of aMap.entries()) {
    overlap += Math.min(countA, bMap.get(gram) ?? 0);
  }

  const total =
    Array.from(aMap.values()).reduce((sum, n) => sum + n, 0) +
    Array.from(bMap.values()).reduce((sum, n) => sum + n, 0);

  if (!total) return 0;
  return (2 * overlap) / total;
};

const scoreTrack = (title: string, artist: string, track: InventoryTrack) => {
  const titleScore = dice(title, track.normalizedTitle);
  const artistScore = artist ? dice(artist, track.normalizedArtist) : 0;
  const weighted = artist ? titleScore * 0.65 + artistScore * 0.35 : titleScore;
  const titleBoost = title === track.normalizedTitle ? 0.1 : 0;
  const artistBoost = artist && artist === track.normalizedArtist ? 0.1 : 0;
  return Math.min(1, weighted + titleBoost + artistBoost);
};

const toCandidate = (track: InventoryTrack, score: number): MatchCandidate => ({
  track_key: track.trackKey,
  inventory_id: track.inventoryId,
  title: track.title,
  artist: track.artist,
  side: track.side,
  position: track.position,
  score: Number(score.toFixed(3)),
});

const addMapList = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const k = key.trim();
  if (!k) return;
  if (!map.has(k)) map.set(k, []);
  map.get(k)!.push(value);
};

export const parseCsvRows = (csvText: string): SourceRow[] => {
  const input = String(csvText ?? "");
  const headerProbe = Papa.parse(input, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  if (headerProbe.errors.length > 0 && headerProbe.data.length === 0) {
    throw new Error("CSV parse failed");
  }

  const fields = (headerProbe.meta.fields ?? []).map(normalizeHeader);
  const hasKnownHeaders = fields.some((field) => TITLE_KEYS.includes(field) || ARTIST_KEYS.includes(field));

  if (hasKnownHeaders) {
    const rows: SourceRow[] = [];
    for (const row of headerProbe.data ?? []) {
      const record = row as Record<string, unknown>;
      const title =
        strip(TITLE_KEYS.map((key) => record[key]).find((value) => strip(value).length > 0)) ||
        strip(record[fields[0] ?? ""]);
      const artist =
        strip(ARTIST_KEYS.map((key) => record[key]).find((value) => strip(value).length > 0)) ||
        strip(record[fields[1] ?? ""]);
      if (!title) continue;
      rows.push({ title, artist: artist || undefined });
    }
    return rows;
  }

  const raw = Papa.parse(input, {
    header: false,
    skipEmptyLines: "greedy",
  });
  if (raw.errors.length > 0 && raw.data.length === 0) {
    throw new Error("CSV parse failed");
  }

  const rows: SourceRow[] = [];
  for (const candidate of raw.data ?? []) {
    const row = candidate as unknown;
    if (!Array.isArray(row)) continue;
    const title = strip(row[0]);
    const artist = strip(row[1]);
    if (!title) continue;
    rows.push({ title, artist: artist || undefined });
  }
  return rows;
};

const loadInventoryTracks = async (authHeader?: string): Promise<InventoryTrack[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseServer(authHeader) as any;

  const inventoryByRelease = new Map<number, number>();
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await db
      .from("inventory")
      .select("id, release_id")
      .not("release_id", "is", null)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Failed loading inventory rows: ${error.message}`);

    const rows = data ?? [];
    for (const row of rows) {
      const inventoryId = typeof row.id === "number" ? row.id : null;
      const releaseId = typeof row.release_id === "number" ? row.release_id : null;
      if (!inventoryId || !releaseId) continue;
      const current = inventoryByRelease.get(releaseId);
      if (!current || inventoryId < current) inventoryByRelease.set(releaseId, inventoryId);
    }

    if (rows.length < PAGE_SIZE) break;
    page += 1;
  }

  const releaseIds = Array.from(inventoryByRelease.keys());
  if (releaseIds.length === 0) return [];

  const albumArtistByRelease = new Map<number, string>();
  const tracks: InventoryTrack[] = [];
  const releaseChunkSize = 250;

  for (let i = 0; i < releaseIds.length; i += releaseChunkSize) {
    const chunk = releaseIds.slice(i, i + releaseChunkSize);

    {
      const { data: releases, error: releaseError } = await db
        .from("releases")
        .select("id, master:masters(artist:artists(name))")
        .in("id", chunk);
      if (releaseError) throw new Error(`Failed loading release artists: ${releaseError.message}`);

      for (const row of releases ?? []) {
        const releaseId = typeof row.id === "number" ? row.id : null;
        if (!releaseId) continue;
        const master = Array.isArray(row.master) ? row.master[0] : row.master;
        const artistContainer = master && typeof master === "object" ? (master as { artist?: unknown }).artist : null;
        const artistRow = Array.isArray(artistContainer) ? artistContainer[0] : artistContainer;
        const name = artistRow && typeof artistRow === "object" ? (artistRow as { name?: unknown }).name : null;
        if (typeof name === "string" && name.trim()) {
          albumArtistByRelease.set(releaseId, name.trim());
        }
      }
    }

    const { data: releaseTracks, error: tracksError } = await db
      .from("release_tracks")
      .select("release_id, position, side, title_override, recordings ( id, title, track_artist )")
      .in("release_id", chunk);

    if (tracksError) throw new Error(`Failed loading release tracks: ${tracksError.message}`);

    for (const row of releaseTracks ?? []) {
      const releaseId = typeof row.release_id === "number" ? row.release_id : null;
      if (!releaseId) continue;

      const inventoryId = inventoryByRelease.get(releaseId);
      if (!inventoryId) continue;

      const recording = Array.isArray(row.recordings) ? row.recordings[0] : row.recordings;
      const titleRaw = row.title_override || recording?.title;
      const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
      if (!title) continue;

      const positionRaw = row.position;
      const position = typeof positionRaw === "string" ? positionRaw.trim() : "";
      if (!position) continue;

      const side = typeof row.side === "string" ? row.side.trim() : null;
      const trackArtist = typeof recording?.track_artist === "string" ? recording.track_artist.trim() : "";
      const albumArtist = albumArtistByRelease.get(releaseId) ?? "";
      const artist = (trackArtist || albumArtist || "Unknown Artist").trim();

      tracks.push({
        trackKey: `${inventoryId}:${position}`,
        inventoryId,
        title,
        artist,
        side: side || null,
        position,
        normalizedTitle: normalizeText(title),
        normalizedArtist: normalizeText(artist),
      });
    }
  }

  const deduped = new Map<string, InventoryTrack>();
  for (const track of tracks) {
    if (!deduped.has(track.trackKey)) deduped.set(track.trackKey, track);
  }

  return Array.from(deduped.values());
};

const buildIndex = (tracks: InventoryTrack[]): InventoryIndex => {
  const exact = new Map<string, InventoryTrack[]>();
  const byTitle = new Map<string, InventoryTrack[]>();
  const byToken = new Map<string, InventoryTrack[]>();

  for (const track of tracks) {
    const exactKey = `${track.normalizedTitle}::${track.normalizedArtist}`;
    addMapList(exact, exactKey, track);
    addMapList(byTitle, track.normalizedTitle, track);

    const tokens = new Set([...tokenize(track.title), ...tokenize(track.artist)]);
    for (const token of tokens) {
      addMapList(byToken, token, track);
    }
  }

  return { exact, byTitle, byToken };
};

const collectCandidates = (rowTitle: string, rowArtist: string, index: InventoryIndex): InventoryTrack[] => {
  const pool = new Map<string, InventoryTrack>();

  const directTitle = index.byTitle.get(rowTitle) ?? [];
  for (const track of directTitle) pool.set(track.trackKey, track);

  for (const token of new Set([...tokenize(rowTitle), ...tokenize(rowArtist)])) {
    const list = index.byToken.get(token) ?? [];
    for (const track of list) {
      pool.set(track.trackKey, track);
      if (pool.size >= 800) break;
    }
    if (pool.size >= 800) break;
  }

  return Array.from(pool.values());
};

const matchRows = (rows: SourceRow[], index: InventoryIndex) => {
  const matchedTrackKeys: string[] = [];
  const missing: MissingRow[] = [];
  let fuzzyMatchedCount = 0;

  for (const row of rows) {
    const rawTitle = strip(row.title);
    const rawArtist = strip(row.artist);
    const normTitle = normalizeText(rawTitle);
    const normArtist = normalizeText(rawArtist);

    if (!normTitle) continue;

    const exactHits = index.exact.get(`${normTitle}::${normArtist}`) ?? [];
    if (exactHits.length > 0) {
      matchedTrackKeys.push(exactHits[0].trackKey);
      continue;
    }

    const candidates = collectCandidates(normTitle, normArtist, index)
      .map((track) => ({ track, score: scoreTrack(normTitle, normArtist, track) }))
      .filter((entry) => entry.score >= 0.28)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (candidates.length > 0) {
      const best = candidates[0];
      const second = candidates[1];
      const delta = second ? best.score - second.score : best.score;

      if (best.score >= 0.9 || (best.score >= 0.84 && delta >= 0.07)) {
        matchedTrackKeys.push(best.track.trackKey);
        fuzzyMatchedCount += 1;
        continue;
      }

      missing.push({
        title: rawTitle || undefined,
        artist: rawArtist || undefined,
        candidates: candidates.map((entry) => toCandidate(entry.track, entry.score)),
      });
      continue;
    }

    missing.push({
      title: rawTitle || undefined,
      artist: rawArtist || undefined,
      candidates: [],
    });
  }

  return { matchedTrackKeys, missing, fuzzyMatchedCount };
};

const getPlaylistId = async (db: any, options: ImportOptions, playlistName: string): Promise<number> => {
  const requestedId = Number(options.existingPlaylistId ?? 0);
  if (Number.isFinite(requestedId) && requestedId > 0) {
    const { data: existing, error: existingError } = await db
      .from("collection_playlists")
      .select("id")
      .eq("id", requestedId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing?.id) throw new Error(`Playlist ${requestedId} not found`);
    return Number(existing.id);
  }

  const { data: maxSortRow, error: maxSortError } = await db
    .from("collection_playlists")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxSortError) throw maxSortError;

  const maxSortOrder = maxSortRow && typeof maxSortRow.sort_order === "number" ? maxSortRow.sort_order : -1;

  const { data: inserted, error: insertError } = await db
    .from("collection_playlists")
    .insert({
      name: playlistName,
      icon: options.icon,
      color: options.color,
      sort_order: maxSortOrder + 1,
      is_smart: false,
      smart_rules: null,
      match_rules: "all",
      live_update: true,
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    throw insertError || new Error("Failed to create playlist");
  }

  return Number(inserted.id);
};

export const importRowsToPlaylist = async (options: ImportOptions): Promise<ImportResult> => {
  const rows = options.rows
    .map((row) => ({ title: strip(row.title), artist: strip(row.artist) || undefined }))
    .filter((row) => row.title.length > 0);

  if (rows.length === 0) {
    throw new Error("No valid rows found for import");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseServer(options.authHeader) as any;
  const playlistName = sanitizePlaylistName(options.playlistName);

  const inventoryTracks = await loadInventoryTracks(options.authHeader);
  const index = buildIndex(inventoryTracks);
  const { matchedTrackKeys, missing, fuzzyMatchedCount } = matchRows(rows, index);
  const dedupedMatched = Array.from(new Set(matchedTrackKeys));

  const playlistId = await getPlaylistId(db, options, playlistName);

  const { data: existingItems, error: existingItemsError } = await db
    .from("collection_playlist_items")
    .select("track_key, sort_order")
    .eq("playlist_id", playlistId);
  if (existingItemsError) throw existingItemsError;

  const existingKeys = new Set(
    (existingItems ?? [])
      .map((item: { track_key?: unknown }) => (typeof item.track_key === "string" ? item.track_key.trim() : ""))
      .filter((value: string) => value.length > 0)
  );

  let maxSortOrder = -1;
  for (const item of existingItems ?? []) {
    const sortOrder =
      typeof (item as { sort_order?: unknown }).sort_order === "number"
        ? Number((item as { sort_order: number }).sort_order)
        : -1;
    if (sortOrder > maxSortOrder) maxSortOrder = sortOrder;
  }

  const newTrackKeys = dedupedMatched.filter((key) => !existingKeys.has(key));
  if (newTrackKeys.length > 0) {
    const insertRows = newTrackKeys.map((trackKey, idx) => ({
      playlist_id: playlistId,
      track_key: trackKey,
      sort_order: maxSortOrder + idx + 1,
    }));

    const { error: insertError } = await db
      .from("collection_playlist_items")
      .insert(insertRows);
    if (insertError) throw insertError;
  }

  return {
    playlistId,
    playlistName,
    sourceCount: rows.length,
    matchedCount: newTrackKeys.length,
    fuzzyMatchedCount,
    unmatchedCount: missing.length,
    unmatchedSample: missing.slice(0, 25),
    duplicatesSkipped: dedupedMatched.length - newTrackKeys.length,
  };
};

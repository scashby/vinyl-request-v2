import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { supabaseServer } from "src/lib/supabaseServer";
import { stripDiscogsDisambiguationSuffix } from "src/lib/artistName";

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
  inventory_id: number | null;
  title: string;
  artist: string;
  side: string | null;
  position: string | null;
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

type CachedInventoryIndex = {
  expiresAt: number;
  index: InventoryIndex;
  version: number;
};

const INVENTORY_INDEX_TTL_MS = 10 * 60 * 1000;
const INVENTORY_INDEX_VERSION = 2;

type InventoryIndexCache = Record<string, CachedInventoryIndex | undefined>;
const inventoryIndexCache: InventoryIndexCache =
  (globalThis as { __inventoryIndexCache?: InventoryIndexCache }).__inventoryIndexCache ?? {};
(globalThis as { __inventoryIndexCache?: InventoryIndexCache }).__inventoryIndexCache = inventoryIndexCache;

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const raw = parts[1] ?? "";
  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  try {
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const getCacheKeyForAuthHeader = (authHeader?: string) => {
  const raw = String(authHeader ?? "").trim();
  if (!raw) return "public";
  const token = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : raw;
  if (!token) return "public";
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  if (typeof sub === "string" && sub.trim().length > 0) return `user:${sub.trim()}`;
  const userId = payload?.user_id;
  if (typeof userId === "string" && userId.trim().length > 0) return `user:${userId.trim()}`;
  return "auth:unknown";
};

const normalizeTitleValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeArtistValue = (value: string) =>
  stripDiscogsDisambiguationSuffix(value)
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stripTitleNoiseTokens = (value: string) => {
  const tokens = value.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return value;

  const noise = new Set([
    "remaster",
    "remastered",
    "remastering",
    "mono",
    "stereo",
    "mix",
    "remix",
    "edit",
    "version",
    "live",
    "demo",
    "bonus",
    "track",
    "radio",
    "single",
    "album",
    "explicit",
    "clean",
    "deluxe",
    "expanded",
    "extended",
    "original",
    "acoustic",
    "instrumental",
    "feat",
    "featuring",
    "ft",
  ]);

  const filtered = tokens.filter((t) => {
    if (noise.has(t)) return false;
    const year = Number(t);
    if (Number.isInteger(year) && year >= 1900 && year <= 2099 && tokens.length > 1) {
      return false;
    }
    return true;
  });

  return filtered.join(" ").trim();
};

const normalizeTitle = (value: string) => stripTitleNoiseTokens(normalizeTitleValue(value));

const normalizeArtist = (value: string) => {
  const normalized = normalizeArtistValue(value);
  if (!normalized) return normalized;
  const tokens = normalized.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  const filtered = tokens.filter((t) => t !== "the" && t !== "and");
  return filtered.join(" ").trim();
};

const tokenize = (value: string, kind: "title" | "artist" = "title") =>
  (kind === "artist" ? normalizeArtistValue(value) : normalizeTitleValue(value))
    .split(/\s+/)
    .map((v) => v.trim())
    .filter(Boolean);

const getTrackKey = (track: InventoryTrack) =>
  track.inventory_id && track.position ? `${track.inventory_id}:${track.position}` : "";

const addToListMap = (map: Map<string, InventoryTrack[]>, key: string, track: InventoryTrack) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(track);
};

const toCandidate = (score: number, track: InventoryTrack): MatchCandidate => ({
  track_key: getTrackKey(track),
  inventory_id: track.inventory_id ?? null,
  title: track.title,
  artist: track.artist,
  side: track.side ?? null,
  position: track.position ?? null,
  score: Number(score.toFixed(3)),
});

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
  const tTitle = normalizeTitle(track.title);
  const tArtist = normalizeArtist(track.artist);
  const titleScore = diceCoefficient(rowTitle, tTitle);
  const artistScore = rowArtist ? diceCoefficient(rowArtist, tArtist) : 0;
  const exactTitleBoost = rowTitle === tTitle ? 0.15 : 0;
  const exactArtistBoost = rowArtist && rowArtist === tArtist ? 0.1 : 0;
  const artistWeight = rowArtist ? 0.4 : 0;
  const titleWeight = 1 - artistWeight;
  return Math.min(1, titleScore * titleWeight + artistScore * artistWeight + exactTitleBoost + exactArtistBoost);
};

const scoreSearchCandidate = (queryTitle: string, queryArtist: string, track: InventoryTrack) => {
  const tTitle = normalizeTitle(track.title);
  const tArtist = normalizeArtist(track.artist);

  const titleScore = queryTitle ? diceCoefficient(queryTitle, tTitle) : 0;
  const artistScore = queryArtist ? diceCoefficient(queryArtist, tArtist) : 0;
  const exactTitleBoost = queryTitle && queryTitle === tTitle ? 0.15 : 0;
  const exactArtistBoost = queryArtist && queryArtist === tArtist ? 0.1 : 0;
  const artistWeight = queryArtist ? 0.35 : 0;
  const titleWeight = 1 - artistWeight;
  const fielded = Math.min(1, titleScore * titleWeight + artistScore * artistWeight + exactTitleBoost + exactArtistBoost);

  // If the user types "title + artist" into the title box, this catches it.
  const combinedQuery = `${normalizeTitleValue(queryTitle)} ${normalizeArtistValue(queryArtist)}`.trim();
  const combinedTrack = `${normalizeTitleValue(track.title)} ${normalizeArtistValue(track.artist)}`.trim();
  const combined = combinedQuery ? diceCoefficient(combinedQuery, combinedTrack) : 0;

  return Math.max(fielded, combined);
};

const collectCandidates = (rowTitle: string, rowArtist: string, index: InventoryIndex, maxPoolSize = 500): InventoryTrack[] => {
  const pool = new Map<string, InventoryTrack>();
  for (const token of new Set([...tokenize(rowTitle, "title"), ...tokenize(rowArtist, "artist")])) {
    const tracks = index.byToken.get(token) ?? [];
    for (const track of tracks) {
      const key = getTrackKey(track);
      if (!key) continue;
      pool.set(key, track);
      if (pool.size >= maxPoolSize) break;
    }
    if (pool.size >= maxPoolSize) break;
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
      if (pool.size >= maxPoolSize) break;
    }
  }
  return Array.from(pool.values());
};

const fuzzyCandidates = (
  row: { title?: string; artist?: string },
  index: InventoryIndex,
  opts?: { maxCandidates?: number; minScore?: number; maxPoolSize?: number }
): MatchCandidate[] => {
  const rowTitle = normalizeTitleValue(row.title ?? "");
  const rowArtist = normalizeArtistValue(row.artist ?? "");
  if (!rowTitle) return [];
  const maxCandidates = opts?.maxCandidates ?? 8;
  const minScore = opts?.minScore ?? 0.5;
  const maxPoolSize = opts?.maxPoolSize ?? 500;

  return collectCandidates(rowTitle, rowArtist, index, maxPoolSize)
    .map((track) => toCandidate(scoreCandidate(rowTitle, rowArtist, track), track))
    .filter((candidate) => candidate.score >= minScore && !!candidate.track_key)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates);
};

const pickBestOfTitleMatches = (rowTitle: string, rowArtist: string, titleMatches: InventoryTrack[]) => {
  const scored = titleMatches
    .map((track) => ({ track, score: scoreCandidate(rowTitle, rowArtist, track) }))
    .sort((a, b) => b.score - a.score);
  return {
    best: scored[0] ?? null,
    second: scored[1] ?? null,
    candidates: scored.map((entry) => toCandidate(entry.score, entry.track)),
  };
};

export const buildInventoryIndex = (tracks: InventoryTrack[]): InventoryIndex => {
  const exact = new Map<string, InventoryTrack>();
  const titleOnly = new Map<string, InventoryTrack[]>();
  const byToken = new Map<string, InventoryTrack[]>();
  for (const track of tracks) {
    const titleKey = normalizeTitle(track.title);
    const artistKey = normalizeArtist(track.artist);
    if (!titleKey) continue;
    const fullKey = `${titleKey}::${artistKey}`;
    if (!exact.has(fullKey)) {
      exact.set(fullKey, track);
    }

    addToListMap(titleOnly, titleKey, track);

    for (const token of new Set([...tokenize(track.title, "title"), ...tokenize(track.artist, "artist")])) {
      addToListMap(byToken, token, track);
    }
  }
  return { exact, titleOnly, byToken };
};

export const getCachedInventoryIndex = async (authHeader?: string) => {
  const now = Date.now();
  const key = getCacheKeyForAuthHeader(authHeader);
  const cached = inventoryIndexCache[key];
  if (cached && cached.expiresAt > now && cached.version === INVENTORY_INDEX_VERSION) {
    return cached.index;
  }
  const tracks = await fetchInventoryTracks(authHeader);
  const index = buildInventoryIndex(tracks);
  inventoryIndexCache[key] = { expiresAt: now + INVENTORY_INDEX_TTL_MS, index, version: INVENTORY_INDEX_VERSION };
  return index;
};

export const matchTracks = (
  rows: { title?: string; artist?: string }[],
  index: InventoryIndex
) => {
  const matched: InventoryTrack[] = [];
  const missing: MissingTrackRow[] = [];
  let fuzzyMatchedCount = 0;

  for (const row of rows) {
    const titleKey = normalizeTitle(row.title ?? "");
    const artistKey = normalizeArtist(row.artist ?? "");
    if (!titleKey) continue;
    const fullKey = `${titleKey}::${artistKey}`;
    const exact = index.exact.get(fullKey);
    const titleMatches = index.titleOnly.get(titleKey) ?? [];

    if (exact) {
      matched.push(exact);
      continue;
    }

    // If title matches exist, only auto-pick when it's unambiguous.
    if (titleMatches.length === 1) {
      matched.push(titleMatches[0]);
      continue;
    }

    if (titleMatches.length > 1) {
      const { best, second, candidates: titleCandidates } = pickBestOfTitleMatches(titleKey, artistKey, titleMatches);
      const bestScore = best?.score ?? 0;
      const secondScore = second?.score ?? 0;
      const delta = bestScore - secondScore;
      // Only auto-match ambiguous titles when artist similarity clearly breaks the tie.
      if (best && (bestScore >= 0.95 || (bestScore >= 0.9 && delta >= 0.08))) {
        matched.push(best.track);
        fuzzyMatchedCount += 1;
        continue;
      }
      const candidates = titleCandidates
        .filter((c) => c.score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      missing.push({ ...row, candidates });
      continue;
    }

    // Fuzzy fallback (token-based pool)
    const candidates = fuzzyCandidates(row, index, { maxCandidates: 8, minScore: 0.35, maxPoolSize: 650 });
    if (candidates.length > 0) {
      const best = candidates[0];
      const second = candidates[1];
      const delta = second ? best.score - second.score : best.score;
      // Only auto-match very high confidence + separation.
      if (best.score >= 0.93 && delta >= 0.08) {
        const bestTrack =
          (index.titleOnly.get(normalizeTitle(best.title)) ?? []).find((t) => getTrackKey(t) === best.track_key) ??
          index.exact.get(`${normalizeTitle(best.title)}::${normalizeArtist(best.artist)}`);
        if (bestTrack) {
          matched.push(bestTrack);
          fuzzyMatchedCount += 1;
          continue;
        }
      }
    }

    missing.push({ ...row, candidates });
  }

  return { matched, missing, fuzzyMatchedCount };
};

export const searchInventoryCandidates = async (
  params: { title: string; artist?: string; limit?: number },
  index?: InventoryIndex
): Promise<MatchCandidate[]> => {
  const resolvedIndex = index ?? (await getCachedInventoryIndex());
  const titleRaw = params.title ?? "";
  const artistRaw = params.artist ?? "";
  const limit = Math.min(25, Math.max(1, Number(params.limit ?? 10)));

  const queryTitle = normalizeTitle(titleRaw);
  const queryArtist = normalizeArtist(artistRaw);
  if (!queryTitle) return [];

  const merged = new Map<string, MatchCandidate>();
  const addCandidate = (track: InventoryTrack) => {
    const candidate = toCandidate(scoreSearchCandidate(queryTitle, queryArtist, track), track);
    if (!candidate.track_key || candidate.score < 0.25) return;
    const current = merged.get(candidate.track_key);
    if (!current || candidate.score > current.score) {
      merged.set(candidate.track_key, candidate);
    }
  };

  // Always include exact normalized title hits so obvious matches are never dropped by token pooling.
  const titleMatches = resolvedIndex.titleOnly.get(queryTitle) ?? [];
  for (const track of titleMatches) {
    addCandidate(track);
  }

  for (const track of collectCandidates(queryTitle, queryArtist, resolvedIndex, 1000)) {
    addCandidate(track);
  }

  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const fetchInventoryTracks = async (authHeaderOrLimit?: string | number, limitMaybe?: number) => {
  const tracks: InventoryTrack[] = [];
  const authHeader = typeof authHeaderOrLimit === "string" ? authHeaderOrLimit : undefined;
  const limit = typeof authHeaderOrLimit === "number" ? authHeaderOrLimit : limitMaybe;
  const supabase = authHeader ? supabaseServer(authHeader) : supabaseAdmin;

  // Step 1: fetch inventory rows to determine the release ids in the library.
  // De-dupe by release_id so we don't create duplicate candidate tracks when multiple copies exist.
  const inventoryByReleaseId = new Map<number, number>();
  let inventoryPage = 0;
  while (true) {
    const from = inventoryPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("inventory")
      .select("id, release_id")
      .not("release_id", "is", null)
      .order("id", { ascending: true })
      .range(from, to);

    if (inventoryError) {
      throw new Error(`Failed loading inventory rows: ${inventoryError.message}`);
    }

    const rows = inventoryRows ?? [];
    for (const row of rows) {
      const inventoryId = typeof row.id === "number" ? row.id : null;
      const releaseId = typeof row.release_id === "number" ? row.release_id : null;
      if (!inventoryId || !releaseId) continue;
      const current = inventoryByReleaseId.get(releaseId);
      if (!current || inventoryId < current) {
        inventoryByReleaseId.set(releaseId, inventoryId);
      }
    }

    if (rows.length < PAGE_SIZE) break;
    inventoryPage += 1;
  }

  const releaseIds = Array.from(inventoryByReleaseId.keys());
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

    // Prefetch album artist for release_id (fallback when track_artist is missing).
    const releaseArtistById = new Map<number, string>();
    {
      const { data: releases, error: releaseError } = await supabase
        .from("releases")
        .select("id, master:masters(artist:artists(name))")
        .in("id", chunk);
      if (releaseError) {
        throw new Error(`Failed loading release artists: ${releaseError.message}`);
      }
      for (const row of releases ?? []) {
        const releaseId = typeof row.id === "number" ? row.id : null;
        const master = Array.isArray(row.master) ? row.master[0] : row.master;
        const artist = master && typeof master === "object" ? (master as { artist?: unknown }).artist : null;
        const artistRow = Array.isArray(artist) ? artist[0] : artist;
        const name = artistRow && typeof artistRow === "object" ? (artistRow as { name?: unknown }).name : null;
        if (releaseId && typeof name === "string" && name.trim().length > 0) {
          releaseArtistById.set(releaseId, name.trim());
        }
      }
    }

    let releaseTrackPage = 0;
    while (true) {
      const from = releaseTrackPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data: releaseTracks, error: releaseTracksError } = await supabase
        .from("release_tracks")
        .select("id, release_id, position, side, title_override, recordings ( id, title, track_artist )")
        .in("release_id", chunk)
        .order("id", { ascending: true })
        .range(from, to);

      if (releaseTracksError) {
        throw new Error(`Failed loading release tracks: ${releaseTracksError.message}`);
      }

      const rows = releaseTracks ?? [];
      for (const row of rows) {
        const releaseId = row.release_id;
        if (typeof releaseId !== "number") continue;
        const recording = Array.isArray(row.recordings) ? row.recordings[0] : row.recordings;
        const title = row.title_override || recording?.title;
        if (!title) continue;
        const albumArtist = releaseArtistById.get(releaseId) ?? null;
        const trackArtist = recording?.track_artist?.trim?.() ? recording.track_artist : null;
        const trackRow = {
          recording_id: recording?.id ?? null,
          title,
          artist: trackArtist || albumArtist || "Unknown Artist",
          side: row.side ?? null,
          position: row.position ?? null,
        };
        if (!trackMap.has(releaseId)) {
          trackMap.set(releaseId, []);
        }
        trackMap.get(releaseId)!.push(trackRow);
      }

      if (rows.length < PAGE_SIZE) break;
      releaseTrackPage += 1;
    }
  }

  // Step 3: project the preloaded tracks onto the de-duped inventory ids.
  for (const [releaseId, inventoryId] of inventoryByReleaseId) {
    const releaseTracks = trackMap.get(releaseId) ?? [];
    for (const track of releaseTracks) {
      tracks.push({
        inventory_id: inventoryId,
        recording_id: track.recording_id,
        title: track.title,
        artist: track.artist,
        side: track.side,
        position: track.position,
      });
      if (limit && tracks.length >= limit) {
        return tracks.slice(0, limit);
      }
    }
  }

  return tracks;
};

export const sanitizePlaylistName = (value?: string) => {
  const cleaned = value?.trim();
  if (!cleaned) return "Custom Playlist";
  return cleaned.slice(0, 80);
};

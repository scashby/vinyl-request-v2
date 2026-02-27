import Papa from "papaparse";
import { supabaseServer } from "src/lib/supabaseServer";

export type SourceRow = {
  title?: string;
  artist?: string;
  isrc?: string;
  spotifyUri?: string;
  spotifyTrackId?: string;
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
  isrc: string | null;
  canonTitle: string;
  canonArtist: string;
  titleTokens: Set<string>;
  artistTokens: Set<string>;
};

type InventoryIndex = {
  byIsrc: Map<string, InventoryTrack[]>;
  byExact: Map<string, InventoryTrack[]>;
  byTitle: Map<string, InventoryTrack[]>;
  byToken: Map<string, InventoryTrack[]>;
};

type ScoredTrack = {
  track: InventoryTrack;
  score: number;
  titleScore: number;
  artistScore: number;
};

const PAGE_SIZE = 1000;

const TITLE_KEYS = [
  "title",
  "track",
  "track_title",
  "track_name",
  "song",
  "song_title",
  "name",
];

const ARTIST_KEYS = [
  "artist",
  "artist_name",
  "track_artist",
  "artists",
  "performer",
  "band",
  "album_artist",
];

const ISRC_KEYS = ["isrc", "isrc_code", "track_isrc"];
const URI_KEYS = ["spotify_uri", "track_uri", "uri", "spotify_track_uri"];
const ID_KEYS = ["spotify_id", "spotify_track_id", "track_id", "id"];

const TITLE_NOISE = new Set([
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
]);

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

const normalizeIsrc = (value: unknown) => {
  const raw = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return raw.length >= 10 ? raw : "";
};

const maybeSpotifyUri = (value: unknown) => {
  const raw = strip(value);
  if (!raw) return "";
  if (/^spotify:track:[A-Za-z0-9]+$/i.test(raw)) return raw;
  if (/open\.spotify\.com\/track\//i.test(raw)) return raw;
  return "";
};

const trackIdFromSpotifyUri = (value: unknown) => {
  const raw = strip(value);
  if (!raw) return "";
  const uriMatch = raw.match(/^spotify:track:([A-Za-z0-9]+)$/i);
  if (uriMatch?.[1]) return uriMatch[1];
  const urlMatch = raw.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/i);
  if (urlMatch?.[1]) return urlMatch[1];
  return "";
};

const normalizeSpaces = (value: string) =>
  value
    .replace(/&/g, " and ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const canonicalTitle = (value: string) => {
  const lowered = normalizeSpaces(String(value ?? "").toLowerCase())
    .replace(/["'`]/g, "")
    .replace(/\((feat|featuring|ft)\.?[^)]*\)/g, "")
    .replace(/\[(feat|featuring|ft)\.?[^\]]*\]/g, "")
    .replace(/\(([^)]*version|[^)]*mix|[^)]*edit|[^)]*remaster[^)]*)\)/g, "")
    .replace(/\[([^\]]*version|[^\]]*mix|[^\]]*edit|[^\]]*remaster[^\]]*)\]/g, "")
    .replace(/\b(feat|featuring|ft)\.?\b.*$/, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = lowered
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !TITLE_NOISE.has(token))
    .filter((token) => {
      const year = Number(token);
      return !(Number.isInteger(year) && year >= 1900 && year <= 2099);
    });

  return tokens.join(" ").trim();
};

const canonicalArtist = (value: string) => {
  const lowered = normalizeSpaces(String(value ?? "").toLowerCase())
    .replace(/["'`]/g, "")
    .replace(/\((feat|featuring|ft)\.?[^)]*\)/g, "")
    .replace(/\[(feat|featuring|ft)\.?[^\]]*\]/g, "")
    .replace(/\b(feat|featuring|ft)\.?\b.*$/, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = lowered
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token !== "the");

  return tokens.join(" ").trim();
};

const tokenSet = (value: string) => {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  return new Set(tokens);
};

const setDice = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const token of a) {
    if (b.has(token)) inter += 1;
  }
  return (2 * inter) / (a.size + b.size);
};

const charDice = (a: string, b: string) => {
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

const similarity = (a: string, b: string) => {
  if (!a || !b) return 0;
  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  return Math.max(setDice(aTokens, bTokens), charDice(a, b));
};

const scoreCandidate = (rowTitle: string, rowArtist: string, track: InventoryTrack): ScoredTrack => {
  const titleScore = similarity(rowTitle, track.canonTitle);
  const artistScore = rowArtist ? similarity(rowArtist, track.canonArtist) : 0;

  const titleExact = rowTitle.length > 0 && rowTitle === track.canonTitle;
  const artistExact = rowArtist.length > 0 && rowArtist === track.canonArtist;

  let score = rowArtist ? titleScore * 0.72 + artistScore * 0.28 : titleScore;
  if (titleExact) score += 0.12;
  if (artistExact) score += 0.08;

  const titleTokenDelta = Math.abs(tokenSet(rowTitle).size - track.titleTokens.size);
  if (titleTokenDelta >= 5) score -= 0.06;

  return {
    track,
    titleScore,
    artistScore,
    score: Math.max(0, Math.min(1, score)),
  };
};

const toCandidate = (scored: ScoredTrack): MatchCandidate => ({
  track_key: scored.track.trackKey,
  inventory_id: scored.track.inventoryId,
  title: scored.track.title,
  artist: scored.track.artist,
  side: scored.track.side,
  position: scored.track.position,
  score: Number(scored.score.toFixed(3)),
});

const addMapList = <T>(map: Map<string, T[]>, key: string, value: T) => {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(value);
};

const firstFromKeys = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = strip(record[key]);
    if (value) return value;
  }
  return "";
};

const rowFromArray = (cells: string[]): SourceRow => {
  const c0 = strip(cells[0]);
  const c1 = strip(cells[1]);
  const c2 = strip(cells[2]);
  const c3 = strip(cells[3]);

  let title = "";
  let artist = "";
  let spotifyUri = maybeSpotifyUri(c0);
  let spotifyTrackId = trackIdFromSpotifyUri(c0);

  if (spotifyUri && c1) {
    title = c1;
    artist = c2;
  } else {
    title = c0;
    artist = c1;
    if (!spotifyUri) {
      spotifyUri = maybeSpotifyUri(c2) || maybeSpotifyUri(c3);
      if (!spotifyTrackId) spotifyTrackId = trackIdFromSpotifyUri(c2) || trackIdFromSpotifyUri(c3);
    }
  }

  const isrcCandidate = [c0, c1, c2, c3].map(normalizeIsrc).find(Boolean) ?? "";

  return {
    title: title || undefined,
    artist: artist || undefined,
    isrc: isrcCandidate || undefined,
    spotifyUri: spotifyUri || undefined,
    spotifyTrackId: spotifyTrackId || undefined,
  };
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
  const hasRecognizedHeaders =
    fields.some((field) => TITLE_KEYS.includes(field)) ||
    fields.some((field) => ARTIST_KEYS.includes(field)) ||
    fields.some((field) => ISRC_KEYS.includes(field)) ||
    fields.some((field) => URI_KEYS.includes(field));

  if (hasRecognizedHeaders) {
    const rows: SourceRow[] = [];

    for (const rawRow of headerProbe.data ?? []) {
      const record = rawRow as Record<string, unknown>;

      const title = firstFromKeys(record, TITLE_KEYS);
      const artist = firstFromKeys(record, ARTIST_KEYS);
      const isrc = normalizeIsrc(firstFromKeys(record, ISRC_KEYS));
      const spotifyUri = maybeSpotifyUri(firstFromKeys(record, URI_KEYS));

      const idCandidate = firstFromKeys(record, ID_KEYS);
      const spotifyTrackId =
        (idCandidate && !idCandidate.includes(" ") ? idCandidate : "") ||
        trackIdFromSpotifyUri(spotifyUri);

      const fallbackFields = fields.filter(Boolean);
      const fallback = rowFromArray(fallbackFields.map((field) => strip(record[field])));

      const row: SourceRow = {
        title: title || fallback.title,
        artist: artist || fallback.artist,
        isrc: isrc || fallback.isrc,
        spotifyUri: spotifyUri || fallback.spotifyUri,
        spotifyTrackId: spotifyTrackId || fallback.spotifyTrackId,
      };

      if (!strip(row.title)) continue;
      rows.push(row);
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
    if (!Array.isArray(candidate)) continue;
    const cells = candidate.map((cell) => strip(cell));
    const row = rowFromArray(cells);
    if (!strip(row.title)) continue;
    rows.push(row);
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
      .select("release_id, position, side, title_override, recordings ( id, title, track_artist, isrc )")
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

      const canonTitle = canonicalTitle(title);
      const canonArtist = canonicalArtist(artist);
      if (!canonTitle) continue;

      tracks.push({
        trackKey: `${inventoryId}:${position}`,
        inventoryId,
        title,
        artist,
        side: side || null,
        position,
        isrc: normalizeIsrc(recording?.isrc) || null,
        canonTitle,
        canonArtist,
        titleTokens: tokenSet(canonTitle),
        artistTokens: tokenSet(canonArtist),
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
  const byIsrc = new Map<string, InventoryTrack[]>();
  const byExact = new Map<string, InventoryTrack[]>();
  const byTitle = new Map<string, InventoryTrack[]>();
  const byToken = new Map<string, InventoryTrack[]>();

  for (const track of tracks) {
    const exactKey = `${track.canonTitle}::${track.canonArtist}`;
    addMapList(byExact, exactKey, track);
    addMapList(byTitle, track.canonTitle, track);

    for (const token of new Set([...track.titleTokens, ...track.artistTokens])) {
      addMapList(byToken, token, track);
    }

    if (track.isrc) {
      addMapList(byIsrc, track.isrc, track);
    }
  }

  return { byIsrc, byExact, byTitle, byToken };
};

const collectCandidates = (rowTitle: string, rowArtist: string, index: InventoryIndex): InventoryTrack[] => {
  const pool = new Map<string, InventoryTrack>();

  const titleMatches = index.byTitle.get(rowTitle) ?? [];
  for (const track of titleMatches) {
    pool.set(track.trackKey, track);
  }

  const rowTokens = new Set([...tokenSet(rowTitle), ...tokenSet(rowArtist)]);
  for (const token of rowTokens) {
    const tracks = index.byToken.get(token) ?? [];
    for (const track of tracks) {
      pool.set(track.trackKey, track);
      if (pool.size >= 900) break;
    }
    if (pool.size >= 900) break;
  }

  if (pool.size === 0) {
    const prefix = rowTitle.slice(0, 5);
    for (const [titleKey, tracks] of index.byTitle.entries()) {
      if (!prefix || !titleKey.startsWith(prefix)) continue;
      for (const track of tracks) {
        pool.set(track.trackKey, track);
      }
      if (pool.size >= 900) break;
    }
  }

  return Array.from(pool.values());
};

const chooseFromTitleMatches = (rowTitle: string, rowArtist: string, titleMatches: InventoryTrack[]) => {
  if (titleMatches.length === 0) return null;
  if (titleMatches.length === 1) return titleMatches[0];

  const scored = titleMatches
    .map((track) => scoreCandidate(rowTitle, rowArtist, track))
    .sort((a, b) => b.artistScore - a.artistScore || b.score - a.score);

  const best = scored[0];
  const second = scored[1];
  const margin = second ? best.artistScore - second.artistScore : best.artistScore;

  if (best.artistScore >= 0.72 && margin >= 0.08) {
    return best.track;
  }

  return null;
};

const shouldAutoMatch = (best: ScoredTrack, second?: ScoredTrack) => {
  const margin = second ? best.score - second.score : best.score;
  if (best.score >= 0.9) return true;
  if (best.score >= 0.84 && margin >= 0.07) return true;
  if (best.titleScore >= 0.96 && best.artistScore >= 0.62 && margin >= 0.09) return true;
  return false;
};

const matchRows = (rows: SourceRow[], index: InventoryIndex) => {
  const matchedTrackKeys: string[] = [];
  const missing: MissingRow[] = [];
  let fuzzyMatchedCount = 0;

  for (const row of rows) {
    const rawTitle = strip(row.title);
    const rawArtist = strip(row.artist);
    const normTitle = canonicalTitle(rawTitle);
    const normArtist = canonicalArtist(rawArtist);
    const normIsrc = normalizeIsrc(row.isrc);

    if (!normTitle) continue;

    if (normIsrc) {
      const isrcHits = index.byIsrc.get(normIsrc) ?? [];
      if (isrcHits.length > 0) {
        matchedTrackKeys.push(isrcHits[0].trackKey);
        continue;
      }
    }

    const exactHits = index.byExact.get(`${normTitle}::${normArtist}`) ?? [];
    if (exactHits.length > 0) {
      matchedTrackKeys.push(exactHits[0].trackKey);
      continue;
    }

    const titleMatches = index.byTitle.get(normTitle) ?? [];
    const chosenByTitle = chooseFromTitleMatches(normTitle, normArtist, titleMatches);
    if (chosenByTitle) {
      matchedTrackKeys.push(chosenByTitle.trackKey);
      fuzzyMatchedCount += 1;
      continue;
    }

    const scoredCandidates = collectCandidates(normTitle, normArtist, index)
      .map((track) => scoreCandidate(normTitle, normArtist, track))
      .filter((scored) => scored.score >= 0.34)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (scoredCandidates.length > 0 && shouldAutoMatch(scoredCandidates[0], scoredCandidates[1])) {
      matchedTrackKeys.push(scoredCandidates[0].track.trackKey);
      fuzzyMatchedCount += 1;
      continue;
    }

    missing.push({
      title: rawTitle || undefined,
      artist: rawArtist || undefined,
      candidates: scoredCandidates.map(toCandidate),
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
    .map((row) => ({
      title: strip(row.title),
      artist: strip(row.artist) || undefined,
      isrc: normalizeIsrc(row.isrc) || undefined,
      spotifyUri: maybeSpotifyUri(row.spotifyUri) || undefined,
      spotifyTrackId: strip(row.spotifyTrackId) || trackIdFromSpotifyUri(row.spotifyUri) || undefined,
    }))
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

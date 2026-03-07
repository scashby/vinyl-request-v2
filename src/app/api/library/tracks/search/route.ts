import { NextRequest, NextResponse } from "next/server";
import { getCachedInventoryIndex, searchInventoryCandidates } from "src/lib/vinylPlaylistImport";
import { getBingoDb } from "src/lib/bingoDb";
import { resolveTrackKeys } from "src/lib/bingoEngine";
import { buildPlaylistTrackKey, toSingle } from "src/lib/library/mappers";
import type { LibraryTrackSearchResult } from "src/lib/library/types";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

export const runtime = "nodejs";

type SearchMode = "smart" | "collection";

type CollectionTrackSearchRow = LibraryTrackSearchResult & {
  searchable: string;
  sort_position: number;
  album_media_type: string;
  track_format_facets: string[];
};

type CollectionTrackSearchCacheEntry = {
  expiresAt: number;
  rows: CollectionTrackSearchRow[];
};

const COLLECTION_TRACK_CACHE_TTL_MS = 2 * 60 * 1000;

const collectionTrackSearchCache: Record<string, CollectionTrackSearchCacheEntry | undefined> =
  (globalThis as { __collectionTrackSearchCache?: Record<string, CollectionTrackSearchCacheEntry | undefined> }).__collectionTrackSearchCache ?? {};
(globalThis as { __collectionTrackSearchCache?: Record<string, CollectionTrackSearchCacheEntry | undefined> }).__collectionTrackSearchCache = collectionTrackSearchCache;

function parseRequestedLimit(raw: string | null): number {
  if (raw === null || raw.trim().length === 0) return Number.MAX_SAFE_INTEGER;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.floor(parsed);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
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
}

function getCollectionSearchCacheKey(authHeader: string | undefined, includeForSale: boolean): string {
  const raw = String(authHeader ?? "").trim();
  if (!raw) return `public:${includeForSale ? "with-sale" : "no-sale"}`;
  const token = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : raw;
  const payload = decodeJwtPayload(token);
  const sub = typeof payload?.sub === "string" ? payload.sub.trim() : "";
  if (sub) return `user:${sub}:${includeForSale ? "with-sale" : "no-sale"}`;
  return `auth:unknown:${includeForSale ? "with-sale" : "no-sale"}`;
}

function isInvalidTrackPositionToken(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return normalized === "NAN" || normalized === "NULL" || normalized === "UNDEFINED";
}

function normalizeTrackPosition(position: string | null | undefined, fallback: number): string {
  const raw = String(position ?? "").trim();
  if (raw && !isInvalidTrackPositionToken(raw)) return raw;
  return String(fallback);
}

function getTrackPositionSortValue(position: string, side: string | null): number {
  const parsedSide = (side ?? position.trim().charAt(0)).toUpperCase();
  const sideWeight = parsedSide >= "A" && parsedSide <= "Z" ? parsedSide.charCodeAt(0) - 65 : 100;
  const match = position.match(/\d+/g);
  const number = match?.length ? Number(match[match.length - 1]) : 999;
  return sideWeight * 1000 + (Number.isNaN(number) ? 999 : number);
}

function canonicalizeFormatFacet(value: string): string | null {
  const token = value.trim().toLowerCase();
  if (!token) return null;

  const mapped: Array<[RegExp, string]> = [
    [/^vinyl$/, "Vinyl"],
    [/^cd$|^compact disc$/, "CD"],
    [/^cassette$|^cass$/, "Cassette"],
    [/^8[- ]?track cartridge$|^8[- ]?track$/, "8-Track"],
    [/^dvd$/, "DVD"],
    [/^all media$/, "All Media"],
    [/^box set$/, "Box Set"],
    [/^lp$/, "LP"],
    [/^ep$/, "EP"],
    [/^single$/, "Single"],
    [/^album$/, "Album"],
    [/^mini-album$/, "Mini-Album"],
    [/^maxi-single$/, "Maxi-Single"],
    [/^7"$/, "7\""],
    [/^10"$/, "10\""],
    [/^12"$/, "12\""],
    [/^45 rpm$|^45$/, "45 RPM"],
    [/^33 ?1\/3 rpm$|^33⅓ rpm$|^33 rpm$/, "33 RPM"],
    [/^78 rpm$|^78$/, "78 RPM"],
    [/^reissue$/, "Reissue"],
    [/^stereo$/, "Stereo"],
    [/^mono$/, "Mono"],
  ];

  for (const [regex, label] of mapped) {
    if (regex.test(token)) return label;
  }

  return null;
}

function buildTrackFormatFacets(mediaType: string | null, formatDetails: string[] | null): string[] {
  const rawTokens: string[] = [];
  if (mediaType) rawTokens.push(mediaType);

  for (const entry of formatDetails ?? []) {
    if (!entry) continue;
    rawTokens.push(entry);
    for (const part of entry.split(/[,/]/)) {
      const trimmed = part.trim();
      if (trimmed) rawTokens.push(trimmed);
    }
  }

  const facets = new Set<string>();
  for (const token of rawTokens) {
    const normalized = canonicalizeFormatFacet(token);
    if (normalized) facets.add(normalized);
  }

  return Array.from(facets);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => entry.length > 0);
}

function asNumber(value: unknown): number | null {
  const typed = Number(value);
  return Number.isFinite(typed) ? typed : null;
}

async function fetchCollectionTrackRowsFromLibraryAlbumsApi(request: NextRequest, authHeader: string | undefined, includeForSale: boolean): Promise<CollectionTrackSearchRow[]> {
  const pageSize = 80;
  const rows: CollectionTrackSearchRow[] = [];

  for (let page = 0; page < 1000; page += 1) {
    const url = new URL("/api/library/albums", request.url);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("includeTracks", "true");
    url.searchParams.set("includeForSale", includeForSale ? "true" : "false");

    const response = await fetch(url, {
      headers: {
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | { data?: Array<Record<string, unknown>>; hasMore?: boolean; error?: string }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "Failed to load albums");
    }

    const albums = Array.isArray(payload?.data) ? payload.data : [];
    if (albums.length === 0) break;

    for (const albumRow of albums) {
      const inventoryId = asNumber(albumRow.id);
      if (!inventoryId || inventoryId <= 0) continue;

      const release = asObject(toSingle(albumRow.release));
      const releaseId = asNumber(release?.id) ?? null;
      const mediaType = asString(release?.media_type);
      const formatDetails = asStringArray(release?.format_details);
      const trackFormatFacets = buildTrackFormatFacets(mediaType || null, formatDetails.length > 0 ? formatDetails : null);

      const master = asObject(toSingle(release?.master));
      const albumTitle = asString(master?.title);
      const masterArtist = asObject(toSingle(master?.artist));
      const albumArtist = asString(masterArtist?.name);

      const releaseTracksRaw = release && Array.isArray(release.release_tracks) ? release.release_tracks : [];
      for (let index = 0; index < releaseTracksRaw.length; index += 1) {
        const rawTrack = asObject(releaseTracksRaw[index]);
        if (!rawTrack) continue;

        const recording = asObject(toSingle(rawTrack.recording));
        const titleOverride = asString(rawTrack.title_override);
        const recordingTitle = asString(recording?.title);
        const trackTitle = titleOverride || recordingTitle;
        if (!trackTitle) continue;

        const trackArtist = asString(recording?.track_artist) || albumArtist;
        const side = asString(rawTrack.side).toUpperCase() || null;
        const position = normalizeTrackPosition(asString(rawTrack.position) || null, index + 1);
        const recordingId = asNumber(recording?.id);
        const trackKey = buildPlaylistTrackKey(inventoryId, position);

        const searchable = [
          trackTitle,
          trackArtist,
          albumTitle,
          albumArtist,
          position,
          side ?? "",
          mediaType,
          trackFormatFacets.join(" "),
        ]
          .join(" ")
          .toLowerCase();

        rows.push({
          track_key: trackKey,
          inventory_id: inventoryId,
          release_id: releaseId,
          recording_id: recordingId,
          position,
          side,
          track_title: trackTitle,
          track_artist: trackArtist || null,
          album_title: albumTitle || null,
          album_artist: albumArtist || null,
          score: null,
          searchable,
          sort_position: getTrackPositionSortValue(position, side),
          album_media_type: mediaType,
          track_format_facets: trackFormatFacets,
        });
      }
    }

    if (!payload?.hasMore) break;
  }

  rows.sort((a, b) => {
    const artistCompare = String(a.album_artist ?? "").localeCompare(String(b.album_artist ?? ""), undefined, { sensitivity: "base", numeric: true });
    if (artistCompare !== 0) return artistCompare;

    const albumCompare = String(a.album_title ?? "").localeCompare(String(b.album_title ?? ""), undefined, { sensitivity: "base", numeric: true });
    if (albumCompare !== 0) return albumCompare;

    if (a.sort_position !== b.sort_position) return a.sort_position - b.sort_position;

    const titleCompare = String(a.track_title ?? "").localeCompare(String(b.track_title ?? ""), undefined, { sensitivity: "base", numeric: true });
    if (titleCompare !== 0) return titleCompare;

    return (a.inventory_id ?? 0) - (b.inventory_id ?? 0);
  });

  return rows;
}

async function getCachedCollectionTrackRows(request: NextRequest, authHeader: string | undefined, includeForSale: boolean): Promise<CollectionTrackSearchRow[]> {
  const cacheKey = getCollectionSearchCacheKey(authHeader, includeForSale);
  const now = Date.now();
  const cached = collectionTrackSearchCache[cacheKey];
  if (cached && cached.expiresAt > now) {
    return cached.rows;
  }

  const rows = await fetchCollectionTrackRowsFromLibraryAlbumsApi(request, authHeader, includeForSale);
  collectionTrackSearchCache[cacheKey] = {
    expiresAt: now + COLLECTION_TRACK_CACHE_TTL_MS,
    rows,
  };
  return rows;
}

function applyCollectionMode(params: {
  rows: CollectionTrackSearchRow[];
  q: string;
  artist: string;
  mediaTypes: string[];
  formatDetails: string[];
  limit: number;
}): LibraryTrackSearchResult[] {
  const qLower = params.q.toLowerCase();
  const artistLower = params.artist.toLowerCase();
  const mediaTypeFilters = params.mediaTypes.map((value) => value.toLowerCase());
  const formatDetailFilters = params.formatDetails.map((value) => value.toLowerCase());

  const filtered = params.rows.filter((row) => {
    if (!row.searchable.includes(qLower)) return false;

    if (artistLower) {
      const artistSearchable = `${row.track_artist ?? ""} ${row.album_artist ?? ""}`.toLowerCase();
      if (!artistSearchable.includes(artistLower)) return false;
    }

    if (mediaTypeFilters.length > 0) {
      const mediaType = row.album_media_type.toLowerCase();
      if (!mediaTypeFilters.some((value) => mediaType.includes(value))) return false;
    }

    if (formatDetailFilters.length > 0) {
      const formatTokens = row.track_format_facets.map((value) => value.toLowerCase());
      if (!formatDetailFilters.some((value) => formatTokens.some((token) => token.includes(value)))) return false;
    }

    return true;
  });

  const limited = filtered.slice(0, params.limit === Number.MAX_SAFE_INTEGER ? undefined : params.limit);
  return limited.map((row) => ({
    track_key: row.track_key,
    inventory_id: row.inventory_id,
    release_id: row.release_id,
    recording_id: row.recording_id,
    position: row.position,
    side: row.side,
    track_title: row.track_title,
    track_artist: row.track_artist,
    album_title: row.album_title,
    album_artist: row.album_artist,
    score: row.score,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const artist = (url.searchParams.get("artist") ?? "").trim();
    const modeRaw = (url.searchParams.get("mode") ?? "").trim().toLowerCase();
    const mode: SearchMode = modeRaw === "collection" ? "collection" : "smart";
    const limit = parseRequestedLimit(url.searchParams.get("limit"));
    const mediaTypes = [
      ...url.searchParams.getAll("mediaType"),
      ...url.searchParams.getAll("mediaTypes"),
    ]
      .map((value) => value.trim())
      .filter(Boolean);
    const formatDetails = [
      ...url.searchParams.getAll("formatDetail"),
      ...url.searchParams.getAll("formatDetails"),
    ]
      .map((value) => value.trim())
      .filter(Boolean);
    const includeForSale = (url.searchParams.get("includeForSale") ?? "false").toLowerCase() === "true";

    if (!q) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }

    const authHeader = getAuthHeader(request);

    if (mode === "collection") {
      const tableRows = await getCachedCollectionTrackRows(request, authHeader, includeForSale);
      const results = applyCollectionMode({
        rows: tableRows,
        q,
        artist,
        mediaTypes,
        formatDetails,
        limit,
      });
      return NextResponse.json({ ok: true, results }, { status: 200 });
    }

    const smartLimit = limit === Number.MAX_SAFE_INTEGER ? 50 : limit;
    const index = await getCachedInventoryIndex(authHeader, { includeForSale });
    const candidates = await searchInventoryCandidates({
      title: q,
      artist,
      limit: smartLimit,
      mediaTypes,
      formatDetails,
      includeForSale,
    }, index);

    const db = getBingoDb();
    const keys = candidates
      .map((c) => (c.inventory_id ? buildPlaylistTrackKey(c.inventory_id, c.position) : ""))
      .filter((k) => k.length > 0);

    const resolved = await resolveTrackKeys(db, keys);
    const results: LibraryTrackSearchResult[] = candidates.map((candidate) => {
      const trackKey = candidate.inventory_id ? buildPlaylistTrackKey(candidate.inventory_id, candidate.position) : candidate.track_key;
      const patch = resolved.get(trackKey);
      return {
        track_key: trackKey,
        inventory_id: candidate.inventory_id ?? null,
        release_id: null,
        recording_id: null,
        position: patch?.position ?? candidate.position ?? null,
        side: patch?.side ?? candidate.side ?? null,
        track_title: patch?.track_title ?? candidate.title ?? null,
        track_artist: patch?.artist_name ?? candidate.artist ?? null,
        album_title: patch?.album_name ?? candidate.album_title ?? null,
        album_artist: null,
        score: candidate.score,
      };
    });

    const inventoryIds = Array.from(new Set(results.map((r) => r.inventory_id).filter((id): id is number => typeof id === "number")));
    if (inventoryIds.length > 0) {
      const supabase = supabaseServer(authHeader);
      const { data: rows } = await supabase
        .from("inventory")
        .select("id, release:releases(master:masters(artist:artists(name)))")
        .in("id", inventoryIds);

      const byId = new Map<number, string>();
      for (const row of rows ?? []) {
        const typedRow = row as { id?: unknown; release?: unknown } & Record<string, unknown>;
        const release = toSingle(typedRow.release) as Record<string, unknown> | null;
        const master = toSingle(release?.master as unknown) as Record<string, unknown> | null;
        const artistRow = toSingle(master?.artist as unknown) as { name?: string } | null;
        if (typeof typedRow.id === "number" && artistRow?.name) {
          byId.set(typedRow.id, artistRow.name);
        }
      }
      results.forEach((r) => {
        if (r.inventory_id && byId.has(r.inventory_id)) {
          r.album_artist = byId.get(r.inventory_id) ?? null;
        }
      });
    }

    return NextResponse.json({ ok: true, results: results.slice(0, smartLimit) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

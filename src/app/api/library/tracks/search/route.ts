import { NextRequest, NextResponse } from "next/server";
import { getCachedInventoryIndex, searchInventoryCandidates } from "src/lib/vinylPlaylistImport";
import { getBingoDb } from "src/lib/bingoDb";
import { resolveTrackKeys } from "src/lib/bingoEngine";
import { buildPlaylistTrackKey, toSingle } from "src/lib/library/mappers";
import type { LibraryTrackSearchResult } from "src/lib/library/types";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

export const runtime = "nodejs";

type SearchMode = "smart" | "collection";

function normalizeSearchText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rankCollectionRow(row: LibraryTrackSearchResult, query: string, tokens: string[]): number | null {
  const trackTitle = normalizeSearchText(row.track_title);
  const trackArtist = normalizeSearchText(row.track_artist);
  const albumTitle = normalizeSearchText(row.album_title);
  const albumArtist = normalizeSearchText(row.album_artist);
  const position = normalizeSearchText(row.position);
  const side = normalizeSearchText(row.side);
  const combined = `${trackTitle} ${trackArtist} ${albumTitle} ${albumArtist} ${position} ${side}`.trim();

  const phraseMatch = query.length > 0 && combined.includes(query);
  const allTokensMatch = tokens.length > 0 && tokens.every((token) => combined.includes(token));
  if (!phraseMatch && !allTokensMatch) return null;

  let rank = 0;

  if (trackArtist === query) rank += 140;
  else if (trackArtist.startsWith(query)) rank += 95;
  else if (trackArtist.includes(query)) rank += 70;
  else if (albumArtist === query) rank += 55;
  else if (albumArtist.includes(query)) rank += 35;

  if (trackTitle === query) rank += 105;
  else if (trackTitle.startsWith(query)) rank += 80;
  else if (trackTitle.includes(query)) rank += 58;

  if (albumTitle === query) rank += 50;
  else if (albumTitle.startsWith(query)) rank += 34;
  else if (albumTitle.includes(query)) rank += 22;

  rank += phraseMatch ? 30 : 12;
  rank += Math.min(tokens.length, 6);

  if (typeof row.score === "number" && Number.isFinite(row.score)) {
    rank += row.score * 10;
  }

  return rank;
}

function applyCollectionMode(rows: LibraryTrackSearchResult[], q: string, limit: number): LibraryTrackSearchResult[] {
  const normalizedQuery = normalizeSearchText(q);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!normalizedQuery) return [];

  return rows
    .map((row) => ({ row, rank: rankCollectionRow(row, normalizedQuery, tokens) }))
    .filter((entry): entry is { row: LibraryTrackSearchResult; rank: number } => entry.rank !== null)
    .sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;

      const artistCompare = String(a.row.track_artist ?? "").localeCompare(String(b.row.track_artist ?? ""));
      if (artistCompare !== 0) return artistCompare;

      const albumCompare = String(a.row.album_title ?? "").localeCompare(String(b.row.album_title ?? ""));
      if (albumCompare !== 0) return albumCompare;

      const positionCompare = String(a.row.position ?? "").localeCompare(String(b.row.position ?? ""));
      if (positionCompare !== 0) return positionCompare;

      return String(a.row.track_title ?? "").localeCompare(String(b.row.track_title ?? ""));
    })
    .slice(0, limit)
    .map((entry) => entry.row);
}

function parseRequestedLimit(raw: string | null): number {
  if (raw === null || raw.trim().length === 0) return Number.MAX_SAFE_INTEGER;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const artist = (url.searchParams.get("artist") ?? "").trim();
    const modeRaw = (url.searchParams.get("mode") ?? "").trim().toLowerCase();
    const mode: SearchMode = modeRaw === "collection" ? "collection" : "smart";
    const limit = parseRequestedLimit(url.searchParams.get("limit"));
    const candidateLimit = mode === "collection"
      ? Math.max(limit, 200)
      : limit;
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
    const index = await getCachedInventoryIndex(authHeader, { includeForSale });
    const candidates = await searchInventoryCandidates({
      title: q,
      artist,
      limit: candidateLimit,
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

    // Attempt to fill album artist from masters lookup (best effort).
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

    const output = mode === "collection" ? applyCollectionMode(results, q, limit) : results.slice(0, limit);
    return NextResponse.json({ ok: true, results: output }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

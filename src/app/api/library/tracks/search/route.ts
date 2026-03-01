import { NextRequest, NextResponse } from "next/server";
import { getCachedInventoryIndex, searchInventoryCandidates } from "src/lib/vinylPlaylistImport";
import { getBingoDb } from "src/lib/bingoDb";
import { resolveTrackKeys } from "src/lib/bingoEngine";
import { buildPlaylistTrackKey, toSingle } from "src/lib/library/mappers";
import type { LibraryTrackSearchResult } from "src/lib/library/types";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const artist = (url.searchParams.get("artist") ?? "").trim();
    const limit = Math.min(25, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
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

    if (!q) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }

    const authHeader = getAuthHeader(request);
    const index = await getCachedInventoryIndex(authHeader);
    const candidates = await searchInventoryCandidates({ title: q, artist, limit, mediaTypes, formatDetails }, index);

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
        album_title: patch?.album_name ?? null,
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

    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

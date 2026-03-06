import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function parseLimit(raw: string | null): number | null {
  if (raw === null || raw.trim().length === 0) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const artist = (request.nextUrl.searchParams.get("artist") ?? "").trim();
  const modeRaw = (request.nextUrl.searchParams.get("mode") ?? "collection").trim().toLowerCase();
  const mode = modeRaw === "smart" ? "smart" : "collection";
  const includeForSale = (request.nextUrl.searchParams.get("includeForSale") ?? "false").toLowerCase() === "true";
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  if (!q) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const proxyUrl = new URL("/api/library/tracks/search", request.url);
  proxyUrl.searchParams.set("q", q);
  if (limit !== null) proxyUrl.searchParams.set("limit", String(limit));
  proxyUrl.searchParams.set("mode", mode);
  proxyUrl.searchParams.set("includeForSale", includeForSale ? "true" : "false");
  if (artist) proxyUrl.searchParams.set("artist", artist);

  const response = await fetch(proxyUrl, {
    headers: {
      ...(request.headers.get("authorization") ? { authorization: request.headers.get("authorization") as string } : {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | { results?: Array<Record<string, unknown>>; error?: string }
    | null;
  if (!response.ok) {
    return NextResponse.json({ error: payload?.error ?? "Inventory search failed" }, { status: response.status });
  }

  const results = Array.isArray(payload?.results) ? payload.results : [];
  const mapped = results
    .map((row) => ({
      inventory_id: Number(row.inventory_id),
      release_id: Number.isFinite(Number(row.release_id)) ? Number(row.release_id) : null,
      release_track_id: null,
      artist: typeof row.track_artist === "string" && row.track_artist.trim().length > 0
        ? row.track_artist.trim()
        : (typeof row.album_artist === "string" ? row.album_artist.trim() : ""),
      album: typeof row.album_title === "string" ? row.album_title.trim() : "",
      title: typeof row.track_title === "string" ? row.track_title.trim() : "",
      side: typeof row.side === "string" && row.side.trim().length > 0 ? row.side.trim() : null,
      position: typeof row.position === "string" && row.position.trim().length > 0 ? row.position.trim() : null,
      track_key: typeof row.track_key === "string" ? row.track_key : null,
      score: Number.isFinite(Number(row.score)) ? Number(row.score) : null,
    }))
    .filter((row) => Number.isFinite(row.inventory_id) && row.inventory_id > 0 && row.title.length > 0)
    .slice(0, limit ?? undefined);

  return NextResponse.json({ data: mapped }, { status: 200 });
}

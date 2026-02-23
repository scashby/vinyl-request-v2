import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { resolveTrackKeys } from "src/lib/bingoEngine";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const playlistId = Number(id);
  if (!Number.isFinite(playlistId) || playlistId <= 0) {
    return NextResponse.json({ error: "Invalid playlist id" }, { status: 400 });
  }

  const db = getBingoDb();

  const { data, error } = await db
    .from("collection_playlist_items")
    .select("track_key, sort_order")
    .eq("playlist_id", playlistId)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const typed = (data ?? []) as Array<{ track_key: string | null; sort_order: number | null }>;
  const keys = typed
    .map((row) => String(row.track_key ?? "").trim())
    .filter((value) => value.length > 0);

  try {
    const resolved = await resolveTrackKeys(db, keys);
    const items = typed.map((row, index) => {
      const trackKey = String(row.track_key ?? "").trim();
      const patch = trackKey ? resolved.get(trackKey) : undefined;
      return {
        track_key: trackKey,
        sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
        track_title: patch?.track_title ?? null,
        artist_name: patch?.artist_name ?? null,
        album_name: patch?.album_name ?? null,
        side: patch?.side ?? null,
        position: patch?.position ?? null,
      };
    });
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch {
    const items = typed.map((row, index) => ({
      track_key: String(row.track_key ?? "").trim(),
      sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
      track_title: null,
      artist_name: null,
      album_name: null,
      side: null,
      position: null,
    }));
    return NextResponse.json({ ok: true, items, partial: true }, { status: 200 });
  }
}


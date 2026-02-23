import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { toSingle } from "src/lib/library/mappers";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ inventoryId: string }> }) {
  try {
    const { inventoryId } = await context.params;
    const id = Number(inventoryId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid inventoryId" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: inventory, error: inventoryError } = await db
      .from("inventory")
      .select("id, release_id, release:releases(id, master:masters(title, artist:artists(name)))")
      .eq("id", id)
      .single();

    if (inventoryError || !inventory) {
      return NextResponse.json({ error: inventoryError?.message || "Album not found" }, { status: 404 });
    }

    const releaseId = inventory.release_id as number | null;
    if (!releaseId) {
      return NextResponse.json({ ok: true, items: [], release_id: null }, { status: 200 });
    }

    const { data: tracks, error } = await db
      .from("release_tracks")
      .select(
        `id,
         release_id,
         recording_id,
         position,
         side,
         title_override,
         recording:recordings (
           id,
           title,
           duration_seconds,
           track_artist,
           lyrics,
           lyrics_url,
           credits,
           notes
         )`
      )
      .eq("release_id", releaseId)
      .order("position", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const release = toSingle(inventory.release);
    const master = toSingle(release?.master);
    const artist = toSingle(master?.artist);

    return NextResponse.json(
      {
        ok: true,
        inventory_id: inventory.id,
        release_id: releaseId,
        album_title: master?.title ?? null,
        album_artist: artist?.name ?? null,
        items: tracks ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tracks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


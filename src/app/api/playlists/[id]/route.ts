import { NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const playlistId = Number(id);
    if (!Number.isFinite(playlistId) || playlistId <= 0) {
      return NextResponse.json({ error: "Invalid playlist id" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    // Detach any foreign-key references that might block deletion.
    const detachRes = await db.from("bingo_sessions").update({ playlist_id: null }).eq("playlist_id", playlistId);
    if (detachRes?.error) {
      // Older installs may have playlist_id NOT NULL; fall back to deleting sessions for this playlist.
      const deleteSessionsRes = await db.from("bingo_sessions").delete().eq("playlist_id", playlistId);
      if (deleteSessionsRes?.error) {
        return NextResponse.json(
          { error: `Failed to detach/delete Bingo sessions referencing this playlist: ${deleteSessionsRes.error.message}` },
          { status: 500 }
        );
      }
    }

    const { error: itemsError } = await db
      .from("collection_playlist_items")
      .delete()
      .eq("playlist_id", playlistId);
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const { error: deleteError } = await db.from("collection_playlists").delete().eq("id", playlistId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete playlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

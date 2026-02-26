import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const countRows = async (db: any, table: string, apply?: (q: any) => any) => {
  let query = db.from(table).select("*", { head: true, count: "exact" });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }
  return typeof count === "number" ? count : 0;
};

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const req = _req as Request;
    const { id } = await context.params;
    const playlistId = Number(id);
    if (!Number.isFinite(playlistId) || playlistId <= 0) {
      return NextResponse.json({ error: "Invalid playlist id" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseServer(getAuthHeader(req)) as any;

    const before = {
      playlist_exists: (await countRows(db, "collection_playlists", (q) => q.eq("id", playlistId))) > 0,
      playlist_items: await countRows(db, "collection_playlist_items", (q) => q.eq("playlist_id", playlistId)),
      bingo_sessions_with_playlist: await countRows(db, "bingo_sessions", (q) => q.eq("playlist_id", playlistId)),
      supabase_mode: "publishable",
    };

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

    const after = {
      playlist_exists: (await countRows(db, "collection_playlists", (q) => q.eq("id", playlistId))) > 0,
      playlist_items: await countRows(db, "collection_playlist_items", (q) => q.eq("playlist_id", playlistId)),
      bingo_sessions_with_playlist: await countRows(db, "bingo_sessions", (q) => q.eq("playlist_id", playlistId)),
    };

    if (before.playlist_exists && after.playlist_exists) {
      return NextResponse.json(
        {
          error: "Delete executed but playlist still exists.",
          hint: "This usually means the server is not using a Supabase service_role key or RLS is blocking deletes.",
          before,
          after,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, before, after }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete playlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
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

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const confirm = (url.searchParams.get("confirm") ?? "").trim().toLowerCase();
    if (confirm !== "yes") {
      return NextResponse.json(
        { error: "Missing confirmation. Pass ?confirm=yes to delete all playlists." },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseServer(getAuthHeader(request)) as any;

    const { data: visiblePlaylists, error: visibleError } = await db
      .from("collection_playlists")
      .select("id");
    if (visibleError) {
      return NextResponse.json({ error: visibleError.message }, { status: 500 });
    }
    const playlistIds = (visiblePlaylists ?? [])
      .map((row: { id?: unknown }) => (typeof row?.id === "number" ? row.id : null))
      .filter((id: number | null): id is number => typeof id === "number" && id > 0);

    const before = {
      playlists: await countRows(db, "collection_playlists"),
      playlist_items: await countRows(db, "collection_playlist_items"),
      bingo_sessions_with_playlist: await countRows(db, "bingo_sessions", (q) => q.not("playlist_id", "is", null)),
      supabase_mode: "publishable",
      visible_playlist_ids: playlistIds.slice(0, 50),
    };

    // Detach any foreign-key references that might block deletion.
    const detachRes = await db.from("bingo_sessions").update({ playlist_id: null }).not("playlist_id", "is", null);
    if (detachRes?.error) {
      // Older installs may have playlist_id NOT NULL; fall back to deleting sessions.
      const deleteSessionsRes = await db.from("bingo_sessions").delete().not("id", "is", null);
      if (deleteSessionsRes?.error) {
        return NextResponse.json(
          { error: `Failed to detach/delete Bingo sessions referencing playlists: ${deleteSessionsRes.error.message}` },
          { status: 500 }
        );
      }
    }

    const { data: deletedItems, error: itemsError } = await db
      .from("collection_playlist_items")
      .delete()
      .in("playlist_id", playlistIds)
      .select("id");
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const { data: deletedPlaylists, error: playlistsError } = await db
      .from("collection_playlists")
      .delete()
      .in("id", playlistIds)
      .select("id");
    if (playlistsError) {
      return NextResponse.json({ error: playlistsError.message }, { status: 500 });
    }

    const after = {
      playlists: await countRows(db, "collection_playlists"),
      playlist_items: await countRows(db, "collection_playlist_items"),
      bingo_sessions_with_playlist: await countRows(db, "bingo_sessions", (q) => q.not("playlist_id", "is", null)),
      deleted: {
        playlists: Array.isArray(deletedPlaylists) ? deletedPlaylists.length : 0,
        playlist_items: Array.isArray(deletedItems) ? deletedItems.length : 0,
      },
    };

    const deletedPlaylistCount = Array.isArray(deletedPlaylists) ? deletedPlaylists.length : 0;
    if (playlistIds.length > 0 && deletedPlaylistCount === 0) {
      return NextResponse.json(
        {
          error: "Delete All could not delete any playlists (0 rows affected).",
          hint: "This is almost always a missing RLS DELETE policy on collection_playlists / collection_playlist_items.",
          before,
          after,
        },
        { status: 403 }
      );
    }

    if (before.playlists > 0 && after.playlists >= before.playlists) {
      return NextResponse.json(
        {
          error: "Delete All executed but playlists were not removed.",
          hint: "This usually means the server is not using a Supabase service_role key or RLS is blocking deletes.",
          before,
          after,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, before, after }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete playlists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

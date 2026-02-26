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

    const before = {
      playlists: await countRows(db, "collection_playlists"),
      playlist_items: await countRows(db, "collection_playlist_items"),
      bingo_sessions_with_playlist: await countRows(db, "bingo_sessions", (q) => q.not("playlist_id", "is", null)),
      supabase_mode: "publishable",
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

    const { error: itemsError } = await db.from("collection_playlist_items").delete().not("playlist_id", "is", null);
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const { error: playlistsError } = await db.from("collection_playlists").delete().not("id", "is", null);
    if (playlistsError) {
      return NextResponse.json({ error: playlistsError.message }, { status: 500 });
    }

    const after = {
      playlists: await countRows(db, "collection_playlists"),
      playlist_items: await countRows(db, "collection_playlist_items"),
      bingo_sessions_with_playlist: await countRows(db, "bingo_sessions", (q) => q.not("playlist_id", "is", null)),
    };

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

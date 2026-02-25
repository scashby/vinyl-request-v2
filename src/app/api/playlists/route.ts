import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

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
    const db = supabaseAdmin as any;

    // Detach any foreign-key references that might block deletion.
    await db.from("bingo_sessions").update({ playlist_id: null }).not("playlist_id", "is", null);

    const { error: itemsError } = await db.from("collection_playlist_items").delete().neq("playlist_id", 0);
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const { error: playlistsError } = await db.from("collection_playlists").delete().neq("id", 0);
    if (playlistsError) {
      return NextResponse.json({ error: playlistsError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete playlists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


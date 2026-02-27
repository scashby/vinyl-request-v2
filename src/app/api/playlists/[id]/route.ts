import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

export const runtime = "nodejs";

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const playlistId = Number(id);

    if (!Number.isFinite(playlistId) || playlistId <= 0) {
      return NextResponse.json({ error: "Invalid playlist id" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseServer(getAuthHeader(req)) as any;

    const { data: beforeRow, error: beforeError } = await db
      .from("collection_playlists")
      .select("id")
      .eq("id", playlistId)
      .maybeSingle();

    if (beforeError) {
      return NextResponse.json({ error: beforeError.message }, { status: 500 });
    }

    const existedBefore = !!beforeRow?.id;

    const { data: deletedRows, error: deleteError } = await db
      .from("collection_playlists")
      .delete()
      .eq("id", playlistId)
      .select("id");

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const deletedCount = Array.isArray(deletedRows) ? deletedRows.length : 0;

    const { data: afterRow, error: afterError } = await db
      .from("collection_playlists")
      .select("id")
      .eq("id", playlistId)
      .maybeSingle();

    if (afterError) {
      return NextResponse.json({ error: afterError.message }, { status: 500 });
    }

    const existsAfter = !!afterRow?.id;

    if (existedBefore && deletedCount === 0) {
      return NextResponse.json(
        {
          error: "Playlist delete was blocked (0 rows deleted).",
          hint: "RLS delete policy on collection_playlists is likely missing for this user/role.",
          details: { playlistId, existedBefore, deletedCount, existsAfter },
        },
        { status: 403 }
      );
    }

    if (existedBefore && existsAfter) {
      return NextResponse.json(
        {
          error: "Playlist still exists after delete.",
          details: { playlistId, existedBefore, deletedCount, existsAfter },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        deletedCount,
        playlistId,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete playlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

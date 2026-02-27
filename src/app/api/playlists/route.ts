import { NextRequest, NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

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
    const db = supabaseServer(getAuthHeader(request)) as any;

    const { data: existingRows, error: existingError } = await db
      .from("collection_playlists")
      .select("id")
      .order("id", { ascending: true });

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const playlistIds = (existingRows ?? [])
      .map((row: { id?: unknown }) => (typeof row.id === "number" ? row.id : null))
      .filter((id: number | null): id is number => typeof id === "number" && id > 0);

    if (playlistIds.length === 0) {
      return NextResponse.json({ ok: true, deletedCount: 0, beforeCount: 0, afterCount: 0 }, { status: 200 });
    }

    const { data: deletedRows, error: deleteError } = await db
      .from("collection_playlists")
      .delete()
      .in("id", playlistIds)
      .select("id");

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const deletedCount = Array.isArray(deletedRows) ? deletedRows.length : 0;

    const { count: afterCount, error: afterError } = await db
      .from("collection_playlists")
      .select("*", { head: true, count: "exact" });

    if (afterError) {
      return NextResponse.json({ error: afterError.message }, { status: 500 });
    }

    if (deletedCount === 0 && playlistIds.length > 0) {
      return NextResponse.json(
        {
          error: "Delete all was blocked (0 rows deleted).",
          hint: "RLS delete policy on collection_playlists is likely missing for this user/role.",
          details: {
            beforeCount: playlistIds.length,
            deletedCount,
            afterCount: typeof afterCount === "number" ? afterCount : null,
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        beforeCount: playlistIds.length,
        deletedCount,
        afterCount: typeof afterCount === "number" ? afterCount : 0,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete playlists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

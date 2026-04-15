import { NextRequest, NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = supabaseServer(getAuthHeader(request));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('playlists')
    .select('id, platform, embed_url')
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, {
    status: 200,
    headers: { 'Cache-Control': 's-maxage=60' }
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, platform, embed_url } = body;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseServer(getAuthHeader(request)) as any;

    const { error } = await supabase
      .from("playlists")
      .update({ platform, embed_url })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

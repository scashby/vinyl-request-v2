import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

// GET /api/library/albums/counts
// Returns format counts: [{ media_type, count }]
//
// GET /api/library/albums/counts?mediaType=Vinyl
// Returns vinyl sublocation counts: [{ location, count }]
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const mediaType = (url.searchParams.get("mediaType") ?? "").trim();

    if (mediaType) {
      // Sublocation counts for a specific media type — fetch all and filter in JS
      // (PostgREST nested-table eq filters are unreliable for aliased relations)
      const { data, error } = await supabaseAdmin
        .from("inventory")
        .select("location, status, releases(media_type)")
        .neq("status", "for_sale");

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const rel = Array.isArray(row.releases) ? row.releases[0] : row.releases;
        const mt = (rel as { media_type?: string } | null)?.media_type ?? "Unknown";
        if (mt !== mediaType) continue;
        const loc = (row.location as string | null) ?? "Unknown";
        counts[loc] = (counts[loc] ?? 0) + 1;
      }
      return NextResponse.json({
        ok: true,
        data: Object.entries(counts).map(([location, count]) => ({ location, count })),
      });
    }

    // Format counts — fetch all non-sale inventory and group by media_type in JS
    const { data, error } = await supabaseAdmin
      .from("inventory")
      .select("status, releases(media_type)")
      .neq("status", "for_sale");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const rel = Array.isArray(row.releases) ? row.releases[0] : row.releases;
      const mt = (rel as { media_type?: string } | null)?.media_type ?? "Unknown";
      counts[mt] = (counts[mt] ?? 0) + 1;
    }
    return NextResponse.json({
      ok: true,
      data: Object.entries(counts).map(([media_type, count]) => ({ media_type, count })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load counts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

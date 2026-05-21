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
      // Sublocation counts for a specific media type (e.g. Vinyl → location breakdown)
      const { data, error } = await supabaseAdmin
        .from("inventory")
        .select("location, release:releases!inner(media_type)")
        .eq("release.media_type", mediaType)
        .neq("status", "for_sale");

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const loc = (row.location as string | null) ?? "Unknown";
        counts[loc] = (counts[loc] ?? 0) + 1;
      }
      return NextResponse.json({ ok: true, data: Object.entries(counts).map(([location, count]) => ({ location, count })) });
    }

    // Format counts across all non-sale inventory
    const { data, error } = await supabaseAdmin
      .from("inventory")
      .select("release:releases!inner(media_type)")
      .neq("status", "for_sale");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const rel = Array.isArray(row.release) ? row.release[0] : row.release;
      const mt = (rel as { media_type?: string } | null)?.media_type ?? "Unknown";
      counts[mt] = (counts[mt] ?? 0) + 1;
    }
    return NextResponse.json({ ok: true, data: Object.entries(counts).map(([media_type, count]) => ({ media_type, count })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load counts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

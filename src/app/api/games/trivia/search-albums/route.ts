// @ts-nocheck — masters table not in TriviaDatabase; use supabaseAdmin directly
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const { data, error } = await (supabaseAdmin as unknown as { from: (t: string) => unknown })
    .from("masters")
    .select("id, title, artists:main_artist_id(name)")
    .ilike("title", `%${q}%`)
    .order("title", { ascending: true })
    .limit(20) as unknown as Promise<{
      data: Array<{ id: number; title: string; artists: { name: string } | null }> | null;
      error: { message: string } | null;
    }>;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = (data ?? []).map((m) => ({
    id: m.id,
    label: m.artists?.name ? `${m.title} — ${m.artists.name}` : m.title,
  }));

  return NextResponse.json({ data: results });
}

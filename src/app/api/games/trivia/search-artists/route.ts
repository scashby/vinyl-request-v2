// @ts-nocheck — artists table not in TriviaDatabase; use supabaseAdmin directly
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const { data, error } = await (supabaseAdmin as unknown as { from: (t: string) => unknown })
    .from("artists")
    .select("id, name")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(20) as unknown as Promise<{
      data: Array<{ id: number; name: string }> | null;
      error: { message: string } | null;
    }>;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = (data ?? []).map((a) => ({ id: a.id, label: a.name }));
  return NextResponse.json({ data: results });
}

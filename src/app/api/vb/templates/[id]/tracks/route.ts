import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin as any;
  const { id } = await context.params;
  const templateId = Number(id);

  if (!Number.isFinite(templateId)) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }

  const { data, error } = await db
    .from("vb_template_tracks")
    .select("id, template_id, track_title, artist_name, album_name, side, position, sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

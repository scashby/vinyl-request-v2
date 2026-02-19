import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const templateId = Number(params.id);

  if (!Number.isFinite(templateId)) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("game_template_items")
    .select("id, template_id, inventory_id, title, artist, side, position, sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = (data ?? []).map((item, index) => ({
    ...item,
    track_title: item.title,
    artist_name: item.artist,
    album_name: null,
    column_letter: ["B", "I", "N", "G", "O"][index % 5],
  }));

  return NextResponse.json({ data: normalized }, { status: 200 });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("game_templates")
    .select("id, name, description, source, setlist_mode, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withCounts = await Promise.all(
    (data ?? []).map(async (template) => {
      const { count } = await supabaseAdmin
        .from("game_template_items")
        .select("id", { count: "exact", head: true })
        .eq("template_id", template.id);

      return {
        ...template,
        item_count: count ?? 0,
      };
    })
  );

  return NextResponse.json({ data: withCounts }, { status: 200 });
}

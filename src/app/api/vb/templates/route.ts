import { NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const db = supabaseAdmin as any;

  const { data, error } = await db
    .from("vb_templates")
    .select("id, name, description, source, setlist_mode, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = await Promise.all(
    (data ?? []).map(async (template: any) => {
      const { count } = await db
        .from("vb_template_tracks")
        .select("id", { count: "exact", head: true })
        .eq("template_id", template.id);

      return { ...template, track_count: count ?? 0 };
    })
  );

  return NextResponse.json({ data: rows }, { status: 200 });
}

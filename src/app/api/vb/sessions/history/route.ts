import { NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("vb_sessions")
    .select("id, created_at, status, session_code, vb_templates ( name )")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mapped = await Promise.all(
    (data ?? []).map(async (row: any) => {
      const { count } = await db
        .from("vb_session_calls")
        .select("id", { count: "exact", head: true })
        .eq("session_id", row.id)
        .eq("status", "played");

      return {
        id: row.id,
        created_at: row.created_at,
        status: row.status,
        session_code: row.session_code,
        playlist_name: row.vb_templates?.name ?? "Unknown",
        calls_played: count ?? 0,
      };
    })
  );

  return NextResponse.json({ data: mapped }, { status: 200 });
}

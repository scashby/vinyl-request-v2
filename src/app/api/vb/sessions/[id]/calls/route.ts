import { NextRequest, NextResponse } from "next/server";
import { getColumnLetter } from "src/lib/vbEngine";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin as any;
  const { id } = await context.params;
  const sessionId = Number(id);

  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const { data, error } = await db
    .from("vb_session_calls")
    .select("id, call_index, status, called_at, vb_template_tracks ( id, track_title, artist_name, album_name )")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const normalized = (data ?? []).map((row: any) => ({
    id: row.id,
    call_index: row.call_index,
    status: row.status,
    called_at: row.called_at,
    column_letter: getColumnLetter(row.call_index),
    track_title: row.vb_template_tracks?.track_title ?? "",
    artist_name: row.vb_template_tracks?.artist_name ?? "",
    album_name: row.vb_template_tracks?.album_name ?? null,
  }));

  return NextResponse.json({ data: normalized }, { status: 200 });
}

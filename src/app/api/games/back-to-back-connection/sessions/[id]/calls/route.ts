import { NextRequest, NextResponse } from "next/server";
import { getBackToBackConnectionDb } from "src/lib/backToBackConnectionDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getBackToBackConnectionDb();
  const { data, error } = await db
    .from("b2bc_session_calls")
    .select(
      "call_index, round_number, track_a_artist, track_a_title, track_a_source_label, track_b_artist, track_b_title, track_b_source_label, accepted_connection, accepted_detail, host_notes"
    )
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    call_index: row.call_index,
    round_number: row.round_number,
    artist: `${row.track_a_artist} -> ${row.track_b_artist}`,
    title: `${row.track_a_title} -> ${row.track_b_title}`,
    source_label: [row.track_a_source_label, row.track_b_source_label].filter(Boolean).join(" | ") || null,
    detail: [row.accepted_connection, row.accepted_detail].filter(Boolean).join(" | ") || null,
    host_notes: row.host_notes,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

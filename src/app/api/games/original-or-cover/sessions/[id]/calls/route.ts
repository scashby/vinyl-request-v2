import { NextRequest, NextResponse } from "next/server";
import { getOriginalOrCoverDb } from "src/lib/originalOrCoverDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getOriginalOrCoverDb();
  const { data, error } = await db
    .from("ooc_session_calls")
    .select("call_index, round_number, spin_artist, track_title, original_artist, is_cover, source_label, host_notes")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    call_index: row.call_index,
    round_number: row.round_number,
    artist: row.spin_artist,
    title: row.track_title,
    source_label: row.source_label,
    detail: `${row.is_cover ? "Cover" : "Original"} | Original artist: ${row.original_artist}`,
    host_notes: row.host_notes,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

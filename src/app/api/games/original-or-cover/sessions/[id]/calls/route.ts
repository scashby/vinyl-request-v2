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
    .select(
      "id, session_id, call_index, round_number, spin_artist, track_title, original_artist, alt_accept_original_artist, is_cover, source_label, host_notes, status, asked_at, revealed_at, scored_at, created_at"
    )
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    session_id: row.session_id,
    call_index: row.call_index,
    round_number: row.round_number,
    spin_artist: row.spin_artist,
    track_title: row.track_title,
    original_artist: row.original_artist,
    alt_accept_original_artist: row.alt_accept_original_artist,
    is_cover: row.is_cover,
    artist: row.spin_artist,
    title: row.track_title,
    source_label: row.source_label,
    status: row.status,
    asked_at: row.asked_at,
    revealed_at: row.revealed_at,
    scored_at: row.scored_at,
    created_at: row.created_at,
    detail: `${row.is_cover ? "Cover" : "Original"} | Original artist: ${row.original_artist}`,
    host_notes: row.host_notes,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

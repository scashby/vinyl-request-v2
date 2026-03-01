import { NextRequest, NextResponse } from "next/server";
import { getNeedleDropRouletteDb } from "src/lib/needleDropRouletteDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getNeedleDropRouletteDb();
  const { data, error } = await db
    .from("ndr_session_calls")
    .select("id, call_index, round_number, source_label, artist_answer, title_answer, snippet_duration_seconds, host_notes, status, asked_at, answer_revealed_at, scored_at")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    call_index: row.call_index,
    round_number: row.round_number,
    artist: row.artist_answer,
    title: row.title_answer,
    source_label: row.source_label,
    detail: row.snippet_duration_seconds ? `Snippet: ${row.snippet_duration_seconds}s` : null,
    host_notes: row.host_notes,
    status: row.status,
    asked_at: row.asked_at,
    answer_revealed_at: row.answer_revealed_at,
    scored_at: row.scored_at,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

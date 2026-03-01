import { NextRequest, NextResponse } from "next/server";
import { getLyricGapRelayDb } from "src/lib/lyricGapRelayDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getLyricGapRelayDb();
  const { data, error } = await db
    .from("lgr_session_calls")
    .select("call_index, round_number, artist, title, source_label, cue_lyric, answer_lyric, host_notes")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    call_index: row.call_index,
    round_number: row.round_number,
    artist: row.artist,
    title: row.title,
    source_label: row.source_label,
    detail: `Cue: ${row.cue_lyric} | Answer: ${row.answer_lyric}`,
    host_notes: row.host_notes,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

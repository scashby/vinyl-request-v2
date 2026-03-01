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
    .select(
      "id, session_id, round_number, call_index, source_label, artist, title, cue_lyric, answer_lyric, accepted_answers, host_notes, status, asked_at, answer_revealed_at, scored_at, created_at"
    )
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

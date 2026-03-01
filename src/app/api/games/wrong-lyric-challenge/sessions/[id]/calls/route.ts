import { NextRequest, NextResponse } from "next/server";
import { getWrongLyricChallengeDb } from "src/lib/wrongLyricChallengeDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getWrongLyricChallengeDb();
  const { data, error } = await db
    .from("wlc_session_calls")
    .select(
      "call_index, round_number, artist, title, source_label, correct_lyric, decoy_lyric_1, decoy_lyric_2, decoy_lyric_3, answer_slot, dj_cue_hint, host_notes"
    )
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    call_index: row.call_index,
    round_number: row.round_number,
    artist: row.artist,
    title: row.title,
    source_label: row.source_label,
    detail: [
      `Correct slot: ${row.answer_slot}`,
      `Correct lyric: ${row.correct_lyric}`,
      row.dj_cue_hint ? `Cue: ${row.dj_cue_hint}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    host_notes: row.host_notes,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

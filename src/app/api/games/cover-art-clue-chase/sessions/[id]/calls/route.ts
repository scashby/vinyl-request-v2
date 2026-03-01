import { NextRequest, NextResponse } from "next/server";
import { getCoverArtClueChaseDb } from "src/lib/coverArtClueChaseDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getCoverArtClueChaseDb();
  const [{ data, error }, { data: scores, error: scoresError }] = await Promise.all([
    db
      .from("cacc_session_calls")
      .select("id, session_id, round_number, call_index, source_label, artist, title, release_year, reveal_level_1_image_url, reveal_level_2_image_url, reveal_level_3_image_url, audio_clue_source, host_notes, status, stage_revealed, asked_at, revealed_at, scored_at, created_at")
      .eq("session_id", sessionId)
      .order("call_index", { ascending: true }),
    db
      .from("cacc_team_scores")
      .select("call_id, awarded_points, exact_match, used_audio_clue")
      .eq("session_id", sessionId),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });

  const scoreMap = new Map<number, { rows: number; exact_hits: number; audio_hits: number; max_points: number }>();
  for (const score of scores ?? []) {
    const row = scoreMap.get(score.call_id) ?? { rows: 0, exact_hits: 0, audio_hits: 0, max_points: 0 };
    row.rows += 1;
    if (score.exact_match) row.exact_hits += 1;
    if (score.used_audio_clue) row.audio_hits += 1;
    row.max_points = Math.max(row.max_points, Number(score.awarded_points ?? 0));
    scoreMap.set(score.call_id, row);
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    session_id: row.session_id,
    call_index: row.call_index,
    round_number: row.round_number,
    artist: row.artist,
    title: row.title,
    release_year: row.release_year,
    source_label: row.source_label,
    reveal_level_1_image_url: row.reveal_level_1_image_url,
    reveal_level_2_image_url: row.reveal_level_2_image_url,
    reveal_level_3_image_url: row.reveal_level_3_image_url,
    audio_clue_source: row.audio_clue_source,
    status: row.status,
    stage_revealed: row.stage_revealed,
    asked_at: row.asked_at,
    revealed_at: row.revealed_at,
    scored_at: row.scored_at,
    created_at: row.created_at,
    detail: row.release_year ? `Release year: ${row.release_year}` : null,
    host_notes: row.host_notes,
    score_rows: scoreMap.get(row.id)?.rows ?? 0,
    score_exact_hits: scoreMap.get(row.id)?.exact_hits ?? 0,
    score_audio_hits: scoreMap.get(row.id)?.audio_hits ?? 0,
    score_max_points: scoreMap.get(row.id)?.max_points ?? 0,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

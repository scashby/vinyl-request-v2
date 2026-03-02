import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getTriviaDb();
  const { data, error } = await db
    .from("trivia_session_calls")
    .select("id, session_id, round_number, call_index, playlist_track_key, is_tiebreaker, category, difficulty, question_text, answer_key, accepted_answers, source_note, prep_status, display_element_type, display_image_override_url, auto_cover_art_url, auto_vinyl_label_url, source_artist, source_title, source_album, source_side, source_position, base_points, bonus_points, status, asked_at, answer_revealed_at, scored_at, created_at")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      data: (data ?? []).map((row) => ({
        ...row,
        effective_display_image_url:
          row.display_image_override_url ??
          (row.display_element_type === "vinyl_label" ? row.auto_vinyl_label_url : row.auto_cover_art_url),
      })),
    },
    { status: 200 }
  );
}

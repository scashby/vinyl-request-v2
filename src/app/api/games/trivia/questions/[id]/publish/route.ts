import { NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { TRIVIA_BANK_ENABLED } from "src/lib/triviaBankApi";
import { hasRequiredCueSource } from "src/lib/triviaBank";

export const runtime = "nodejs";

function parseQuestionId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const { id } = await params;
  const questionId = parseQuestionId(id);
  if (!questionId) return NextResponse.json({ error: "Invalid question id" }, { status: 400 });

  const now = new Date().toISOString();
  const db = getTriviaDb();
  const { data: question, error: questionError } = await db
    .from("trivia_questions")
    .select("id, cue_source_type, cue_source_payload, primary_cue_start_seconds")
    .eq("id", questionId)
    .maybeSingle();
  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const hasRequiredCue = hasRequiredCueSource({
    cueSourceType: question.cue_source_type,
    cueSourcePayload: question.cue_source_payload,
    primaryCueStartSeconds: question.primary_cue_start_seconds,
  });
  if (!hasRequiredCue) {
    return NextResponse.json({ error: "Pick a vinyl track and cue time to continue." }, { status: 400 });
  }

  const { error } = await db
    .from("trivia_questions")
    .update({
      status: "published",
      published_at: now,
      archived_at: null,
      updated_at: now,
      updated_by: "admin",
    })
    .eq("id", questionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db
    .from("trivia_question_facets")
    .upsert({
      question_id: questionId,
      has_required_cue: true,
    }, { onConflict: "question_id" });

  return NextResponse.json({ ok: true }, { status: 200 });
}

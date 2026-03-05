import { NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { TRIVIA_BANK_ENABLED } from "src/lib/triviaBankApi";

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

  return NextResponse.json({ ok: true }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { TRIVIA_BANK_ENABLED, asNullableString, asString } from "src/lib/triviaBankApi";

export const runtime = "nodejs";

type Body = {
  asset_role?: "clue_primary" | "clue_secondary" | "answer_visual" | "explanation_media";
  asset_type?: "image" | "audio" | "video";
  bucket?: string;
  object_path?: string;
  mime_type?: string | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  sort_order?: number;
  created_by?: string;
};

function parseQuestionId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const { id } = await params;
  const questionId = parseQuestionId(id);
  if (!questionId) return NextResponse.json({ error: "Invalid question id" }, { status: 400 });

  const body = (await request.json()) as Body;
  const objectPath = asString(body.object_path);
  if (!objectPath) return NextResponse.json({ error: "object_path is required" }, { status: 400 });

  const db = getTriviaDb();
  const { data: question } = await db.from("trivia_questions").select("id").eq("id", questionId).maybeSingle();
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const { data: created, error } = await db
    .from("trivia_question_assets")
    .insert({
      question_id: questionId,
      asset_role: body.asset_role ?? "clue_primary",
      asset_type: body.asset_type ?? "image",
      bucket: asString(body.bucket) || "trivia-assets",
      object_path: objectPath,
      mime_type: asNullableString(body.mime_type),
      width: Number.isFinite(Number(body.width)) ? Number(body.width) : null,
      height: Number.isFinite(Number(body.height)) ? Number(body.height) : null,
      duration_seconds: Number.isFinite(Number(body.duration_seconds)) ? Number(body.duration_seconds) : null,
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
      created_by: asString(body.created_by) || "admin",
    })
    .select("id, question_id, asset_role, asset_type, bucket, object_path, mime_type, width, height, duration_seconds, sort_order, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: facetsError } = await db
    .from("trivia_question_facets")
    .upsert({
      question_id: questionId,
      has_media: true,
    }, { onConflict: "question_id" });
  if (facetsError) return NextResponse.json({ error: facetsError.message }, { status: 500 });

  return NextResponse.json({ data: created }, { status: 201 });
}

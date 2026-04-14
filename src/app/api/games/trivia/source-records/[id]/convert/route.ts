import { NextRequest, NextResponse } from "next/server";
import { generateTriviaQuestionCode } from "src/lib/triviaBank";
import { getTriviaDb } from "src/lib/triviaDb";

export const runtime = "nodejs";

function parseSourceRecordId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function generateUniqueQuestionCode() {
  const db = getTriviaDb();
  for (let i = 0; i < 20; i += 1) {
    const code = generateTriviaQuestionCode();
    const { data } = await db.from("trivia_questions").select("id").eq("question_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique question code");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sourceRecordId = parseSourceRecordId(id);
  if (!sourceRecordId) return NextResponse.json({ error: "Invalid source record id" }, { status: 400 });

  try {
    const db = getTriviaDb();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const userLabel = asString(body.created_by) || "admin";
    const { data: sourceRecord, error: sourceError } = await db
      .from("trivia_source_records")
      .select("id, source_title, source_url, excerpt_text, claim_text, verification_notes, verification_status, source_kind")
      .eq("id", sourceRecordId)
      .maybeSingle();

    if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
    if (!sourceRecord) return NextResponse.json({ error: "Source record not found" }, { status: 404 });

    const claimText = sourceRecord.claim_text?.trim() || "";
    const sourceTitle = sourceRecord.source_title?.trim() || "";
    const excerptText = sourceRecord.excerpt_text?.trim() || "";
    const answerKey = claimText || sourceTitle || "Review source record";
    const promptText = `Draft from source: ${claimText || sourceTitle || `Source #${sourceRecordId}`}`;
    const now = new Date().toISOString();
    const questionCode = await generateUniqueQuestionCode();

    const { data: question, error: questionError } = await db
      .from("trivia_questions")
      .insert({
        question_code: questionCode,
        status: "draft",
        question_type: "free_response",
        prompt_text: promptText,
        answer_key: answerKey,
        accepted_answers: [answerKey],
        answer_payload: {},
        options_payload: [],
        reveal_payload: {},
        display_element_type: "song",
        explanation_text: excerptText || null,
        default_category: "General Music",
        default_difficulty: "medium",
        source_note: sourceRecord.source_url ? `Imported from ${sourceRecord.source_url}` : `Imported from source record #${sourceRecordId}`,
        is_tiebreaker_eligible: true,
        cue_source_type: null,
        cue_source_payload: {},
        primary_cue_start_seconds: null,
        primary_cue_end_seconds: null,
        primary_cue_instruction: null,
        cue_notes_text: sourceRecord.verification_notes ?? null,
        cue_payload: { segments: [] },
        created_by: userLabel,
        updated_by: userLabel,
        created_at: now,
        updated_at: now,
        published_at: null,
        archived_at: null,
      })
      .select("id, question_code")
      .single();

    if (questionError || !question) return NextResponse.json({ error: questionError?.message ?? "Failed to create draft question" }, { status: 500 });

    const { error: facetError } = await db.from("trivia_question_facets").upsert({
      question_id: question.id,
      has_media: false,
      has_required_cue: false,
      difficulty: "medium",
      category: "General Music",
    }, { onConflict: "question_id" });
    if (facetError) return NextResponse.json({ error: facetError.message }, { status: 500 });

    const { error: sourceLinkError } = await db.from("trivia_question_sources").insert({
      question_id: question.id,
      source_record_id: sourceRecordId,
      relationship_type: "research",
      is_primary: true,
      sort_order: 0,
      citation_excerpt: excerptText || null,
      claim_text: claimText || null,
      verification_notes: sourceRecord.verification_notes ?? null,
      created_by: userLabel,
      created_at: now,
      updated_at: now,
    });
    if (sourceLinkError) return NextResponse.json({ error: sourceLinkError.message }, { status: 500 });

    return NextResponse.json({
      data: {
        question_id: question.id,
        question_code: question.question_code,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
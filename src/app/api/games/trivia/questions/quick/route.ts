import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { generateTriviaQuestionCode } from "src/lib/triviaBank";
import { TRIVIA_BANK_ENABLED, asString, normalizeQuestionWriteInput } from "src/lib/triviaBankApi";

export const runtime = "nodejs";

type QuickCreateBody = {
  question_text?: string;
  prompt_text?: string;
  correct_answer?: string;
  answer_key?: string;
  alternate_answers?: string[];
  accepted_answers?: string[];
  category?: string;
  default_category?: string;
  difficulty?: "easy" | "medium" | "hard";
  default_difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
  cue_source_type?: "inventory_track" | "uploaded_clip";
  cue_source_payload?: Record<string, unknown>;
  inventory_track?: Record<string, unknown>;
  primary_cue_start_seconds?: number | string;
  cue_start?: number | string;
  cue_start_time?: number | string;
  primary_cue_end_seconds?: number | string;
  cue_end?: number | string;
  cue_end_time?: number | string;
  primary_cue_instruction?: string;
  cue_instruction?: string;
  cue_notes_text?: string;
  extra_cue_notes?: string;
  explanation_text?: string;
  source_note?: string;
  question_type?: "free_response" | "multiple_choice" | "true_false" | "ordering";
  display_element_type?: "song" | "artist" | "album" | "cover_art" | "vinyl_label";
  status?: "draft" | "published" | "archived";
  publish?: boolean;
  created_by?: string;
};

async function generateUniqueQuestionCode() {
  const db = getTriviaDb();
  for (let i = 0; i < 20; i += 1) {
    const code = generateTriviaQuestionCode();
    const { data } = await db.from("trivia_questions").select("id").eq("question_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique question code");
}

function resolveCueSourceType(body: QuickCreateBody): "inventory_track" | "uploaded_clip" | undefined {
  if (body.cue_source_type === "inventory_track" || body.cue_source_type === "uploaded_clip") {
    return body.cue_source_type;
  }

  const payload = body.cue_source_payload;
  if (payload && typeof payload === "object") {
    if (typeof payload.inventory_id === "number" || typeof payload.inventory_id === "string") return "inventory_track";
    if (typeof payload.object_path === "string") return "uploaded_clip";
  }

  if (body.inventory_track && typeof body.inventory_track === "object") return "inventory_track";
  return undefined;
}

function buildCanonicalBody(body: QuickCreateBody): Record<string, unknown> {
  const category = asString(body.category ?? body.default_category) || "General Music";
  const difficulty = (body.difficulty ?? body.default_difficulty ?? "medium") as "easy" | "medium" | "hard";
  const requestedStatus = body.status === "draft" || body.status === "published" || body.status === "archived"
    ? body.status
    : undefined;
  const status = requestedStatus ?? (body.publish === false ? "draft" : "published");

  const cueSourceType = resolveCueSourceType(body);
  const cueSourcePayload =
    body.cue_source_payload && typeof body.cue_source_payload === "object"
      ? body.cue_source_payload
      : (body.inventory_track && typeof body.inventory_track === "object" ? body.inventory_track : {});

  const acceptedAnswers = Array.from(
    new Set(
      [
        ...(Array.isArray(body.accepted_answers) ? body.accepted_answers : []),
        ...(Array.isArray(body.alternate_answers) ? body.alternate_answers : []),
      ]
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );

  return {
    status,
    question_type: body.question_type ?? "free_response",
    prompt_text: body.question_text ?? body.prompt_text ?? "",
    answer_key: body.correct_answer ?? body.answer_key ?? "",
    accepted_answers: acceptedAnswers,
    default_category: category,
    default_difficulty: difficulty,
    facet_category: category,
    facet_difficulty: difficulty,
    tags: Array.isArray(body.tags) ? body.tags : [],
    cue_source_type: cueSourceType,
    cue_source_payload: cueSourcePayload,
    primary_cue_start_seconds: body.primary_cue_start_seconds ?? body.cue_start ?? body.cue_start_time,
    primary_cue_end_seconds: body.primary_cue_end_seconds ?? body.cue_end ?? body.cue_end_time,
    primary_cue_instruction: body.primary_cue_instruction ?? body.cue_instruction,
    cue_notes_text: body.cue_notes_text ?? body.extra_cue_notes,
    explanation_text: body.explanation_text,
    source_note: body.source_note,
    display_element_type: body.display_element_type ?? "song",
    has_media: false,
  };
}

export async function POST(request: NextRequest) {
  if (!TRIVIA_BANK_ENABLED) {
    return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });
  }

  try {
    const db = getTriviaDb();
    const body = (await request.json()) as QuickCreateBody;
    const normalized = normalizeQuestionWriteInput(buildCanonicalBody(body));

    if (!normalized.prompt_text || !normalized.answer_key) {
      return NextResponse.json({ error: "Question text and correct answer are required." }, { status: 400 });
    }
    if (normalized.cue_payload_has_validation_error) {
      return NextResponse.json({ error: "Cue timing is invalid. Use non-negative times and make sure end is after start." }, { status: 400 });
    }
    if (!normalized.has_required_cue) {
      return NextResponse.json({ error: "Pick a vinyl track and cue time to continue." }, { status: 400 });
    }

    const questionCode = await generateUniqueQuestionCode();
    const now = new Date().toISOString();
    const userLabel = asString(body.created_by) || "admin";

    const { data: question, error: questionError } = await db
      .from("trivia_questions")
      .insert({
        question_code: questionCode,
        status: normalized.status,
        question_type: normalized.question_type,
        prompt_text: normalized.prompt_text,
        answer_key: normalized.answer_key,
        accepted_answers: normalized.accepted_answers,
        answer_payload: normalized.answer_payload,
        options_payload: normalized.options_payload,
        reveal_payload: normalized.reveal_payload,
        display_element_type: asString(body.display_element_type) || "song",
        explanation_text: normalized.explanation_text,
        default_category: normalized.default_category,
        default_difficulty: normalized.default_difficulty,
        source_note: normalized.source_note,
        is_tiebreaker_eligible: normalized.is_tiebreaker_eligible,
        cue_source_type: normalized.cue_source_type,
        cue_source_payload: normalized.cue_source_payload,
        primary_cue_start_seconds: normalized.primary_cue_start_seconds,
        primary_cue_end_seconds: normalized.primary_cue_end_seconds,
        primary_cue_instruction: normalized.primary_cue_instruction,
        cue_notes_text: normalized.cue_notes_text,
        cue_payload: normalized.cue_payload,
        created_by: userLabel,
        updated_by: userLabel,
        created_at: now,
        updated_at: now,
        published_at: normalized.status === "published" ? now : null,
        archived_at: normalized.status === "archived" ? now : null,
      })
      .select("id, question_code, status")
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: questionError?.message ?? "Failed to create question" }, { status: 500 });
    }

    const questionId = question.id;
    const { error: facetsError } = await db
      .from("trivia_question_facets")
      .upsert({
        question_id: questionId,
        ...normalized.facets,
      }, { onConflict: "question_id" });
    if (facetsError) throw new Error(facetsError.message);

    if (normalized.tags.length > 0) {
      const { error: tagsError } = await db
        .from("trivia_question_tags")
        .insert(normalized.tags.map((tag) => ({ question_id: questionId, tag })));
      if (tagsError) throw new Error(tagsError.message);
    }

    return NextResponse.json({
      id: questionId,
      question_code: question.question_code,
      status: question.status,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

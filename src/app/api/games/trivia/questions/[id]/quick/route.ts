import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { TRIVIA_BANK_ENABLED, asString, normalizeQuestionWriteInput } from "src/lib/triviaBankApi";
import { replaceQuestionScopes } from "src/lib/triviaScopes";
import { replaceQuestionSources } from "src/lib/triviaSources";

type QuickPatchBody = {
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
  updated_by?: string;
  sources?: unknown[];
  scopes?: unknown[];
};

export const runtime = "nodejs";

function parseQuestionId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function resolveCueSourceType(body: QuickPatchBody): "inventory_track" | "uploaded_clip" | undefined {
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

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) {
    return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });
  }

  const { id } = await params;
  const questionId = parseQuestionId(id);
  if (!questionId) return NextResponse.json({ error: "Invalid question id" }, { status: 400 });

  try {
    const body = (await request.json()) as QuickPatchBody;
    const bodyRecord = body as Record<string, unknown>;
    const db = getTriviaDb();

    const [{ data: question, error: questionError }, { data: facets, error: facetsError }] = await Promise.all([
      db
        .from("trivia_questions")
        .select("id, status, question_type, prompt_text, answer_key, accepted_answers, answer_payload, options_payload, reveal_payload, display_element_type, explanation_text, default_category, default_difficulty, source_note, is_tiebreaker_eligible, cue_source_type, cue_source_payload, primary_cue_start_seconds, primary_cue_end_seconds, primary_cue_instruction, cue_notes_text, cue_payload")
        .eq("id", questionId)
        .maybeSingle(),
      db
        .from("trivia_question_facets")
        .select("era, genre, decade, region, language, has_media, difficulty, category")
        .eq("question_id", questionId)
        .maybeSingle(),
    ]);

    if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });
    if (facetsError) return NextResponse.json({ error: facetsError.message }, { status: 500 });
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

    const requestedStatus = body.status === "draft" || body.status === "published" || body.status === "archived"
      ? body.status
      : undefined;
    const explicitStatus = requestedStatus ?? (body.publish === true ? "published" : (body.publish === false ? "draft" : undefined));

    const cueSourceType = resolveCueSourceType(body);
    const cueSourcePayload =
      body.cue_source_payload && typeof body.cue_source_payload === "object"
        ? body.cue_source_payload
        : (body.inventory_track && typeof body.inventory_track === "object" ? body.inventory_track : undefined);

    const incomingAcceptedAnswers = Array.from(
      new Set(
        [
          ...(Array.isArray(body.accepted_answers) ? body.accepted_answers : []),
          ...(Array.isArray(body.alternate_answers) ? body.alternate_answers : []),
        ]
          .map((value) => String(value).trim())
          .filter(Boolean)
      )
    );

    const merged = {
      status: explicitStatus ?? question.status,
      question_type: body.question_type ?? question.question_type,
      prompt_text: hasOwn(bodyRecord, "question_text") || hasOwn(bodyRecord, "prompt_text")
        ? (body.question_text ?? body.prompt_text ?? "")
        : question.prompt_text,
      answer_key: hasOwn(bodyRecord, "correct_answer") || hasOwn(bodyRecord, "answer_key")
        ? (body.correct_answer ?? body.answer_key ?? "")
        : question.answer_key,
      accepted_answers: incomingAcceptedAnswers.length > 0 ? incomingAcceptedAnswers : question.accepted_answers,
      answer_payload: question.answer_payload,
      options_payload: question.options_payload,
      reveal_payload: question.reveal_payload,
      display_element_type: body.display_element_type ?? question.display_element_type,
      explanation_text: hasOwn(bodyRecord, "explanation_text") ? body.explanation_text : question.explanation_text,
      default_category: body.category ?? body.default_category ?? question.default_category,
      default_difficulty: body.difficulty ?? body.default_difficulty ?? question.default_difficulty,
      source_note: hasOwn(bodyRecord, "source_note") ? body.source_note : question.source_note,
      is_tiebreaker_eligible: question.is_tiebreaker_eligible,
      cue_source_type: cueSourceType ?? question.cue_source_type,
      cue_source_payload: cueSourcePayload ?? question.cue_source_payload,
      primary_cue_start_seconds:
        hasOwn(bodyRecord, "primary_cue_start_seconds") || hasOwn(bodyRecord, "cue_start") || hasOwn(bodyRecord, "cue_start_time")
          ? (body.primary_cue_start_seconds ?? body.cue_start ?? body.cue_start_time)
          : question.primary_cue_start_seconds,
      primary_cue_end_seconds:
        hasOwn(bodyRecord, "primary_cue_end_seconds") || hasOwn(bodyRecord, "cue_end") || hasOwn(bodyRecord, "cue_end_time")
          ? (body.primary_cue_end_seconds ?? body.cue_end ?? body.cue_end_time)
          : question.primary_cue_end_seconds,
      primary_cue_instruction:
        hasOwn(bodyRecord, "primary_cue_instruction") || hasOwn(bodyRecord, "cue_instruction")
          ? (body.primary_cue_instruction ?? body.cue_instruction)
          : question.primary_cue_instruction,
      cue_notes_text:
        hasOwn(bodyRecord, "cue_notes_text") || hasOwn(bodyRecord, "extra_cue_notes")
          ? (body.cue_notes_text ?? body.extra_cue_notes)
          : question.cue_notes_text,
      cue_payload: question.cue_payload,
      tags: hasOwn(bodyRecord, "tags") && Array.isArray(body.tags) ? body.tags : [],
      era: facets?.era ?? null,
      genre: facets?.genre ?? null,
      decade: facets?.decade ?? null,
      region: facets?.region ?? null,
      language: facets?.language ?? null,
      has_media: facets?.has_media ?? false,
      facet_difficulty: body.difficulty ?? body.default_difficulty ?? facets?.difficulty ?? question.default_difficulty,
      facet_category: body.category ?? body.default_category ?? facets?.category ?? question.default_category,
    };

    const normalized = normalizeQuestionWriteInput(merged);
    if (!normalized.prompt_text || !normalized.answer_key) {
      return NextResponse.json({ error: "Question text and correct answer are required." }, { status: 400 });
    }
    if (normalized.cue_payload_has_validation_error) {
      return NextResponse.json({ error: "Cue timing is invalid. Use non-negative times and make sure end is after start." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const userLabel = asString(body.updated_by) || "admin";

    const { error: updateQuestionError } = await db
      .from("trivia_questions")
      .update({
        status: normalized.status,
        question_type: normalized.question_type,
        prompt_text: normalized.prompt_text,
        answer_key: normalized.answer_key,
        accepted_answers: normalized.accepted_answers,
        answer_payload: normalized.answer_payload,
        options_payload: normalized.options_payload,
        reveal_payload: normalized.reveal_payload,
        display_element_type: merged.display_element_type,
        explanation_text: normalized.explanation_text,
        default_category: normalized.default_category,
        default_difficulty: normalized.default_difficulty,
        source_note: normalized.source_note,
        cue_source_type: normalized.cue_source_type,
        cue_source_payload: normalized.cue_source_payload,
        primary_cue_start_seconds: normalized.primary_cue_start_seconds,
        primary_cue_end_seconds: normalized.primary_cue_end_seconds,
        primary_cue_instruction: normalized.primary_cue_instruction,
        cue_notes_text: normalized.cue_notes_text,
        cue_payload: normalized.cue_payload,
        published_at: normalized.status === "published" ? now : null,
        archived_at: normalized.status === "archived" ? now : null,
        updated_at: now,
        updated_by: userLabel,
      })
      .eq("id", questionId);

    if (updateQuestionError) {
      return NextResponse.json({ error: updateQuestionError.message }, { status: 500 });
    }

    const { error: updateFacetError } = await db
      .from("trivia_question_facets")
      .upsert({
        question_id: questionId,
        ...normalized.facets,
      }, { onConflict: "question_id" });
    if (updateFacetError) return NextResponse.json({ error: updateFacetError.message }, { status: 500 });

    if (hasOwn(bodyRecord, "tags")) {
      const { error: deleteTagsError } = await db.from("trivia_question_tags").delete().eq("question_id", questionId);
      if (deleteTagsError) return NextResponse.json({ error: deleteTagsError.message }, { status: 500 });

      if (normalized.tags.length > 0) {
        const { error: insertTagsError } = await db
          .from("trivia_question_tags")
          .insert(normalized.tags.map((tag) => ({ question_id: questionId, tag })));
        if (insertTagsError) return NextResponse.json({ error: insertTagsError.message }, { status: 500 });
      }
    }

    if (hasOwn(bodyRecord, "sources")) {
      await replaceQuestionSources(questionId, body.sources, userLabel);
    }

    if (hasOwn(bodyRecord, "scopes")) {
      await replaceQuestionScopes(questionId, body.scopes, userLabel);
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: questionId,
        status: normalized.status,
      },
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

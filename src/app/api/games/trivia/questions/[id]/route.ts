import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { TRIVIA_BANK_ENABLED, asString, normalizeQuestionWriteInput } from "src/lib/triviaBankApi";
import { hasRequiredCueSource } from "src/lib/triviaBank";
import { loadQuestionScopes, replaceQuestionScopes } from "src/lib/triviaScopes";
import { loadQuestionSources, replaceQuestionSources } from "src/lib/triviaSources";

export const runtime = "nodejs";

function parseQuestionId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

async function getQuestionUsageCounts(questionId: number) {
  const db = getTriviaDb();
  const [{ count: deckUsageCount, error: deckUsageError }, { count: sessionUsageCount, error: sessionUsageError }] = await Promise.all([
    db.from("trivia_deck_items").select("id", { count: "exact", head: true }).eq("question_id", questionId),
    db.from("trivia_session_calls").select("id", { count: "exact", head: true }).eq("question_id", questionId),
  ]);

  if (deckUsageError) throw new Error(deckUsageError.message);
  if (sessionUsageError) throw new Error(sessionUsageError.message);

  return {
    deck_usage_count: deckUsageCount ?? 0,
    session_usage_count: sessionUsageCount ?? 0,
  };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const { id } = await params;
  const questionId = parseQuestionId(id);
  if (!questionId) return NextResponse.json({ error: "Invalid question id" }, { status: 400 });

  const db = getTriviaDb();
  const [{ data: question, error: questionError }, { data: facets }, { data: tags }, { data: assets }, sources, scopes] = await Promise.all([
    db
      .from("trivia_questions")
      .select("id, question_code, status, question_type, prompt_text, answer_key, accepted_answers, answer_payload, options_payload, reveal_payload, display_element_type, explanation_text, default_category, default_difficulty, source_note, is_tiebreaker_eligible, cue_source_type, cue_source_payload, primary_cue_start_seconds, primary_cue_end_seconds, primary_cue_instruction, cue_notes_text, cue_payload, created_by, updated_by, created_at, updated_at, published_at, archived_at")
      .eq("id", questionId)
      .maybeSingle(),
    db
      .from("trivia_question_facets")
      .select("question_id, era, genre, decade, region, language, has_media, has_required_cue, difficulty, category")
      .eq("question_id", questionId)
      .maybeSingle(),
    db
      .from("trivia_question_tags")
      .select("id, tag")
      .eq("question_id", questionId)
      .order("tag", { ascending: true }),
    db
      .from("trivia_question_assets")
      .select("id, asset_role, asset_type, bucket, object_path, mime_type, width, height, duration_seconds, sort_order, created_at")
      .eq("question_id", questionId)
      .order("sort_order", { ascending: true }),
    loadQuestionSources(questionId),
    loadQuestionScopes(questionId),
  ]);

  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  return NextResponse.json(
    {
      ...question,
      facets: facets ?? null,
      tags: (tags ?? []).map((row) => row.tag),
      assets: assets ?? [],
      sources,
      scopes,
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const { id } = await params;
  const questionId = parseQuestionId(id);
  if (!questionId) return NextResponse.json({ error: "Invalid question id" }, { status: 400 });

  const body = (await request.json()) as Record<string, unknown>;
  const normalized = normalizeQuestionWriteInput(body);
  if (normalized.cue_payload_has_validation_error) {
    return NextResponse.json({ error: "cue_payload has invalid segment timing. Use non-negative times and end >= start." }, { status: 400 });
  }
  const db = getTriviaDb();
  const { data: existingQuestion, error: existingQuestionError } = await db
    .from("trivia_questions")
    .select("id, status, cue_source_type, cue_source_payload, primary_cue_start_seconds")
    .eq("id", questionId)
    .maybeSingle();
  if (existingQuestionError) return NextResponse.json({ error: existingQuestionError.message }, { status: 500 });
  if (!existingQuestion) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const now = new Date().toISOString();
  const userLabel = asString(body.updated_by) || "admin";

  type TriviaQuestionPatch = {
    status?: "draft" | "published" | "archived";
    question_type?: "free_response" | "multiple_choice" | "true_false" | "ordering";
    prompt_text?: string;
    answer_key?: string;
    accepted_answers?: unknown;
    answer_payload?: unknown;
    options_payload?: unknown;
    reveal_payload?: unknown;
    display_element_type?: string;
    explanation_text?: string | null;
    default_category?: string;
    default_difficulty?: "easy" | "medium" | "hard";
    source_note?: string | null;
    is_tiebreaker_eligible?: boolean;
    cue_source_type?: "inventory_track" | "uploaded_clip" | null;
    cue_source_payload?: unknown;
    primary_cue_start_seconds?: number | null;
    primary_cue_end_seconds?: number | null;
    primary_cue_instruction?: string | null;
    cue_notes_text?: string | null;
    cue_payload?: unknown;
    created_by?: string | null;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
    published_at?: string | null;
    archived_at?: string | null;
  };
  const patch: TriviaQuestionPatch = {};

  if (Object.prototype.hasOwnProperty.call(body, "status")) patch.status = normalized.status;
  if (Object.prototype.hasOwnProperty.call(body, "question_type")) patch.question_type = normalized.question_type;
  if (Object.prototype.hasOwnProperty.call(body, "prompt_text")) patch.prompt_text = normalized.prompt_text;
  if (Object.prototype.hasOwnProperty.call(body, "answer_key")) patch.answer_key = normalized.answer_key;
  if (Object.prototype.hasOwnProperty.call(body, "accepted_answers")) patch.accepted_answers = normalized.accepted_answers;
  if (Object.prototype.hasOwnProperty.call(body, "answer_payload")) patch.answer_payload = normalized.answer_payload;
  if (Object.prototype.hasOwnProperty.call(body, "options_payload")) patch.options_payload = normalized.options_payload;
  if (Object.prototype.hasOwnProperty.call(body, "reveal_payload")) patch.reveal_payload = normalized.reveal_payload;
  if (Object.prototype.hasOwnProperty.call(body, "display_element_type")) patch.display_element_type = asString(body.display_element_type) || "song";
  if (Object.prototype.hasOwnProperty.call(body, "explanation_text")) patch.explanation_text = normalized.explanation_text;
  if (Object.prototype.hasOwnProperty.call(body, "default_category")) patch.default_category = normalized.default_category;
  if (Object.prototype.hasOwnProperty.call(body, "default_difficulty")) patch.default_difficulty = normalized.default_difficulty;
  if (Object.prototype.hasOwnProperty.call(body, "source_note")) patch.source_note = normalized.source_note;
  if (Object.prototype.hasOwnProperty.call(body, "is_tiebreaker_eligible")) patch.is_tiebreaker_eligible = normalized.is_tiebreaker_eligible;
  if (Object.prototype.hasOwnProperty.call(body, "cue_source_type")) patch.cue_source_type = normalized.cue_source_type;
  if (Object.prototype.hasOwnProperty.call(body, "cue_source_payload")) patch.cue_source_payload = normalized.cue_source_payload;
  if (Object.prototype.hasOwnProperty.call(body, "primary_cue_start_seconds")) patch.primary_cue_start_seconds = normalized.primary_cue_start_seconds;
  if (Object.prototype.hasOwnProperty.call(body, "primary_cue_end_seconds")) patch.primary_cue_end_seconds = normalized.primary_cue_end_seconds;
  if (Object.prototype.hasOwnProperty.call(body, "primary_cue_instruction")) patch.primary_cue_instruction = normalized.primary_cue_instruction;
  if (Object.prototype.hasOwnProperty.call(body, "cue_notes_text")) patch.cue_notes_text = normalized.cue_notes_text;
  if (Object.prototype.hasOwnProperty.call(body, "cue_payload")) patch.cue_payload = normalized.cue_payload;

  const nextCueSourceType = Object.prototype.hasOwnProperty.call(patch, "cue_source_type")
    ? patch.cue_source_type
    : existingQuestion.cue_source_type;
  const nextCueSourcePayload = Object.prototype.hasOwnProperty.call(patch, "cue_source_payload")
    ? patch.cue_source_payload
    : existingQuestion.cue_source_payload;
  const nextPrimaryCueStart = Object.prototype.hasOwnProperty.call(patch, "primary_cue_start_seconds")
    ? patch.primary_cue_start_seconds
    : existingQuestion.primary_cue_start_seconds;

  const hasRequiredCue = hasRequiredCueSource({
    cueSourceType: nextCueSourceType,
    cueSourcePayload: nextCueSourcePayload,
    primaryCueStartSeconds: nextPrimaryCueStart,
  });

  const nextStatus = (patch.status as string | undefined) ?? undefined;
  const effectiveStatus = nextStatus ?? existingQuestion.status;
  if (effectiveStatus === "published" && !hasRequiredCue) {
    return NextResponse.json({ error: "Pick a vinyl track and cue time to continue." }, { status: 400 });
  }
  if (nextStatus === "published") {
    patch.published_at = now;
    patch.archived_at = null;
  } else if (nextStatus === "archived") {
    patch.archived_at = now;
  }
  if (Object.keys(patch).length > 0) {
    patch.updated_at = now;
    patch.updated_by = userLabel;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("trivia_questions").update(patch).eq("id", questionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const facetKeys = ["era", "genre", "decade", "region", "language", "has_media", "facet_difficulty", "facet_category"];
  const touchesFacets = facetKeys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
  const touchesCueRuleFields =
    Object.prototype.hasOwnProperty.call(body, "cue_source_type") ||
    Object.prototype.hasOwnProperty.call(body, "cue_source_payload") ||
    Object.prototype.hasOwnProperty.call(body, "primary_cue_start_seconds");
  if (touchesFacets) {
    const { error } = await db
      .from("trivia_question_facets")
      .upsert({
        question_id: questionId,
        ...normalized.facets,
      }, { onConflict: "question_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (touchesCueRuleFields) {
    const { error } = await db
      .from("trivia_question_facets")
      .upsert({
        question_id: questionId,
        has_required_cue: hasRequiredCue,
      }, { onConflict: "question_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Object.prototype.hasOwnProperty.call(body, "tags")) {
    const { error: deleteError } = await db.from("trivia_question_tags").delete().eq("question_id", questionId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    if (normalized.tags.length > 0) {
      const { error: insertError } = await db.from("trivia_question_tags").insert(
        normalized.tags.map((tag) => ({ question_id: questionId, tag }))
      );
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "sources")) {
    try {
      await replaceQuestionSources(questionId, body.sources, userLabel);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update question sources";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "scopes")) {
    try {
      await replaceQuestionScopes(questionId, body.scopes, userLabel);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update question scopes";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (Object.keys(patch).length === 0 && !touchesFacets && !touchesCueRuleFields && !Object.prototype.hasOwnProperty.call(body, "tags") && !Object.prototype.hasOwnProperty.call(body, "sources") && !Object.prototype.hasOwnProperty.call(body, "scopes")) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const { data: updated } = await db
    .from("trivia_questions")
    .select("id, question_code, status, updated_at, updated_by")
    .eq("id", questionId)
    .maybeSingle();

  return NextResponse.json({ ok: true, data: updated ?? null }, { status: 200 });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const { id } = await params;
  const questionId = parseQuestionId(id);
  if (!questionId) return NextResponse.json({ error: "Invalid question id" }, { status: 400 });

  try {
    const db = getTriviaDb();
    const { data: existingQuestion, error: existingQuestionError } = await db
      .from("trivia_questions")
      .select("id, status")
      .eq("id", questionId)
      .maybeSingle();

    if (existingQuestionError) return NextResponse.json({ error: existingQuestionError.message }, { status: 500 });
    if (!existingQuestion) return NextResponse.json({ error: "Question not found" }, { status: 404 });

    const usage = await getQuestionUsageCounts(questionId);
    if (usage.deck_usage_count > 0 || usage.session_usage_count > 0) {
      return NextResponse.json(
        {
          error: "This question is already used by a deck or session and cannot be deleted.",
          usage,
        },
        { status: 409 }
      );
    }

    if (existingQuestion.status !== "archived") {
      return NextResponse.json({ error: "Archive this question before deleting it." }, { status: 400 });
    }

    const { error: assetsError } = await db.from("trivia_question_assets").delete().eq("question_id", questionId);
    if (assetsError) return NextResponse.json({ error: assetsError.message }, { status: 500 });

    const { error: tagsError } = await db.from("trivia_question_tags").delete().eq("question_id", questionId);
    if (tagsError) return NextResponse.json({ error: tagsError.message }, { status: 500 });

    const { error: facetsError } = await db.from("trivia_question_facets").delete().eq("question_id", questionId);
    if (facetsError) return NextResponse.json({ error: facetsError.message }, { status: 500 });

    const { error: questionError } = await db.from("trivia_questions").delete().eq("id", questionId);
    if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

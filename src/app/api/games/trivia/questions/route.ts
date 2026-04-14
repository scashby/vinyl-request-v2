import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { generateTriviaQuestionCode } from "src/lib/triviaBank";
import { TRIVIA_BANK_ENABLED, asString, normalizeQuestionWriteInput } from "src/lib/triviaBankApi";
import { replaceQuestionSources } from "src/lib/triviaSources";

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseBoolean(value: string | null): boolean | null {
  if (value === null) return null;
  const text = value.trim().toLowerCase();
  if (text === "true" || text === "1" || text === "yes") return true;
  if (text === "false" || text === "0" || text === "no") return false;
  return null;
}

function intersectIds(current: Set<number> | null, values: number[]): Set<number> {
  const incoming = new Set(values.filter((value) => Number.isFinite(value)));
  if (current === null) return incoming;
  const next = new Set<number>();
  for (const value of current) {
    if (incoming.has(value)) next.add(value);
  }
  return next;
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

export async function GET(request: NextRequest) {
  if (!TRIVIA_BANK_ENABLED) {
    return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });
  }

  const db = getTriviaDb();
  const searchParams = request.nextUrl.searchParams;

  const q = asString(searchParams.get("q"));
  const statusRaw = asString(searchParams.get("status")).toLowerCase();
  const status = statusRaw === "draft" || statusRaw === "published" || statusRaw === "archived"
    ? statusRaw
    : "";
  const questionTypeRaw = asString(searchParams.get("question_type")).toLowerCase();
  const questionType =
    questionTypeRaw === "free_response" ||
    questionTypeRaw === "multiple_choice" ||
    questionTypeRaw === "true_false" ||
    questionTypeRaw === "ordering"
      ? questionTypeRaw
      : "";
  const defaultDifficultyRaw = asString(searchParams.get("difficulty")).toLowerCase();
  const defaultDifficulty =
    defaultDifficultyRaw === "easy" || defaultDifficultyRaw === "medium" || defaultDifficultyRaw === "hard"
      ? defaultDifficultyRaw
      : "";
  const defaultCategory = asString(searchParams.get("category"));
  const tag = asString(searchParams.get("tag"));
  const facetCategory = asString(searchParams.get("facet_category"));
  const facetDifficultyRaw = asString(searchParams.get("facet_difficulty")).toLowerCase();
  const facetDifficulty =
    facetDifficultyRaw === "easy" || facetDifficultyRaw === "medium" || facetDifficultyRaw === "hard"
      ? facetDifficultyRaw
      : "";
  const hasMedia = parseBoolean(searchParams.get("has_media"));
  const hasRequiredCue = parseBoolean(searchParams.get("has_required_cue"));
  const limit = Math.min(200, parsePositiveInt(searchParams.get("limit"), 50));
  const offset = Math.max(0, parsePositiveInt(searchParams.get("offset"), 0));

  let constrainedIds: Set<number> | null = null;

  if (tag) {
    const { data, error } = await db.from("trivia_question_tags").select("question_id").eq("tag", tag);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    constrainedIds = intersectIds(
      constrainedIds,
      ((data ?? []) as Array<{ question_id: number }>).map((row) => row.question_id)
    );
  }

  if (facetCategory || facetDifficulty || hasMedia !== null || hasRequiredCue !== null) {
    let facetsQuery = db.from("trivia_question_facets").select("question_id");
    if (facetCategory) facetsQuery = facetsQuery.eq("category", facetCategory);
    if (facetDifficulty) facetsQuery = facetsQuery.eq("difficulty", facetDifficulty);
    if (hasMedia !== null) facetsQuery = facetsQuery.eq("has_media", hasMedia);
    if (hasRequiredCue !== null) facetsQuery = facetsQuery.eq("has_required_cue", hasRequiredCue);
    const { data, error } = await facetsQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    constrainedIds = intersectIds(
      constrainedIds,
      ((data ?? []) as Array<{ question_id: number }>).map((row) => row.question_id)
    );
  }

  if (constrainedIds && constrainedIds.size === 0) {
    return NextResponse.json({ data: [], total: 0 }, { status: 200 });
  }

  let query = db
    .from("trivia_questions")
    .select(
      "id, question_code, status, question_type, prompt_text, answer_key, accepted_answers, answer_payload, options_payload, reveal_payload, display_element_type, explanation_text, default_category, default_difficulty, source_note, is_tiebreaker_eligible, cue_source_type, cue_source_payload, primary_cue_start_seconds, primary_cue_end_seconds, primary_cue_instruction, cue_notes_text, cue_payload, created_by, updated_by, created_at, updated_at, published_at, archived_at",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (questionType) query = query.eq("question_type", questionType);
  if (defaultDifficulty) query = query.eq("default_difficulty", defaultDifficulty);
  if (defaultCategory) query = query.eq("default_category", defaultCategory);
  if (q) query = query.or(`prompt_text.ilike.%${q}%,answer_key.ilike.%${q}%,source_note.ilike.%${q}%,question_code.ilike.%${q}%`);
  if (constrainedIds) query = query.in("id", Array.from(constrainedIds));

  const { data: questions, error: questionsError, count } = await query;
  if (questionsError) return NextResponse.json({ error: questionsError.message }, { status: 500 });

  const questionIds = ((questions ?? []) as Array<{ id: number }>).map((row) => row.id);
  const [{ data: facets }, { data: tags }, { data: assets }] = await Promise.all([
    questionIds.length
      ? db
          .from("trivia_question_facets")
          .select("question_id, era, genre, decade, region, language, has_media, has_required_cue, difficulty, category")
          .in("question_id", questionIds)
      : Promise.resolve({ data: [] as unknown[] }),
    questionIds.length
      ? db
          .from("trivia_question_tags")
          .select("question_id, tag")
          .in("question_id", questionIds)
      : Promise.resolve({ data: [] as unknown[] }),
    questionIds.length
      ? db
          .from("trivia_question_assets")
          .select("id, question_id, asset_role, asset_type, bucket, object_path, mime_type, width, height, duration_seconds, sort_order")
          .in("question_id", questionIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const facetByQuestion = new Map<number, unknown>();
  for (const row of (facets ?? []) as Array<{ question_id: number }>) {
    facetByQuestion.set(row.question_id, row);
  }

  const tagsByQuestion = new Map<number, string[]>();
  for (const row of (tags ?? []) as Array<{ question_id: number; tag: string }>) {
    const current = tagsByQuestion.get(row.question_id) ?? [];
    current.push(row.tag);
    tagsByQuestion.set(row.question_id, current);
  }

  const assetsByQuestion = new Map<number, unknown[]>();
  for (const row of (assets ?? []) as Array<{ question_id: number } & Record<string, unknown>>) {
    const current = assetsByQuestion.get(row.question_id) ?? [];
    current.push(row);
    assetsByQuestion.set(row.question_id, current);
  }

  return NextResponse.json(
    {
      data: ((questions ?? []) as Array<Record<string, unknown>>).map((row) => ({
        ...row,
        facets: facetByQuestion.get(Number(row.id)) ?? null,
        tags: tagsByQuestion.get(Number(row.id)) ?? [],
        assets: assetsByQuestion.get(Number(row.id)) ?? [],
      })),
      total: count ?? 0,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  if (!TRIVIA_BANK_ENABLED) {
    return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });
  }

  try {
    const db = getTriviaDb();
    const body = (await request.json()) as Record<string, unknown>;
    const normalized = normalizeQuestionWriteInput(body);

    if (!normalized.prompt_text || !normalized.answer_key) {
      return NextResponse.json({ error: "prompt_text and answer_key are required" }, { status: 400 });
    }
    if (normalized.status === "published" && !normalized.has_required_cue) {
      return NextResponse.json({ error: "Pick a vinyl track and cue time to continue." }, { status: 400 });
    }
    if (normalized.cue_payload_has_validation_error) {
      return NextResponse.json({ error: "cue_payload has invalid segment timing. Use non-negative times and end >= start." }, { status: 400 });
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
      .select("id, question_code")
      .single();
    if (questionError || !question) return NextResponse.json({ error: questionError?.message ?? "Failed to create question" }, { status: 500 });

    const questionId = question.id;
    const { error: facetsError } = await db
      .from("trivia_question_facets")
      .upsert({
        question_id: questionId,
        ...normalized.facets,
      }, { onConflict: "question_id" });
    if (facetsError) throw new Error(facetsError.message);

    if (normalized.tags.length > 0) {
      const { error: tagsError } = await db.from("trivia_question_tags").insert(
        normalized.tags.map((tag) => ({ question_id: questionId, tag }))
      );
      if (tagsError) throw new Error(tagsError.message);
    }

    if (Array.isArray(body.sources)) {
      await replaceQuestionSources(questionId, body.sources, userLabel);
    }

    return NextResponse.json({ id: questionId, question_code: question.question_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

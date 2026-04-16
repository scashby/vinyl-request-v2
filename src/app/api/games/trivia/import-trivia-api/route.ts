// @ts-nocheck — trivia_questions and related tables not fully typed; use getTriviaDb with cast
import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { generateTriviaQuestionCode } from "src/lib/triviaBank";
import {
  fetchTriviaApiQuestions,
  decadeToTag,
  genreToTag,
  type TriviaApiFetchParams,
} from "src/lib/triviaApiClient";
import { replaceQuestionScopes } from "src/lib/triviaScopes";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Route — POST /api/games/trivia/import-trivia-api
// ---------------------------------------------------------------------------

type ImportRequest = {
  limit?: number;
  difficulties?: ("easy" | "medium" | "hard")[];
  scope_type?: string;   // "decade" | "genre" | "collection" | etc.
  scope_value?: string;  // "1980s", "Rock", etc.
  created_by?: string;
};

export async function POST(request: NextRequest) {
  const triviaDb = getTriviaDb();
  const db = triviaDb as unknown as { from: (t: string) => unknown };

  let body: ImportRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    limit = 50,
    difficulties,
    scope_type,
    scope_value,
    created_by = "trivia-api-import",
  } = body;

  // Build tag filter from scope
  const tags: string[] = [];
  if (scope_type === "decade" && scope_value) {
    const tag = decadeToTag(scope_value);
    if (tag) tags.push(tag);
  } else if (scope_type === "genre" && scope_value) {
    const tag = genreToTag(scope_value);
    if (tag) tags.push(tag);
  }

  const params: TriviaApiFetchParams = {
    limit: Math.min(limit, 50),
    difficulties: difficulties?.length ? difficulties : undefined,
    tags: tags.length ? tags : undefined,
  };

  // Fetch from The Trivia API
  let questions;
  try {
    questions = await fetchTriviaApiQuestions(params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!questions.length) {
    return NextResponse.json({ imported: 0, skipped: 0, message: "No questions returned from Trivia API" });
  }

  let imported = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const q of questions) {
    const sourceNote = `trivia-api:${q.id}`;

    // Dedup — skip if we already have this question
    const { data: existing } = await (db
      .from("trivia_questions")
      .select("id")
      .eq("source_note", sourceNote)
      .maybeSingle() as unknown as Promise<{ data: { id: number } | null }>);

    if (existing) { skipped++; continue; }

    // Generate unique question code
    let code = "";
    for (let i = 0; i < 20; i++) {
      const candidate = generateTriviaQuestionCode();
      const { data: taken } = await (db
        .from("trivia_questions")
        .select("id")
        .eq("question_code", candidate)
        .maybeSingle() as unknown as Promise<{ data: { id: number } | null }>);
      if (!taken) { code = candidate; break; }
    }
    if (!code) { skipped++; continue; }

    // Shuffle options so correct answer isn't always first
    const options = [q.correctAnswer, ...q.incorrectAnswers];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    const { data: inserted, error } = await (db
      .from("trivia_questions")
      .insert({
        question_code: code,
        status: "draft",
        question_type: "multiple_choice",
        prompt_text: q.question.text,
        answer_key: q.correctAnswer,
        accepted_answers: [q.correctAnswer],
        answer_payload: {},
        options_payload: options,
        reveal_payload: {},
        display_element_type: "song",
        explanation_text: "",
        default_category: "Music",
        default_difficulty: q.difficulty,
        source_note: sourceNote,
        is_tiebreaker_eligible: true,
        cue_source_type: null,
        cue_source_payload: {},
        cue_payload: { segments: [] },
        created_by,
        updated_by: created_by,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single() as unknown as Promise<{ data: { id: number } | null; error: { message: string } | null }>);

    if (error || !inserted) { skipped++; continue; }

    const questionId = inserted.id;

    // Facets
    await (db
      .from("trivia_question_facets")
      .upsert({
        question_id: questionId,
        difficulty: q.difficulty,
        category: "Music",
        has_media: false,
        has_required_cue: false,
      }, { onConflict: "question_id" }) as unknown as Promise<unknown>);

    // Tags: source tags + API tags (normalised)
    const tagValues = [
      "trivia-api",
      ...q.tags.filter((t) => t !== "music").map((t) => t.replace(/_/g, "-")),
    ];
    if (scope_type === "decade" && scope_value) tagValues.push(scope_value.toLowerCase());
    if (scope_type === "genre" && scope_value) tagValues.push(scope_value.toLowerCase());

    if (tagValues.length) {
      await (db
        .from("trivia_question_tags")
        .insert(tagValues.map((tag) => ({ question_id: questionId, tag }))) as unknown as Promise<unknown>);
    }

    // Scopes — decade and genre scopes can be set directly
    const scopes: Array<{ scope_type: string; scope_value?: string | null; display_label?: string | null }> = [];
    if (scope_type === "decade" && scope_value) {
      scopes.push({ scope_type: "decade", scope_value, display_label: scope_value });
    }
    if (scope_type === "genre" && scope_value) {
      scopes.push({ scope_type: "genre", scope_value, display_label: scope_value });
    }
    if (scopes.length) {
      await replaceQuestionScopes(questionId, scopes, created_by);
    }

    imported++;
  }

  return NextResponse.json({
    imported,
    skipped,
    total_fetched: questions.length,
    message: `Imported ${imported} question${imported !== 1 ? "s" : ""} (${skipped} already existed)`,
  });
}

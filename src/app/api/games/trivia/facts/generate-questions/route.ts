// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — trivia_facts/trivia_fact_question_links not in TriviaDatabase; use getTriviaDb with cast
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { getTriviaDb } from "src/lib/triviaDb";
import { generateTriviaQuestionCode } from "src/lib/triviaBank";
import { generateQuestionsFromFact } from "src/lib/triviaAIGenerator";
import { replaceQuestionScopes } from "src/lib/triviaScopes";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TriviaFact = {
  id: number;
  entity_type: string;
  entity_id: number | null;
  entity_ref: string;
  fact_text: string;
  fact_kind: string;
  status: string;
  source_record_id: number | null;
  generation_run_id: number | null;
};

type MasterLookup = {
  id: number;
  main_artist_id: number | null;
  genres: string[] | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function lookupMasterForEntity(
  entity_type: string,
  entity_id: number | null
): Promise<MasterLookup | null> {
  if (!entity_id) return null;
  if (entity_type === "master") {
    const { data } = await (supabaseAdmin as unknown as { from: (t: string) => unknown })
      .from("masters")
      .select("id, main_artist_id, genres")
      .eq("id", entity_id)
      .single() as unknown as Promise<{ data: MasterLookup | null }>;
    return data ?? null;
  }
  // For artist entity, pick the first master as genre context
  if (entity_type === "artist") {
    const { data } = await (supabaseAdmin as unknown as { from: (t: string) => unknown })
      .from("masters")
      .select("id, main_artist_id, genres")
      .eq("main_artist_id", entity_id)
      .limit(1)
      .single() as unknown as Promise<{ data: MasterLookup | null }>;
    return data ?? null;
  }
  return null;
}

async function insertQuestion(
  triviaDb: unknown,
  payload: Awaited<ReturnType<typeof generateQuestionsFromFact>>[number],
  fact: TriviaFact,
  createdBy: string
): Promise<number | null> {
  const db = triviaDb as { from: (t: string) => unknown };
  const now = new Date().toISOString();

  // Generate unique question code
  let code = "";
  for (let i = 0; i < 20; i++) {
    const candidate = generateTriviaQuestionCode();
    const { data } = await (db
      .from("trivia_questions")
      .select("id")
      .eq("question_code", candidate)
      .maybeSingle() as unknown as Promise<{ data: { id: number } | null }>);
    if (!data) { code = candidate; break; }
  }
  if (!code) return null;

  // Shuffle MC options so correct answer isn't always first
  let options = [...(payload.options_payload ?? [])];
  if (options.length > 1) {
    // Fisher-Yates shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
  }

  const { data: question, error } = await (db
    .from("trivia_questions")
    .insert({
      question_code: code,
      status: "draft",
      question_type: payload.question_type,
      prompt_text: payload.prompt_text,
      answer_key: payload.answer_key,
      accepted_answers: payload.accepted_answers,
      answer_payload: {},
      options_payload: options,
      reveal_payload: {},
      display_element_type: "song",
      explanation_text: payload.explanation_text,
      default_category: payload.default_category,
      default_difficulty: payload.difficulty_hint,
      source_note: `Generated from fact ${fact.id} (${fact.entity_ref})`,
      is_tiebreaker_eligible: true,
      cue_source_type: null,
      cue_source_payload: {},
      cue_payload: { segments: [] },
      created_by: createdBy,
      updated_by: createdBy,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single() as unknown as Promise<{ data: { id: number } | null; error: { message: string } | null }>);

  if (error || !question) { console.error("[generate-questions] insert error:", error?.message); return null; }

  const questionId = question.id;

  // Facets
  await (db
    .from("trivia_question_facets")
    .upsert({
      question_id: questionId,
      difficulty: payload.difficulty_hint,
      category: payload.default_category,
      has_media: false,
      has_required_cue: false,
    }, { onConflict: "question_id" }) as unknown as Promise<unknown>);

  // Tags
  const tags = ["ai-generated", "fact-sourced", fact.entity_type, fact.fact_kind];
  await (db
    .from("trivia_question_tags")
    .insert(tags.map((tag) => ({ question_id: questionId, tag }))) as unknown as Promise<unknown>);

  // Link to source record
  if (fact.source_record_id) {
    await (db
      .from("trivia_question_sources")
      .insert({
        question_id: questionId,
        source_record_id: fact.source_record_id,
        relationship_type: "research",
        is_primary: true,
        citation_excerpt: fact.fact_text.slice(0, 500),
        claim_text: payload.answer_key,
        created_by: createdBy,
        created_at: now,
        updated_at: now,
      }) as unknown as Promise<unknown>);
  }

  // Scopes derived from entity linkage
  const scopes: Array<{ scope_type: string; scope_ref_id?: number | null; scope_value?: string | null; display_label?: string | null }> = [];
  if (fact.entity_type === "artist" && fact.entity_id) {
    scopes.push({ scope_type: "artist", scope_ref_id: fact.entity_id, scope_value: fact.entity_ref, display_label: fact.entity_ref });
  } else if (fact.entity_type === "master" && fact.entity_id) {
    scopes.push({ scope_type: "album", scope_ref_id: fact.entity_id, scope_value: fact.entity_ref, display_label: fact.entity_ref });
    // Also try to add artist scope via master's main_artist_id
    const master = await lookupMasterForEntity("master", fact.entity_id);
    if (master?.main_artist_id) {
      // Fetch artist name
      const { data: artist } = await (supabaseAdmin as unknown as { from: (t: string) => unknown })
        .from("artists")
        .select("id, name")
        .eq("id", master.main_artist_id)
        .single() as unknown as Promise<{ data: { id: number; name: string } | null }>;
      if (artist) {
        scopes.push({ scope_type: "artist", scope_ref_id: artist.id, scope_value: artist.name, display_label: artist.name });
      }
    }
  } else if (fact.entity_type === "recording" && fact.entity_id) {
    scopes.push({ scope_type: "track", scope_ref_id: fact.entity_id, scope_value: fact.entity_ref, display_label: fact.entity_ref });
  }
  if (scopes.length > 0) {
    await replaceQuestionScopes(questionId, scopes, createdBy);
  }

  // Link fact → question
  await (db
    .from("trivia_fact_question_links")
    .insert({ fact_id: fact.id, question_id: questionId, created_at: now }) as unknown as Promise<unknown>);

  return questionId;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const triviaDb = getTriviaDb();
  const db = triviaDb as unknown as { from: (t: string) => unknown };

  let body: { fact_ids: number[]; created_by?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { fact_ids, created_by = "trivia-ai-generator" } = body;
  if (!Array.isArray(fact_ids) || fact_ids.length === 0) {
    return NextResponse.json({ error: "fact_ids must be a non-empty array" }, { status: 400 });
  }
  if (fact_ids.length > 100) {
    return NextResponse.json({ error: "Maximum 100 facts per request" }, { status: 400 });
  }

  // Load approved facts
  const { data: facts, error: factsErr } = await (db
    .from("trivia_facts")
    .select("id, entity_type, entity_id, entity_ref, fact_text, fact_kind, status, source_record_id, generation_run_id")
    .in("id", fact_ids)
    .eq("status", "approved") as unknown as Promise<{ data: TriviaFact[] | null; error: { message: string } | null }>);

  if (factsErr) return NextResponse.json({ error: factsErr.message }, { status: 500 });
  if (!facts?.length) return NextResponse.json({ error: "No approved facts found for given IDs" }, { status: 400 });

  const questionIds: number[] = [];
  const errors: Array<{ fact_id: number; error: string }> = [];

  for (const fact of facts) {
    // Fetch genre context
    const master = await lookupMasterForEntity(fact.entity_type, fact.entity_id);
    const genres = master?.genres ?? [];

    // Call Claude
    const payloads = await generateQuestionsFromFact(
      { fact_text: fact.fact_text, entity_type: fact.entity_type, entity_ref: fact.entity_ref, fact_kind: fact.fact_kind },
      { genres },
      2
    );

    if (!payloads.length) {
      errors.push({ fact_id: fact.id, error: "AI returned no valid questions" });
      continue;
    }

    for (const payload of payloads) {
      const qId = await insertQuestion(triviaDb, payload, fact, created_by);
      if (qId) questionIds.push(qId);
      else errors.push({ fact_id: fact.id, error: "Insert failed" });
    }
  }

  return NextResponse.json({
    generated_count: questionIds.length,
    facts_processed: facts.length,
    question_ids: questionIds,
    errors: errors.length ? errors : undefined,
  });
}

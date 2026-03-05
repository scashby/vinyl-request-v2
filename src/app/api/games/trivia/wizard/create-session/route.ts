import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb, type TriviaDatabase } from "src/lib/triviaDb";
import { generateTriviaDeckCode, hasRequiredCueSource, type JsonValue } from "src/lib/triviaBank";
import { TRIVIA_BANK_ENABLED, asString } from "src/lib/triviaBankApi";
import { loadQuestionSnapshotsByIds } from "src/lib/triviaDeckSnapshots";

export const runtime = "nodejs";

type WizardCreateSessionBody = {
  event_id?: number | null;
  title?: string;
  deck_title?: string;
  round_count?: number;
  questions_per_round?: number;
  tie_breaker_count?: number;
  score_mode?: "standard" | "difficulty_bonus_static";
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_rounds?: boolean;
  show_question_counter?: boolean;
  show_leaderboard?: boolean;
  show_cue_hints?: boolean;
  max_teams?: number | null;
  slips_batch_size?: number | null;
  team_names?: string[];
  question_ids?: number[];
};

async function generateUniqueDeckCode() {
  const db = getTriviaDb();
  for (let i = 0; i < 20; i += 1) {
    const code = generateTriviaDeckCode();
    const { data } = await db.from("trivia_decks").select("id").eq("deck_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique deck code");
}

function asNumber(value: unknown, fallback: number, min = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

function normalizeTeamNames(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );
}

function normalizeQuestionIds(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value))
    )
  );
}

function snapshotHasPromptAnswerAndCue(snapshotPayload: JsonValue): boolean {
  if (!snapshotPayload || typeof snapshotPayload !== "object" || Array.isArray(snapshotPayload)) return false;
  const snapshot = snapshotPayload as Record<string, unknown>;
  const promptText = typeof snapshot.prompt_text === "string" ? snapshot.prompt_text.trim() : "";
  const answerKey = typeof snapshot.answer_key === "string" ? snapshot.answer_key.trim() : "";
  if (!promptText || !answerKey) return false;

  return hasRequiredCueSource({
    cueSourceType: snapshot.cue_source_type,
    cueSourcePayload: snapshot.cue_source_payload,
    primaryCueStartSeconds: snapshot.primary_cue_start_seconds,
  });
}

export async function POST(request: NextRequest) {
  if (!TRIVIA_BANK_ENABLED) {
    return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as WizardCreateSessionBody;
  const roundCount = asNumber(body.round_count, 2, 1);
  const questionsPerRound = asNumber(body.questions_per_round, 5, 1);
  const tieBreakerCount = asNumber(body.tie_breaker_count, 0, 0);
  const requiredCount = (roundCount * questionsPerRound) + tieBreakerCount;
  const questionIds = normalizeQuestionIds(body.question_ids);
  const teamNames = normalizeTeamNames(body.team_names);

  if (teamNames.length < 2) {
    return NextResponse.json({ error: "At least 2 teams are required." }, { status: 400 });
  }
  if (questionIds.length < requiredCount) {
    return NextResponse.json(
      { error: `This setup needs ${requiredCount} questions, but only ${questionIds.length} were provided.` },
      { status: 400 }
    );
  }

  const db = getTriviaDb();
  const selectedQuestionIds = questionIds.slice(0, requiredCount);
  const snapshotByQuestion = await loadQuestionSnapshotsByIds(db, selectedQuestionIds);

  const missingQuestionIds = selectedQuestionIds.filter((questionId) => !snapshotByQuestion.has(questionId));
  if (missingQuestionIds.length > 0) {
    return NextResponse.json({ error: `Some selected questions could not be loaded: ${missingQuestionIds.join(", ")}` }, { status: 400 });
  }

  for (const questionId of selectedQuestionIds) {
    const snapshot = snapshotByQuestion.get(questionId) as unknown as JsonValue;
    if (!snapshotHasPromptAnswerAndCue(snapshot)) {
      return NextResponse.json(
        { error: `Question ${questionId} is missing a required vinyl cue source or cue start time.` },
        { status: 400 }
      );
    }
  }

  const now = new Date().toISOString();
  const deckCode = await generateUniqueDeckCode();
  const deckTitle = asString(body.deck_title) || `${asString(body.title) || "Music Trivia"} Deck`;

  const { data: deck, error: deckError } = await db
    .from("trivia_decks")
    .insert({
      deck_code: deckCode,
      title: deckTitle,
      status: "ready",
      event_id: Number.isFinite(Number(body.event_id)) ? Number(body.event_id) : null,
      playlist_id: null,
      build_mode: "manual",
      rules_payload: {
        round_count: roundCount,
        questions_per_round: questionsPerRound,
        tie_breaker_count: tieBreakerCount,
        target_count: roundCount * questionsPerRound,
        filters: {
          has_required_cue: true,
          statuses: ["published"],
        },
      } as JsonValue,
      cooldown_days: 90,
      created_by: "wizard",
      created_at: now,
      updated_at: now,
      locked_at: now,
    })
    .select("id")
    .single();

  if (deckError || !deck) {
    return NextResponse.json({ error: deckError?.message ?? "Failed to create deck" }, { status: 500 });
  }

  const rows: TriviaDatabase["public"]["Tables"]["trivia_deck_items"]["Insert"][] = selectedQuestionIds.map((questionId, index) => {
    const callIndex = index + 1;
    const isTieBreaker = callIndex > (roundCount * questionsPerRound);
    const roundNumber = isTieBreaker
      ? (roundCount + 1)
      : (Math.floor(index / questionsPerRound) + 1);

    return {
      deck_id: deck.id,
      item_index: callIndex,
      round_number: roundNumber,
      is_tiebreaker: isTieBreaker,
      question_id: questionId,
      snapshot_payload: snapshotByQuestion.get(questionId) as unknown as JsonValue,
      locked: true,
      created_at: now,
      updated_at: now,
    };
  });

  const { error: itemsError } = await db.from("trivia_deck_items").insert(rows);
  if (itemsError) {
    await db.from("trivia_decks").delete().eq("id", deck.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const sessionUrl = new URL("/api/games/trivia/sessions", request.url);
  const sessionResponse = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_id: Number.isFinite(Number(body.event_id)) ? Number(body.event_id) : null,
      deck_id: deck.id,
      title: asString(body.title) || "Music Trivia Session",
      round_count: roundCount,
      questions_per_round: questionsPerRound,
      tie_breaker_count: tieBreakerCount,
      score_mode: body.score_mode ?? "difficulty_bonus_static",
      remove_resleeve_seconds: asNumber(body.remove_resleeve_seconds, 20, 0),
      find_record_seconds: asNumber(body.find_record_seconds, 12, 0),
      cue_seconds: asNumber(body.cue_seconds, 12, 0),
      host_buffer_seconds: asNumber(body.host_buffer_seconds, 8, 0),
      show_title: body.show_title ?? true,
      show_rounds: body.show_rounds ?? true,
      show_question_counter: body.show_question_counter ?? true,
      show_leaderboard: body.show_leaderboard ?? true,
      show_cue_hints: body.show_cue_hints ?? false,
      max_teams: Number.isFinite(Number(body.max_teams)) ? Number(body.max_teams) : null,
      slips_batch_size: Number.isFinite(Number(body.slips_batch_size)) ? Number(body.slips_batch_size) : null,
      team_names: teamNames,
    }),
  });

  const sessionPayload = await sessionResponse.json().catch(() => null);
  if (!sessionResponse.ok) {
    await db.from("trivia_decks").delete().eq("id", deck.id);
    return NextResponse.json(sessionPayload ?? { error: "Failed to create session" }, { status: sessionResponse.status });
  }

  return NextResponse.json({
    ok: true,
    deck_id: deck.id,
    session: sessionPayload,
  }, { status: 201 });
}

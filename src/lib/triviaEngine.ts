import type { TriviaDbClient } from "src/lib/triviaDb";

export type TriviaSessionStatus = "pending" | "running" | "paused" | "completed";
export type TriviaCallStatus = "pending" | "asked" | "answer_revealed" | "scored" | "skipped";
export type TriviaDifficulty = "easy" | "medium" | "hard";
export type TriviaScoreMode = "standard" | "difficulty_bonus_static";

export type TriviaSessionCountdownRow = {
  status: TriviaSessionStatus;
  target_gap_seconds: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
  paused_at: string | null;
};

export type CreateTriviaCallsInput = {
  sessionId: number;
  roundCount: number;
  questionsPerRound: number;
  categories: string[];
  scoreMode: TriviaScoreMode;
  difficultyTargets?: Partial<Record<TriviaDifficulty, number>>;
};

type TriviaCallInsertRow = {
  session_id: number;
  round_number: number;
  call_index: number;
  category: string;
  difficulty: TriviaDifficulty;
  question_text: string;
  answer_key: string;
  accepted_answers: string[];
  source_note: string | null;
  base_points: number;
  bonus_points: number;
  status: TriviaCallStatus;
};

const DEFAULT_CATEGORIES = [
  "General Music",
  "Classic Rock",
  "Soul & Funk",
  "Hip-Hop",
  "80s",
  "90s",
  "One-Hit Wonders",
];

function normalizeCategories(categories: string[]): string[] {
  const cleaned = categories.map((value) => value.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : DEFAULT_CATEGORIES;
}

function buildDifficultyStack(
  totalQuestions: number,
  difficultyTargets?: Partial<Record<TriviaDifficulty, number>>
): TriviaDifficulty[] {
  const easyTarget = Math.max(0, difficultyTargets?.easy ?? 2);
  const mediumTarget = Math.max(0, difficultyTargets?.medium ?? 2);
  const hardTarget = Math.max(0, difficultyTargets?.hard ?? 1);
  const seed: TriviaDifficulty[] = [
    ...Array.from({ length: easyTarget }, () => "easy" as const),
    ...Array.from({ length: mediumTarget }, () => "medium" as const),
    ...Array.from({ length: hardTarget }, () => "hard" as const),
  ];
  const fallback: TriviaDifficulty[] = ["easy", "medium", "medium", "hard"];
  const source = seed.length > 0 ? seed : fallback;

  return Array.from({ length: totalQuestions }, (_, index) => source[index % source.length] ?? "medium");
}

function getBonusPoints(scoreMode: TriviaScoreMode, difficulty: TriviaDifficulty): number {
  if (scoreMode !== "difficulty_bonus_static") return 0;
  return difficulty === "hard" ? 1 : 0;
}

export function computeTriviaRemainingSeconds(session: TriviaSessionCountdownRow): number {
  if (session.paused_at) {
    return Math.max(0, session.paused_remaining_seconds ?? session.target_gap_seconds);
  }
  if (!session.countdown_started_at) return session.target_gap_seconds;

  const started = new Date(session.countdown_started_at).getTime();
  if (!Number.isFinite(started)) return session.target_gap_seconds;
  const elapsed = Math.floor((Date.now() - started) / 1000);
  return Math.max(0, session.target_gap_seconds - elapsed);
}

export function getDefaultAwardedPoints(params: {
  scoreMode: TriviaScoreMode;
  difficulty: TriviaDifficulty;
  basePoints: number;
  bonusPoints: number;
  correct: boolean;
}): number {
  if (!params.correct) return 0;
  if (params.scoreMode === "difficulty_bonus_static") {
    return params.basePoints + getBonusPoints(params.scoreMode, params.difficulty);
  }
  return params.basePoints + Math.max(0, params.bonusPoints);
}

export async function generateTriviaSessionCalls(db: TriviaDbClient, input: CreateTriviaCallsInput): Promise<void> {
  const totalQuestions = Math.max(1, input.roundCount * input.questionsPerRound);
  const categories = normalizeCategories(input.categories);
  const difficulties = buildDifficultyStack(totalQuestions, input.difficultyTargets);

  const rows: TriviaCallInsertRow[] = Array.from({ length: totalQuestions }, (_, index) => {
    const callIndex = index + 1;
    const roundNumber = Math.floor(index / input.questionsPerRound) + 1;
    const category = categories[index % categories.length] ?? "General Music";
    const difficulty = difficulties[index] ?? "medium";
    const answerKey = `Answer ${callIndex}`;
    return {
      session_id: input.sessionId,
      round_number: roundNumber,
      call_index: callIndex,
      category,
      difficulty,
      question_text: `[${category} • ${difficulty.toUpperCase()}] Placeholder question ${callIndex}. Replace with your curated prompt.`,
      answer_key: answerKey,
      accepted_answers: [answerKey],
      source_note: "Placeholder generated in setup",
      base_points: 1,
      bonus_points: getBonusPoints(input.scoreMode, difficulty),
      status: "pending",
    };
  });

  const { error } = await db.from("trivia_session_calls").insert(rows);
  if (error) throw new Error(error.message);
}

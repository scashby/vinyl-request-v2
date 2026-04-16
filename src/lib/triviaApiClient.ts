/**
 * triviaApiClient.ts
 *
 * Client for The Trivia API (https://the-trivia-api.com)
 * Free for non-commercial use — no API key required.
 * Fetches music trivia questions with correct answer + 3 wrong options already included.
 */

const BASE_URL = "https://the-trivia-api.com/v2";

export type TriviaApiQuestion = {
  id: string;
  category: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  question: { text: string };
  tags: string[];
  type: string;
  difficulty: "easy" | "medium" | "hard";
  regions: string[];
  isNiche: boolean;
};

export type TriviaApiFetchParams = {
  limit?: number;                              // max per request (default 50)
  difficulties?: ("easy" | "medium" | "hard")[];
  tags?: string[];                             // e.g. ["1980s"], ["rock"], ["pop_music"]
};

/**
 * Fetch music trivia questions from The Trivia API.
 * Always filters to category=music.
 * Returns an empty array on failure rather than throwing, so callers can handle gracefully.
 */
export async function fetchTriviaApiQuestions(
  params: TriviaApiFetchParams = {}
): Promise<TriviaApiQuestion[]> {
  const url = new URL(`${BASE_URL}/questions`);
  url.searchParams.set("categories", "music");

  const limit = Math.min(Math.max(1, params.limit ?? 50), 50);
  url.searchParams.set("limit", String(limit));

  if (params.difficulties?.length) {
    url.searchParams.set("difficulties", params.difficulties.join(","));
  }
  if (params.tags?.length) {
    url.searchParams.set("tags", params.tags.join(","));
  }

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "vinyl-request-trivia/1.0" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Trivia API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as unknown;
  if (!Array.isArray(data)) return [];
  return (data as TriviaApiQuestion[]).filter(isValidQuestion);
}

function isValidQuestion(q: unknown): q is TriviaApiQuestion {
  if (!q || typeof q !== "object") return false;
  const obj = q as Record<string, unknown>;
  if (typeof obj.id !== "string") return false;
  if (!obj.question || typeof (obj.question as Record<string, unknown>).text !== "string") return false;
  if (typeof obj.correctAnswer !== "string") return false;
  if (!Array.isArray(obj.incorrectAnswers) || obj.incorrectAnswers.length < 1) return false;
  return true;
}

/**
 * Map decade string ("1980s", "2000s") to the tag used by The Trivia API.
 * Returns null if the value isn't a recognised decade.
 */
export function decadeToTag(decade: string): string | null {
  const m = decade.match(/(\d{4})/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const d = Math.floor(year / 10) * 10;
  return `${d}s`;
}

/**
 * Map genre string to The Trivia API tag format (lowercase, underscores).
 * Only known useful tags are supported.
 */
export function genreToTag(genre: string): string | null {
  const map: Record<string, string> = {
    pop: "pop_music",
    rock: "rock_music",
    "hip hop": "hip_hop",
    "hip-hop": "hip_hop",
    country: "country_music",
    jazz: "jazz",
    classical: "classical_music",
    "r&b": "rnb",
    soul: "soul_music",
    punk: "punk",
    metal: "heavy_metal",
    "heavy metal": "heavy_metal",
    alternative: "alternative_music",
    indie: "indie_music",
    electronic: "electronic_music",
    dance: "dance_music",
    reggae: "reggae",
    folk: "folk_music",
    blues: "blues",
  };
  return map[genre.toLowerCase()] ?? null;
}

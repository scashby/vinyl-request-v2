/**
 * triviaAIGenerator.ts
 *
 * Calls the Anthropic Messages API (native fetch, no SDK dependency) to
 * generate trivia question payloads from a single approved fact.
 *
 * Requires env var: ANTHROPIC_API_KEY
 */

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIQuestionPayload = {
  question_type: "multiple_choice" | "free_response" | "true_false";
  prompt_text: string;
  answer_key: string;
  accepted_answers: string[];
  options_payload: string[];   // MC options (shuffled); empty for free_response/true_false
  explanation_text: string;
  default_category: string;
  difficulty_hint: "easy" | "medium" | "hard";
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

type AnthropicRequest = {
  model: string;
  max_tokens: number;
  system: string;
  messages: AnthropicMessage[];
};

type AnthropicResponse = {
  content: Array<{ type: string; text: string }>;
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a music trivia expert creating questions for vinyl record enthusiasts at a brewery music event.

Rules:
- Generate questions based ONLY on information explicitly stated in the provided fact. Do not invent or infer details not present.
- Prefer questions about recording context, production history, cultural impact, and surprising specifics over simple "who sang X" identification questions.
- Multiple choice options must be plausible but clearly wrong — use real names/places/years from the same era and genre when possible.
- True/false questions should have a clear, verifiable answer based solely on the fact.
- Explanation text should cite the fact as context (1-2 sentences).
- Default category must be one of: "Recording Context", "Artist History", "Album Facts", "Production", "Cultural Impact".
- Return ONLY a valid JSON array. No prose, no markdown, no code fences.`;

function buildUserPrompt(
  entityRef: string,
  entityType: string,
  factText: string,
  factKind: string,
  genres: string[],
  count: number
): string {
  const genreCtx = genres.length ? genres.slice(0, 3).join(", ") : "unknown";
  return `Entity: ${entityRef} (${entityType})
Fact kind: ${factKind}
Genre context: ${genreCtx}
Fact: ${factText}

Generate ${count} trivia question(s) based ONLY on this fact. Mix question types when count > 1 — include at least one multiple-choice.

Return a JSON array with this exact shape:
[
  {
    "question_type": "multiple_choice" | "free_response" | "true_false",
    "prompt_text": "...",
    "answer_key": "...",
    "accepted_answers": ["...", "..."],
    "options_payload": ["correct answer", "wrong1", "wrong2", "wrong3"],
    "explanation_text": "...",
    "default_category": "Recording Context" | "Artist History" | "Album Facts" | "Production" | "Cultural Impact",
    "difficulty_hint": "easy" | "medium" | "hard"
  }
]

Notes:
- options_payload: 4 items for multiple_choice (first is correct, rest are plausible distractors), empty [] for other types
- accepted_answers: include common alternate phrasings for free_response
- difficulty_hint: easy = widely known, medium = enthusiast knowledge, hard = deep cut`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidPayload(item: unknown): item is AIQuestionPayload {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  if (!["multiple_choice", "free_response", "true_false"].includes(obj.question_type as string)) return false;
  if (typeof obj.prompt_text !== "string" || !obj.prompt_text.trim()) return false;
  if (typeof obj.answer_key !== "string" || !obj.answer_key.trim()) return false;
  if (!Array.isArray(obj.accepted_answers)) return false;
  if (!Array.isArray(obj.options_payload)) return false;
  if (typeof obj.explanation_text !== "string") return false;
  if (typeof obj.default_category !== "string") return false;
  if (!["easy", "medium", "hard"].includes(obj.difficulty_hint as string)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Core generation function
// ---------------------------------------------------------------------------

export async function generateQuestionsFromFact(
  fact: {
    fact_text: string;
    entity_type: string;
    entity_ref: string;
    fact_kind: string;
  },
  context: {
    genres?: string[];
  } = {},
  count = 2
): Promise<AIQuestionPayload[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[triviaAIGenerator] ANTHROPIC_API_KEY not set — skipping generation");
    return [];
  }

  const userPrompt = buildUserPrompt(
    fact.entity_ref,
    fact.entity_type,
    fact.fact_text,
    fact.fact_kind,
    context.genres ?? [],
    count
  );

  const body: AnthropicRequest = {
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  };

  let rawText = "";
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[triviaAIGenerator] API error", res.status, errText);
      return [];
    }

    const json = (await res.json()) as AnthropicResponse;
    rawText = json?.content?.find((c) => c.type === "text")?.text ?? "";
    if (!rawText.trim()) return [];

    // Strip markdown code fences if model wrapped the JSON
    const stripped = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(stripped);

    if (!Array.isArray(parsed)) {
      console.error("[triviaAIGenerator] Expected array, got:", typeof parsed);
      return [];
    }

    return parsed.filter(isValidPayload);
  } catch (err) {
    console.error("[triviaAIGenerator] Parse/fetch error:", err, "\nRaw:", rawText.slice(0, 500));
    return [];
  }
}

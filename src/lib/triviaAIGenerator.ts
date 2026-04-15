/**
 * triviaAIGenerator.ts
 *
 * Two-phase AI pipeline for music trivia:
 *
 * Phase 1 — generateRawTrivia(): Ask Claude what *surprising* trivia it knows
 *   about an artist or album. This is the primary source of interesting facts —
 *   the kind that makes pub quiz players say "wait, really?!"
 *   Uses claude-sonnet-4-6 for deep music knowledge.
 *
 * Phase 2 — generateQuestionsFromFact(): Convert an approved fact into playable
 *   trivia questions (MC, T/F, free response).
 *   Uses claude-haiku-4-5-20251001 for cost-efficient formatting.
 *
 * Requires env var: ANTHROPIC_API_KEY
 */

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Sonnet for trivia *generation* — needs broad music knowledge
const TRIVIA_MODEL = "claude-sonnet-4-6";
// Haiku for question *formatting* — just needs to follow a schema
const QUESTION_MODEL = "claude-haiku-4-5-20251001";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RawTriviaFact = {
  fact: string;
  kind:
    | "name_origin"
    | "connection"
    | "pre_fame"
    | "collaboration"
    | "personal"
    | "song_history"
    | "band_history"
    | "unusual_skill"
    | "other";
};

export type AIQuestionPayload = {
  question_type: "multiple_choice" | "free_response" | "true_false";
  prompt_text: string;
  answer_key: string;
  accepted_answers: string[];
  options_payload: string[]; // MC: 4 items (correct first); empty for other types
  explanation_text: string;
  default_category: string;
  difficulty_hint: "easy" | "medium" | "hard";
};

type AnthropicRequest = {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

type AnthropicResponse = {
  content: Array<{ type: string; text: string }>;
};

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

async function callAnthropic(body: AnthropicRequest): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[triviaAIGenerator] ANTHROPIC_API_KEY not set");
    return "";
  }

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
    console.error("[triviaAIGenerator] API error", res.status, await res.text());
    return "";
  }

  const json = (await res.json()) as AnthropicResponse;
  return json?.content?.find((c) => c.type === "text")?.text ?? "";
}

function parseJsonFromText<T>(raw: string): T | null {
  if (!raw.trim()) return null;
  try {
    const stripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(stripped) as T;
  } catch (err) {
    console.error("[triviaAIGenerator] JSON parse error:", err, "\nRaw:", raw.slice(0, 500));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 1 — Generate raw trivia facts from Claude's knowledge
// ---------------------------------------------------------------------------

const TRIVIA_SYSTEM_PROMPT = `You are an expert music trivia researcher for a vinyl record pub quiz.

Your job is to surface SURPRISING, COUNTERINTUITIVE, and LITTLE-KNOWN facts — the kind that make people say "wait, really?!" These should be fun, specific, and unexpected. Think: Pop-Up Video, VH1 Behind the Music, Jeopardy, pub quiz night.

GREAT trivia examples (aim for this quality and specificity):
- "Steely Dan is named after a steam-powered dildo in William S. Burroughs' novel Naked Lunch"
- "Lemmy Kilmister was a roadie for Jimi Hendrix before forming Motörhead"
- "Bruce Springsteen originally wrote 'Hungry Heart' to give to the Ramones"
- "Lynyrd Skynyrd named themselves after their high school PE teacher, Leonard Skinner, who once suspended them for having long hair"
- "Mick Jagger sings uncredited background vocals on Carly Simon's 'You're So Vain'"
- "Members of Guns N' Roses and the Red Hot Chili Peppers attended the same high school"
- "Pantera originally played glam metal and released five albums before reinventing themselves with Cowboys from Hell"
- "Bruce Dickinson of Iron Maiden is a licensed commercial airline pilot and has flown the band's touring aircraft"
- "The Beastie Boys are credited with coining the word 'mullet' in their 1994 song 'Mullet Head'"

DO include:
- Unexpected connections between famous artists
- Origins of band names, album titles, or song titles (especially bizarre ones)
- Pre-fame jobs, side careers, or early band identities
- Famous collaborations or appearances most people don't know about
- Surprising personal facts (unusual skills, professions, lifestyle)
- Songs that were written for or rejected by other artists
- Band lineup connections (schoolmates, ex-bandmates of famous people)
- Near-misses or rejected deals that changed music history

DO NOT include:
- Chart positions or sales figures ("reached #3 on the Billboard chart")
- Generic biographical summaries ("was formed in 1975 in Los Angeles")
- Critical reception platitudes ("was well-received by critics")
- Things that are commonly known and not surprising
- Anything you're not confident about — accuracy matters for a quiz

Return ONLY a valid JSON array. No prose, no markdown fences.`;

function buildTriviaPrompt(
  entityRef: string,
  entityType: string,
  genres: string[],
  existingContext: string
): string {
  const genreCtx = genres.length ? genres.slice(0, 4).join(", ") : "";
  const contextSection = existingContext.trim()
    ? `\nBackground context (for reference only — generate trivia that goes BEYOND this):\n${existingContext.slice(0, 800)}`
    : "";

  return `Generate 6-8 surprising trivia facts about: ${entityRef} (${entityType}${genreCtx ? `, ${genreCtx}` : ""})${contextSection}

Return a JSON array:
[
  {
    "fact": "The full, specific trivia statement as you would say it on a quiz show.",
    "kind": "name_origin" | "connection" | "pre_fame" | "collaboration" | "personal" | "song_history" | "band_history" | "unusual_skill" | "other"
  }
]

Each fact must be:
- Specific and verifiable (include names, dates, titles where relevant)
- Surprising — not something casual fans would immediately know
- Phrased as a complete, standalone statement (not a question)
- At least 20 words`;
}

function isValidRawFact(item: unknown): item is RawTriviaFact {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  if (typeof obj.fact !== "string" || obj.fact.trim().length < 20) return false;
  if (typeof obj.kind !== "string") return false;
  return true;
}

export async function generateRawTrivia(
  entityRef: string,
  entityType: string,
  context: {
    genres?: string[];
    existingContext?: string; // notes, bio text, etc. — used as background only
  } = {}
): Promise<RawTriviaFact[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const raw = await callAnthropic({
    model: TRIVIA_MODEL,
    max_tokens: 1500,
    system: TRIVIA_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildTriviaPrompt(
          entityRef,
          entityType,
          context.genres ?? [],
          context.existingContext ?? ""
        ),
      },
    ],
  });

  const parsed = parseJsonFromText<RawTriviaFact[]>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidRawFact);
}

// ---------------------------------------------------------------------------
// Phase 2 — Convert a trivia fact into playable questions
// ---------------------------------------------------------------------------

const QUESTION_SYSTEM_PROMPT = `You are a music trivia question writer for a vinyl record pub quiz at a brewery.

Given a surprising trivia fact, write 1-2 engaging quiz questions. The questions should feel fun and surprising — not dry or academic. If the fact is genuinely interesting, let that come through in the question.

Rules:
- Write questions that test whether players know the fact, not generic questions about the artist
- Multiple choice distractors must be plausible — use real artists/places/years from the same era
- For true/false, make the false version plausible enough to fool people
- The explanation should briefly confirm why the answer is correct (1-2 sentences)
- Default category: "Name Origins", "Connections", "Side Projects", "Song History", "Personal Facts", "Band History", or "Collaborations"
- Return ONLY a valid JSON array. No prose, no markdown fences.`;

function buildQuestionPrompt(
  entityRef: string,
  fact: string,
  factKind: string,
  genres: string[],
  count: number
): string {
  const genreCtx = genres.length ? ` (${genres.slice(0, 3).join(", ")})` : "";
  return `Artist/Album: ${entityRef}${genreCtx}
Fact type: ${factKind}
Trivia fact: ${fact}

Write ${count} quiz question(s) based on this fact. Mix types if count > 1 (include at least one multiple-choice).

Return JSON array:
[
  {
    "question_type": "multiple_choice" | "free_response" | "true_false",
    "prompt_text": "The question as asked on a quiz show",
    "answer_key": "The correct answer",
    "accepted_answers": ["correct answer", "alternate phrasing if any"],
    "options_payload": ["correct answer", "wrong but plausible 1", "wrong but plausible 2", "wrong but plausible 3"],
    "explanation_text": "Brief confirmation of why this is correct.",
    "default_category": "Name Origins" | "Connections" | "Side Projects" | "Song History" | "Personal Facts" | "Band History" | "Collaborations",
    "difficulty_hint": "easy" | "medium" | "hard"
  }
]

Notes:
- options_payload: 4 items for multiple_choice (correct first), empty [] for other types
- difficulty: easy = widely known, medium = music enthusiast, hard = deep cut knowledge`;
}

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

export async function generateQuestionsFromFact(
  fact: {
    fact_text: string;
    entity_type: string;
    entity_ref: string;
    fact_kind: string;
  },
  context: { genres?: string[] } = {},
  count = 2
): Promise<AIQuestionPayload[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[triviaAIGenerator] ANTHROPIC_API_KEY not set — skipping generation");
    return [];
  }

  const raw = await callAnthropic({
    model: QUESTION_MODEL,
    max_tokens: 1024,
    system: QUESTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildQuestionPrompt(
          fact.entity_ref,
          fact.fact_text,
          fact.fact_kind,
          context.genres ?? [],
          count
        ),
      },
    ],
  });

  const parsed = parseJsonFromText<AIQuestionPayload[]>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidPayload);
}

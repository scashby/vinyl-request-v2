/**
 * triviaAIGenerator.ts
 *
 * Two-phase AI pipeline for music trivia:
 *
 * Phase 1 — generateRawTrivia(): Ask Claude Sonnet to write pub quiz Q&A pairs
 *   directly. Questions should be specific, verifiable, short-answer — the kind
 *   you'd find on a music trivia game show or VH1's pop-up video.
 *   Style examples:
 *     Q: What rock guitarist played on Michael Jackson's "Beat It"?  A: Eddie Van Halen
 *     Q: What actor appeared in Paul Simon's "You Can Call Me Al" video?  A: Chevy Chase
 *     Q: What "General Hospital" actor had a 1984 hit with "All I Need"?  A: Jack Wagner
 *
 * Phase 2 — generateQuestionsFromFact(): Take an approved Q&A pair and format it
 *   for the game: shuffle multiple-choice options, assign category/difficulty,
 *   write explanation. Uses Haiku for cost-efficient formatting.
 *
 * Requires env var: ANTHROPIC_API_KEY
 */

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const TRIVIA_MODEL = "claude-sonnet-4-6";
const QUESTION_MODEL = "claude-haiku-4-5-20251001";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RawTriviaFact = {
  question: string; // The trivia question as asked in a pub quiz
  answer: string;   // The specific correct answer (ideally 1–5 words)
  kind:
    | "lyric"
    | "crossover"       // musician in TV/film, actor in video
    | "cover_version"
    | "chart_fact"
    | "band_member"
    | "collaboration"   // famous guest appearance on another artist's song
    | "historical_first"
    | "stage_name"
    | "personal"        // marriage, relationships, real name
    | "connection"      // schoolmates, shared history
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
    const errBody = await res.text();
    console.error("[triviaAIGenerator] API error", res.status, errBody);
    throw new Error(`Anthropic API ${res.status}: ${errBody.slice(0, 200)}`);
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
// Phase 1 — Generate pub quiz Q&A pairs from Claude's knowledge
// ---------------------------------------------------------------------------

const TRIVIA_SYSTEM_PROMPT = `You are a music trivia expert writing questions for a vinyl record pub quiz at a brewery.

Write questions about CONNECTIONS — how an artist or album connects to other famous people, other bands, movies, TV shows, historical moments, unexpected collaborations, and surprising backstories. These are the questions that make a pub go quiet for a second and then explode with "wait, REALLY?!"

PERFECT EXAMPLES — match this style exactly:

Artist trivia:
- Q: What rock guitarist played on Michael Jackson's "Beat It"? A: Eddie Van Halen
- Q: What "General Hospital" actor had a 1984 Top 40 hit with "All I Need"? A: Jack Wagner
- Q: What actor appeared in Paul Simon's "You Can Call Me Al" video? A: Chevy Chase
- Q: "Hungry Heart" was originally written by Bruce Springsteen to give to which band? A: The Ramones
- Q: What "Friends" actress dances on stage with Bruce Springsteen in the "Dancing in the Dark" video? A: Courteney Cox
- Q: Lemmy Kilmister was a roadie for which rock legend before forming Motörhead? A: Jimi Hendrix
- Q: Lynyrd Skynyrd named themselves after which real person? A: Leonard Skinner, their high school PE teacher
- Q: Mick Jagger sang uncredited backing vocals on what Carly Simon song? A: "You're So Vain"
- Q: Before using his real last name, John Mellencamp went by what stage name? A: John Cougar
- Q: Which musician performed at both the US and London stages of 1985's Live Aid? A: Phil Collins

Album trivia:
- Q: The Clash's "London Calling" album cover is a tribute to the debut album of which artist? A: Elvis Presley
- Q: The Beatles recorded "With a Little Help from My Friends" in a single take — who sang lead? A: Ringo Starr
- Q: What classic novel inspired the title of The Beastie Boys' debut album "Licensed to Ill"? A: It was originally titled "Don't Be a Faggot" — changed by the label
- Q: Pink Floyd's "The Wall" was partly inspired by which band member's breakdown on stage? A: Roger Waters
- Q: What song on Fleetwood Mac's "Rumours" was written about Mick Fleetwood's divorce? A: "The Chain"
- Q: Which famous guitarist played the solo on Michael Jackson's "Thriller" album track "Beat It"? A: Eddie Van Halen
- Q: The cover of The Velvet Underground's debut album featured artwork by which pop artist? A: Andy Warhol

QUESTION TYPES TO USE (mix generously):
- Album cover art: origins, tributes, who designed it, what it references
- Songs offered to or rejected by other artists before being recorded
- Surprise guest musicians on specific tracks
- Real events or people that inspired an album or song
- TV/film crossovers: musician in a show, actor in a video
- Cover versions: who originally wrote/recorded the song
- Pre-fame stories about band members
- Band name origins (only when genuinely surprising)
- Stage names and aliases
- Songs written about specific real people

NEVER write questions about:
- Chart positions or Billboard rankings ("peaked at #59")
- Generic production credits ("who produced this album?")
- Track listings or album sequencing
- Recording studio names
- Deep-cut lyrics that only hardcore fans know
- Anything a Wikipedia "Discography" section would list as a dry fact

The test: would this question surprise someone at a pub? If yes, include it. If it sounds like a music encyclopedia entry, skip it.

Return ONLY a valid JSON array. No prose, no markdown fences.`;

function buildTriviaPrompt(
  entityRef: string,
  entityType: string,
  genres: string[]
): string {
  const genreCtx = genres.length ? ` (${genres.slice(0, 4).join(", ")})` : "";

  return `Generate 8–10 pub quiz trivia Q&A pairs about: ${entityRef} (${entityType}${genreCtx})

Mix question types: include lyrics, collaborations, crossovers, cover versions, band history, personal facts, chart facts, and surprising connections.

Return a JSON array:
[
  {
    "question": "The full question exactly as asked in a pub quiz",
    "answer": "The specific correct answer",
    "kind": "lyric" | "crossover" | "cover_version" | "chart_fact" | "band_member" | "collaboration" | "historical_first" | "stage_name" | "personal" | "connection" | "other"
  }
]

Each Q&A must:
- Have a single unambiguous correct answer
- Be specific enough that an informed person can verify it
- Be fun and suitable for a general music audience`;
}

function isValidRawFact(item: unknown): item is RawTriviaFact {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  if (typeof obj.question !== "string" || obj.question.trim().length < 10) return false;
  if (typeof obj.answer !== "string" || obj.answer.trim().length < 1) return false;
  if (typeof obj.kind !== "string") return false;
  return true;
}

export async function generateRawTrivia(
  entityRef: string,
  entityType: string,
  context: { genres?: string[] } = {}
): Promise<RawTriviaFact[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  console.log(`[triviaAIGenerator] generateRawTrivia: ${entityType} "${entityRef}"`);

  const raw = await callAnthropic({
    model: TRIVIA_MODEL,
    max_tokens: 2000,
    system: TRIVIA_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildTriviaPrompt(entityRef, entityType, context.genres ?? []),
      },
    ],
  });

  const parsed = parseJsonFromText<RawTriviaFact[]>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidRawFact);
}

// ---------------------------------------------------------------------------
// Phase 2 — Format an approved Q&A pair into a game-ready question
// ---------------------------------------------------------------------------

const QUESTION_SYSTEM_PROMPT = `You are a music trivia formatter for a vinyl record pub quiz at a brewery.

You will receive a trivia question and its correct answer. Your job is to:
1. Keep the question text exactly as given (do not rewrite it)
2. Generate 3 plausible but wrong multiple-choice options from the same era/genre
3. Assign a category and difficulty
4. Write a brief explanation (1-2 sentences) confirming why the answer is correct

Wrong answer options must be:
- From the same era and genre as the correct answer
- Plausible enough to genuinely fool someone
- Real artists, songs, people, or things (not made up)

Return ONLY a valid JSON array. No prose, no markdown fences.`;

function buildQuestionPrompt(
  entityRef: string,
  question: string,
  answer: string,
  genres: string[]
): string {
  const genreCtx = genres.length ? ` (${genres.slice(0, 3).join(", ")})` : "";
  return `Artist/Album: ${entityRef}${genreCtx}

Question: ${question}
Correct Answer: ${answer}

Format this as a multiple-choice quiz question with 3 plausible wrong options.

Return JSON array:
[
  {
    "question_type": "multiple_choice",
    "prompt_text": "${question.replace(/"/g, '\\"')}",
    "answer_key": "${answer.replace(/"/g, '\\"')}",
    "accepted_answers": ["${answer.replace(/"/g, '\\"')}"],
    "options_payload": ["${answer.replace(/"/g, '\\"')}", "wrong but plausible 1", "wrong but plausible 2", "wrong but plausible 3"],
    "explanation_text": "Brief confirmation of why this is correct.",
    "default_category": "Lyrics" | "Collaborations" | "Crossovers" | "Cover Versions" | "Chart Facts" | "Band Members" | "Historical Firsts" | "Stage Names" | "Personal Facts" | "Connections",
    "difficulty_hint": "easy" | "medium" | "hard"
  }
]

Notes:
- options_payload: 4 items, correct answer first (will be shuffled before display)
- difficulty: easy = most music fans know it, medium = dedicated fans, hard = deep cut`;
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

// Parse "Q: ...\nA: ..." format stored in fact_text
function parseFactText(factText: string): { question: string; answer: string } {
  // Format: "Q: {question}\nA: {answer}"
  const newlineIdx = factText.indexOf("\nA:");
  if (factText.startsWith("Q:") && newlineIdx !== -1) {
    const question = factText.slice(2, newlineIdx).trim();
    const answer = factText.slice(newlineIdx + 3).trim();
    return { question, answer };
  }
  return { question: factText, answer: "" };
}

export async function generateQuestionsFromFact(
  fact: {
    fact_text: string;
    entity_type: string;
    entity_ref: string;
    fact_kind: string;
  },
  context: { genres?: string[] } = {},
  _count = 1 // always generates 1 MC question per Q&A pair
): Promise<AIQuestionPayload[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[triviaAIGenerator] ANTHROPIC_API_KEY not set — skipping generation");
    return [];
  }

  const { question, answer } = parseFactText(fact.fact_text);
  if (!question || !answer) {
    console.warn("[triviaAIGenerator] Could not parse Q/A from fact_text:", fact.fact_text.slice(0, 100));
    return [];
  }

  const raw = await callAnthropic({
    model: QUESTION_MODEL,
    max_tokens: 800,
    system: QUESTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildQuestionPrompt(
          fact.entity_ref,
          question,
          answer,
          context.genres ?? []
        ),
      },
    ],
  });

  const parsed = parseJsonFromText<AIQuestionPayload[]>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidPayload);
}

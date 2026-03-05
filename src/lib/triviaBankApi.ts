import { sanitizeCuePayload, type JsonValue, type TriviaDifficulty, type TriviaQuestionType } from "src/lib/triviaBank";

export const TRIVIA_BANK_ENABLED = (process.env.TRIVIA_BANK_V1 ?? "true").toLowerCase() !== "false";

export function asTriviaQuestionType(value: unknown): TriviaQuestionType {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text === "free_response" || text === "multiple_choice" || text === "true_false" || text === "ordering") return text;
  return "free_response";
}

export function asTriviaDifficulty(value: unknown): TriviaDifficulty {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text === "easy" || text === "medium" || text === "hard") return text;
  return "medium";
}

export function normalizeTagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => String(entry).trim())
        .filter(Boolean)
    )
  );
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    if (raw === "true" || raw === "1" || raw === "yes") return true;
    if (raw === "false" || raw === "0" || raw === "no") return false;
  }
  return fallback;
}

export function asJson(value: unknown, fallback: JsonValue): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value) ||
    (value && typeof value === "object")
  ) {
    return value as JsonValue;
  }
  return fallback;
}

export function normalizeQuestionWriteInput(body: Record<string, unknown>) {
  const promptText = asString(body.prompt_text);
  const answerPayload = asJson(body.answer_payload, {});
  const optionsPayload = asJson(body.options_payload, []);
  const revealPayload = asJson(body.reveal_payload, {});
  const cuePayloadSanitized = sanitizeCuePayload(body.cue_payload);
  const cueSegmentsRaw = body.cue_payload && typeof body.cue_payload === "object" && !Array.isArray(body.cue_payload)
    ? (Array.isArray((body.cue_payload as { segments?: unknown }).segments)
      ? ((body.cue_payload as { segments: unknown[] }).segments ?? [])
      : [])
    : [];
  const hasCueValidationError = cueSegmentsRaw.length !== cuePayloadSanitized.segments.length;
  const cuePayload = cuePayloadSanitized as unknown as JsonValue;
  const acceptedAnswers = normalizeTagList(body.accepted_answers);
  const answerKeyRaw =
    asString(body.answer_key) ||
    (typeof (answerPayload as { canonical?: unknown })?.canonical === "string"
      ? String((answerPayload as { canonical: string }).canonical).trim()
      : "");
  const answerKey = answerKeyRaw || acceptedAnswers[0] || "";

  return {
    status: (asString(body.status).toLowerCase() || "draft") as "draft" | "published" | "archived",
    question_type: asTriviaQuestionType(body.question_type),
    prompt_text: promptText,
    answer_key: answerKey,
    accepted_answers: Array.from(new Set([answerKey, ...acceptedAnswers].filter(Boolean))),
    answer_payload: answerPayload,
    options_payload: optionsPayload,
    explanation_text: asNullableString(body.explanation_text),
    default_category: asString(body.default_category) || "General Music",
    default_difficulty: asTriviaDifficulty(body.default_difficulty),
    source_note: asNullableString(body.source_note),
    is_tiebreaker_eligible: asBoolean(body.is_tiebreaker_eligible, true),
    cue_notes_text: asNullableString(body.cue_notes_text),
    cue_payload: cuePayload,
    cue_payload_has_validation_error: hasCueValidationError,
    reveal_payload: revealPayload,
    tags: normalizeTagList(body.tags),
    facets: {
      era: asNullableString(body.era),
      genre: asNullableString(body.genre),
      decade: asNullableString(body.decade),
      region: asNullableString(body.region),
      language: asNullableString(body.language),
      has_media: asBoolean(body.has_media, false),
      difficulty: asTriviaDifficulty(body.facet_difficulty ?? body.default_difficulty),
      category: asString(body.facet_category ?? body.default_category) || "General Music",
    },
  };
}

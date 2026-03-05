type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue | undefined };
type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type TriviaQuestionStatus = "draft" | "published" | "archived";
export type TriviaDeckStatus = "draft" | "ready" | "archived";
export type TriviaDeckBuildMode = "manual" | "hybrid" | "rule";
export type TriviaQuestionType = "free_response" | "multiple_choice" | "true_false" | "ordering";
export type TriviaDifficulty = "easy" | "medium" | "hard";
export type TriviaAssetRole = "clue_primary" | "clue_secondary" | "answer_visual" | "explanation_media";
export type TriviaAssetType = "image" | "audio" | "video";
export type TriviaCueRole = "primary" | "any_album_track" | "original" | "cover" | "alt";
export type TriviaCueSourceType = "inventory_track" | "uploaded_clip";

export type TriviaCueSourcePayloadInventoryTrack = {
  inventory_id: number;
  release_id?: number | null;
  release_track_id?: number | null;
  artist: string;
  album: string;
  title: string;
  side?: string | null;
  position?: string | null;
};

export type TriviaCueSourcePayloadUploadedClip = {
  asset_id?: number | null;
  bucket: string;
  object_path: string;
};

export type TriviaCueSegment = {
  role: TriviaCueRole;
  track_label?: string | null;
  start_seconds: number;
  end_seconds?: number | null;
  instruction?: string | null;
};

export type TriviaCuePayload = {
  segments: TriviaCueSegment[];
};

export type TriviaQuestionAssetRef = {
  id: number;
  asset_role: TriviaAssetRole;
  asset_type: TriviaAssetType;
  bucket: string;
  object_path: string;
  sort_order: number;
  mime_type?: string | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
};

export type TriviaQuestionSnapshot = {
  question_id: number | null;
  question_type: TriviaQuestionType;
  category: string;
  difficulty: TriviaDifficulty;
  prompt_text: string;
  answer_key: string;
  accepted_answers: string[];
  answer_payload: JsonValue;
  options_payload: JsonValue;
  explanation_text: string | null;
  source_note: string | null;
  cue_source_type: TriviaCueSourceType | null;
  cue_source_payload: JsonValue;
  primary_cue_start_seconds: number | null;
  primary_cue_end_seconds: number | null;
  primary_cue_instruction: string | null;
  display_element_type: "song" | "artist" | "album" | "cover_art" | "vinyl_label";
  reveal_payload: JsonValue;
  cue_notes_text: string | null;
  cue_payload: TriviaCuePayload;
  media_assets: TriviaQuestionAssetRef[];
};

const QUESTION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DECK_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(alphabet: string, length: number): string {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)] ?? "X";
  }
  return output;
}

export function generateTriviaQuestionCode(): string {
  return `TQ-${randomCode(QUESTION_CODE_ALPHABET, 7)}`;
}

export function generateTriviaDeckCode(): string {
  return `TD-${randomCode(DECK_CODE_ALPHABET, 6)}`;
}

function normalizeCueRole(raw: unknown): TriviaCueRole {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "primary" || value === "any_album_track" || value === "original" || value === "cover" || value === "alt") {
    return value;
  }
  return "primary";
}

export function normalizeCueSourceType(raw: unknown): TriviaCueSourceType | null {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "inventory_track" || value === "uploaded_clip") return value;
  return null;
}

export function parseCueTimeToSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 ? Math.floor(value) : null;
  }
  if (typeof value !== "string") return null;

  const input = value.trim();
  if (!input) return null;

  if (/^\d+(\.\d+)?$/.test(input)) {
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
  }

  const parts = input.split(":").map((part) => part.trim());
  if (parts.length === 2) {
    const [minutesRaw, secondsRaw] = parts;
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsRaw);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
    return Math.floor((minutes * 60) + seconds);
  }

  if (parts.length === 3) {
    const [hoursRaw, minutesRaw, secondsRaw] = parts;
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsRaw);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    if (hours < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null;
    return Math.floor((hours * 3600) + (minutes * 60) + seconds);
  }

  return null;
}

export function formatSecondsClock(seconds: number | null | undefined): string {
  if (!Number.isFinite(Number(seconds))) return "--:--";
  const safe = Math.max(0, Math.floor(Number(seconds)));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function sanitizeCuePayload(value: unknown): TriviaCuePayload {
  const segmentsRaw =
    value && typeof value === "object" && !Array.isArray(value) && Array.isArray((value as { segments?: unknown }).segments)
      ? ((value as { segments: unknown[] }).segments ?? [])
      : [];

  const segments: TriviaCueSegment[] = segmentsRaw
    .map((segment) => {
      if (!segment || typeof segment !== "object" || Array.isArray(segment)) return null;
      const row = segment as {
        role?: unknown;
        track_label?: unknown;
        start_seconds?: unknown;
        end_seconds?: unknown;
        instruction?: unknown;
      };

      const startSeconds = parseCueTimeToSeconds(row.start_seconds);
      if (startSeconds === null) return null;

      const endSeconds = parseCueTimeToSeconds(row.end_seconds);
      if (endSeconds !== null && endSeconds < startSeconds) return null;
      const trackLabel = typeof row.track_label === "string" ? row.track_label.trim() : "";
      const instruction = typeof row.instruction === "string" ? row.instruction.trim() : "";

      return {
        role: normalizeCueRole(row.role),
        start_seconds: startSeconds,
        ...(trackLabel ? { track_label: trackLabel } : {}),
        ...(endSeconds !== null ? { end_seconds: endSeconds } : {}),
        ...(instruction ? { instruction } : {}),
      } satisfies TriviaCueSegment;
    })
    .filter((segment): segment is TriviaCueSegment => Boolean(segment));

  return { segments };
}

export function hasRequiredCueSource(params: {
  cueSourceType: unknown;
  cueSourcePayload: unknown;
  primaryCueStartSeconds: unknown;
}): boolean {
  const cueSourceType = normalizeCueSourceType(params.cueSourceType);
  const primaryCueStartSeconds = parseCueTimeToSeconds(params.primaryCueStartSeconds);
  if (!cueSourceType || primaryCueStartSeconds === null) return false;

  if (!params.cueSourcePayload || typeof params.cueSourcePayload !== "object" || Array.isArray(params.cueSourcePayload)) {
    return false;
  }
  const payload = params.cueSourcePayload as Record<string, unknown>;

  if (cueSourceType === "inventory_track") {
    const inventoryId = Number(payload.inventory_id);
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const artist = typeof payload.artist === "string" ? payload.artist.trim() : "";
    return Number.isFinite(inventoryId) && inventoryId > 0 && title.length > 0 && artist.length > 0;
  }

  const bucket = typeof payload.bucket === "string" ? payload.bucket.trim() : "";
  const objectPath = typeof payload.object_path === "string" ? payload.object_path.trim() : "";
  return bucket.length > 0 && objectPath.length > 0;
}

function normalizeAnswerList(values: unknown, fallback: string): string[] {
  const normalized = Array.isArray(values)
    ? values.map((value) => String(value).trim()).filter(Boolean)
    : [];
  return Array.from(new Set([fallback.trim(), ...normalized].filter(Boolean)));
}

function asDifficulty(value: unknown): TriviaDifficulty {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return "medium";
}

function asQuestionType(value: unknown): TriviaQuestionType {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "free_response" || raw === "multiple_choice" || raw === "true_false" || raw === "ordering") return raw;
  return "free_response";
}

function asDisplayElementType(value: unknown): "song" | "artist" | "album" | "cover_art" | "vinyl_label" {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "song" || raw === "artist" || raw === "album" || raw === "cover_art" || raw === "vinyl_label") return raw;
  return "song";
}

export function buildQuestionSnapshot(input: {
  questionId: number | null;
  questionType: unknown;
  category: unknown;
  difficulty: unknown;
  promptText: unknown;
  answerKey: unknown;
  acceptedAnswers: unknown;
  answerPayload: unknown;
  optionsPayload: unknown;
  explanationText: unknown;
  sourceNote: unknown;
  cueSourceType: unknown;
  cueSourcePayload: unknown;
  primaryCueStartSeconds: unknown;
  primaryCueEndSeconds: unknown;
  primaryCueInstruction: unknown;
  displayElementType: unknown;
  revealPayload: unknown;
  cueNotesText: unknown;
  cuePayload: unknown;
  mediaAssets: TriviaQuestionAssetRef[];
}): TriviaQuestionSnapshot {
  const promptText = typeof input.promptText === "string" ? input.promptText.trim() : "";
  const answerKey = typeof input.answerKey === "string" ? input.answerKey.trim() : "";
  const category = typeof input.category === "string" && input.category.trim() ? input.category.trim() : "General Music";
  const explanationText = typeof input.explanationText === "string" ? input.explanationText.trim() : "";
  const sourceNote = typeof input.sourceNote === "string" ? input.sourceNote.trim() : "";
  const cueNotesText = typeof input.cueNotesText === "string" ? input.cueNotesText.trim() : "";
  const primaryCueStartSeconds = parseCueTimeToSeconds(input.primaryCueStartSeconds);
  const primaryCueEndSecondsRaw = parseCueTimeToSeconds(input.primaryCueEndSeconds);
  const primaryCueEndSeconds =
    primaryCueStartSeconds !== null && primaryCueEndSecondsRaw !== null && primaryCueEndSecondsRaw >= primaryCueStartSeconds
      ? primaryCueEndSecondsRaw
      : null;
  const primaryCueInstruction = typeof input.primaryCueInstruction === "string" ? input.primaryCueInstruction.trim() : "";
  const cueSourceType = normalizeCueSourceType(input.cueSourceType);
  const cueSourcePayload =
    input.cueSourcePayload && typeof input.cueSourcePayload === "object" && !Array.isArray(input.cueSourcePayload)
      ? (input.cueSourcePayload as JsonValue)
      : {};

  return {
    question_id: Number.isFinite(Number(input.questionId)) ? Number(input.questionId) : null,
    question_type: asQuestionType(input.questionType),
    category,
    difficulty: asDifficulty(input.difficulty),
    prompt_text: promptText,
    answer_key: answerKey,
    accepted_answers: normalizeAnswerList(input.acceptedAnswers, answerKey),
    answer_payload: (input.answerPayload as JsonValue | undefined) ?? {},
    options_payload: (input.optionsPayload as JsonValue | undefined) ?? [],
    explanation_text: explanationText || null,
    source_note: sourceNote || null,
    cue_source_type: cueSourceType,
    cue_source_payload: cueSourcePayload,
    primary_cue_start_seconds: primaryCueStartSeconds,
    primary_cue_end_seconds: primaryCueEndSeconds,
    primary_cue_instruction: primaryCueInstruction || null,
    display_element_type: asDisplayElementType(input.displayElementType),
    reveal_payload: (input.revealPayload as JsonValue | undefined) ?? {},
    cue_notes_text: cueNotesText || null,
    cue_payload: sanitizeCuePayload(input.cuePayload),
    media_assets: input.mediaAssets
      .map((asset) => ({
        ...asset,
        bucket: String(asset.bucket || "").trim() || "trivia-assets",
        object_path: String(asset.object_path || "").trim(),
      }))
      .filter((asset) => asset.object_path.length > 0)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
  };
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededUnit(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) / 0x100000000);
  };
}

export function deterministicShuffle<T>(items: T[], seed: string): T[] {
  const list = [...items];
  const next = seededUnit(seed);
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

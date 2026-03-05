import { buildQuestionSnapshot, type TriviaQuestionAssetRef, type TriviaQuestionSnapshot } from "src/lib/triviaBank";
import type { TriviaDbClient } from "src/lib/triviaDb";

type RawQuestionRow = {
  id: number;
  question_type: string;
  prompt_text: string;
  answer_key: string;
  accepted_answers: unknown;
  answer_payload: unknown;
  options_payload: unknown;
  explanation_text: string | null;
  source_note: string | null;
  default_category: string;
  default_difficulty: string;
  display_element_type: string;
  reveal_payload: unknown;
  cue_notes_text: string | null;
  cue_payload: unknown;
};

type RawAssetRow = {
  id: number;
  question_id: number;
  asset_role: string;
  asset_type: string;
  bucket: string;
  object_path: string;
  sort_order: number;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

function mapAsset(row: RawAssetRow): TriviaQuestionAssetRef {
  return {
    id: Number(row.id),
    asset_role: (row.asset_role as TriviaQuestionAssetRef["asset_role"]) ?? "clue_primary",
    asset_type: (row.asset_type as TriviaQuestionAssetRef["asset_type"]) ?? "image",
    bucket: String(row.bucket ?? "trivia-assets"),
    object_path: String(row.object_path ?? ""),
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
    width: Number.isFinite(Number(row.width)) ? Number(row.width) : null,
    height: Number.isFinite(Number(row.height)) ? Number(row.height) : null,
    duration_seconds: Number.isFinite(Number(row.duration_seconds)) ? Number(row.duration_seconds) : null,
  };
}

function toSnapshot(question: RawQuestionRow, assets: TriviaQuestionAssetRef[]): TriviaQuestionSnapshot {
  return buildQuestionSnapshot({
    questionId: question.id,
    questionType: question.question_type,
    category: question.default_category,
    difficulty: question.default_difficulty,
    promptText: question.prompt_text,
    answerKey: question.answer_key,
    acceptedAnswers: question.accepted_answers,
    answerPayload: question.answer_payload,
    optionsPayload: question.options_payload,
    explanationText: question.explanation_text,
    sourceNote: question.source_note,
    displayElementType: question.display_element_type,
    revealPayload: question.reveal_payload,
    cueNotesText: question.cue_notes_text,
    cuePayload: question.cue_payload,
    mediaAssets: assets,
  });
}

export async function loadQuestionSnapshot(db: TriviaDbClient, questionId: number): Promise<TriviaQuestionSnapshot | null> {
  const [{ data: question }, { data: assets }] = await Promise.all([
    db
      .from("trivia_questions")
      .select("id, question_type, prompt_text, answer_key, accepted_answers, answer_payload, options_payload, explanation_text, source_note, default_category, default_difficulty, display_element_type, reveal_payload, cue_notes_text, cue_payload")
      .eq("id", questionId)
      .maybeSingle(),
    db
      .from("trivia_question_assets")
      .select("id, question_id, asset_role, asset_type, bucket, object_path, sort_order, mime_type, width, height, duration_seconds")
      .eq("question_id", questionId)
      .order("sort_order", { ascending: true }),
  ]);

  if (!question) return null;

  const mappedAssets = ((assets ?? []) as RawAssetRow[]).map(mapAsset);
  return toSnapshot(question as RawQuestionRow, mappedAssets);
}

export async function loadQuestionSnapshotsByIds(db: TriviaDbClient, questionIds: number[]): Promise<Map<number, TriviaQuestionSnapshot>> {
  const ids = Array.from(new Set(questionIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (ids.length === 0) return new Map<number, TriviaQuestionSnapshot>();

  const [{ data: questions, error: questionError }, { data: assets, error: assetError }] = await Promise.all([
    db
      .from("trivia_questions")
      .select("id, question_type, prompt_text, answer_key, accepted_answers, answer_payload, options_payload, explanation_text, source_note, default_category, default_difficulty, display_element_type, reveal_payload, cue_notes_text, cue_payload")
      .in("id", ids),
    db
      .from("trivia_question_assets")
      .select("id, question_id, asset_role, asset_type, bucket, object_path, sort_order, mime_type, width, height, duration_seconds")
      .in("question_id", ids)
      .order("sort_order", { ascending: true }),
  ]);

  if (questionError) throw new Error(questionError.message);
  if (assetError) throw new Error(assetError.message);

  const assetsByQuestion = new Map<number, TriviaQuestionAssetRef[]>();
  for (const row of (assets ?? []) as RawAssetRow[]) {
    const list = assetsByQuestion.get(row.question_id) ?? [];
    list.push(mapAsset(row));
    assetsByQuestion.set(row.question_id, list);
  }

  const snapshots = new Map<number, TriviaQuestionSnapshot>();
  for (const row of (questions ?? []) as RawQuestionRow[]) {
    const mappedAssets = assetsByQuestion.get(row.id) ?? [];
    snapshots.set(row.id, toSnapshot(row, mappedAssets));
  }

  return snapshots;
}

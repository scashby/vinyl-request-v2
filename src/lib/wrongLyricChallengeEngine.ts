type CountdownSession = {
  target_gap_seconds: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
  status: "pending" | "running" | "paused" | "completed";
};

type LyricCallShape = {
  correct_lyric: string;
  decoy_lyric_1: string;
  decoy_lyric_2: string;
  decoy_lyric_3: string | null;
  answer_slot: number;
};

export type WrongLyricOption = {
  slot: number;
  label: string;
  lyric: string;
  is_answer: boolean;
};

const SLOT_LABELS = ["A", "B", "C", "D"];

export function computeWrongLyricChallengeRemainingSeconds(session: CountdownSession): number {
  if (session.status === "paused" && Number.isFinite(session.paused_remaining_seconds)) {
    return Math.max(0, Number(session.paused_remaining_seconds));
  }

  if (!session.countdown_started_at) return Math.max(0, session.target_gap_seconds);

  const startedAt = new Date(session.countdown_started_at).getTime();
  if (!Number.isFinite(startedAt)) return Math.max(0, session.target_gap_seconds);

  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, session.target_gap_seconds - elapsed);
}

export function buildWrongLyricOptions(call: LyricCallShape, optionCount: number): WrongLyricOption[] {
  const safeCount = optionCount === 4 ? 4 : 3;
  const decoys = [call.decoy_lyric_1, call.decoy_lyric_2, call.decoy_lyric_3]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .slice(0, safeCount - 1);

  while (decoys.length < safeCount - 1) {
    decoys.push("(missing decoy)");
  }

  const answerSlot = Math.max(1, Math.min(safeCount, Number(call.answer_slot) || 1));
  const slots: Array<string> = new Array(safeCount).fill("");

  slots[answerSlot - 1] = call.correct_lyric;

  let decoyIndex = 0;
  for (let i = 0; i < safeCount; i += 1) {
    if (slots[i]) continue;
    slots[i] = decoys[decoyIndex] ?? "(missing decoy)";
    decoyIndex += 1;
  }

  return slots.map((lyric, index) => ({
    slot: index + 1,
    label: SLOT_LABELS[index] ?? `${index + 1}`,
    lyric,
    is_answer: index + 1 === answerSlot,
  }));
}

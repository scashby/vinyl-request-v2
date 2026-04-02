/**
 * bingoCrateModel.ts
 *
 * Helpers for managing immutable call-order crates attached to bingo session rounds.
 * Each crate captures the generated call order at a point in time and is named with a
 * sequential letter (A, B, C…) scoped to the session so hosts can identify them easily.
 */

import { getBingoDb } from "./bingoDb";

const CRATE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export type CrateCallEntry = {
  id: number;
  call_index: number;
  ball_number: number | null;
  column_letter: string;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
  status: string;
};

export type BingoSessionCrate = {
  id: number;
  session_id: number;
  round_number: number;
  crate_name: string;
  crate_letter: string;
  call_order: CrateCallEntry[];
  created_at: string;
};

/** Return the next available crate letter for a session (across all rounds). */
async function getNextCrateLetter(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<string> {
  const { data } = await db
    .from("bingo_session_crates")
    .select("crate_letter")
    .eq("session_id", sessionId)
    .order("crate_letter", { ascending: true });

  const usedLetters = new Set((data ?? []).map((row) => row.crate_letter as string));
  const next = CRATE_LETTERS.find((l) => !usedLetters.has(l));
  if (!next) throw new Error("All 26 crate letters exhausted for this session.");
  return next;
}

/**
 * Persist the current call order for a round as a new named crate.
 * The crate is automatically named "{sessionId} Crate {letter}".
 * Returns the newly-created crate row.
 */
export async function saveCrateForRound(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number,
  calls: CrateCallEntry[]
): Promise<BingoSessionCrate> {
  const letter = await getNextCrateLetter(db, sessionId);
  const crateName = `${sessionId} Crate ${letter}`;

  const { data, error } = await db
    .from("bingo_session_crates")
    .insert({
      session_id: sessionId,
      round_number: roundNumber,
      crate_name: crateName,
      crate_letter: letter,
      call_order: calls as unknown as Record<string, unknown>[],
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save crate.");

  return {
    ...data,
    call_order: data.call_order as unknown as CrateCallEntry[],
  };
}

/** Return all crates for a session, ordered by crate_letter. */
export async function getCratesForSession(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<BingoSessionCrate[]> {
  const { data, error } = await db
    .from("bingo_session_crates")
    .select("*")
    .eq("session_id", sessionId)
    .order("crate_letter", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    call_order: row.call_order as unknown as CrateCallEntry[],
  }));
}

/** Return all crates for a specific round of a session. */
export async function getCratesForRound(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number
): Promise<BingoSessionCrate[]> {
  const { data, error } = await db
    .from("bingo_session_crates")
    .select("*")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .order("crate_letter", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    call_order: row.call_order as unknown as CrateCallEntry[],
  }));
}

/**
 * Mark a crate letter as the active crate for a round in the session.
 * Reads existing `active_crate_letter_by_round` jsonb array and updates it.
 */
export async function setActiveCrateForRound(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number,
  crateLetterOrNull: string | null
): Promise<void> {
  const { data: session } = await db
    .from("bingo_sessions")
    .select("active_crate_letter_by_round")
    .eq("id", sessionId)
    .single();

  const existing: { round: number; letter: string }[] =
    (session?.active_crate_letter_by_round as { round: number; letter: string }[] | null) ?? [];

  const without = existing.filter((entry) => entry.round !== roundNumber);
  const next =
    crateLetterOrNull !== null
      ? [...without, { round: roundNumber, letter: crateLetterOrNull }].sort((a, b) => a.round - b.round)
      : without;

  await db
    .from("bingo_sessions")
    .update({ active_crate_letter_by_round: next })
    .eq("id", sessionId);
}

/** Return the active crate letter for a round (null = none selected yet). */
export function getActiveCrateLetter(
  activeCrateLetterByRound: { round: number; letter: string }[] | null,
  roundNumber: number
): string | null {
  if (!activeCrateLetterByRound) return null;
  return activeCrateLetterByRound.find((e) => e.round === roundNumber)?.letter ?? null;
}

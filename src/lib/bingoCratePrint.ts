import type { BingoDbClient } from "src/lib/bingoDb";
import type { BingoCardCell } from "src/lib/bingoEngine";

type PreviewCard = {
  card_number: number;
  card_identifier: string;
  grid: BingoCardCell[];
};

type RoundCardRow = {
  card_number: number;
  card_identifier: string;
  has_free_space: boolean;
  grid: unknown;
};

type SessionCallRow = {
  id: number;
  ball_number: number | null;
};

/**
 * Fixed Crates mode: returns that round's own independently-generated card set
 * (bingo_session_round_cards), built once at session creation — not a relabeled
 * copy of another round's cards. Safe to call for any round at any time, regardless
 * of which round is currently active in the live game; purely a read.
 */
export async function getRoundCardPreview(
  db: BingoDbClient,
  sessionId: number,
  roundNumber: number
): Promise<PreviewCard[]> {
  const { data: cards, error } = await db
    .from("bingo_session_round_cards")
    .select("card_number, card_identifier, has_free_space, grid")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .order("card_number", { ascending: true });
  if (error) throw new Error(error.message);

  if (!cards || cards.length === 0) {
    throw new Error(`No cards found for round ${roundNumber}. Has the session finished creating?`);
  }

  return (cards as unknown as RoundCardRow[]).map((row) => ({
    card_number: row.card_number,
    card_identifier: row.card_identifier,
    grid: (Array.isArray(row.grid) ? row.grid : []) as BingoCardCell[],
  }));
}

/**
 * Fixed Crates mode: copies a round's precomputed card set (bingo_session_round_cards)
 * into the live bingo_cards table, resolving each cell's call_id from the CURRENT
 * bingo_session_calls rows for that round (which activate-round must have already
 * refreshed before calling this). This is what makes the cards printed in advance
 * match what the live game actually shows/validates against.
 *
 * No-op if this round has no precomputed cards (e.g. Shared Pool sessions, where
 * bingo_session_round_cards is never populated), so it is safe to call unconditionally.
 */
export async function syncRoundCardsToLive(
  db: BingoDbClient,
  sessionId: number,
  roundNumber: number
): Promise<void> {
  const { data: roundCards, error: roundCardsError } = await db
    .from("bingo_session_round_cards")
    .select("card_number, card_identifier, has_free_space, grid")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .order("card_number", { ascending: true });
  if (roundCardsError) throw new Error(roundCardsError.message);
  if (!roundCards || roundCards.length === 0) return;

  const { data: calls, error: callsError } = await db
    .from("bingo_session_calls")
    .select("id, ball_number")
    .eq("session_id", sessionId);
  if (callsError) throw new Error(callsError.message);

  const ballNumberToCallId = new Map<number, number>(
    ((calls ?? []) as SessionCallRow[])
      .filter((call): call is SessionCallRow & { ball_number: number } => call.ball_number !== null)
      .map((call) => [call.ball_number, call.id])
  );

  const { error: deleteError } = await db.from("bingo_cards").delete().eq("session_id", sessionId);
  if (deleteError) throw new Error(deleteError.message);

  const liveRows = (roundCards as unknown as RoundCardRow[]).map((row) => {
    const grid = (Array.isArray(row.grid) ? row.grid : []) as BingoCardCell[];
    return {
      session_id: sessionId,
      card_number: row.card_number,
      card_identifier: row.card_identifier,
      has_free_space: row.has_free_space,
      grid: grid.map((cell) =>
        cell.free || cell.ball_number == null
          ? cell
          : { ...cell, call_id: ballNumberToCallId.get(cell.ball_number) ?? null }
      ),
    };
  });

  const { error: insertError } = await db.from("bingo_cards").insert(liveRows);
  if (insertError) throw new Error(insertError.message);
}

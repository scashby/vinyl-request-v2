import type { BingoDbClient } from "src/lib/bingoDb";
import type { BingoCardCell } from "src/lib/bingoEngine";
import { getPlaylistByLetter, getPlaylistsForRound } from "src/lib/bingoCrateModel";

type PreviewCard = {
  card_number: number;
  card_identifier: string;
  grid: BingoCardCell[];
};

type CardRow = {
  id: number;
  card_number: number;
  card_identifier: string;
  grid: unknown;
};

type SessionCallRow = {
  id: number;
  ball_number: number | null;
};

type SessionRow = {
  id: number;
  card_label_mode: string;
  active_playlist_letter_by_round: { round: number; letter: string }[] | null;
};

/**
 * Builds a read-only preview of a round's card labels by remapping the session's one physical
 * card set (bingo_cards) onto that round's precomputed call order (bingo_session_game_playlists),
 * via each cell's stable ball_number identity. Does not read/write bingo_session_calls' live state
 * and never mutates any row — safe to call for any round at any time, regardless of which round is
 * currently active in the live game.
 */
export async function buildRoundCardPreview(
  db: BingoDbClient,
  sessionId: number,
  roundNumber: number
): Promise<PreviewCard[]> {
  const { data: session, error: sessionError } = await db
    .from("bingo_sessions")
    .select("id, card_label_mode, active_playlist_letter_by_round")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Session not found");
  const typedSession = session as unknown as SessionRow;
  const labelMode = (typedSession.card_label_mode ?? "track_artist") as "track_artist" | "track_only";

  const { data: cards, error: cardsError } = await db
    .from("bingo_cards")
    .select("id, card_number, card_identifier, grid")
    .eq("session_id", sessionId)
    .order("card_number", { ascending: true });
  if (cardsError) throw new Error(cardsError.message);

  const { data: calls, error: callsError } = await db
    .from("bingo_session_calls")
    .select("id, ball_number")
    .eq("session_id", sessionId);
  if (callsError) throw new Error(callsError.message);

  const callIdToBallNumber = new Map<number, number>(
    ((calls ?? []) as SessionCallRow[])
      .filter((call): call is SessionCallRow & { ball_number: number } => call.ball_number !== null)
      .map((call) => [call.id, call.ball_number])
  );

  const activeLetter = (typedSession.active_playlist_letter_by_round ?? []).find(
    (entry) => entry.round === roundNumber
  )?.letter;

  const roundPlaylist = activeLetter
    ? await getPlaylistByLetter(db, sessionId, activeLetter)
    : (await getPlaylistsForRound(db, sessionId, roundNumber))[0] ?? null;

  if (!roundPlaylist) {
    throw new Error(`No game playlist found for round ${roundNumber}. Has the session finished creating?`);
  }

  const ballNumberToTrack = new Map<number, { track_title: string; artist_name: string }>(
    roundPlaylist.call_order
      .filter((entry) => entry.ball_number !== null)
      .map((entry) => [entry.ball_number as number, { track_title: entry.track_title, artist_name: entry.artist_name }])
  );

  return ((cards ?? []) as unknown as CardRow[]).map((card) => {
    const grid = (Array.isArray(card.grid) ? card.grid : []) as BingoCardCell[];
    return {
      card_number: card.card_number,
      card_identifier: card.card_identifier,
      grid: grid.map((cell) => {
        if (cell.free || cell.call_id === null) return cell;

        const ballNumber = callIdToBallNumber.get(cell.call_id);
        const track = ballNumber !== undefined ? ballNumberToTrack.get(ballNumber) : undefined;
        if (!track) return cell;

        const label = labelMode === "track_only" ? track.track_title : `${track.track_title} - ${track.artist_name}`;
        return {
          ...cell,
          track_title: track.track_title,
          artist_name: track.artist_name,
          label,
        };
      }),
    };
  });
}

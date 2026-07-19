import { getStandaloneSupabaseClient } from "@/lib/supabaseStandalone";
import {
  type CreateStandaloneBingoCardInput,
  type StandaloneBingoCardCell,
  type StandaloneBingoCardRecord,
  type StandaloneBingoCardsRepository,
} from "@/lib/standaloneBingoCardsRepo";

function coerceGrid(value: unknown): StandaloneBingoCardCell[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((cell): cell is Record<string, unknown> => typeof cell === "object" && cell !== null)
    .map((cell) => ({
      row: Number(cell.row ?? 0),
      col: Number(cell.col ?? 0),
      label: String(cell.label ?? ""),
      track_title: String(cell.track_title ?? ""),
      artist_name: String(cell.artist_name ?? ""),
      free: Boolean(cell.free),
      call_id: null,
    }));
}

function mapRow(row: Record<string, unknown>): StandaloneBingoCardRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    cardIndex: Number(row.card_index),
    cardIdentifier: String(row.card_identifier),
    grid: coerceGrid(row.grid),
    createdAt: String(row.created_at),
  };
}

export class SupabaseStandaloneBingoCardsRepository
  implements StandaloneBingoCardsRepository
{
  async listBySession(sessionId: string): Promise<StandaloneBingoCardRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_cards")
      .select("id, session_id, card_index, card_identifier, grid, created_at")
      .eq("session_id", sessionId)
      .order("card_index", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async createMany(
    sessionId: string,
    cards: CreateStandaloneBingoCardInput[]
  ): Promise<void> {
    if (cards.length === 0) return;

    const supabase = getStandaloneSupabaseClient();
    const { error } = await supabase.from("sg_game_bingo_cards").insert(
      cards.map((card) => ({
        session_id: sessionId,
        card_index: card.cardIndex,
        card_identifier: card.cardIdentifier,
        grid: card.grid,
      }))
    );

    if (error) throw new Error(error.message);
  }

  async replaceSession(
    sessionId: string,
    cards: CreateStandaloneBingoCardInput[]
  ): Promise<void> {
    const supabase = getStandaloneSupabaseClient();
    const { error: deleteError } = await supabase
      .from("sg_game_bingo_cards")
      .delete()
      .eq("session_id", sessionId);

    if (deleteError) throw new Error(deleteError.message);
    await this.createMany(sessionId, cards);
  }

  async getByIdentifier(
    sessionId: string,
    cardIdentifier: string
  ): Promise<StandaloneBingoCardRecord | null> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_cards")
      .select("id, session_id, card_index, card_identifier, grid, created_at")
      .eq("session_id", sessionId)
      .eq("card_identifier", cardIdentifier)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapRow(data as Record<string, unknown>) : null;
  }
}
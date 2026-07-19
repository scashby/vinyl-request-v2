import { getStandaloneSupabaseClient } from "@/lib/supabaseStandalone";
import {
  type CreateStandaloneBingoSessionPlaylistInput,
  type StandaloneBingoSessionPlaylistRecord,
  type StandaloneBingoSessionPlaylistsRepository,
} from "@/lib/standaloneBingoSessionPlaylistsRepo";

function mapRow(row: Record<string, unknown>): StandaloneBingoSessionPlaylistRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    roundNumber: Number(row.round_number),
    playlistLetter: String(row.playlist_letter),
    playlistName: String(row.playlist_name),
    callOrder: Array.isArray(row.call_order)
      ? row.call_order
          .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
          .map((entry) => ({
            call_index: Number(entry.call_index ?? 0),
            track_title: String(entry.track_title ?? ""),
            artist_name: String(entry.artist_name ?? ""),
            album_name: typeof entry.album_name === "string" ? String(entry.album_name) : null,
            side: typeof entry.side === "string" ? String(entry.side) : null,
            position: typeof entry.position === "string" ? String(entry.position) : null,
          }))
      : [],
    createdAt: String(row.created_at),
  };
}

export class SupabaseStandaloneBingoSessionPlaylistsRepository implements StandaloneBingoSessionPlaylistsRepository {
  async listBySession(sessionId: string): Promise<StandaloneBingoSessionPlaylistRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_session_playlists")
      .select("id, session_id, round_number, playlist_letter, playlist_name, call_order, created_at")
      .eq("session_id", sessionId)
      .order("playlist_letter", { ascending: true })
      .order("round_number", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async createMany(sessionId: string, playlists: CreateStandaloneBingoSessionPlaylistInput[]): Promise<void> {
    if (playlists.length === 0) return;
    const supabase = getStandaloneSupabaseClient();
    const { error } = await supabase.from("sg_game_bingo_session_playlists").insert(
      playlists.map((playlist) => ({
        session_id: sessionId,
        round_number: playlist.roundNumber,
        playlist_letter: playlist.playlistLetter,
        playlist_name: playlist.playlistName,
        call_order: playlist.callOrder,
      }))
    );
    if (error) throw new Error(error.message);
  }

  async replaceByLetter(sessionId: string, playlistLetter: string, playlists: CreateStandaloneBingoSessionPlaylistInput[]): Promise<void> {
    await this.deleteByLetter(sessionId, playlistLetter);
    await this.createMany(sessionId, playlists);
  }

  async deleteByLetter(sessionId: string, playlistLetter: string): Promise<void> {
    const supabase = getStandaloneSupabaseClient();
    const { error } = await supabase
      .from("sg_game_bingo_session_playlists")
      .delete()
      .eq("session_id", sessionId)
      .eq("playlist_letter", playlistLetter);
    if (error) throw new Error(error.message);
  }
}

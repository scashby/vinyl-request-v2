import { getStandaloneSupabaseClient } from "@/lib/supabaseStandalone";
import {
  type CreateStandaloneBingoCallInput,
  type StandaloneBingoCallRecord,
  type StandaloneBingoCallsRepository,
} from "@/lib/standaloneBingoCallsRepo";

function mapRow(row: Record<string, unknown>): StandaloneBingoCallRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    callIndex: Number(row.call_index),
    canonicalTrackId: typeof row.canonical_track_id === "string" ? row.canonical_track_id : null,
    trackTitle: String(row.track_title),
    artistName: String(row.artist_name),
    status: row.status as StandaloneBingoCallRecord["status"],
    calledAt: typeof row.called_at === "string" ? row.called_at : null,
    createdAt: String(row.created_at),
  };
}

export class SupabaseStandaloneBingoCallsRepository implements StandaloneBingoCallsRepository {
  async listBySession(sessionId: string): Promise<StandaloneBingoCallRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_calls")
      .select("id, session_id, call_index, canonical_track_id, track_title, artist_name, status, called_at, created_at")
      .eq("session_id", sessionId)
      .order("call_index", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async createMany(sessionId: string, calls: CreateStandaloneBingoCallInput[]): Promise<void> {
    const supabase = getStandaloneSupabaseClient();
    const { error } = await supabase.from("sg_game_bingo_calls").insert(
      calls.map((call) => ({
        session_id: sessionId,
        call_index: call.callIndex,
        canonical_track_id: call.canonicalTrackId ?? null,
        track_title: call.trackTitle,
        artist_name: call.artistName,
        status: "pending",
      }))
    );

    if (error) throw new Error(error.message);
  }

  async getCurrentCalled(sessionId: string): Promise<StandaloneBingoCallRecord | null> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_calls")
      .select("id, session_id, call_index, canonical_track_id, track_title, artist_name, status, called_at, created_at")
      .eq("session_id", sessionId)
      .eq("status", "called")
      .order("call_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async getNextPending(sessionId: string): Promise<StandaloneBingoCallRecord | null> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_calls")
      .select("id, session_id, call_index, canonical_track_id, track_title, artist_name, status, called_at, created_at")
      .eq("session_id", sessionId)
      .eq("status", "pending")
      .order("call_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async markCompleted(callId: string): Promise<void> {
    const supabase = getStandaloneSupabaseClient();
    const { error } = await supabase
      .from("sg_game_bingo_calls")
      .update({ status: "completed" })
      .eq("id", callId);

    if (error) throw new Error(error.message);
  }

  async markSkipped(callId: string): Promise<void> {
    const supabase = getStandaloneSupabaseClient();
    const { error } = await supabase
      .from("sg_game_bingo_calls")
      .update({ status: "skipped" })
      .eq("id", callId);

    if (error) throw new Error(error.message);
  }

  async markCalled(callId: string, calledAt: string): Promise<StandaloneBingoCallRecord | null> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_calls")
      .update({ status: "called", called_at: calledAt })
      .eq("id", callId)
      .select("id, session_id, call_index, canonical_track_id, track_title, artist_name, status, called_at, created_at")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapRow(data as Record<string, unknown>) : null;
  }
}
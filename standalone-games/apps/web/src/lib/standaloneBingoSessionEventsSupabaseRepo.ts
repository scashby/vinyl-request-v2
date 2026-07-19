import { getStandaloneSupabaseClient } from "@/lib/supabaseStandalone";
import {
  type StandaloneBingoSessionEventRecord,
  type StandaloneBingoSessionEventType,
  type StandaloneBingoSessionEventsRepository,
} from "@/lib/standaloneBingoSessionEventsRepo";

function mapRow(row: Record<string, unknown>): StandaloneBingoSessionEventRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    eventType: String(row.event_type) as StandaloneBingoSessionEventType,
    payload:
      row.payload && typeof row.payload === "object"
        ? {
            call_id: typeof (row.payload as Record<string, unknown>).call_id === "string"
              ? String((row.payload as Record<string, unknown>).call_id)
              : undefined,
            after_call_id: typeof (row.payload as Record<string, unknown>).after_call_id === "string"
              ? String((row.payload as Record<string, unknown>).after_call_id)
              : undefined,
          }
        : null,
    createdAt: String(row.created_at),
  };
}

export class SupabaseStandaloneBingoSessionEventsRepository implements StandaloneBingoSessionEventsRepository {
  async listBySession(sessionId: string): Promise<StandaloneBingoSessionEventRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_session_events")
      .select("id, session_id, event_type, payload, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(
    sessionId: string,
    eventType: StandaloneBingoSessionEventType,
    payload: StandaloneBingoSessionEventRecord["payload"]
  ): Promise<void> {
    const supabase = getStandaloneSupabaseClient();
    const { error } = await supabase.from("sg_game_bingo_session_events").insert({
      session_id: sessionId,
      event_type: eventType,
      payload,
    });

    if (error) throw new Error(error.message);
  }

  async deleteBySession(sessionId: string): Promise<void> {
    const supabase = getStandaloneSupabaseClient();
    const { error } = await supabase
      .from("sg_game_bingo_session_events")
      .delete()
      .eq("session_id", sessionId);

    if (error) throw new Error(error.message);
  }
}

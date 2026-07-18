import { getStandaloneSupabaseClient } from "@/lib/supabaseStandalone";
import {
  type CreateStandaloneBingoPresetInput,
  type StandaloneBingoPresetRecord,
  type StandaloneBingoPresetsRepository,
} from "@/lib/standaloneBingoPresetsRepo";

function mapRow(row: Record<string, unknown>): StandaloneBingoPresetRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    sourcePlaylistIds: Array.isArray(row.source_playlist_ids) ? row.source_playlist_ids.map(String) : [],
    sourcePlaylistNames: Array.isArray(row.source_playlist_names) ? row.source_playlist_names.map(String) : [],
    poolSize: Number(row.pool_size ?? 0),
    note: typeof row.note === "string" ? row.note : null,
    createdFromSessionId: typeof row.created_from_session_id === "string" ? row.created_from_session_id : null,
    createdAt: String(row.created_at),
  };
}

export class SupabaseStandaloneBingoPresetsRepository implements StandaloneBingoPresetsRepository {
  async listByTenant(tenantId: string): Promise<StandaloneBingoPresetRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_presets")
      .select("id, tenant_id, name, source_playlist_ids, source_playlist_names, pool_size, note, created_from_session_id, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(input: CreateStandaloneBingoPresetInput): Promise<StandaloneBingoPresetRecord> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_presets")
      .insert({
        tenant_id: input.tenantId,
        name: input.name,
        source_playlist_ids: input.sourcePlaylistIds,
        source_playlist_names: input.sourcePlaylistNames,
        pool_size: input.poolSize,
        note: input.note ?? null,
        created_from_session_id: input.createdFromSessionId ?? null,
      })
      .select("id, tenant_id, name, source_playlist_ids, source_playlist_names, pool_size, note, created_from_session_id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }
}

import { getStandaloneSupabaseClient, isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import {
  type CreateStandaloneBingoSessionInput,
  type StandaloneBingoSessionRecord,
  type StandaloneBingoSessionsRepository,
} from "@/lib/standaloneBingoSessionsRepo";

function mapRow(row: Record<string, unknown>): StandaloneBingoSessionRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    createdByUserId: String(row.created_by_user_id ?? ""),
    sessionCode: String(row.session_code),
    status: row.status as StandaloneBingoSessionRecord["status"],
    playlistSnapshotId: String(row.playlist_snapshot_id),
    roundCount: Number(row.round_count),
    cardCount: Number(row.card_count),
    gameMode: row.game_mode as StandaloneBingoSessionRecord["gameMode"],
    callIntervalSeconds: Number(row.call_interval_seconds),
    createdAt: String(row.created_at),
  };
}

export class SupabaseStandaloneBingoSessionsRepository
  implements StandaloneBingoSessionsRepository
{
  async listByTenant(tenantId: string): Promise<StandaloneBingoSessionRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_sessions")
      .select(
        "id, tenant_id, created_by_user_id, session_code, status, playlist_snapshot_id, round_count, card_count, game_mode, call_interval_seconds, created_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(
    input: CreateStandaloneBingoSessionInput
  ): Promise<StandaloneBingoSessionRecord> {
    const supabase = getStandaloneSupabaseClient();
    const payload = {
      tenant_id: input.tenantId,
      created_by_user_id: input.createdByUserId,
      playlist_snapshot_id: input.playlistSnapshotId,
      round_count: input.roundCount,
      card_count: input.cardCount,
      game_mode: input.gameMode,
      call_interval_seconds: input.callIntervalSeconds,
      session_code: this.buildSessionCode(),
    };

    const { data, error } = await supabase
      .from("sg_game_bingo_sessions")
      .insert(payload)
      .select(
        "id, tenant_id, created_by_user_id, session_code, status, playlist_snapshot_id, round_count, card_count, game_mode, call_interval_seconds, created_at"
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRow(data as Record<string, unknown>);
  }

  private buildSessionCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }
}

export function getStandaloneBingoSessionsRepository(): StandaloneBingoSessionsRepository {
  if (isStandaloneSupabaseConfigured()) {
    return new SupabaseStandaloneBingoSessionsRepository();
  }

  const { getStandaloneBingoSessionsRepository: getInMemoryRepo } = require("@/lib/standaloneBingoSessionsRepo");
  return getInMemoryRepo();
}

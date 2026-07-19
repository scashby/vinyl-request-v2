import { getStandaloneSupabaseClient, isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import {
  type CreateStandaloneBingoSessionInput,
  type StandaloneBingoRoundModesEntry,
  type StandaloneBingoSessionRecord,
  type StandaloneBingoSessionsRepository,
  type UpdateStandaloneBingoSessionInput,
} from "@/lib/standaloneBingoSessionsRepo";

function coerceRoundModes(value: unknown): StandaloneBingoRoundModesEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      round: Number(entry.round ?? 1),
      modes: Array.isArray(entry.modes) ? entry.modes.map((mode) => String(mode) as StandaloneBingoRoundModesEntry["modes"][number]) : [],
    }))
    .filter((entry) => Number.isFinite(entry.round) && entry.round >= 1 && entry.modes.length > 0);
}

function mapRow(row: Record<string, unknown>): StandaloneBingoSessionRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    createdByUserId: String(row.created_by_user_id ?? ""),
    eventId: typeof row.event_id === "string" ? row.event_id : null,
    sessionCode: String(row.session_code),
    status: row.status as StandaloneBingoSessionRecord["status"],
    playlistSnapshotId: String(row.playlist_snapshot_id),
    currentRound: Number(row.current_round ?? 1),
    roundCount: Number(row.round_count),
    roundModes: coerceRoundModes(row.round_modes),
    cardCount: Number(row.card_count),
    gameMode: row.game_mode as StandaloneBingoSessionRecord["gameMode"],
    callIntervalSeconds: Number(row.call_interval_seconds),
    removeResleeveSeconds: Number(row.remove_resleeve_seconds ?? 20),
    placeVinylSeconds: Number(row.place_vinyl_seconds ?? 8),
    cueSeconds: Number(row.cue_seconds ?? 12),
    startSlideSeconds: Number(row.start_slide_seconds ?? 5),
    hostBufferSeconds: Number(row.host_buffer_seconds ?? 2),
    sonosOutputDelayMs: Number(row.sonos_output_delay_ms ?? 75),
    callRevealDelaySeconds: Number(row.call_reveal_delay_seconds ?? 10),
    defaultIntermissionSeconds: Number(row.default_intermission_seconds ?? 600),
    welcomeHeadingText: typeof row.welcome_heading_text === "string" ? row.welcome_heading_text : null,
    welcomeMessageText: typeof row.welcome_message_text === "string" ? row.welcome_message_text : null,
    welcomeRulesText: typeof row.welcome_rules_text === "string" ? row.welcome_rules_text : null,
    welcomeTiebreakText: typeof row.welcome_tiebreak_text === "string" ? row.welcome_tiebreak_text : null,
    intermissionHeadingText: typeof row.intermission_heading_text === "string" ? row.intermission_heading_text : null,
    intermissionMessageText: typeof row.intermission_message_text === "string" ? row.intermission_message_text : null,
    intermissionFooterText: typeof row.intermission_footer_text === "string" ? row.intermission_footer_text : null,
    thanksHeadingText: typeof row.thanks_heading_text === "string" ? row.thanks_heading_text : null,
    thanksSubheadingText: typeof row.thanks_subheading_text === "string" ? row.thanks_subheading_text : null,
    thanksEventsHeadingText: typeof row.thanks_events_heading_text === "string" ? row.thanks_events_heading_text : null,
    showCountdown: Boolean(row.show_countdown ?? true),
    recentCallsLimit: Number(row.recent_calls_limit ?? 5),
    themeEnabled: Boolean(row.theme_enabled),
    themeName: typeof row.theme_name === "string" ? row.theme_name : null,
    isSandbox: Boolean(row.is_sandbox),
    sandboxSourceSessionId: typeof row.sandbox_source_session_id === "string" ? row.sandbox_source_session_id : null,
    sandboxExpiresAt: typeof row.sandbox_expires_at === "string" ? row.sandbox_expires_at : null,
    isFavorite: Boolean(row.is_favorite),
    createdAt: String(row.created_at),
    startedAt: typeof row.started_at === "string" ? row.started_at : null,
    endedAt: typeof row.ended_at === "string" ? row.ended_at : null,
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
        "id, tenant_id, created_by_user_id, event_id, session_code, status, playlist_snapshot_id, current_round, round_count, round_modes, card_count, game_mode, call_interval_seconds, remove_resleeve_seconds, place_vinyl_seconds, cue_seconds, start_slide_seconds, host_buffer_seconds, sonos_output_delay_ms, call_reveal_delay_seconds, default_intermission_seconds, welcome_heading_text, welcome_message_text, welcome_rules_text, welcome_tiebreak_text, intermission_heading_text, intermission_message_text, intermission_footer_text, thanks_heading_text, thanks_subheading_text, thanks_events_heading_text, show_countdown, recent_calls_limit, theme_enabled, theme_name, is_sandbox, sandbox_source_session_id, sandbox_expires_at, is_favorite, created_at, started_at, ended_at"
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
      event_id: input.eventId ?? null,
      playlist_snapshot_id: input.playlistSnapshotId,
      current_round: 1,
      round_count: input.roundCount,
      round_modes: input.roundModes ?? [],
      card_count: input.cardCount,
      game_mode: input.gameMode,
      call_interval_seconds: input.callIntervalSeconds,
      remove_resleeve_seconds: input.removeResleeveSeconds ?? 20,
      place_vinyl_seconds: input.placeVinylSeconds ?? 8,
      cue_seconds: input.cueSeconds ?? 12,
      start_slide_seconds: input.startSlideSeconds ?? 5,
      host_buffer_seconds: input.hostBufferSeconds ?? 2,
      sonos_output_delay_ms: input.sonosOutputDelayMs ?? 75,
      call_reveal_delay_seconds: input.callRevealDelaySeconds ?? 10,
      default_intermission_seconds: input.defaultIntermissionSeconds ?? 600,
      welcome_heading_text: input.welcomeHeadingText ?? "Welcome To Vinyl Music Bingo",
      welcome_message_text: input.welcomeMessageText ?? "Get your cards ready and listen for the next call.",
      welcome_rules_text: input.welcomeRulesText ?? "Complete the winning pattern before anyone else.",
      welcome_tiebreak_text: input.welcomeTiebreakText ?? "Ties are resolved by the host.",
      intermission_heading_text: input.intermissionHeadingText ?? "Intermission",
      intermission_message_text: input.intermissionMessageText ?? "Round {round} of {roundCount} begins in",
      intermission_footer_text: input.intermissionFooterText ?? "Crate reset in progress. Next round starts shortly.",
      thanks_heading_text: input.thanksHeadingText ?? "Thank You For Playing!",
      thanks_subheading_text: input.thanksSubheadingText ?? "Vinyl Music Bingo",
      thanks_events_heading_text: input.thanksEventsHeadingText ?? "Find Us Next At",
      show_countdown: input.showCountdown ?? true,
      recent_calls_limit: input.recentCallsLimit ?? 5,
      theme_enabled: input.themeEnabled ?? false,
      theme_name: input.themeName ?? null,
      is_sandbox: input.isSandbox ?? false,
      sandbox_source_session_id: input.sandboxSourceSessionId ?? null,
      sandbox_expires_at: input.sandboxExpiresAt ?? null,
      session_code: this.buildSessionCode(),
    };

    const { data, error } = await supabase
      .from("sg_game_bingo_sessions")
      .insert(payload)
      .select(
        "id, tenant_id, created_by_user_id, event_id, session_code, status, playlist_snapshot_id, current_round, round_count, round_modes, card_count, game_mode, call_interval_seconds, remove_resleeve_seconds, place_vinyl_seconds, cue_seconds, start_slide_seconds, host_buffer_seconds, sonos_output_delay_ms, call_reveal_delay_seconds, default_intermission_seconds, welcome_heading_text, welcome_message_text, welcome_rules_text, welcome_tiebreak_text, intermission_heading_text, intermission_message_text, intermission_footer_text, thanks_heading_text, thanks_subheading_text, thanks_events_heading_text, show_countdown, recent_calls_limit, theme_enabled, theme_name, is_sandbox, sandbox_source_session_id, sandbox_expires_at, is_favorite, created_at, started_at, ended_at"
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRow(data as Record<string, unknown>);
  }

  async getById(
    tenantId: string,
    sessionId: string
  ): Promise<StandaloneBingoSessionRecord | null> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_game_bingo_sessions")
      .select(
        "id, tenant_id, created_by_user_id, event_id, session_code, status, playlist_snapshot_id, current_round, round_count, round_modes, card_count, game_mode, call_interval_seconds, remove_resleeve_seconds, place_vinyl_seconds, cue_seconds, start_slide_seconds, host_buffer_seconds, sonos_output_delay_ms, call_reveal_delay_seconds, default_intermission_seconds, welcome_heading_text, welcome_message_text, welcome_rules_text, welcome_tiebreak_text, intermission_heading_text, intermission_message_text, intermission_footer_text, thanks_heading_text, thanks_subheading_text, thanks_events_heading_text, show_countdown, recent_calls_limit, theme_enabled, theme_name, is_sandbox, sandbox_source_session_id, sandbox_expires_at, is_favorite, created_at, started_at, ended_at"
      )
      .eq("tenant_id", tenantId)
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async update(
    tenantId: string,
    sessionId: string,
    input: UpdateStandaloneBingoSessionInput
  ): Promise<StandaloneBingoSessionRecord | null> {
    const supabase = getStandaloneSupabaseClient();
    const patch: Record<string, unknown> = {};

    if (input.status !== undefined) patch.status = input.status;
    if (input.startedAt !== undefined) patch.started_at = input.startedAt;
    if (input.endedAt !== undefined) patch.ended_at = input.endedAt;
    if (input.isFavorite !== undefined) patch.is_favorite = input.isFavorite;
    if (input.callRevealDelaySeconds !== undefined) patch.call_reveal_delay_seconds = input.callRevealDelaySeconds;
    if (input.defaultIntermissionSeconds !== undefined) patch.default_intermission_seconds = input.defaultIntermissionSeconds;
    if (input.currentRound !== undefined) patch.current_round = input.currentRound;
    if (input.roundModes !== undefined) patch.round_modes = input.roundModes;
    if (input.sandboxExpiresAt !== undefined) patch.sandbox_expires_at = input.sandboxExpiresAt;

    const { data, error } = await supabase
      .from("sg_game_bingo_sessions")
      .update(patch)
      .eq("tenant_id", tenantId)
      .eq("id", sessionId)
      .select(
        "id, tenant_id, created_by_user_id, event_id, session_code, status, playlist_snapshot_id, current_round, round_count, round_modes, card_count, game_mode, call_interval_seconds, remove_resleeve_seconds, place_vinyl_seconds, cue_seconds, start_slide_seconds, host_buffer_seconds, sonos_output_delay_ms, call_reveal_delay_seconds, default_intermission_seconds, welcome_heading_text, welcome_message_text, welcome_rules_text, welcome_tiebreak_text, intermission_heading_text, intermission_message_text, intermission_footer_text, thanks_heading_text, thanks_subheading_text, thanks_events_heading_text, is_sandbox, sandbox_source_session_id, sandbox_expires_at, is_favorite, created_at, started_at, ended_at"
      )
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async delete(tenantId: string, sessionId: string): Promise<void> {
    const supabase = getStandaloneSupabaseClient();
    const { error } = await supabase
      .from("sg_game_bingo_sessions")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", sessionId);

    if (error) {
      throw new Error(error.message);
    }
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

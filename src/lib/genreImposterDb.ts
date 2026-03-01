import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type GiSessionStatus = "pending" | "running" | "paused" | "completed";
type GiRoundStatus = "pending" | "active" | "closed";
type GiCallStatus = "pending" | "cued" | "played" | "revealed" | "scored" | "skipped";

export type GenreImposterDatabase = {
  public: {
    Tables: {
      events: {
        Row: {
          id: number;
          date: string;
          title: string;
          time: string | null;
          location: string | null;
        };
        Insert: {
          id?: number;
          date: string;
          title: string;
          time?: string | null;
          location?: string | null;
        };
        Update: {
          id?: number;
          date?: string;
          title?: string;
          time?: string | null;
          location?: string | null;
        };
        Relationships: [];
      };
      gi_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          playlist_id: number | null;
          session_code: string;
          title: string;
          round_count: number;
          reveal_mode: "after_third_spin" | "immediate";
          reason_mode: "host_judged" | "strict_key";
          imposter_points: number;
          reason_bonus_points: number;
          remove_resleeve_seconds: number;
          find_record_seconds: number;
          cue_seconds: number;
          host_buffer_seconds: number;
          target_gap_seconds: number;
          current_round: number;
          current_call_index: number;
          countdown_started_at: string | null;
          paused_remaining_seconds: number | null;
          paused_at: string | null;
          show_title: boolean;
          show_round: boolean;
          show_category: boolean;
          show_scoreboard: boolean;
          status: GiSessionStatus;
          created_at: string;
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: number;
          event_id?: number | null;
          playlist_id?: number | null;
          session_code: string;
          title: string;
          round_count?: number;
          reveal_mode?: "after_third_spin" | "immediate";
          reason_mode?: "host_judged" | "strict_key";
          imposter_points?: number;
          reason_bonus_points?: number;
          remove_resleeve_seconds?: number;
          find_record_seconds?: number;
          cue_seconds?: number;
          host_buffer_seconds?: number;
          target_gap_seconds?: number;
          current_round?: number;
          current_call_index?: number;
          countdown_started_at?: string | null;
          paused_remaining_seconds?: number | null;
          paused_at?: string | null;
          show_title?: boolean;
          show_round?: boolean;
          show_category?: boolean;
          show_scoreboard?: boolean;
          status?: GiSessionStatus;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          id?: number;
          event_id?: number | null;
          playlist_id?: number | null;
          session_code?: string;
          title?: string;
          round_count?: number;
          reveal_mode?: "after_third_spin" | "immediate";
          reason_mode?: "host_judged" | "strict_key";
          imposter_points?: number;
          reason_bonus_points?: number;
          remove_resleeve_seconds?: number;
          find_record_seconds?: number;
          cue_seconds?: number;
          host_buffer_seconds?: number;
          target_gap_seconds?: number;
          current_round?: number;
          current_call_index?: number;
          countdown_started_at?: string | null;
          paused_remaining_seconds?: number | null;
          paused_at?: string | null;
          show_title?: boolean;
          show_round?: boolean;
          show_category?: boolean;
          show_scoreboard?: boolean;
          status?: GiSessionStatus;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      gi_session_teams: {
        Row: {
          id: number;
          session_id: number;
          team_name: string;
          table_label: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          team_name: string;
          table_label?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          team_name?: string;
          table_label?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      gi_session_rounds: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          category_label: string;
          category_card_note: string | null;
          reason_key: string | null;
          imposter_call_index: number;
          status: GiRoundStatus;
          opened_at: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          category_label: string;
          category_card_note?: string | null;
          reason_key?: string | null;
          imposter_call_index: number;
          status?: GiRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          category_label?: string;
          category_card_note?: string | null;
          reason_key?: string | null;
          imposter_call_index?: number;
          status?: GiRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      gi_session_calls: {
        Row: {
          id: number;
          session_id: number;
          round_id: number;
          round_number: number;
          call_index: number;
          play_order: number;
          source_label: string | null;
          artist: string | null;
          title: string | null;
          record_label: string | null;
          fits_category: boolean;
          is_imposter: boolean;
          host_notes: string | null;
          status: GiCallStatus;
          cued_at: string | null;
          played_at: string | null;
          revealed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_id: number;
          round_number: number;
          call_index: number;
          play_order: number;
          source_label?: string | null;
          artist?: string | null;
          title?: string | null;
          record_label?: string | null;
          fits_category?: boolean;
          is_imposter?: boolean;
          host_notes?: string | null;
          status?: GiCallStatus;
          cued_at?: string | null;
          played_at?: string | null;
          revealed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_id?: number;
          round_number?: number;
          call_index?: number;
          play_order?: number;
          source_label?: string | null;
          artist?: string | null;
          title?: string | null;
          record_label?: string | null;
          fits_category?: boolean;
          is_imposter?: boolean;
          host_notes?: string | null;
          status?: GiCallStatus;
          cued_at?: string | null;
          played_at?: string | null;
          revealed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      gi_round_team_picks: {
        Row: {
          id: number;
          session_id: number;
          round_id: number;
          team_id: number;
          picked_call_id: number;
          reason_text: string | null;
          imposter_correct: boolean;
          reason_correct: boolean;
          awarded_points: number;
          scored_by: string | null;
          locked_at: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_id: number;
          team_id: number;
          picked_call_id: number;
          reason_text?: string | null;
          imposter_correct?: boolean;
          reason_correct?: boolean;
          awarded_points?: number;
          scored_by?: string | null;
          locked_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_id?: number;
          team_id?: number;
          picked_call_id?: number;
          reason_text?: string | null;
          imposter_correct?: boolean;
          reason_correct?: boolean;
          awarded_points?: number;
          scored_by?: string | null;
          locked_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      gi_team_scores: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          total_points: number;
          imposter_hits: number;
          reason_bonus_hits: number;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          team_id: number;
          total_points?: number;
          imposter_hits?: number;
          reason_bonus_hits?: number;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          team_id?: number;
          total_points?: number;
          imposter_hits?: number;
          reason_bonus_hits?: number;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type GenreImposterDbClient = SupabaseClient<GenreImposterDatabase>;

export function getGenreImposterDb(): GenreImposterDbClient {
  return supabaseAdmin as unknown as GenreImposterDbClient;
}

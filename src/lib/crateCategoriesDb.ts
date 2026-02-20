import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type CrateCategoriesSessionStatus = "pending" | "running" | "paused" | "completed";
type CrateCategoriesRoundStatus = "pending" | "active" | "closed";
type CrateCategoriesCallStatus = "pending" | "playing" | "revealed" | "scored" | "skipped";
type CrateCategoriesPromptType =
  | "identify-thread"
  | "odd-one-out"
  | "belongs-or-bust"
  | "decade-lock"
  | "mood-match";

type CrateCategoriesDatabase = {
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
      ccat_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          session_code: string;
          title: string;
          round_count: number;
          default_tracks_per_round: number;
          remove_resleeve_seconds: number;
          find_record_seconds: number;
          cue_seconds: number;
          host_buffer_seconds: number;
          target_gap_seconds: number;
          current_round: number;
          current_call_index: number;
          show_title: boolean;
          show_round: boolean;
          show_prompt: boolean;
          show_scoreboard: boolean;
          status: CrateCategoriesSessionStatus;
          created_at: string;
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: number;
          event_id?: number | null;
          session_code: string;
          title: string;
          round_count?: number;
          default_tracks_per_round?: number;
          remove_resleeve_seconds?: number;
          find_record_seconds?: number;
          cue_seconds?: number;
          host_buffer_seconds?: number;
          target_gap_seconds?: number;
          current_round?: number;
          current_call_index?: number;
          show_title?: boolean;
          show_round?: boolean;
          show_prompt?: boolean;
          show_scoreboard?: boolean;
          status?: CrateCategoriesSessionStatus;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          event_id?: number | null;
          title?: string;
          current_round?: number;
          current_call_index?: number;
          show_title?: boolean;
          show_round?: boolean;
          show_prompt?: boolean;
          show_scoreboard?: boolean;
          status?: CrateCategoriesSessionStatus;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      ccat_session_teams: {
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
          team_name?: string;
          table_label?: string | null;
          active?: boolean;
        };
        Relationships: [];
      };
      ccat_session_rounds: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          category_label: string;
          prompt_type: CrateCategoriesPromptType;
          tracks_in_round: number;
          points_correct: number;
          points_bonus: number;
          status: CrateCategoriesRoundStatus;
          opened_at: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          category_label: string;
          prompt_type: CrateCategoriesPromptType;
          tracks_in_round?: number;
          points_correct?: number;
          points_bonus?: number;
          status?: CrateCategoriesRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          category_label?: string;
          prompt_type?: CrateCategoriesPromptType;
          tracks_in_round?: number;
          points_correct?: number;
          points_bonus?: number;
          status?: CrateCategoriesRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      ccat_session_calls: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          call_index: number;
          track_in_round: number;
          artist: string;
          title: string;
          release_year: number | null;
          source_label: string | null;
          crate_tag: string | null;
          host_notes: string | null;
          status: CrateCategoriesCallStatus;
          asked_at: string | null;
          revealed_at: string | null;
          scored_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          call_index: number;
          track_in_round: number;
          artist: string;
          title: string;
          release_year?: number | null;
          source_label?: string | null;
          crate_tag?: string | null;
          host_notes?: string | null;
          status?: CrateCategoriesCallStatus;
          asked_at?: string | null;
          revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Update: {
          track_in_round?: number;
          artist?: string;
          title?: string;
          release_year?: number | null;
          source_label?: string | null;
          crate_tag?: string | null;
          host_notes?: string | null;
          status?: CrateCategoriesCallStatus;
          asked_at?: string | null;
          revealed_at?: string | null;
          scored_at?: string | null;
        };
        Relationships: [];
      };
      ccat_round_scores: {
        Row: {
          id: number;
          session_id: number;
          round_id: number;
          team_id: number;
          guess_summary: string | null;
          rationale: string | null;
          awarded_points: number;
          scored_by: string | null;
          notes: string | null;
          scored_at: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_id: number;
          team_id: number;
          guess_summary?: string | null;
          rationale?: string | null;
          awarded_points?: number;
          scored_by?: string | null;
          notes?: string | null;
          scored_at?: string;
          created_at?: string;
        };
        Update: {
          guess_summary?: string | null;
          rationale?: string | null;
          awarded_points?: number;
          scored_by?: string | null;
          notes?: string | null;
          scored_at?: string;
        };
        Relationships: [];
      };
      ccat_session_events: {
        Row: {
          id: number;
          session_id: number;
          event_type: string;
          payload: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          event_type: string;
          payload?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          payload?: Record<string, unknown> | null;
        };
        Relationships: [];
      };
    };
  };
};

export function getCrateCategoriesDb(): SupabaseClient<CrateCategoriesDatabase> {
  return supabaseAdmin as SupabaseClient<CrateCategoriesDatabase>;
}

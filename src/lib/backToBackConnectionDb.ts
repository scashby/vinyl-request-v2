import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type BackToBackConnectionSessionStatus = "pending" | "running" | "paused" | "completed";
type BackToBackConnectionRoundStatus = "pending" | "active" | "closed";
type BackToBackConnectionCallStatus =
  | "pending"
  | "played_track_a"
  | "played_track_b"
  | "discussion"
  | "revealed"
  | "scored"
  | "skipped";

type BackToBackConnectionDatabase = {
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
      b2bc_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          session_code: string;
          title: string;
          round_count: number;
          connection_points: number;
          detail_bonus_points: number;
          remove_resleeve_seconds: number;
          find_record_seconds: number;
          cue_seconds: number;
          host_buffer_seconds: number;
          target_gap_seconds: number;
          current_round: number;
          current_call_index: number;
          show_title: boolean;
          show_round: boolean;
          show_scoreboard: boolean;
          show_connection_prompt: boolean;
          status: BackToBackConnectionSessionStatus;
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
          connection_points?: number;
          detail_bonus_points?: number;
          remove_resleeve_seconds?: number;
          find_record_seconds?: number;
          cue_seconds?: number;
          host_buffer_seconds?: number;
          target_gap_seconds?: number;
          current_round?: number;
          current_call_index?: number;
          show_title?: boolean;
          show_round?: boolean;
          show_scoreboard?: boolean;
          show_connection_prompt?: boolean;
          status?: BackToBackConnectionSessionStatus;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          id?: number;
          event_id?: number | null;
          session_code?: string;
          title?: string;
          round_count?: number;
          connection_points?: number;
          detail_bonus_points?: number;
          remove_resleeve_seconds?: number;
          find_record_seconds?: number;
          cue_seconds?: number;
          host_buffer_seconds?: number;
          target_gap_seconds?: number;
          current_round?: number;
          current_call_index?: number;
          show_title?: boolean;
          show_round?: boolean;
          show_scoreboard?: boolean;
          show_connection_prompt?: boolean;
          status?: BackToBackConnectionSessionStatus;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      b2bc_session_teams: {
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
      b2bc_session_rounds: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          round_title: string | null;
          status: BackToBackConnectionRoundStatus;
          opened_at: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          round_title?: string | null;
          status?: BackToBackConnectionRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          round_title?: string | null;
          status?: BackToBackConnectionRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      b2bc_session_calls: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          call_index: number;
          track_a_artist: string;
          track_a_title: string;
          track_a_release_year: number | null;
          track_a_source_label: string | null;
          track_b_artist: string;
          track_b_title: string;
          track_b_release_year: number | null;
          track_b_source_label: string | null;
          accepted_connection: string;
          accepted_detail: string | null;
          host_notes: string | null;
          status: BackToBackConnectionCallStatus;
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
          track_a_artist: string;
          track_a_title: string;
          track_a_release_year?: number | null;
          track_a_source_label?: string | null;
          track_b_artist: string;
          track_b_title: string;
          track_b_release_year?: number | null;
          track_b_source_label?: string | null;
          accepted_connection: string;
          accepted_detail?: string | null;
          host_notes?: string | null;
          status?: BackToBackConnectionCallStatus;
          asked_at?: string | null;
          revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          call_index?: number;
          track_a_artist?: string;
          track_a_title?: string;
          track_a_release_year?: number | null;
          track_a_source_label?: string | null;
          track_b_artist?: string;
          track_b_title?: string;
          track_b_release_year?: number | null;
          track_b_source_label?: string | null;
          accepted_connection?: string;
          accepted_detail?: string | null;
          host_notes?: string | null;
          status?: BackToBackConnectionCallStatus;
          asked_at?: string | null;
          revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      b2bc_team_scores: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          call_id: number;
          guessed_connection: string | null;
          guessed_detail: string | null;
          connection_correct: boolean;
          detail_correct: boolean;
          awarded_points: number;
          scored_by: string | null;
          notes: string | null;
          scored_at: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          team_id: number;
          call_id: number;
          guessed_connection?: string | null;
          guessed_detail?: string | null;
          connection_correct?: boolean;
          detail_correct?: boolean;
          awarded_points?: number;
          scored_by?: string | null;
          notes?: string | null;
          scored_at?: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          team_id?: number;
          call_id?: number;
          guessed_connection?: string | null;
          guessed_detail?: string | null;
          connection_correct?: boolean;
          detail_correct?: boolean;
          awarded_points?: number;
          scored_by?: string | null;
          notes?: string | null;
          scored_at?: string;
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

export function getBackToBackConnectionDb(): SupabaseClient<BackToBackConnectionDatabase> {
  return supabaseAdmin as unknown as SupabaseClient<BackToBackConnectionDatabase>;
}

import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type OriginalOrCoverSessionStatus = "pending" | "running" | "paused" | "completed";
type OriginalOrCoverRoundStatus = "pending" | "active" | "closed";
type OriginalOrCoverCallStatus = "pending" | "asked" | "revealed" | "scored" | "skipped";

type OriginalOrCoverDatabase = {
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
      ooc_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          session_code: string;
          title: string;
          round_count: number;
          points_correct_call: number;
          bonus_original_artist_points: number;
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
          show_prompt: boolean;
          status: OriginalOrCoverSessionStatus;
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
          points_correct_call?: number;
          bonus_original_artist_points?: number;
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
          show_prompt?: boolean;
          status?: OriginalOrCoverSessionStatus;
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
          points_correct_call?: number;
          bonus_original_artist_points?: number;
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
          show_prompt?: boolean;
          status?: OriginalOrCoverSessionStatus;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      ooc_session_teams: {
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
      ooc_session_rounds: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          round_title: string | null;
          status: OriginalOrCoverRoundStatus;
          opened_at: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          round_title?: string | null;
          status?: OriginalOrCoverRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          round_title?: string | null;
          status?: OriginalOrCoverRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ooc_session_calls: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          call_index: number;
          source_label: string | null;
          spin_artist: string;
          track_title: string;
          original_artist: string;
          alt_accept_original_artist: string | null;
          release_year: number | null;
          is_cover: boolean;
          host_notes: string | null;
          status: OriginalOrCoverCallStatus;
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
          source_label?: string | null;
          spin_artist: string;
          track_title: string;
          original_artist: string;
          alt_accept_original_artist?: string | null;
          release_year?: number | null;
          is_cover: boolean;
          host_notes?: string | null;
          status?: OriginalOrCoverCallStatus;
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
          source_label?: string | null;
          spin_artist?: string;
          track_title?: string;
          original_artist?: string;
          alt_accept_original_artist?: string | null;
          release_year?: number | null;
          is_cover?: boolean;
          host_notes?: string | null;
          status?: OriginalOrCoverCallStatus;
          asked_at?: string | null;
          revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ooc_team_scores: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          call_id: number;
          called_original: boolean | null;
          named_original_artist: string | null;
          call_correct: boolean;
          artist_bonus_awarded: boolean;
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
          called_original?: boolean | null;
          named_original_artist?: string | null;
          call_correct?: boolean;
          artist_bonus_awarded?: boolean;
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
          called_original?: boolean | null;
          named_original_artist?: string | null;
          call_correct?: boolean;
          artist_bonus_awarded?: boolean;
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

export function getOriginalOrCoverDb(): SupabaseClient<OriginalOrCoverDatabase> {
  return supabaseAdmin as unknown as SupabaseClient<OriginalOrCoverDatabase>;
}

import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type SampleDetectiveSessionStatus = "pending" | "running" | "paused" | "completed";
type SampleDetectiveRoundStatus = "pending" | "active" | "closed";
type SampleDetectiveCallStatus = "pending" | "asked" | "revealed" | "scored" | "skipped";

type SampleDetectiveDatabase = {
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
      collection_playlists: {
        Row: {
          id: number;
          name: string;
          is_smart: boolean;
        };
        Insert: {
          id?: number;
          name: string;
          is_smart?: boolean;
        };
        Update: {
          id?: number;
          name?: string;
          is_smart?: boolean;
        };
        Relationships: [];
      };
      sd_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          playlist_id: number | null;
          session_code: string;
          title: string;
          round_count: number;
          points_correct_pair: number;
          bonus_both_artists_points: number;
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
          show_scoring_hint: boolean;
          status: SampleDetectiveSessionStatus;
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
          points_correct_pair?: number;
          bonus_both_artists_points?: number;
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
          show_scoring_hint?: boolean;
          status?: SampleDetectiveSessionStatus;
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
          points_correct_pair?: number;
          bonus_both_artists_points?: number;
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
          show_scoring_hint?: boolean;
          status?: SampleDetectiveSessionStatus;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      sd_session_rounds: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          round_title: string | null;
          status: SampleDetectiveRoundStatus;
          opened_at: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          round_title?: string | null;
          status?: SampleDetectiveRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          round_title?: string | null;
          status?: SampleDetectiveRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      sd_session_calls: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          call_index: number;
          source_label: string | null;
          sampled_artist: string;
          sampled_title: string;
          source_artist: string;
          source_title: string;
          release_year: number | null;
          sample_timestamp: string | null;
          host_notes: string | null;
          status: SampleDetectiveCallStatus;
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
          sampled_artist: string;
          sampled_title: string;
          source_artist: string;
          source_title: string;
          release_year?: number | null;
          sample_timestamp?: string | null;
          host_notes?: string | null;
          status?: SampleDetectiveCallStatus;
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
          sampled_artist?: string;
          sampled_title?: string;
          source_artist?: string;
          source_title?: string;
          release_year?: number | null;
          sample_timestamp?: string | null;
          host_notes?: string | null;
          status?: SampleDetectiveCallStatus;
          asked_at?: string | null;
          revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      sd_session_teams: {
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
      sd_team_scores: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          call_id: number;
          guessed_sampled_artist: string | null;
          guessed_sampled_title: string | null;
          guessed_source_artist: string | null;
          guessed_source_title: string | null;
          pair_correct: boolean;
          both_artists_named: boolean;
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
          guessed_sampled_artist?: string | null;
          guessed_sampled_title?: string | null;
          guessed_source_artist?: string | null;
          guessed_source_title?: string | null;
          pair_correct?: boolean;
          both_artists_named?: boolean;
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
          guessed_sampled_artist?: string | null;
          guessed_sampled_title?: string | null;
          guessed_source_artist?: string | null;
          guessed_source_title?: string | null;
          pair_correct?: boolean;
          both_artists_named?: boolean;
          awarded_points?: number;
          scored_by?: string | null;
          notes?: string | null;
          scored_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      sd_session_events: {
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
          id?: number;
          session_id?: number;
          event_type?: string;
          payload?: Record<string, unknown> | null;
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

let cachedClient: SupabaseClient<SampleDetectiveDatabase> | null = null;

export function getSampleDetectiveDb(): SupabaseClient<SampleDetectiveDatabase> {
  if (!cachedClient) {
    cachedClient = supabaseAdmin as unknown as SupabaseClient<SampleDetectiveDatabase>;
  }
  return cachedClient;
}

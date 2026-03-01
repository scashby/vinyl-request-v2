import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type CoverArtSessionStatus = "pending" | "running" | "paused" | "completed";
type CoverArtRoundStatus = "pending" | "active" | "closed";
type CoverArtCallStatus = "pending" | "stage_1" | "stage_2" | "final_reveal" | "scored" | "skipped";

type CoverArtClueChaseDatabase = {
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
      cacc_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          playlist_id: number | null;
          session_code: string;
          title: string;
          round_count: number;
          stage_one_points: number;
          stage_two_points: number;
          final_reveal_points: number;
          audio_clue_enabled: boolean;
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
          show_stage_hint: boolean;
          status: CoverArtSessionStatus;
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
          stage_one_points?: number;
          stage_two_points?: number;
          final_reveal_points?: number;
          audio_clue_enabled?: boolean;
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
          show_stage_hint?: boolean;
          status?: CoverArtSessionStatus;
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
          stage_one_points?: number;
          stage_two_points?: number;
          final_reveal_points?: number;
          audio_clue_enabled?: boolean;
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
          show_stage_hint?: boolean;
          status?: CoverArtSessionStatus;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      cacc_session_teams: {
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
      cacc_session_rounds: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          round_title: string | null;
          status: CoverArtRoundStatus;
          opened_at: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          round_title?: string | null;
          status?: CoverArtRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          round_title?: string | null;
          status?: CoverArtRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      cacc_session_calls: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          call_index: number;
          source_label: string | null;
          artist: string;
          title: string;
          release_year: number | null;
          reveal_level_1_image_url: string;
          reveal_level_2_image_url: string;
          reveal_level_3_image_url: string;
          audio_clue_source: string | null;
          host_notes: string | null;
          status: CoverArtCallStatus;
          stage_revealed: number;
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
          artist: string;
          title: string;
          release_year?: number | null;
          reveal_level_1_image_url: string;
          reveal_level_2_image_url: string;
          reveal_level_3_image_url: string;
          audio_clue_source?: string | null;
          host_notes?: string | null;
          status?: CoverArtCallStatus;
          stage_revealed?: number;
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
          artist?: string;
          title?: string;
          release_year?: number | null;
          reveal_level_1_image_url?: string;
          reveal_level_2_image_url?: string;
          reveal_level_3_image_url?: string;
          audio_clue_source?: string | null;
          host_notes?: string | null;
          status?: CoverArtCallStatus;
          stage_revealed?: number;
          asked_at?: string | null;
          revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      cacc_team_scores: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          call_id: number;
          guessed_artist: string | null;
          guessed_title: string | null;
          guessed_at_stage: number | null;
          used_audio_clue: boolean;
          exact_match: boolean;
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
          guessed_artist?: string | null;
          guessed_title?: string | null;
          guessed_at_stage?: number | null;
          used_audio_clue?: boolean;
          exact_match?: boolean;
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
          guessed_artist?: string | null;
          guessed_title?: string | null;
          guessed_at_stage?: number | null;
          used_audio_clue?: boolean;
          exact_match?: boolean;
          awarded_points?: number;
          scored_by?: string | null;
          notes?: string | null;
          scored_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      cacc_session_events: {
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

export function getCoverArtClueChaseDb(): SupabaseClient<CoverArtClueChaseDatabase> {
  return supabaseAdmin as unknown as SupabaseClient<CoverArtClueChaseDatabase>;
}

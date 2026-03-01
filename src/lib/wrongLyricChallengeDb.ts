import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type WrongLyricChallengeDatabase = {
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
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      wlc_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          playlist_id: number | null;
          session_code: string;
          title: string;
          round_count: number;
          lyric_points: number;
          song_bonus_enabled: boolean;
          song_bonus_points: number;
          option_count: number;
          reveal_mode: "host_reads" | "jumbotron_choices";
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
          show_scoreboard: boolean;
          show_options: boolean;
          status: "pending" | "running" | "paused" | "completed";
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
          lyric_points?: number;
          song_bonus_enabled?: boolean;
          song_bonus_points?: number;
          option_count?: number;
          reveal_mode?: "host_reads" | "jumbotron_choices";
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
          show_scoreboard?: boolean;
          show_options?: boolean;
          status?: "pending" | "running" | "paused" | "completed";
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
          lyric_points?: number;
          song_bonus_enabled?: boolean;
          song_bonus_points?: number;
          option_count?: number;
          reveal_mode?: "host_reads" | "jumbotron_choices";
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
          show_scoreboard?: boolean;
          show_options?: boolean;
          status?: "pending" | "running" | "paused" | "completed";
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      wlc_session_teams: {
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
      wlc_session_rounds: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          round_title: string | null;
          status: "pending" | "active" | "closed";
          opened_at: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          round_title?: string | null;
          status?: "pending" | "active" | "closed";
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          round_title?: string | null;
          status?: "pending" | "active" | "closed";
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      wlc_session_calls: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          call_index: number;
          source_label: string | null;
          artist: string;
          title: string;
          correct_lyric: string;
          decoy_lyric_1: string;
          decoy_lyric_2: string;
          decoy_lyric_3: string | null;
          answer_slot: number;
          dj_cue_hint: string | null;
          host_notes: string | null;
          status: "pending" | "asked" | "locked" | "revealed" | "scored" | "skipped";
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
          correct_lyric: string;
          decoy_lyric_1: string;
          decoy_lyric_2: string;
          decoy_lyric_3?: string | null;
          answer_slot?: number;
          dj_cue_hint?: string | null;
          host_notes?: string | null;
          status?: "pending" | "asked" | "locked" | "revealed" | "scored" | "skipped";
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
          correct_lyric?: string;
          decoy_lyric_1?: string;
          decoy_lyric_2?: string;
          decoy_lyric_3?: string | null;
          answer_slot?: number;
          dj_cue_hint?: string | null;
          host_notes?: string | null;
          status?: "pending" | "asked" | "locked" | "revealed" | "scored" | "skipped";
          asked_at?: string | null;
          revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      wlc_team_scores: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          call_id: number;
          guessed_option: number | null;
          guessed_artist: string | null;
          guessed_title: string | null;
          lyric_correct: boolean;
          song_bonus_awarded: boolean;
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
          guessed_option?: number | null;
          guessed_artist?: string | null;
          guessed_title?: string | null;
          lyric_correct?: boolean;
          song_bonus_awarded?: boolean;
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
          guessed_option?: number | null;
          guessed_artist?: string | null;
          guessed_title?: string | null;
          lyric_correct?: boolean;
          song_bonus_awarded?: boolean;
          awarded_points?: number;
          scored_by?: string | null;
          notes?: string | null;
          scored_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      wlc_session_events: {
        Row: {
          id: number;
          session_id: number;
          event_type: string;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          event_type: string;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          event_type?: string;
          payload?: Json | null;
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

export type WrongLyricChallengeDbClient = SupabaseClient<WrongLyricChallengeDatabase>;

export function getWrongLyricChallengeDb(): WrongLyricChallengeDbClient {
  return supabaseAdmin as unknown as WrongLyricChallengeDbClient;
}

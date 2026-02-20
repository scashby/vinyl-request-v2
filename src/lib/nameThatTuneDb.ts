import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type NameThatTuneDatabase = {
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
      ntt_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          session_code: string;
          title: string;
          round_count: number;
          lock_in_rule: string;
          lock_in_window_seconds: number;
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
          show_rounds: boolean;
          show_scoreboard: boolean;
          status: "pending" | "running" | "paused" | "completed";
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
          lock_in_rule?: string;
          lock_in_window_seconds?: number;
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
          show_rounds?: boolean;
          show_scoreboard?: boolean;
          status?: "pending" | "running" | "paused" | "completed";
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
          lock_in_rule?: string;
          lock_in_window_seconds?: number;
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
          show_rounds?: boolean;
          show_scoreboard?: boolean;
          status?: "pending" | "running" | "paused" | "completed";
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      ntt_session_teams: {
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
      ntt_session_calls: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          call_index: number;
          source_label: string | null;
          artist_answer: string;
          title_answer: string;
          accepted_artist_aliases: Json;
          accepted_title_aliases: Json;
          snippet_start_seconds: number;
          snippet_duration_seconds: number;
          host_notes: string | null;
          status: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
          asked_at: string | null;
          answer_revealed_at: string | null;
          scored_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          call_index: number;
          source_label?: string | null;
          artist_answer: string;
          title_answer: string;
          accepted_artist_aliases?: Json;
          accepted_title_aliases?: Json;
          snippet_start_seconds?: number;
          snippet_duration_seconds?: number;
          host_notes?: string | null;
          status?: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
          asked_at?: string | null;
          answer_revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          call_index?: number;
          source_label?: string | null;
          artist_answer?: string;
          title_answer?: string;
          accepted_artist_aliases?: Json;
          accepted_title_aliases?: Json;
          snippet_start_seconds?: number;
          snippet_duration_seconds?: number;
          host_notes?: string | null;
          status?: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
          asked_at?: string | null;
          answer_revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ntt_team_scores: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          call_id: number;
          artist_correct: boolean;
          title_correct: boolean;
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
          artist_correct?: boolean;
          title_correct?: boolean;
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
          artist_correct?: boolean;
          title_correct?: boolean;
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

export type NameThatTuneDbClient = SupabaseClient<NameThatTuneDatabase>;

export function getNameThatTuneDb(): NameThatTuneDbClient {
  return supabaseAdmin as unknown as NameThatTuneDbClient;
}

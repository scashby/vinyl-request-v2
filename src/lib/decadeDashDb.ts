import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type DdSessionStatus = "pending" | "running" | "paused" | "completed";
type DdRoundStatus = "pending" | "active" | "closed";
type DdCallStatus = "pending" | "asked" | "locked" | "revealed" | "scored" | "skipped";

export type DecadeDashDatabase = {
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
      dd_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          playlist_id: number | null;
          session_code: string;
          title: string;
          round_count: number;
          adjacent_scoring_enabled: boolean;
          exact_points: number;
          adjacent_points: number;
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
          status: DdSessionStatus;
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
          adjacent_scoring_enabled?: boolean;
          exact_points?: number;
          adjacent_points?: number;
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
          status?: DdSessionStatus;
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
          adjacent_scoring_enabled?: boolean;
          exact_points?: number;
          adjacent_points?: number;
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
          status?: DdSessionStatus;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      dd_session_teams: {
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
      dd_session_rounds: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          round_title: string | null;
          status: DdRoundStatus;
          opened_at: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          round_title?: string | null;
          status?: DdRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          round_title?: string | null;
          status?: DdRoundStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      dd_session_calls: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          call_index: number;
          source_label: string | null;
          artist: string | null;
          title: string | null;
          release_year: number | null;
          decade_start: number;
          accepted_adjacent_decades: Json;
          host_notes: string | null;
          status: DdCallStatus;
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
          artist?: string | null;
          title?: string | null;
          release_year?: number | null;
          decade_start: number;
          accepted_adjacent_decades?: Json;
          host_notes?: string | null;
          status?: DdCallStatus;
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
          artist?: string | null;
          title?: string | null;
          release_year?: number | null;
          decade_start?: number;
          accepted_adjacent_decades?: Json;
          host_notes?: string | null;
          status?: DdCallStatus;
          asked_at?: string | null;
          revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      dd_team_scores: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          call_id: number;
          selected_decade: number | null;
          exact_match: boolean;
          adjacent_match: boolean;
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
          selected_decade?: number | null;
          exact_match?: boolean;
          adjacent_match?: boolean;
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
          selected_decade?: number | null;
          exact_match?: boolean;
          adjacent_match?: boolean;
          awarded_points?: number;
          scored_by?: string | null;
          notes?: string | null;
          scored_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      dd_session_events: {
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
  };
};

let decadeDashDb: SupabaseClient<DecadeDashDatabase> | null = null;

export function getDecadeDashDb(): SupabaseClient<DecadeDashDatabase> {
  if (!decadeDashDb) {
    decadeDashDb = supabaseAdmin as unknown as SupabaseClient<DecadeDashDatabase>;
  }
  return decadeDashDb;
}

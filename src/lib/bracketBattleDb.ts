import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BracketBattleDatabase = {
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
      bb_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          session_code: string;
          title: string;
          bracket_size: number;
          vote_method: "hands" | "slips";
          scoring_model: "round_weighted" | "flat_per_hit";
          remove_resleeve_seconds: number;
          find_record_seconds: number;
          cue_seconds: number;
          host_buffer_seconds: number;
          target_gap_seconds: number;
          current_round: number;
          current_matchup_index: number;
          show_title: boolean;
          show_round: boolean;
          show_bracket: boolean;
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
          bracket_size?: number;
          vote_method?: "hands" | "slips";
          scoring_model?: "round_weighted" | "flat_per_hit";
          remove_resleeve_seconds?: number;
          find_record_seconds?: number;
          cue_seconds?: number;
          host_buffer_seconds?: number;
          target_gap_seconds?: number;
          current_round?: number;
          current_matchup_index?: number;
          show_title?: boolean;
          show_round?: boolean;
          show_bracket?: boolean;
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
          bracket_size?: number;
          vote_method?: "hands" | "slips";
          scoring_model?: "round_weighted" | "flat_per_hit";
          remove_resleeve_seconds?: number;
          find_record_seconds?: number;
          cue_seconds?: number;
          host_buffer_seconds?: number;
          target_gap_seconds?: number;
          current_round?: number;
          current_matchup_index?: number;
          show_title?: boolean;
          show_round?: boolean;
          show_bracket?: boolean;
          show_scoreboard?: boolean;
          status?: "pending" | "running" | "paused" | "completed";
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      bb_session_teams: {
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
      bb_session_entries: {
        Row: {
          id: number;
          session_id: number;
          seed: number;
          entry_label: string;
          artist: string | null;
          title: string | null;
          source_label: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          seed: number;
          entry_label: string;
          artist?: string | null;
          title?: string | null;
          source_label?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          seed?: number;
          entry_label?: string;
          artist?: string | null;
          title?: string | null;
          source_label?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      bb_session_rounds: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          round_name: string;
          expected_matchups: number;
          status: "pending" | "active" | "closed";
          opened_at: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          round_name: string;
          expected_matchups: number;
          status?: "pending" | "active" | "closed";
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          round_name?: string;
          expected_matchups?: number;
          status?: "pending" | "active" | "closed";
          opened_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bb_session_matchups: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          matchup_index: number;
          higher_seed_entry_id: number | null;
          lower_seed_entry_id: number | null;
          winner_entry_id: number | null;
          source_label: string | null;
          vote_method: "hands" | "slips";
          status: "pending" | "active" | "voting_locked" | "scored" | "skipped";
          opened_at: string | null;
          voting_locked_at: string | null;
          winner_confirmed_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          round_number: number;
          matchup_index: number;
          higher_seed_entry_id?: number | null;
          lower_seed_entry_id?: number | null;
          winner_entry_id?: number | null;
          source_label?: string | null;
          vote_method?: "hands" | "slips";
          status?: "pending" | "active" | "voting_locked" | "scored" | "skipped";
          opened_at?: string | null;
          voting_locked_at?: string | null;
          winner_confirmed_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          round_number?: number;
          matchup_index?: number;
          higher_seed_entry_id?: number | null;
          lower_seed_entry_id?: number | null;
          winner_entry_id?: number | null;
          source_label?: string | null;
          vote_method?: "hands" | "slips";
          status?: "pending" | "active" | "voting_locked" | "scored" | "skipped";
          opened_at?: string | null;
          voting_locked_at?: string | null;
          winner_confirmed_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bb_bracket_picks: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          matchup_id: number;
          picked_entry_id: number;
          is_correct: boolean;
          points_awarded: number;
          locked_at: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          team_id: number;
          matchup_id: number;
          picked_entry_id: number;
          is_correct?: boolean;
          points_awarded?: number;
          locked_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          team_id?: number;
          matchup_id?: number;
          picked_entry_id?: number;
          is_correct?: boolean;
          points_awarded?: number;
          locked_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bb_matchup_vote_tallies: {
        Row: {
          id: number;
          session_id: number;
          matchup_id: number;
          winner_entry_id: number;
          vote_count: number;
          captured_by: string | null;
          captured_at: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          matchup_id: number;
          winner_entry_id: number;
          vote_count?: number;
          captured_by?: string | null;
          captured_at?: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          matchup_id?: number;
          winner_entry_id?: number;
          vote_count?: number;
          captured_by?: string | null;
          captured_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      bb_team_scores: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          total_points: number;
          tie_break_points: number;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          team_id: number;
          total_points?: number;
          tie_break_points?: number;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          team_id?: number;
          total_points?: number;
          tie_break_points?: number;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      bb_session_events: {
        Row: {
          id: number;
          session_id: number;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          event_type: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          event_type?: string;
          payload?: Json;
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

export type BracketBattleDbClient = SupabaseClient<BracketBattleDatabase>;

export function getBracketBattleDb(): BracketBattleDbClient {
  return supabaseAdmin as unknown as BracketBattleDbClient;
}

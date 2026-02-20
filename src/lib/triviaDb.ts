import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TriviaDatabase = {
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
      trivia_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          session_code: string;
          title: string;
          round_count: number;
          questions_per_round: number;
          score_mode: string;
          question_categories: string[];
          difficulty_easy_target: number;
          difficulty_medium_target: number;
          difficulty_hard_target: number;
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
          show_question_counter: boolean;
          show_leaderboard: boolean;
          max_teams: number | null;
          slips_batch_size: number | null;
          status: string;
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
          questions_per_round?: number;
          score_mode?: string;
          question_categories?: string[];
          difficulty_easy_target?: number;
          difficulty_medium_target?: number;
          difficulty_hard_target?: number;
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
          show_question_counter?: boolean;
          show_leaderboard?: boolean;
          max_teams?: number | null;
          slips_batch_size?: number | null;
          status?: string;
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
          questions_per_round?: number;
          score_mode?: string;
          question_categories?: string[];
          difficulty_easy_target?: number;
          difficulty_medium_target?: number;
          difficulty_hard_target?: number;
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
          show_question_counter?: boolean;
          show_leaderboard?: boolean;
          max_teams?: number | null;
          slips_batch_size?: number | null;
          status?: string;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      trivia_session_teams: {
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
      trivia_session_calls: {
        Row: {
          id: number;
          session_id: number;
          round_number: number;
          call_index: number;
          category: string;
          difficulty: string;
          question_text: string;
          answer_key: string;
          accepted_answers: Json;
          source_note: string | null;
          base_points: number;
          bonus_points: number;
          status: string;
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
          category: string;
          difficulty: string;
          question_text: string;
          answer_key: string;
          accepted_answers?: Json;
          source_note?: string | null;
          base_points?: number;
          bonus_points?: number;
          status?: string;
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
          category?: string;
          difficulty?: string;
          question_text?: string;
          answer_key?: string;
          accepted_answers?: Json;
          source_note?: string | null;
          base_points?: number;
          bonus_points?: number;
          status?: string;
          asked_at?: string | null;
          answer_revealed_at?: string | null;
          scored_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      trivia_team_scores: {
        Row: {
          id: number;
          session_id: number;
          team_id: number;
          call_id: number;
          awarded_points: number;
          correct: boolean;
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
          awarded_points: number;
          correct: boolean;
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
          awarded_points?: number;
          correct?: boolean;
          scored_by?: string | null;
          notes?: string | null;
          scored_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      trivia_session_events: {
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

export type TriviaDbClient = SupabaseClient<TriviaDatabase>;

export function getTriviaDb(): TriviaDbClient {
  return supabaseAdmin as unknown as TriviaDbClient;
}

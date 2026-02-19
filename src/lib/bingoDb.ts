import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BingoDatabase = {
  public: {
    Tables: {
      collection_playlists: {
        Row: {
          id: number;
          name: string;
          icon: string;
          color: string;
          is_smart: boolean;
          smart_rules: Json | null;
          match_rules: string;
          live_update: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          icon?: string;
          color?: string;
          is_smart?: boolean;
          smart_rules?: Json | null;
          match_rules?: string;
          live_update?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          icon?: string;
          color?: string;
          is_smart?: boolean;
          smart_rules?: Json | null;
          match_rules?: string;
          live_update?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      collection_playlist_items: {
        Row: {
          id: number;
          playlist_id: number;
          track_key: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          playlist_id: number;
          track_key: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          playlist_id?: number;
          track_key?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          id: number;
          release_id: number | null;
        };
        Insert: {
          id?: number;
          release_id?: number | null;
        };
        Update: {
          id?: number;
          release_id?: number | null;
        };
        Relationships: [];
      };
      release_tracks: {
        Row: {
          id: number;
          release_id: number | null;
          recording_id: number | null;
          position: string;
          side: string | null;
          title_override: string | null;
        };
        Insert: {
          id?: number;
          release_id?: number | null;
          recording_id?: number | null;
          position: string;
          side?: string | null;
          title_override?: string | null;
        };
        Update: {
          id?: number;
          release_id?: number | null;
          recording_id?: number | null;
          position?: string;
          side?: string | null;
          title_override?: string | null;
        };
        Relationships: [];
      };
      recordings: {
        Row: {
          id: number;
          title: string | null;
          track_artist: string | null;
        };
        Insert: {
          id?: number;
          title?: string | null;
          track_artist?: string | null;
        };
        Update: {
          id?: number;
          title?: string | null;
          track_artist?: string | null;
        };
        Relationships: [];
      };
      releases: {
        Row: {
          id: number;
          master_id: number | null;
        };
        Insert: {
          id?: number;
          master_id?: number | null;
        };
        Update: {
          id?: number;
          master_id?: number | null;
        };
        Relationships: [];
      };
      masters: {
        Row: {
          id: number;
          title: string;
          main_artist_id: number | null;
        };
        Insert: {
          id?: number;
          title: string;
          main_artist_id?: number | null;
        };
        Update: {
          id?: number;
          title?: string;
          main_artist_id?: number | null;
        };
        Relationships: [];
      };
      artists: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      bingo_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          playlist_id: number;
          session_code: string;
          game_mode: string;
          card_count: number;
          card_layout: string;
          card_label_mode: string;
          round_count: number;
          current_round: number;
          songs_per_round: number;
          clip_seconds: number;
          prep_buffer_seconds: number;
          auto_advance: boolean;
          round_end_policy: string;
          tie_break_policy: string;
          pool_exhaustion_policy: string;
          seconds_to_next_call: number;
          countdown_started_at: string | null;
          paused_remaining_seconds: number | null;
          paused_at: string | null;
          current_call_index: number;
          recent_calls_limit: number;
          show_title: boolean;
          show_logo: boolean;
          show_rounds: boolean;
          show_countdown: boolean;
          status: string;
          created_at: string;
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: number;
          event_id?: number | null;
          playlist_id: number;
          session_code: string;
          game_mode: string;
          card_count?: number;
          card_layout?: string;
          card_label_mode?: string;
          round_count?: number;
          current_round?: number;
          songs_per_round?: number;
          clip_seconds?: number;
          prep_buffer_seconds?: number;
          auto_advance?: boolean;
          round_end_policy?: string;
          tie_break_policy?: string;
          pool_exhaustion_policy?: string;
          seconds_to_next_call?: number;
          countdown_started_at?: string | null;
          paused_remaining_seconds?: number | null;
          paused_at?: string | null;
          current_call_index?: number;
          recent_calls_limit?: number;
          show_title?: boolean;
          show_logo?: boolean;
          show_rounds?: boolean;
          show_countdown?: boolean;
          status?: string;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          id?: number;
          event_id?: number | null;
          playlist_id?: number;
          session_code?: string;
          game_mode?: string;
          card_count?: number;
          card_layout?: string;
          card_label_mode?: string;
          round_count?: number;
          current_round?: number;
          songs_per_round?: number;
          clip_seconds?: number;
          prep_buffer_seconds?: number;
          auto_advance?: boolean;
          round_end_policy?: string;
          tie_break_policy?: string;
          pool_exhaustion_policy?: string;
          seconds_to_next_call?: number;
          countdown_started_at?: string | null;
          paused_remaining_seconds?: number | null;
          paused_at?: string | null;
          current_call_index?: number;
          recent_calls_limit?: number;
          show_title?: boolean;
          show_logo?: boolean;
          show_rounds?: boolean;
          show_countdown?: boolean;
          status?: string;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      bingo_session_calls: {
        Row: {
          id: number;
          session_id: number;
          playlist_track_key: string | null;
          call_index: number;
          column_letter: string;
          track_title: string;
          artist_name: string;
          album_name: string | null;
          side: string | null;
          position: string | null;
          status: string;
          prep_started_at: string | null;
          called_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          playlist_track_key?: string | null;
          call_index: number;
          column_letter: string;
          track_title: string;
          artist_name: string;
          album_name?: string | null;
          side?: string | null;
          position?: string | null;
          status?: string;
          prep_started_at?: string | null;
          called_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          playlist_track_key?: string | null;
          call_index?: number;
          column_letter?: string;
          track_title?: string;
          artist_name?: string;
          album_name?: string | null;
          side?: string | null;
          position?: string | null;
          status?: string;
          prep_started_at?: string | null;
          called_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bingo_cards: {
        Row: {
          id: number;
          session_id: number;
          card_number: number;
          has_free_space: boolean;
          grid: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          card_number: number;
          has_free_space?: boolean;
          grid: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: number;
          card_number?: number;
          has_free_space?: boolean;
          grid?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      bingo_session_events: {
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

export type BingoDbClient = SupabaseClient<BingoDatabase>;

export function getBingoDb(): BingoDbClient {
  return supabaseAdmin as unknown as BingoDbClient;
}

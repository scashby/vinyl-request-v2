// src/types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      album_context: {
        Row: {
          album: string;
          artist: string;
          created_at: string | null;
          id: number;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          album: string;
          artist: string;
          created_at?: string | null;
          id?: number;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          album?: string;
          artist?: string;
          created_at?: string | null;
          id?: number;
          title?: string;
          updated_at?: string | null;
        };
      };
      audio_recognition_logs: {
        Row: {
          album: string | null;
          artist: string | null;
          created_at: string | null;
          id: number;
          match_source: string | null;
          matched_id: number | null;
          now_playing: boolean | null;
          service: string | null;
          timestamp: string | null;
          title: string | null;
        };
        Insert: {
          album?: string | null;
          artist?: string | null;
          created_at?: string | null;
          id?: number;
          match_source?: string | null;
          matched_id?: number | null;
          now_playing?: boolean | null;
          service?: string | null;
          timestamp?: string | null;
          title?: string | null;
        };
        Update: {
          album?: string | null;
          artist?: string | null;
          created_at?: string | null;
          id?: number;
          match_source?: string | null;
          matched_id?: number | null;
          now_playing?: boolean | null;
          service?: string | null;
          timestamp?: string | null;
          title?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

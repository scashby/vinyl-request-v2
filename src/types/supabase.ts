// FILE: src/types/supabase.ts
// Updated with staff_picks table

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
          id: number;
          artist: string;
          title: string;
          album: string;
          year?: string | null;
          collection_id?: number | null;
          source?: string | null;
          created_at: string | null;
          updated_at?: string | null;
        };
        Insert: {
          id?: number;
          artist: string;
          title: string;
          album: string;
          year?: string | null;
          collection_id?: number | null;
          source?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          artist?: string;
          title?: string;
          album?: string;
          year?: string | null;
          collection_id?: number | null;
          source?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      audio_recognition_logs: {
        Row: {
          id: number;
          artist: string | null;
          title: string | null;
          album: string | null;
          source: string | null;
          service: string | null;
          confidence: number | null;
          confirmed: boolean | null;
          match_source: string | null;
          matched_id: number | null;
          now_playing: boolean | null;
          raw_response: Json | null;
          created_at: string | null;
          timestamp: string | null;
          updated_at?: string | null;
        };
        Insert: {
          id?: number;
          artist?: string | null;
          title?: string | null;
          album?: string | null;
          source?: string | null;
          service?: string | null;
          confidence?: number | null;
          confirmed?: boolean | null;
          match_source?: string | null;
          matched_id?: number | null;
          now_playing?: boolean | null;
          raw_response?: Json | null;
          created_at?: string | null;
          timestamp?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          artist?: string | null;
          title?: string | null;
          album?: string | null;
          source?: string | null;
          service?: string | null;
          confidence?: number | null;
          confirmed?: boolean | null;
          match_source?: string | null;
          matched_id?: number | null;
          now_playing?: boolean | null;
          raw_response?: Json | null;
          created_at?: string | null;
          timestamp?: string | null;
          updated_at?: string | null;
        };
      };
      now_playing: {
        Row: {
          id: number;
          artist: string | null;
          title: string | null;
          album_title: string | null;
          album_id: number | null;
          started_at: string | null;
          recognition_confidence: number | null;
          service_used: string | null;
          recognition_image_url: string | null;
          next_recognition_in: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          artist?: string | null;
          title?: string | null;
          album_title?: string | null;
          album_id?: number | null;
          started_at?: string | null;
          recognition_confidence?: number | null;
          service_used?: string | null;
          recognition_image_url?: string | null;
          next_recognition_in?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          artist?: string | null;
          title?: string | null;
          album_title?: string | null;
          album_id?: number | null;
          started_at?: string | null;
          recognition_confidence?: number | null;
          service_used?: string | null;
          recognition_image_url?: string | null;
          next_recognition_in?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      collection: {
        Row: {
          id: number;
          artist: string;
          title: string;
          year: string | null;
          format: string | null;
          folder: string | null;
          media_condition: string | null;
          image_url: string | null;
          notes: string | null;
          date_added: string | null;
          inner_circle_preferred: boolean | null;
          blocked: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          artist: string;
          title: string;
          year?: string | null;
          format?: string | null;
          folder?: string | null;
          media_condition?: string | null;
          image_url?: string | null;
          notes?: string | null;
          date_added?: string | null;
          inner_circle_preferred?: boolean | null;
          blocked?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          artist?: string;
          title?: string;
          year?: string | null;
          format?: string | null;
          folder?: string | null;
          media_condition?: string | null;
          image_url?: string | null;
          notes?: string | null;
          date_added?: string | null;
          inner_circle_preferred?: boolean | null;
          blocked?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      staff_picks: {
        Row: {
          id: number;
          staff_name: string;
          staff_title: string | null;
          staff_photo_url: string | null;
          staff_bio: string | null;
          collection_id: number;
          pick_order: number;
          reason: string;
          favorite_track: string | null;
          listening_context: string | null;
          is_active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          staff_name: string;
          staff_title?: string | null;
          staff_photo_url?: string | null;
          staff_bio?: string | null;
          collection_id: number;
          pick_order: number;
          reason: string;
          favorite_track?: string | null;
          listening_context?: string | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          staff_name?: string;
          staff_title?: string | null;
          staff_photo_url?: string | null;
          staff_bio?: string | null;
          collection_id?: number;
          pick_order?: number;
          reason?: string;
          favorite_track?: string | null;
          listening_context?: string | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      inner_circle_votes: {
        Row: {
          id: number;
          voter_name: string;
          voter_email: string;
          collection_id: number;
          session_id: string | null;
          voter_ip: string | null;
          voted_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          voter_name: string;
          voter_email: string;
          collection_id: number;
          session_id?: string | null;
          voter_ip?: string | null;
          voted_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          voter_name?: string;
          voter_email?: string;
          collection_id?: number;
          session_id?: string | null;
          voter_ip?: string | null;
          voted_at?: string | null;
          created_at?: string | null;
        };
      };
      album_suggestions: {
        Row: {
          id: number;
          artist: string;
          title: string;
          year: string | null;
          format: string | null;
          requester_name: string | null;
          requester_email: string | null;
          reason: string | null;
          context: string | null;
          status: string;
          admin_notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          artist: string;
          title: string;
          year?: string | null;
          format?: string | null;
          requester_name?: string | null;
          requester_email?: string | null;
          reason?: string | null;
          context?: string | null;
          status?: string;
          admin_notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          artist?: string;
          title?: string;
          year?: string | null;
          format?: string | null;
          requester_name?: string | null;
          requester_email?: string | null;
          reason?: string | null;
          context?: string | null;
          status?: string;
          admin_notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Helper types for common operations
export type RecognitionLog = Database['public']['Tables']['audio_recognition_logs']['Row'];
export type NewRecognitionLog = Database['public']['Tables']['audio_recognition_logs']['Insert'];
export type UpdateRecognitionLog = Database['public']['Tables']['audio_recognition_logs']['Update'];

export type NowPlaying = Database['public']['Tables']['now_playing']['Row'];
export type NewNowPlaying = Database['public']['Tables']['now_playing']['Insert'];
export type UpdateNowPlaying = Database['public']['Tables']['now_playing']['Update'];

export type AlbumContext = Database['public']['Tables']['album_context']['Row'];
export type NewAlbumContext = Database['public']['Tables']['album_context']['Insert'];
export type UpdateAlbumContext = Database['public']['Tables']['album_context']['Update'];

export type Collection = Database['public']['Tables']['collection']['Row'];
export type NewCollection = Database['public']['Tables']['collection']['Insert'];
export type UpdateCollection = Database['public']['Tables']['collection']['Update'];

export type StaffPick = Database['public']['Tables']['staff_picks']['Row'];
export type NewStaffPick = Database['public']['Tables']['staff_picks']['Insert'];
export type UpdateStaffPick = Database['public']['Tables']['staff_picks']['Update'];

export type InnerCircleVote = Database['public']['Tables']['inner_circle_votes']['Row'];
export type NewInnerCircleVote = Database['public']['Tables']['inner_circle_votes']['Insert'];
export type UpdateInnerCircleVote = Database['public']['Tables']['inner_circle_votes']['Update'];

export type AlbumSuggestion = Database['public']['Tables']['album_suggestions']['Row'];
export type NewAlbumSuggestion = Database['public']['Tables']['album_suggestions']['Insert'];
export type UpdateAlbumSuggestion = Database['public']['Tables']['album_suggestions']['Update'];
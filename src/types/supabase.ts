// FILE: src/types/supabase.ts
// Complete database types with all tables

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
      events: {
        Row: {
          id: number;
          title: string;
          date: string;
          time: string;
          location: string;
          image_url: string;
          info: string;
          info_url: string;
          has_queue: boolean;
          queue_type?: string | null;
          queue_types?: string | null;
          allowed_formats: string | null;
          allowed_tags?: string | null;
          is_recurring: boolean;
          recurrence_pattern?: string | null;
          recurrence_interval?: number | null;
          recurrence_end_date?: string | null;
          parent_event_id?: number | null;
          is_featured_grid?: boolean | null;
          is_featured_upnext?: boolean | null;
          featured_priority?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Insert: {
          id?: number;
          title: string;
          date: string;
          time: string;
          location: string;
          image_url: string;
          info: string;
          info_url: string;
          has_queue?: boolean;
          queue_type?: string | null;
          queue_types?: string | null;
          allowed_formats?: string | null;
          allowed_tags?: string | null;
          is_recurring?: boolean;
          recurrence_pattern?: string | null;
          recurrence_interval?: number | null;
          recurrence_end_date?: string | null;
          parent_event_id?: number | null;
          is_featured_grid?: boolean | null;
          is_featured_upnext?: boolean | null;
          featured_priority?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          title?: string;
          date?: string;
          time?: string;
          location?: string;
          image_url?: string;
          info?: string;
          info_url?: string;
          has_queue?: boolean;
          queue_type?: string | null;
          queue_types?: string | null;
          allowed_formats?: string | null;
          allowed_tags?: string | null;
          is_recurring?: boolean;
          recurrence_pattern?: string | null;
          recurrence_interval?: number | null;
          recurrence_end_date?: string | null;
          parent_event_id?: number | null;
          is_featured_grid?: boolean | null;
          is_featured_upnext?: boolean | null;
          featured_priority?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      requests: {
        Row: {
          id: number;
          artist: string;
          title: string;
          side?: string | null;
          track_number?: string | null;
          track_name?: string | null;
          track_duration?: string | null;
          votes: number;
          event_id: number;
          created_at: string;
          album_id?: number | null;
        };
        Insert: {
          id?: number;
          artist: string;
          title: string;
          side?: string | null;
          track_number?: string | null;
          track_name?: string | null;
          track_duration?: string | null;
          votes?: number;
          event_id: number;
          created_at?: string;
          album_id?: number | null;
        };
        Update: {
          id?: number;
          artist?: string;
          title?: string;
          side?: string | null;
          track_number?: string | null;
          track_name?: string | null;
          track_duration?: string | null;
          votes?: number;
          event_id?: number;
          created_at?: string;
          album_id?: number | null;
        };
      };
      tag_definitions: {
        Row: {
          id: number;
          tag_name: string;
          category: string;
          color: string;
          description: string;
        };
        Insert: {
          id?: number;
          tag_name: string;
          category: string;
          color: string;
          description: string;
        };
        Update: {
          id?: number;
          tag_name?: string;
          category?: string;
          color?: string;
          description?: string;
        };
      };
      collection_1001_matches: {
        Row: {
          album_1001_id: number;
          collection_id: number;
          confidence: number;
          review_status: string;
          matched_at?: string | null;
          reviewed_at?: string | null;
        };
        Insert: {
          album_1001_id: number;
          collection_id: number;
          confidence: number;
          review_status?: string;
          matched_at?: string | null;
          reviewed_at?: string | null;
        };
        Update: {
          album_1001_id?: number;
          collection_id?: number;
          confidence?: number;
          review_status?: string;
          matched_at?: string | null;
          reviewed_at?: string | null;
        };
      };
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
          personal_notes: string | null;
          release_notes: string | null;
          date_added: string | null;
          inner_circle_preferred: boolean | null;
          blocked: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          master_release_id: string | null;
          master_release_date: string | null;
          custom_tags?: string | null;
          collection_id?: number | null;
          folder_id?: number | null;
          label?: string | null;
          catalog_no?: string | null;
          basic_information?: Json | null;
          discogs_genres?: string | null;
          discogs_styles?: string | null;
          decade?: number | null;
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
          personal_notes?: string | null;
          release_notes?: string | null;
          date_added?: string | null;
          inner_circle_preferred?: boolean | null;
          blocked?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          master_release_id?: string | null;
          master_release_date?: string | null;
          custom_tags?: string | null;
          collection_id?: number | null;
          folder_id?: number | null;
          label?: string | null;
          catalog_no?: string | null;
          basic_information?: Json | null;
          discogs_genres?: string | null;
          discogs_styles?: string | null;
          decade?: number | null;
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
          personal_notes?: string | null;
          release_notes?: string | null;
          date_added?: string | null;
          inner_circle_preferred?: boolean | null;
          blocked?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          master_release_id?: string | null;
          master_release_date?: string | null;
          custom_tags?: string | null;
          collection_id?: number | null;
          folder_id?: number | null;
          label?: string | null;
          catalog_no?: string | null;
          basic_information?: Json | null;
          discogs_genres?: string | null;
          discogs_styles?: string | null;
          decade?: number | null;
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
      one_thousand_one_albums: {
        Row: {
          id: number;
          artist: string;
          album: string;
          year: number | null;
          artist_norm: string | null;
          album_norm: string | null;
        };
        Insert: {
          id?: number;
          artist: string;
          album: string;
          year?: number | null;
          artist_norm?: string | null;
          album_norm?: string | null;
        };
        Update: {
          id?: number;
          artist?: string;
          album?: string;
          year?: number | null;
          artist_norm?: string | null;
          album_norm?: string | null;
        };
      };
      collection_1001_review: {
        Row: {
          id: number;
          album_1001_id: number;
          collection_id: number;
          review_status: string;
          confidence: number | null;
          notes: string | null;
          matched_at?: string | null;
          reviewed_at?: string | null;
        };
        Insert: {
          id?: number;
          album_1001_id: number;
          collection_id: number;
          review_status?: string;
          confidence?: number | null;
          notes?: string | null;
          matched_at?: string | null;
          reviewed_at?: string | null;
        };
        Update: {
          id?: number;
          album_1001_id?: number;
          collection_id?: number;
          review_status?: string;
          confidence?: number | null;
          notes?: string | null;
          matched_at?: string | null;
          reviewed_at?: string | null;
        };
      };
      admin_settings: {
        Row: {
          key: string;
          value: string;
          updated_at: string | null;
        };
        Insert: {
          key: string;
          value: string;
          updated_at?: string | null;
        };
        Update: {
          key?: string;
          value?: string;
          updated_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_1001_exact: {
        Args: Record<string, never>;
        Returns: number;
      };
      match_1001_fuzzy: {
        Args: {
          threshold: number;
          year_slop: number;
        };
        Returns: number;
      };
      match_1001_same_artist: {
        Args: {
          threshold: number;
          year_slop: number;
        };
        Returns: number;
      };
      match_1001_fuzzy_artist: {
        Args: {
          threshold: number;
        };
        Returns: number;
      };
      manual_link_1001: {
        Args: {
          p_album_1001_id: number;
          p_collection_id: number;
        };
        Returns: void;
      };
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
export type DbEvent = Database['public']['Tables']['events']['Row'];
export type NewEvent = Database['public']['Tables']['events']['Insert'];
export type UpdateEvent = Database['public']['Tables']['events']['Update'];

export type DbRequest = Database['public']['Tables']['requests']['Row'];
export type NewRequest = Database['public']['Tables']['requests']['Insert'];
export type UpdateRequest = Database['public']['Tables']['requests']['Update'];

export type DbTagDefinition = Database['public']['Tables']['tag_definitions']['Row'];
export type NewTagDefinition = Database['public']['Tables']['tag_definitions']['Insert'];
export type UpdateTagDefinition = Database['public']['Tables']['tag_definitions']['Update'];

export type DbCollection1001Match = Database['public']['Tables']['collection_1001_matches']['Row'];
export type NewCollection1001Match = Database['public']['Tables']['collection_1001_matches']['Insert'];
export type UpdateCollection1001Match = Database['public']['Tables']['collection_1001_matches']['Update'];

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

export type Album1001 = Database['public']['Tables']['one_thousand_one_albums']['Row'];
export type NewAlbum1001 = Database['public']['Tables']['one_thousand_one_albums']['Insert'];
export type UpdateAlbum1001 = Database['public']['Tables']['one_thousand_one_albums']['Update'];

export type Collection1001Review = Database['public']['Tables']['collection_1001_review']['Row'];
export type NewCollection1001Review = Database['public']['Tables']['collection_1001_review']['Insert'];
export type UpdateCollection1001Review = Database['public']['Tables']['collection_1001_review']['Update'];

export type AdminSettings = Database['public']['Tables']['admin_settings']['Row'];
export type NewAdminSettings = Database['public']['Tables']['admin_settings']['Insert'];
export type UpdateAdminSettings = Database['public']['Tables']['admin_settings']['Update'];

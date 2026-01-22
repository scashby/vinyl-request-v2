export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      collection: {
        Row: {
          id: number
          // Identification
          artist: string
          sort_artist: string | null
          secondary_artists: string[] | null
          title: string
          year: string | null
          year_int: number | null
          format: string
          image_url: string | null
          
          // Status & Location
          collection_status: string | null
          for_sale: boolean
          location: string | null
          date_added: string | null
          modified_date: string | null
          
          // Notes
          personal_notes: string | null
          release_notes: string | null
          extra: string | null
          
          // Physical
          media_condition: string
          package_sleeve_condition: string | null
          rpm: string | null
          vinyl_weight: string | null
          vinyl_color: string | null
          discs: number | null
          sides: number | null
          
          // Identifiers
          discogs_release_id: string | null
          discogs_master_id: string | null
          spotify_id: string | null
          apple_music_id: string | null
          musicbrainz_id: string | null
          barcode: string | null
          cat_no: string | null
          
          // Data
          tracks: Json | null
          
          // Legacy/Optional (Kept if not dropped by SQL)
          owner: string | null
          purchase_price: number | null
          current_value: number | null
        }
        Insert: {
          id?: number
          artist: string
          title: string
          format: string
          // Allow optional for almost everything else
          sort_artist?: string | null
          secondary_artists?: string[] | null
          personal_notes?: string | null
          release_notes?: string | null
          location?: string | null
          for_sale?: boolean
          tracks?: Json | null
          [key: string]: unknown
        }
        Update: {
          id?: number
          artist?: string
          title?: string
          personal_notes?: string | null
          location?: string | null
          for_sale?: boolean
          [key: string]: unknown
        }
      }
      
      // NEW: Normalization Rules
      artist_rules: {
        Row: {
          id: number
          search_pattern: string
          replacement: string | null
          rule_type: 'alias' | 'sort_exception' | 'ignore'
          created_at: string
        }
        Insert: {
          search_pattern: string
          replacement?: string | null
          rule_type: 'alias' | 'sort_exception' | 'ignore'
        }
        Update: {
          search_pattern?: string
          replacement?: string | null
          rule_type?: 'alias' | 'sort_exception' | 'ignore'
        }
      }

      // NEW: DJ Data Sidecar
      collection_dj_data: {
        Row: {
          collection_id: number
          bpm: number | null
          musical_key: string | null
          energy: number | null
          danceability: number | null
          valence: number | null
          created_at: string
        }
        Insert: {
          collection_id: number
          bpm?: number | null
          musical_key?: string | null
          // ...
        }
        Update: {
          bpm?: number | null
          musical_key?: string | null
          // ...
        }
      }

      // NEW: Unified Tagging
      master_tags: {
        Row: {
          id: number
          name: string
          category: 'genre' | 'style' | 'mood' | 'context' | 'custom'
          created_at: string
        }
        Insert: {
          name: string
          category?: 'genre' | 'style' | 'mood' | 'context' | 'custom'
        }
        Update: {
          name?: string
          category?: 'genre' | 'style' | 'mood' | 'context' | 'custom'
        }
      }

      collection_tags: {
        Row: {
          collection_id: number
          tag_id: number
        }
        Insert: {
          collection_id: number
          tag_id: number
        }
        Update: {
          collection_id?: number
          tag_id?: number
        }
      }

      // EXISTING: Crates (Merged Target)
      crates: {
        Row: {
          id: number
          name: string
          icon: string | null
          color: string | null
          is_smart: boolean
          smart_rules: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          // ...
        }
        Update: {
          name?: string
          // ...
        }
      }
      
      crate_albums: {
        Row: {
          id: number
          crate_id: number
          album_id: number
          position: number
          added_at: string
        }
        Insert: {
          crate_id: number
          album_id: number
          // ...
        }
        Update: {
          position?: number
          // ...
        }
      }

      // EXISTING: Support Tables
      events: { Row: { id: number; [key: string]: unknown }; Insert: { [key: string]: unknown }; Update: { [key: string]: unknown } }
      requests: { Row: { id: number; [key: string]: unknown }; Insert: { [key: string]: unknown }; Update: { [key: string]: unknown } }
      dj_sets: { Row: { id: number; [key: string]: unknown }; Insert: { [key: string]: unknown }; Update: { [key: string]: unknown } }
      format_abbreviations: { Row: { id: number; [key: string]: unknown }; Insert: { [key: string]: unknown }; Update: { [key: string]: unknown } }
      staff_picks: { Row: { id: number; [key: string]: unknown }; Insert: { [key: string]: unknown }; Update: { [key: string]: unknown } }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
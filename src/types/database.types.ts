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
          // Core Identification
          artist: string
          title: string
          year: string | null
          year_int: number | null
          format: string
          image_url: string | null
          back_image_url: string | null
          index_number: number | null
          
          // Normalized/Generated
          album_norm: string | null
          artist_norm: string | null
          title_norm: string | null
          artist_album_norm: string | null
          
          // Status & Location
          collection_status: string | null
          for_sale: boolean
          location: string | null
          storage_device: string | null
          storage_device_slot: string | null
          slot: string | null
          date_added: string | null
          modified_date: string | null
          last_reviewed_at: string | null
          
          // Notes
          personal_notes: string | null
          release_notes: string | null
          extra: string | null
          
          // Physical
          media_condition: string
          package_sleeve_condition: string | null
          packaging: string | null
          rpm: string | null
          vinyl_weight: string | null
          vinyl_color: string[] | null // Fixed: SQL is ARRAY
          discs: number | null
          sides: Json | null
          is_box_set: boolean | null
          box_set: string | null
          
          // Identifiers
          barcode: string | null
          cat_no: string | null
          discogs_master_id: string | null
          discogs_release_id: string | null
          discogs_id: string | null
          spotify_id: string | null
          spotify_url: string | null
          spotify_album_id: string | null
          apple_music_id: string | null
          apple_music_url: string | null
          musicbrainz_id: string | null
          musicbrainz_url: string | null
          lastfm_id: string | null
          lastfm_url: string | null
          allmusic_id: string | null
          allmusic_url: string | null
          wikipedia_url: string | null
          dbpedia_uri: string | null

          // Audio & Metadata
          tracks: Json | null
          length_seconds: number | null
          sound: string | null
          spars_code: string | null
          is_live: boolean | null
          time_signature: string | null
          tempo_bpm: number | null // Note: Derived or mapped
          
          // Arrays & Tags (SQL Arrays)
          genres: string[] | null
          styles: string[] | null
          labels: string[] | null
          custom_tags: string[] | null
          secondary_artists: string[] | null
          signed_by: string[] | null
          finalized_fields: string[] | null
          enrichment_sources: string[] | null
          
          // People (JSONB in SQL)
          musicians: Json | null
          songwriters: Json | null
          producers: Json | null
          engineers: Json | null
          writers: Json | null
          
          // Classical / People Texts
          chorus: string | null
          composer: string | null
          composition: string | null
          conductor: string | null
          orchestra: string | null
          sort_artist: string | null
          sort_title: string | null
          sort_chorus: string | null
          sort_composition: string | null
          
          // Values & Sales
          owner: string | null
          purchase_price: number | null
          current_value: number | null
          purchase_date: string | null
          purchase_store: string | null
          sale_price: number | null
          sale_platform: string | null
          sale_quantity: number | null
          sale_notes: string | null
          wholesale_cost: number | null
          pricing_notes: string | null
          
          // Usage
          play_count: number | null
          last_played_date: string | null
          last_cleaned_date: string | null
          my_rating: number | null
          
          // Loans
          due_date: string | null
          loan_date: string | null
          loaned_to: string | null
          
          // Tech / JSONB Blobs
          disc_metadata: Json | null
          matrix_numbers: Json | null
          inner_sleeve_images: Json | null
          enriched_metadata: Json | null
          blocked_tracks: Json | null
          
          // Legacy/Other
          sell_price: string | null // Text field in SQL
          decade: number | null
          master_release_id: string | null
          master_release_date: string | null
          country: string | null
          studio: string | null
          recording_location: string | null
          cultural_significance: string | null
          original_release_date: string | null
          original_release_year: number | null
          recording_date: string | null
          recording_year: number | null
          parent_id: string | null // UUID
          child_album_ids: string[] | null
          blocked: boolean | null
          blocked_sides: string[] | null
        }
        Insert: {
          artist: string
          title: string
          format: string
          media_condition: string
          // Allow all optional fields
          [key: string]: unknown
        }
        Update: {
          id?: number
          // Allow updating any field
          [key: string]: unknown
        }
      }

      wantlist: {
        Row: {
          id: number
          artist: string
          title: string
          year: string | null
          format: string | null
          cover_image: string | null
          notes: string | null
          
          // IDs
          discogs_release_id: string | null
          discogs_master_id: string | null
          
          // Normalized
          artist_norm: string | null
          title_norm: string | null
          artist_album_norm: string | null
          
          date_added_to_wantlist: string
        }
        Insert: {
          artist: string
          title: string
          // allow other optional fields
          [key: string]: unknown
        }
        Update: {
          [key: string]: unknown
        }
      }
      
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
          energy?: number | null
          danceability?: number | null
          valence?: number | null
        }
        Update: {
          bpm?: number | null
          musical_key?: string | null
          energy?: number | null
          danceability?: number | null
          valence?: number | null
        }
      }

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

      crates: {
        Row: {
          id: number
          name: string
          icon: string | null
          color: string | null
          is_smart: boolean
          smart_rules: Json | null
          match_rules: string | null
          live_update: boolean | null
          sort_order: number | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          name: string
          icon?: string | null
          color?: string | null
          is_smart?: boolean
          smart_rules?: Json | null
          match_rules?: string | null
          live_update?: boolean | null
          sort_order?: number | null
        }
        Update: {
          name?: string
          icon?: string | null
          color?: string | null
          is_smart?: boolean
          smart_rules?: Json | null
          match_rules?: string | null
          live_update?: boolean | null
          sort_order?: number | null
        }
      }
      
      crate_albums: {
        Row: {
          id: number
          crate_id: number
          album_id: number
          position: number | null
          added_at: string
        }
        Insert: {
          crate_id: number
          album_id: number
          position?: number | null
          added_at?: string
        }
        Update: {
          position?: number | null
        }
      }

      events: {
        Row: {
          id: number
          date: string
          title: string
          time: string
          info: string | null
          location: string | null
          image_url: string | null
          has_queue: boolean | null
          allowed_formats: string[] | null
          info_url: string | null
          is_recurring: boolean | null
          recurrence_pattern: string | null
          recurrence_interval: number | null
          recurrence_days: string | null
          recurrence_end_date: string | null
          parent_event_id: number | null
          queue_type: string | null
          allowed_tags: string[] | null
          queue_types: string[] | null
          is_featured_grid: boolean
          is_featured_upnext: boolean
          featured_priority: number | null
        }
        Insert: {
          date: string
          title: string
          time: string
          [key: string]: unknown
        }
        Update: {
          [key: string]: unknown
        }
      }

      requests: {
        Row: {
          id: string // UUID
          artist: string
          title: string
          side: string | null
          name: string | null
          status: string
          votes: number
          timestamp: string
          folder: string
          year: string | null
          format: string | null
          album_id: number | null
          event_id: number | null
          track_number: string | null
          track_name: string | null
          track_duration: string | null
        }
        Insert: {
          id?: string
          artist: string
          title: string
          status: string
          [key: string]: unknown
        }
        Update: {
          status?: string
          votes?: number
          [key: string]: unknown
        }
      }

      // Other tables defined as unknown to prevent errors but should be fleshed out if used
      dj_sets: { Row: { id: number; [key: string]: unknown }; Insert: { [key: string]: unknown }; Update: { [key: string]: unknown } }
      format_abbreviations: { Row: { id: number; [key: string]: unknown }; Insert: { [key: string]: unknown }; Update: { [key: string]: unknown } }
      staff_picks: { Row: { id: number; [key: string]: unknown }; Insert: { [key: string]: unknown }; Update: { [key: string]: unknown } }
      tracks: { Row: { id: number; [key: string]: unknown }; Insert: { [key: string]: unknown }; Update: { [key: string]: unknown } }
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

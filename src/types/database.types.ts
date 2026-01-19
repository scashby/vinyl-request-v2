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
      events: {
        Row: {
          id: number
          title: string
          date: string
          time: string
          location: string
          image_url: string
          info: string
          info_url: string | null
          has_queue: boolean
          queue_type: string | null
          queue_types: string[] | null
          allowed_formats: string[] | null
          allowed_tags: string[] | null
          is_recurring: boolean
          recurrence_pattern: string | null
          recurrence_interval: number | null
          recurrence_end_date: string | null
          parent_event_id: number | null
          is_featured_grid: boolean
          is_featured_upnext: boolean
          featured_priority: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          title: string
          date: string
          time: string
          location: string
          image_url: string
          info: string
          info_url?: string | null
          has_queue?: boolean
          queue_type?: string | null
          queue_types?: string[] | null
          allowed_formats?: string[] | null
          allowed_tags?: string[] | null
          is_recurring?: boolean
          recurrence_pattern?: string | null
          recurrence_interval?: number | null
          recurrence_end_date?: string | null
          parent_event_id?: number | null
          is_featured_grid?: boolean
          is_featured_upnext?: boolean
          featured_priority?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          title?: string
          date?: string
          time?: string
          location?: string
          image_url?: string
          info?: string
          info_url?: string | null
          has_queue?: boolean
          queue_type?: string | null
          queue_types?: string[] | null
          allowed_formats?: string[] | null
          allowed_tags?: string[] | null
          is_recurring?: boolean
          recurrence_pattern?: string | null
          recurrence_interval?: number | null
          recurrence_end_date?: string | null
          parent_event_id?: number | null
          is_featured_grid?: boolean
          is_featured_upnext?: boolean
          featured_priority?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      requests: {
        Row: {
          id: number
          event_id: number
          album_title: string
          artist: string
          user_name: string | null
          user_email: string | null
          votes: number
          status: string
          queue_type: string
          side: string | null
          track_number: number | null
          created_at: string
          updated_at: string
          played_at: string | null
          notes: string | null
        }
        Insert: {
          id?: number
          event_id: number
          album_title: string
          artist: string
          user_name?: string | null
          user_email?: string | null
          votes?: number
          status?: string
          queue_type: string
          side?: string | null
          track_number?: number | null
          created_at?: string
          updated_at?: string
          played_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: number
          event_id?: number
          album_title?: string
          artist?: string
          user_name?: string | null
          user_email?: string | null
          votes?: number
          status?: string
          queue_type?: string
          side?: string | null
          track_number?: number | null
          created_at?: string
          updated_at?: string
          played_at?: string | null
          notes?: string | null
        }
      }
      tag_definitions: {
        Row: {
          id: number
          tag_name: string
          category: string
          color: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: number
          tag_name: string
          category: string
          color: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          tag_name?: string
          category?: string
          color?: string
          description?: string | null
          created_at?: string
        }
      }
      collection_1001_matches: {
        Row: {
          id: number
          collection_id: number
          album_id: number
          match_type: string
          confidence: number
          created_at: string
        }
        Insert: {
          id?: number
          collection_id: number
          album_id: number
          match_type: string
          confidence?: number
          created_at?: string
        }
        Update: {
          id?: number
          collection_id?: number
          album_id?: number
          match_type?: string
          confidence?: number
          created_at?: string
        }
      }
      one_thousand_one_albums: {
        Row: {
          id: number
          position: number
          artist: string
          album: string
          year: number | null
          genre: string | null
          subgenre: string | null
          created_at: string
        }
        Insert: {
          id?: number
          position: number
          artist: string
          album: string
          year?: number | null
          genre?: string | null
          subgenre?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          position?: number
          artist?: string
          album?: string
          year?: number | null
          genre?: string | null
          subgenre?: string | null
          created_at?: string
        }
      }
      collection_1001_review: {
        Row: {
          id: number
          collection_id: number
          album_id: number
          review_status: string
          reviewed_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: number
          collection_id: number
          album_id: number
          review_status?: string
          reviewed_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          collection_id?: number
          album_id?: number
          review_status?: string
          reviewed_at?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      admin_settings: {
        Row: {
          id: number
          key: string
          value: Json
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          key: string
          value: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          key?: string
          value?: Json
          description?: string | null
          created?: string
          updated_at?: string
        }
      }
      vinyl_collection: {
        Row: {
          id: number
          discogs_id: number
          artist: string
          title: string
          year: number | null
          format: string | null
          label: string | null
          catalog_number: string | null
          genres: string[] | null
          styles: string[] | null
          country: string | null
          notes: string | null
          date_added: string
          last_updated: string | null
          cover_image: string | null
          custom_tags: string[] | null
          spotify_album_id: string | null
          spotify_artist_id: string | null
          apple_music_id: string | null
          lastfm_album_id: string | null
          spotify_popularity: number | null
          apple_music_url: string | null
          genius_song_id: number | null
          lyrics_cached_at: string | null
          // NEW FIELDS START
          energy: number | null
          enrichment_sources: string[] | null
          finalized_fields: string[] | null
          enrichment_summary: Json | null
          musicians: string[] | null
          producers: string[] | null
          credits: Json | null
          composer: string | null
          conductor: string | null
          orchestra: string | null
          // NEW FIELDS END
        }
        Insert: {
          id?: number
          discogs_id: number
          artist: string
          title: string
          year?: number | null
          format?: string | null
          label?: string | null
          catalog_number?: string | null
          genres?: string[] | null
          styles?: string[] | null
          country?: string | null
          notes?: string | null
          date_added?: string
          last_updated?: string | null
          cover_image?: string | null
          custom_tags?: string[] | null
          spotify_album_id?: string | null
          spotify_artist_id?: string | null
          apple_music_id?: string | null
          lastfm_album_id?: string | null
          spotify_popularity?: number | null
          apple_music_url?: string | null
          genius_song_id?: number | null
          lyrics_cached_at?: string | null
          // NEW FIELDS START
          energy?: number | null
          enrichment_sources?: string[] | null
          finalized_fields?: string[] | null
          enrichment_summary?: Json | null
          musicians?: string[] | null
          producers?: string[] | null
          credits?: Json | null
          composer?: string | null
          conductor?: string | null
          orchestra?: string | null
          // NEW FIELDS END
        }
        Update: {
          id?: number
          discogs_id?: number
          artist?: string
          title?: string
          year?: number | null
          format?: string | null
          label?: string | null
          catalog_number?: string | null
          genres?: string[] | null
          styles?: string[] | null
          country?: string | null
          notes?: string | null
          date_added?: string
          last_updated?: string | null
          cover_image?: string | null
          custom_tags?: string[] | null
          spotify_album_id?: string | null
          spotify_artist_id?: string | null
          apple_music_id?: string | null
          lastfm_album_id?: string | null
          spotify_popularity?: number | null
          apple_music_url?: string | null
          genius_song_id?: number | null
          lyrics_cached_at?: string | null
          // NEW FIELDS START
          energy?: number | null
          enrichment_sources?: string[] | null
          finalized_fields?: string[] | null
          enrichment_summary?: Json | null
          musicians?: string[] | null
          producers?: string[] | null
          credits?: Json | null
          composer?: string | null
          conductor?: string | null
          orchestra?: string | null
          // NEW FIELDS END
        }
      }
      dj_tracks: {
        Row: {
          id: number
          collection_id: number
          track_name: string
          track_number: number
          side: string | null
          duration_ms: number | null
          spotify_track_id: string | null
          apple_music_track_id: string | null
          isrc: string | null
          created_at: string
          updated_at: string | null
          // NEW FIELDS START
          lyrics: string | null
          bpm: number | null
          musical_key: string | null
          // NEW FIELDS END
        }
        Insert: {
          id?: number
          collection_id: number
          track_name: string
          track_number: number
          side?: string | null
          duration_ms?: number | null
          spotify_track_id?: string | null
          apple_music_track_id?: string | null
          isrc?: string | null
          created_at?: string
          updated_at?: string | null
          // NEW FIELDS START
          lyrics?: string | null
          bpm?: number | null
          musical_key?: string | null
          // NEW FIELDS END
        }
        Update: {
          id?: number
          collection_id?: number
          track_name?: string
          track_number?: number
          side?: string | null
          duration_ms?: number | null
          spotify_track_id?: string | null
          apple_music_track_id?: string | null
          isrc?: string | null
          created_at?: string
          updated_at?: string | null
          // NEW FIELDS START
          lyrics?: string | null
          bpm?: number | null
          musical_key?: string | null
          // NEW FIELDS END
        }
      }
      dj_crates: {
        Row: {
          id: number
          name: string
          description: string | null
          color: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          name: string
          description?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          description?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      dj_crate_items: {
        Row: {
          id: number
          crate_id: number
          collection_id: number | null
          track_id: number | null
          position: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: number
          crate_id: number
          collection_id?: number | null
          track_id?: number | null
          position?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          crate_id?: number
          collection_id?: number | null
          track_id?: number | null
          position?: number
          notes?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_1001_exact: {
        Args: {
          target_artist: string
          target_album: string
        }
        Returns: {
          collection_id: number
          artist: string
          title: string
          match_score: number
        }[]
      }
      match_1001_fuzzy: {
        Args: {
          target_artist: string
          target_album: string
          threshold?: number
          year_slop?: number
        }
        Returns: {
          collection_id: number
          artist: string
          title: string
          match_score: number
        }[]
      }
      match_1001_same_artist: {
        Args: {
          list_artist: string
        }
        Returns: {
          collection_id: number
          artist: string
          title: string
        }[]
      }
      match_1001_fuzzy_artist: {
        Args: {
          target_artist: string
          target_album: string
          threshold?: number
        }
        Returns: {
          collection_id: number
          artist: string
          title: string
          artist_distance: number
          album_distance: number
        }[]
      }
      manual_link_1001: {
        Args: {
          p_collection_id: number
          p_album_id: number
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
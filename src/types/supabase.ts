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
          queue_types?: string[] | null;
          allowed_formats: string[] | null;
          allowed_tags?: string[] | null;
          crate_id?: number | null;
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
          queue_types?: string[] | null;
          allowed_formats?: string[] | null;
          allowed_tags?: string[] | null;
          crate_id?: number | null;
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
          queue_types?: string[] | null;
          allowed_formats?: string[] | null;
          allowed_tags?: string[] | null;
          crate_id?: number | null;
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
      about_content: {
        Row: {
          id: number;
          main_description: string | null;
          booking_description: string | null;
          contact_name: string | null;
          contact_company: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          calendly_url: string | null;
          services: Json | null;
          testimonials: Json | null;
          booking_notes: string | null;
          amazon_wishlist_url: string | null;
          discogs_wantlist_url: string | null;
          linktree_url: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Insert: {
          id?: number;
          main_description?: string | null;
          booking_description?: string | null;
          contact_name?: string | null;
          contact_company?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          calendly_url?: string | null;
          services?: Json | null;
          testimonials?: Json | null;
          booking_notes?: string | null;
          amazon_wishlist_url?: string | null;
          discogs_wantlist_url?: string | null;
          linktree_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          main_description?: string | null;
          booking_description?: string | null;
          contact_name?: string | null;
          contact_company?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          calendly_url?: string | null;
          services?: Json | null;
          testimonials?: Json | null;
          booking_notes?: string | null;
          amazon_wishlist_url?: string | null;
          discogs_wantlist_url?: string | null;
          linktree_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      artist_rules: {
        Row: {
          id: number;
          search_pattern: string;
          replacement: string | null;
          rule_type: string;
          created_at?: string | null;
        };
        Insert: {
          id?: number;
          search_pattern: string;
          replacement?: string | null;
          rule_type: string;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          search_pattern?: string;
          replacement?: string | null;
          rule_type?: string;
          created_at?: string | null;
        };
      };
      artists: {
        Row: {
          id: number;
          name: string;
          slug: string | null;
          profile_image_url: string | null;
          discogs_id: string | null;
          musicbrainz_id: string | null;
          spotify_id: string | null;
          created_at?: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          slug?: string | null;
          profile_image_url?: string | null;
          discogs_id?: string | null;
          musicbrainz_id?: string | null;
          spotify_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string | null;
          profile_image_url?: string | null;
          discogs_id?: string | null;
          musicbrainz_id?: string | null;
          spotify_id?: string | null;
          created_at?: string | null;
        };
      };
      crate_items: {
        Row: {
          id: number;
          crate_id: number | null;
          inventory_id: number | null;
          position: number | null;
          notes: string | null;
          added_at?: string | null;
        };
        Insert: {
          id?: number;
          crate_id?: number | null;
          inventory_id?: number | null;
          position?: number | null;
          notes?: string | null;
          added_at?: string | null;
        };
        Update: {
          id?: number;
          crate_id?: number | null;
          inventory_id?: number | null;
          position?: number | null;
          notes?: string | null;
          added_at?: string | null;
        };
      };
      crates: {
        Row: {
          id: number;
          name: string;
          icon: string | null;
          color: string | null;
          is_smart: boolean | null;
          smart_rules: Json | null;
          match_rules: string | null;
          live_update: boolean | null;
          sort_order: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          icon?: string | null;
          color?: string | null;
          is_smart?: boolean | null;
          smart_rules?: Json | null;
          match_rules?: string | null;
          live_update?: boolean | null;
          sort_order?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          icon?: string | null;
          color?: string | null;
          is_smart?: boolean | null;
          smart_rules?: Json | null;
          match_rules?: string | null;
          live_update?: boolean | null;
          sort_order?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      dj_sets: {
        Row: {
          id: number;
          event_id: number | null;
          inventory_id: number | null;
          title: string;
          description: string | null;
          file_url: string;
          file_size: number | null;
          duration: number | null;
          recorded_at: string | null;
          is_live: boolean | null;
          track_listing: string[] | null;
          tags: string[] | null;
          download_count: number | null;
          google_drive_id: string | null;
          download_url: string | null;
          storage_provider: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Insert: {
          id?: number;
          event_id?: number | null;
          inventory_id?: number | null;
          title: string;
          description?: string | null;
          file_url: string;
          file_size?: number | null;
          duration?: number | null;
          recorded_at?: string | null;
          is_live?: boolean | null;
          track_listing?: string[] | null;
          tags?: string[] | null;
          download_count?: number | null;
          google_drive_id?: string | null;
          download_url?: string | null;
          storage_provider?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          event_id?: number | null;
          inventory_id?: number | null;
          title?: string;
          description?: string | null;
          file_url?: string;
          file_size?: number | null;
          duration?: number | null;
          recorded_at?: string | null;
          is_live?: boolean | null;
          track_listing?: string[] | null;
          tags?: string[] | null;
          download_count?: number | null;
          google_drive_id?: string | null;
          download_url?: string | null;
          storage_provider?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      format_abbreviations: {
        Row: {
          id: number;
          abbreviation: string;
          full_name: string;
          category: string;
          created_by: string | null;
          use_count: number | null;
          created_at?: string | null;
        };
        Insert: {
          id?: number;
          abbreviation: string;
          full_name: string;
          category: string;
          created_by?: string | null;
          use_count?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          abbreviation?: string;
          full_name?: string;
          category?: string;
          created_by?: string | null;
          use_count?: number | null;
          created_at?: string | null;
        };
      };
      import_conflict_resolutions: {
        Row: {
          id: number;
          album_id: number | null;
          field_name: string;
          source: string;
          resolution: string;
          kept_value: Json | null;
          rejected_value: Json | null;
          resolved_at?: string | null;
        };
        Insert: {
          id?: number;
          album_id?: number | null;
          field_name: string;
          source: string;
          resolution: string;
          kept_value?: Json | null;
          rejected_value?: Json | null;
          resolved_at?: string | null;
        };
        Update: {
          id?: number;
          album_id?: number | null;
          field_name?: string;
          source?: string;
          resolution?: string;
          kept_value?: Json | null;
          rejected_value?: Json | null;
          resolved_at?: string | null;
        };
      };
      import_history: {
        Row: {
          id: number;
          import_date?: string | null;
          records_added: number | null;
          records_updated: number | null;
          records_removed: number | null;
          status: string | null;
          notes: string | null;
        };
        Insert: {
          id?: number;
          import_date?: string | null;
          records_added?: number | null;
          records_updated?: number | null;
          records_removed?: number | null;
          status?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: number;
          import_date?: string | null;
          records_added?: number | null;
          records_updated?: number | null;
          records_removed?: number | null;
          status?: string | null;
          notes?: string | null;
        };
      };
      inventory: {
        Row: {
          id: number;
          release_id: number | null;
          status: string | null;
          location: string | null;
          media_condition: string | null;
          sleeve_condition: string | null;
          date_added: string | null;
          purchase_price: number | null;
          current_value: number | null;
          purchase_date: string | null;
          owner: string | null;
          personal_notes: string | null;
          is_cleaned: boolean | null;
          last_played_at: string | null;
          play_count: number | null;
          created_at?: string | null;
        };
        Insert: {
          id?: number;
          release_id?: number | null;
          status?: string | null;
          location?: string | null;
          media_condition?: string | null;
          sleeve_condition?: string | null;
          date_added?: string | null;
          purchase_price?: number | null;
          current_value?: number | null;
          purchase_date?: string | null;
          owner?: string | null;
          personal_notes?: string | null;
          is_cleaned?: boolean | null;
          last_played_at?: string | null;
          play_count?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          release_id?: number | null;
          status?: string | null;
          location?: string | null;
          media_condition?: string | null;
          sleeve_condition?: string | null;
          date_added?: string | null;
          purchase_price?: number | null;
          current_value?: number | null;
          purchase_date?: string | null;
          owner?: string | null;
          personal_notes?: string | null;
          is_cleaned?: boolean | null;
          last_played_at?: string | null;
          play_count?: number | null;
          created_at?: string | null;
        };
      };
      master_tag_links: {
        Row: {
          master_id: number;
          tag_id: number;
        };
        Insert: {
          master_id: number;
          tag_id: number;
        };
        Update: {
          master_id?: number;
          tag_id?: number;
        };
      };
      master_tags: {
        Row: {
          id: number;
          name: string;
          category: string | null;
          created_at?: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          category?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          category?: string | null;
          created_at?: string | null;
        };
      };
      masters: {
        Row: {
          id: number;
          title: string;
          main_artist_id: number | null;
          original_release_year: number | null;
          cover_image_url: string | null;
          genres: string[] | null;
          styles: string[] | null;
          discogs_master_id: string | null;
          musicbrainz_release_group_id: string | null;
          created_at?: string | null;
        };
        Insert: {
          id?: number;
          title: string;
          main_artist_id?: number | null;
          original_release_year?: number | null;
          cover_image_url?: string | null;
          genres?: string[] | null;
          styles?: string[] | null;
          discogs_master_id?: string | null;
          musicbrainz_release_group_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          title?: string;
          main_artist_id?: number | null;
          original_release_year?: number | null;
          cover_image_url?: string | null;
          genres?: string[] | null;
          styles?: string[] | null;
          discogs_master_id?: string | null;
          musicbrainz_release_group_id?: string | null;
          created_at?: string | null;
        };
      };
      most_wanted: {
        Row: {
          id: number;
          inventory_id: number | null;
          title: string;
          url: string | null;
          rank: number | null;
        };
        Insert: {
          id?: number;
          inventory_id?: number | null;
          title: string;
          url?: string | null;
          rank?: number | null;
        };
        Update: {
          id?: number;
          inventory_id?: number | null;
          title?: string;
          url?: string | null;
          rank?: number | null;
        };
      };
      playlists: {
        Row: {
          id: number;
          platform: string;
          embed_url: string;
          sort_order: number | null;
          updated_at?: string | null;
        };
        Insert: {
          id?: number;
          platform: string;
          embed_url: string;
          sort_order?: number | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          platform?: string;
          embed_url?: string;
          sort_order?: number | null;
          updated_at?: string | null;
        };
      };
      recordings: {
        Row: {
          id: number;
          work_id: number | null;
          title: string | null;
          duration_seconds: number | null;
          isrc: string | null;
          bpm: number | null;
          musical_key: string | null;
          energy: number | null;
          danceability: number | null;
          valence: number | null;
          credits: Json | null;
          created_at?: string | null;
        };
        Insert: {
          id?: number;
          work_id?: number | null;
          title?: string | null;
          duration_seconds?: number | null;
          isrc?: string | null;
          bpm?: number | null;
          musical_key?: string | null;
          energy?: number | null;
          danceability?: number | null;
          valence?: number | null;
          credits?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          work_id?: number | null;
          title?: string | null;
          duration_seconds?: number | null;
          isrc?: string | null;
          bpm?: number | null;
          musical_key?: string | null;
          energy?: number | null;
          danceability?: number | null;
          valence?: number | null;
          credits?: Json | null;
          created_at?: string | null;
        };
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
      };
      releases: {
        Row: {
          id: number;
          master_id: number | null;
          media_type: string;
          label: string | null;
          catalog_number: string | null;
          barcode: string | null;
          country: string | null;
          release_date: string | null;
          release_year: number | null;
          discogs_release_id: string | null;
          spotify_album_id: string | null;
          notes: string | null;
          track_count: number | null;
          created_at?: string | null;
          qty: number | null;
          format_details: string[] | null;
        };
        Insert: {
          id?: number;
          master_id?: number | null;
          media_type: string;
          label?: string | null;
          catalog_number?: string | null;
          barcode?: string | null;
          country?: string | null;
          release_date?: string | null;
          release_year?: number | null;
          discogs_release_id?: string | null;
          spotify_album_id?: string | null;
          notes?: string | null;
          track_count?: number | null;
          created_at?: string | null;
          qty?: number | null;
          format_details?: string[] | null;
        };
        Update: {
          id?: number;
          master_id?: number | null;
          media_type?: string;
          label?: string | null;
          catalog_number?: string | null;
          barcode?: string | null;
          country?: string | null;
          release_date?: string | null;
          release_year?: number | null;
          discogs_release_id?: string | null;
          spotify_album_id?: string | null;
          notes?: string | null;
          track_count?: number | null;
          created_at?: string | null;
          qty?: number | null;
          format_details?: string[] | null;
        };
      };
      requests_v3: {
        Row: {
          id: string;
          event_id: number | null;
          inventory_id: number | null;
          recording_id: number | null;
          artist_name: string | null;
          track_title: string | null;
          status: string | null;
          votes: number | null;
          created_at?: string | null;
        };
        Insert: {
          id?: string;
          event_id?: number | null;
          inventory_id?: number | null;
          recording_id?: number | null;
          artist_name?: string | null;
          track_title?: string | null;
          status?: string | null;
          votes?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: number | null;
          inventory_id?: number | null;
          recording_id?: number | null;
          artist_name?: string | null;
          track_title?: string | null;
          status?: string | null;
          votes?: number | null;
          created_at?: string | null;
        };
      };
      social_embeds: {
        Row: {
          id: string;
          platform: string;
          embed_html: string;
          visible: boolean | null;
          created_at?: string | null;
        };
        Insert: {
          id?: string;
          platform: string;
          embed_html: string;
          visible?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          platform?: string;
          embed_html?: string;
          visible?: boolean | null;
          created_at?: string | null;
        };
      };
      wantlist: {
        Row: {
          id: number;
          artist: string;
          title: string;
          year: string | null;
          format: string | null;
          cover_image: string | null;
          discogs_release_id: string | null;
          discogs_master_id: string | null;
          notes: string | null;
          date_added_to_wantlist?: string | null;
          artist_norm: string | null;
          title_norm: string | null;
          artist_album_norm: string | null;
        };
        Insert: {
          id?: number;
          artist: string;
          title: string;
          year?: string | null;
          format?: string | null;
          cover_image?: string | null;
          discogs_release_id?: string | null;
          discogs_master_id?: string | null;
          notes?: string | null;
          date_added_to_wantlist?: string | null;
          artist_norm?: string | null;
          title_norm?: string | null;
          artist_album_norm?: string | null;
        };
        Update: {
          id?: number;
          artist?: string;
          title?: string;
          year?: string | null;
          format?: string | null;
          cover_image?: string | null;
          discogs_release_id?: string | null;
          discogs_master_id?: string | null;
          notes?: string | null;
          date_added_to_wantlist?: string | null;
          artist_norm?: string | null;
          title_norm?: string | null;
          artist_album_norm?: string | null;
        };
      };
      works: {
        Row: {
          id: number;
          title: string;
          primary_artist_id: number | null;
          original_release_year: number | null;
          iswc: string | null;
          created_at?: string | null;
        };
        Insert: {
          id?: number;
          title: string;
          primary_artist_id?: number | null;
          original_release_year?: number | null;
          iswc?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          title?: string;
          primary_artist_id?: number | null;
          original_release_year?: number | null;
          iswc?: string | null;
          created_at?: string | null;
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
          notes: string | null;
          date_added: string | null;
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
          notes?: string | null;
          date_added?: string | null;
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
          notes?: string | null;
          date_added?: string | null;
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
      v2_legacy_archive: {
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
          notes?: string | null;
          date_added?: string | null;
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
          notes?: string | null;
          date_added?: string | null;
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

export type DbRequestV3 = Database['public']['Tables']['requests_v3']['Row'];
export type NewRequestV3 = Database['public']['Tables']['requests_v3']['Insert'];
export type UpdateRequestV3 = Database['public']['Tables']['requests_v3']['Update'];

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

export type Artist = Database['public']['Tables']['artists']['Row'];
export type Master = Database['public']['Tables']['masters']['Row'];
export type Release = Database['public']['Tables']['releases']['Row'];
export type Inventory = Database['public']['Tables']['inventory']['Row'];
export type Recording = Database['public']['Tables']['recordings']['Row'];
export type ReleaseTrack = Database['public']['Tables']['release_tracks']['Row'];

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

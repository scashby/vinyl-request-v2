export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
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
          created_at: string | null;
          updated_at: string | null;
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
        Relationships: [];
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
        Relationships: [];
      };
      album_suggestions: {
        Row: {
          id: number;
          artist: string;
          album: string;
          reason: string | null;
          contributor_name: string | null;
          contributor_email: string | null;
          contribution_amount: string | null;
          context: string | null;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
          admin_notes: string | null;
          estimated_cost: number | null;
          venmo_transaction_id: string | null;
          priority_score: number | null;
        };
        Insert: {
          id?: number;
          artist: string;
          album: string;
          reason?: string | null;
          contributor_name?: string | null;
          contributor_email?: string | null;
          contribution_amount?: string | null;
          context?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          admin_notes?: string | null;
          estimated_cost?: number | null;
          venmo_transaction_id?: string | null;
          priority_score?: number | null;
        };
        Update: {
          id?: number;
          artist?: string;
          album?: string;
          reason?: string | null;
          contributor_name?: string | null;
          contributor_email?: string | null;
          contribution_amount?: string | null;
          context?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          admin_notes?: string | null;
          estimated_cost?: number | null;
          venmo_transaction_id?: string | null;
          priority_score?: number | null;
        };
        Relationships: [];
      };
      lyric_search_tags: {
        Row: {
          id: number;
          inventory_id: number | null;
          track_title: string | null;
          track_position: string | null;
          search_term: string | null;
          genius_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          inventory_id?: number | null;
          track_title?: string | null;
          track_position?: string | null;
          search_term?: string | null;
          genius_url?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          inventory_id?: number | null;
          track_title?: string | null;
          track_position?: string | null;
          search_term?: string | null;
          genius_url?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lyric_search_tags_inventory_id_fkey';
            columns: ['inventory_id'];
            referencedRelation: 'inventory';
            referencedColumns: ['id'];
          }
        ];
      };
      staff_picks: {
        Row: {
          id: number;
          staff_name: string;
          staff_title: string | null;
          staff_photo_url: string | null;
          staff_bio: string | null;
          inventory_id: number;
          pick_order: number | null;
          reason: string | null;
          favorite_track: string | null;
          listening_context: string | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          staff_name: string;
          staff_title?: string | null;
          staff_photo_url?: string | null;
          staff_bio?: string | null;
          inventory_id: number;
          pick_order?: number | null;
          reason?: string | null;
          favorite_track?: string | null;
          listening_context?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          staff_name?: string;
          staff_title?: string | null;
          staff_photo_url?: string | null;
          staff_bio?: string | null;
          inventory_id?: number;
          pick_order?: number | null;
          reason?: string | null;
          favorite_track?: string | null;
          listening_context?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_picks_inventory_id_fkey';
            columns: ['inventory_id'];
            referencedRelation: 'inventory';
            referencedColumns: ['id'];
          }
        ];
      };
      tournament_candidates: {
        Row: {
          id: number;
          event_id: number;
          inventory_id: number | null;
          artist: string;
          title: string;
          cover_image: string | null;
          vote_count: number;
          is_write_in: boolean;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          event_id: number;
          inventory_id?: number | null;
          artist: string;
          title: string;
          cover_image?: string | null;
          vote_count?: number;
          is_write_in?: boolean;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          event_id?: number;
          inventory_id?: number | null;
          artist?: string;
          title?: string;
          cover_image?: string | null;
          vote_count?: number;
          is_write_in?: boolean;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tournament_candidates_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tournament_candidates_inventory_id_fkey';
            columns: ['inventory_id'];
            referencedRelation: 'inventory';
            referencedColumns: ['id'];
          }
        ];
      };
      artist_rules: {
        Row: {
          id: number;
          search_pattern: string;
          replacement: string | null;
          rule_type: string;
          created_at: string | null;
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
        Relationships: [];
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
          created_at: string | null;
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
        Relationships: [];
      };
      crate_items: {
        Row: {
          id: number;
          crate_id: number | null;
          inventory_id: number | null;
          position: number | null;
          notes: string | null;
          added_at: string | null;
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
        Relationships: [
          {
            foreignKeyName: 'crate_items_crate_id_fkey';
            columns: ['crate_id'];
            referencedRelation: 'crates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'crate_items_inventory_id_fkey';
            columns: ['inventory_id'];
            referencedRelation: 'inventory';
            referencedColumns: ['id'];
          }
        ];
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
          created_at: string | null;
          updated_at: string | null;
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
        Relationships: [];
      };
      dj_sets: {
        Row: {
          id: number;
          event_id: number | null;
          title: string;
          description: string | null;
          file_url: string;
          file_size: number | null;
          duration: number | null;
          recorded_at: string | null;
          is_live: boolean | null;
          track_listing: Json | null;
          tags: Json | null;
          download_count: number | null;
          google_drive_id: string | null;
          download_url: string | null;
          storage_provider: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          event_id?: number | null;
          title: string;
          description?: string | null;
          file_url: string;
          file_size?: number | null;
          duration?: number | null;
          recorded_at?: string | null;
          is_live?: boolean | null;
          track_listing?: Json | null;
          tags?: Json | null;
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
          title?: string;
          description?: string | null;
          file_url?: string;
          file_size?: number | null;
          duration?: number | null;
          recorded_at?: string | null;
          is_live?: boolean | null;
          track_listing?: Json | null;
          tags?: Json | null;
          download_count?: number | null;
          google_drive_id?: string | null;
          download_url?: string | null;
          storage_provider?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dj_sets_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          }
        ];
      };
      events: {
        Row: {
          id: number;
          date: string;
          title: string;
          time: string | null;
          location: string | null;
          image_url: string | null;
          info: string | null;
          info_url: string | null;
          has_queue: boolean | null;
          queue_types: string[] | null;
          allowed_formats: string[] | null;
          allowed_tags: string[] | null;
          crate_id: number | null;
          has_games: boolean | null;
          game_modes: string[] | null;
          is_featured_grid: boolean | null;
          is_featured_upnext: boolean | null;
          featured_priority: number | null;
          is_recurring: boolean | null;
          parent_event_id: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          date: string;
          title: string;
          time?: string | null;
          location?: string | null;
          image_url?: string | null;
          info?: string | null;
          info_url?: string | null;
          has_queue?: boolean | null;
          queue_types?: string[] | null;
          allowed_formats?: string[] | null;
          allowed_tags?: string[] | null;
          crate_id?: number | null;
          has_games?: boolean | null;
          game_modes?: string[] | null;
          is_featured_grid?: boolean | null;
          is_featured_upnext?: boolean | null;
          featured_priority?: number | null;
          is_recurring?: boolean | null;
          parent_event_id?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          date?: string;
          title?: string;
          time?: string | null;
          location?: string | null;
          image_url?: string | null;
          info?: string | null;
          info_url?: string | null;
          has_queue?: boolean | null;
          queue_types?: string[] | null;
          allowed_formats?: string[] | null;
          allowed_tags?: string[] | null;
          crate_id?: number | null;
          has_games?: boolean | null;
          game_modes?: string[] | null;
          is_featured_grid?: boolean | null;
          is_featured_upnext?: boolean | null;
          featured_priority?: number | null;
          is_recurring?: boolean | null;
          parent_event_id?: number | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_crate_id_fkey';
            columns: ['crate_id'];
            referencedRelation: 'crates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          }
        ];
      };
      format_abbreviations: {
        Row: {
          id: number;
          abbreviation: string;
          full_name: string;
          category: string;
          created_by: string | null;
          use_count: number | null;
          created_at: string | null;
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
        Relationships: [];
      };
      game_sessions: {
        Row: {
          id: number;
          event_id: number | null;
          crate_id: number | null;
          game_type: string;
          game_state: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          event_id?: number | null;
          crate_id?: number | null;
          game_type: string;
          game_state?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          event_id?: number | null;
          crate_id?: number | null;
          game_type?: string;
          game_state?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'game_sessions_crate_id_fkey';
            columns: ['crate_id'];
            referencedRelation: 'crates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'game_sessions_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          }
        ];
      };
      game_templates: {
        Row: {
          id: number;
          name: string;
          game_type: string;
          template_state: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          game_type: string;
          template_state?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          game_type?: string;
          template_state?: Json;
          created_at?: string;
        };
        Relationships: [];
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
          resolved_at: string | null;
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
        Relationships: [];
      };
      import_history: {
        Row: {
          id: number;
          import_date: string | null;
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
        Relationships: [];
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
          created_at: string | null;
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
        Relationships: [
          {
            foreignKeyName: 'inventory_release_id_fkey';
            columns: ['release_id'];
            referencedRelation: 'releases';
            referencedColumns: ['id'];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: 'master_tag_links_master_id_fkey';
            columns: ['master_id'];
            referencedRelation: 'masters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'master_tag_links_tag_id_fkey';
            columns: ['tag_id'];
            referencedRelation: 'master_tags';
            referencedColumns: ['id'];
          }
        ];
      };
      master_tags: {
        Row: {
          id: number;
          name: string;
          category: string | null;
          created_at: string | null;
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
        Relationships: [];
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
          notes: string | null;
          sort_title: string | null;
          subtitle: string | null;
          musicians: string[] | null;
          producers: string[] | null;
          engineers: string[] | null;
          songwriters: string[] | null;
          composer: string | null;
          conductor: string | null;
          chorus: string | null;
          composition: string | null;
          orchestra: string | null;
          chart_positions: string[] | null;
          awards: string[] | null;
          certifications: string[] | null;
          cultural_significance: string | null;
          critical_reception: string | null;
          allmusic_rating: number | null;
          allmusic_review: string | null;
          pitchfork_score: number | null;
          pitchfork_review: string | null;
          recording_location: string | null;
          wikipedia_url: string | null;
          allmusic_url: string | null;
          apple_music_url: string | null;
          lastfm_url: string | null;
          spotify_url: string | null;
          genius_url: string | null;
          custom_links: Json | null;
          created_at: string | null;
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
          notes?: string | null;
          sort_title?: string | null;
          subtitle?: string | null;
          musicians?: string[] | null;
          producers?: string[] | null;
          engineers?: string[] | null;
          songwriters?: string[] | null;
          composer?: string | null;
          conductor?: string | null;
          chorus?: string | null;
          composition?: string | null;
          orchestra?: string | null;
          chart_positions?: string[] | null;
          awards?: string[] | null;
          certifications?: string[] | null;
          cultural_significance?: string | null;
          critical_reception?: string | null;
          allmusic_rating?: number | null;
          allmusic_review?: string | null;
          pitchfork_score?: number | null;
          pitchfork_review?: string | null;
          recording_location?: string | null;
          wikipedia_url?: string | null;
          allmusic_url?: string | null;
          apple_music_url?: string | null;
          lastfm_url?: string | null;
          spotify_url?: string | null;
          genius_url?: string | null;
          custom_links?: Json | null;
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
          notes?: string | null;
          sort_title?: string | null;
          subtitle?: string | null;
          musicians?: string[] | null;
          producers?: string[] | null;
          engineers?: string[] | null;
          songwriters?: string[] | null;
          composer?: string | null;
          conductor?: string | null;
          chorus?: string | null;
          composition?: string | null;
          orchestra?: string | null;
          chart_positions?: string[] | null;
          awards?: string[] | null;
          certifications?: string[] | null;
          cultural_significance?: string | null;
          critical_reception?: string | null;
          allmusic_rating?: number | null;
          allmusic_review?: string | null;
          pitchfork_score?: number | null;
          pitchfork_review?: string | null;
          recording_location?: string | null;
          wikipedia_url?: string | null;
          allmusic_url?: string | null;
          apple_music_url?: string | null;
          lastfm_url?: string | null;
          spotify_url?: string | null;
          genius_url?: string | null;
          custom_links?: Json | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'masters_main_artist_id_fkey';
            columns: ['main_artist_id'];
            referencedRelation: 'artists';
            referencedColumns: ['id'];
          }
        ];
      };
      most_wanted: {
        Row: {
          id: number;
          title: string;
          url: string | null;
          rank: number | null;
        };
        Insert: {
          id?: number;
          title: string;
          url?: string | null;
          rank?: number | null;
        };
        Update: {
          id?: number;
          title?: string;
          url?: string | null;
          rank?: number | null;
        };
        Relationships: [];
      };
      playlists: {
        Row: {
          id: number;
          platform: string;
          embed_url: string;
          sort_order: number | null;
          updated_at: string | null;
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
        Relationships: [];
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
          lyrics: string | null;
          lyrics_url: string | null;
          is_cover: boolean | null;
          original_artist: string | null;
          track_artist: string | null;
          credits: Json | null;
          notes: string | null;
          created_at: string | null;
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
          lyrics?: string | null;
          lyrics_url?: string | null;
          is_cover?: boolean | null;
          original_artist?: string | null;
          track_artist?: string | null;
          credits?: Json | null;
          notes?: string | null;
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
          lyrics?: string | null;
          lyrics_url?: string | null;
          is_cover?: boolean | null;
          original_artist?: string | null;
          track_artist?: string | null;
          credits?: Json | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recordings_work_id_fkey';
            columns: ['work_id'];
            referencedRelation: 'works';
            referencedColumns: ['id'];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: 'release_tracks_release_id_fkey';
            columns: ['release_id'];
            referencedRelation: 'releases';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'release_tracks_recording_id_fkey';
            columns: ['recording_id'];
            referencedRelation: 'recordings';
            referencedColumns: ['id'];
          }
        ];
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
          created_at: string | null;
          qty: number | null;
          format_details: string[] | null;
          packaging: string | null;
          vinyl_color: string[] | null;
          vinyl_weight: string | null;
          rpm: string | null;
          spars_code: string | null;
          box_set: string | null;
          sound: string | null;
          studio: string | null;
          disc_metadata: Json | null;
          matrix_numbers: Json | null;
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
          packaging?: string | null;
          vinyl_color?: string[] | null;
          vinyl_weight?: string | null;
          rpm?: string | null;
          spars_code?: string | null;
          box_set?: string | null;
          sound?: string | null;
          studio?: string | null;
          disc_metadata?: Json | null;
          matrix_numbers?: Json | null;
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
          packaging?: string | null;
          vinyl_color?: string[] | null;
          vinyl_weight?: string | null;
          rpm?: string | null;
          spars_code?: string | null;
          box_set?: string | null;
          sound?: string | null;
          studio?: string | null;
          disc_metadata?: Json | null;
          matrix_numbers?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'releases_master_id_fkey';
            columns: ['master_id'];
            referencedRelation: 'masters';
            referencedColumns: ['id'];
          }
        ];
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
          created_at: string | null;
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
        Relationships: [
          {
            foreignKeyName: 'requests_v3_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'requests_v3_inventory_id_fkey';
            columns: ['inventory_id'];
            referencedRelation: 'inventory';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'requests_v3_recording_id_fkey';
            columns: ['recording_id'];
            referencedRelation: 'recordings';
            referencedColumns: ['id'];
          }
        ];
      };
      social_embeds: {
        Row: {
          id: string;
          platform: string;
          embed_html: string;
          visible: boolean | null;
          created_at: string | null;
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
        Relationships: [];
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
          date_added_to_wantlist: string | null;
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
        Relationships: [];
      };
      works: {
        Row: {
          id: number;
          title: string;
          primary_artist_id: number | null;
          original_release_year: number | null;
          iswc: string | null;
          created_at: string | null;
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
        Relationships: [
          {
            foreignKeyName: 'works_primary_artist_id_fkey';
            columns: ['primary_artist_id'];
            referencedRelation: 'artists';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_game_manifest: {
        Args: {
          session_id: number;
        };
        Returns: {
          game_session_id: number;
          crate_id: number;
          crate_name: string;
          inventory_id: number;
          inventory_location: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
// AUDIT: inspected, no changes.

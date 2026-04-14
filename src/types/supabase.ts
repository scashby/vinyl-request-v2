export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      aa_session_calls: {
        Row: {
          accepted_aliases: string[]
          artist_name: string
          asked_at: string | null
          audio_clue_source: string | null
          call_index: number
          clue_collaborator: string
          clue_era: string
          clue_label_region: string
          created_at: string
          host_notes: string | null
          id: number
          revealed_at: string | null
          round_number: number
          scored_at: string | null
          session_id: number
          source_label: string | null
          stage_revealed: number
          status: string
        }
        Insert: {
          accepted_aliases?: string[]
          artist_name: string
          asked_at?: string | null
          audio_clue_source?: string | null
          call_index: number
          clue_collaborator: string
          clue_era: string
          clue_label_region: string
          created_at?: string
          host_notes?: string | null
          id?: number
          revealed_at?: string | null
          round_number: number
          scored_at?: string | null
          session_id: number
          source_label?: string | null
          stage_revealed?: number
          status?: string
        }
        Update: {
          accepted_aliases?: string[]
          artist_name?: string
          asked_at?: string | null
          audio_clue_source?: string | null
          call_index?: number
          clue_collaborator?: string
          clue_era?: string
          clue_label_region?: string
          created_at?: string
          host_notes?: string | null
          id?: number
          revealed_at?: string | null
          round_number?: number
          scored_at?: string | null
          session_id?: number
          source_label?: string | null
          stage_revealed?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aa_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aa_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      aa_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "aa_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aa_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      aa_session_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: number
          opened_at: string | null
          round_number: number
          round_title: string | null
          session_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number: number
          round_title?: string | null
          session_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number?: number
          round_title?: string | null
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aa_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aa_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      aa_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "aa_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aa_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      aa_sessions: {
        Row: {
          audio_clue_enabled: boolean
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          final_reveal_points: number
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          playlist_id: number | null
          remove_resleeve_seconds: number
          round_count: number
          session_code: string
          show_logo: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_stage_hint: boolean
          show_title: boolean
          stage_one_points: number
          stage_two_points: number
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          audio_clue_enabled?: boolean
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          final_reveal_points?: number
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code: string
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_stage_hint?: boolean
          show_title?: boolean
          stage_one_points?: number
          stage_two_points?: number
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          audio_clue_enabled?: boolean
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          final_reveal_points?: number
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code?: string
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_stage_hint?: boolean
          show_title?: boolean
          stage_one_points?: number
          stage_two_points?: number
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aa_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aa_sessions_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      aa_team_scores: {
        Row: {
          awarded_points: number
          call_id: number
          created_at: string
          exact_match: boolean
          guessed_artist: string | null
          guessed_at_stage: number | null
          id: number
          notes: string | null
          scored_at: string
          scored_by: string | null
          session_id: number
          team_id: number
          used_audio_clue: boolean
        }
        Insert: {
          awarded_points?: number
          call_id: number
          created_at?: string
          exact_match?: boolean
          guessed_artist?: string | null
          guessed_at_stage?: number | null
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id: number
          team_id: number
          used_audio_clue?: boolean
        }
        Update: {
          awarded_points?: number
          call_id?: number
          created_at?: string
          exact_match?: boolean
          guessed_artist?: string | null
          guessed_at_stage?: number | null
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          team_id?: number
          used_audio_clue?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "aa_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "aa_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aa_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aa_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aa_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "aa_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      about_content: {
        Row: {
          amazon_wishlist_url: string | null
          booking_description: string | null
          booking_notes: string | null
          calendly_url: string | null
          contact_company: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          discogs_wantlist_url: string | null
          id: number
          linktree_url: string | null
          main_description: string | null
          services: Json | null
          testimonials: Json | null
          updated_at: string | null
        }
        Insert: {
          amazon_wishlist_url?: string | null
          booking_description?: string | null
          booking_notes?: string | null
          calendly_url?: string | null
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          discogs_wantlist_url?: string | null
          id?: never
          linktree_url?: string | null
          main_description?: string | null
          services?: Json | null
          testimonials?: Json | null
          updated_at?: string | null
        }
        Update: {
          amazon_wishlist_url?: string | null
          booking_description?: string | null
          booking_notes?: string | null
          calendly_url?: string | null
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          discogs_wantlist_url?: string | null
          id?: never
          linktree_url?: string | null
          main_description?: string | null
          services?: Json | null
          testimonials?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      album_suggestions: {
        Row: {
          admin_notes: string | null
          album: string
          artist: string
          context: string
          contribution_amount: string | null
          contributor_email: string | null
          contributor_name: string | null
          created_at: string
          estimated_cost: number | null
          id: number
          priority_score: number | null
          reason: string | null
          status: string
          updated_at: string | null
          venmo_transaction_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          album: string
          artist: string
          context?: string
          contribution_amount?: string | null
          contributor_email?: string | null
          contributor_name?: string | null
          created_at?: string
          estimated_cost?: number | null
          id?: never
          priority_score?: number | null
          reason?: string | null
          status?: string
          updated_at?: string | null
          venmo_transaction_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          album?: string
          artist?: string
          context?: string
          contribution_amount?: string | null
          contributor_email?: string | null
          contributor_name?: string | null
          created_at?: string
          estimated_cost?: number | null
          id?: never
          priority_score?: number | null
          reason?: string | null
          status?: string
          updated_at?: string | null
          venmo_transaction_id?: string | null
        }
        Relationships: []
      }
      artist_rules: {
        Row: {
          created_at: string | null
          id: number
          replacement: string | null
          rule_type: string
          search_pattern: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          replacement?: string | null
          rule_type: string
          search_pattern: string
        }
        Update: {
          created_at?: string | null
          id?: never
          replacement?: string | null
          rule_type?: string
          search_pattern?: string
        }
        Relationships: []
      }
      artists: {
        Row: {
          created_at: string | null
          discogs_id: string | null
          id: number
          musicbrainz_id: string | null
          name: string
          profile_image_url: string | null
          slug: string | null
          spotify_id: string | null
        }
        Insert: {
          created_at?: string | null
          discogs_id?: string | null
          id?: never
          musicbrainz_id?: string | null
          name: string
          profile_image_url?: string | null
          slug?: string | null
          spotify_id?: string | null
        }
        Update: {
          created_at?: string | null
          discogs_id?: string | null
          id?: never
          musicbrainz_id?: string | null
          name?: string
          profile_image_url?: string | null
          slug?: string | null
          spotify_id?: string | null
        }
        Relationships: []
      }
      b2bc_session_calls: {
        Row: {
          accepted_connection: string
          accepted_detail: string | null
          asked_at: string | null
          call_index: number
          created_at: string
          host_notes: string | null
          id: number
          revealed_at: string | null
          round_number: number
          scored_at: string | null
          session_id: number
          status: string
          track_a_artist: string
          track_a_release_year: number | null
          track_a_source_label: string | null
          track_a_title: string
          track_b_artist: string
          track_b_release_year: number | null
          track_b_source_label: string | null
          track_b_title: string
        }
        Insert: {
          accepted_connection: string
          accepted_detail?: string | null
          asked_at?: string | null
          call_index: number
          created_at?: string
          host_notes?: string | null
          id?: number
          revealed_at?: string | null
          round_number: number
          scored_at?: string | null
          session_id: number
          status?: string
          track_a_artist: string
          track_a_release_year?: number | null
          track_a_source_label?: string | null
          track_a_title: string
          track_b_artist: string
          track_b_release_year?: number | null
          track_b_source_label?: string | null
          track_b_title: string
        }
        Update: {
          accepted_connection?: string
          accepted_detail?: string | null
          asked_at?: string | null
          call_index?: number
          created_at?: string
          host_notes?: string | null
          id?: number
          revealed_at?: string | null
          round_number?: number
          scored_at?: string | null
          session_id?: number
          status?: string
          track_a_artist?: string
          track_a_release_year?: number | null
          track_a_source_label?: string | null
          track_a_title?: string
          track_b_artist?: string
          track_b_release_year?: number | null
          track_b_source_label?: string | null
          track_b_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2bc_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "b2bc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      b2bc_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "b2bc_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "b2bc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      b2bc_session_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: number
          opened_at: string | null
          round_number: number
          round_title: string | null
          session_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number: number
          round_title?: string | null
          session_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number?: number
          round_title?: string | null
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2bc_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "b2bc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      b2bc_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2bc_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "b2bc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      b2bc_sessions: {
        Row: {
          connection_points: number
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          detail_bonus_points: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          remove_resleeve_seconds: number
          round_count: number
          session_code: string
          show_connection_prompt: boolean
          show_logo: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_title: boolean
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          connection_points?: number
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          detail_bonus_points?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code: string
          show_connection_prompt?: boolean
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          connection_points?: number
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          detail_bonus_points?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code?: string
          show_connection_prompt?: boolean
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2bc_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      b2bc_team_scores: {
        Row: {
          awarded_points: number
          call_id: number
          connection_correct: boolean
          created_at: string
          detail_correct: boolean
          guessed_connection: string | null
          guessed_detail: string | null
          id: number
          notes: string | null
          scored_at: string
          scored_by: string | null
          session_id: number
          team_id: number
        }
        Insert: {
          awarded_points?: number
          call_id: number
          connection_correct?: boolean
          created_at?: string
          detail_correct?: boolean
          guessed_connection?: string | null
          guessed_detail?: string | null
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id: number
          team_id: number
        }
        Update: {
          awarded_points?: number
          call_id?: number
          connection_correct?: boolean
          created_at?: string
          detail_correct?: boolean
          guessed_connection?: string | null
          guessed_detail?: string | null
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "b2bc_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "b2bc_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2bc_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "b2bc_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2bc_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "b2bc_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_bracket_picks: {
        Row: {
          created_at: string
          id: number
          is_correct: boolean
          locked_at: string | null
          matchup_id: number
          picked_entry_id: number
          points_awarded: number
          resolved_at: string | null
          session_id: number
          team_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          is_correct?: boolean
          locked_at?: string | null
          matchup_id: number
          picked_entry_id: number
          points_awarded?: number
          resolved_at?: string | null
          session_id: number
          team_id: number
        }
        Update: {
          created_at?: string
          id?: number
          is_correct?: boolean
          locked_at?: string | null
          matchup_id?: number
          picked_entry_id?: number
          points_awarded?: number
          resolved_at?: string | null
          session_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bb_bracket_picks_matchup_id_fkey"
            columns: ["matchup_id"]
            isOneToOne: false
            referencedRelation: "bb_session_matchups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_bracket_picks_picked_entry_id_fkey"
            columns: ["picked_entry_id"]
            isOneToOne: false
            referencedRelation: "bb_session_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_bracket_picks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bb_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_bracket_picks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "bb_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_matchup_vote_tallies: {
        Row: {
          captured_at: string
          captured_by: string | null
          created_at: string
          id: number
          matchup_id: number
          session_id: number
          vote_count: number
          winner_entry_id: number
        }
        Insert: {
          captured_at?: string
          captured_by?: string | null
          created_at?: string
          id?: number
          matchup_id: number
          session_id: number
          vote_count?: number
          winner_entry_id: number
        }
        Update: {
          captured_at?: string
          captured_by?: string | null
          created_at?: string
          id?: number
          matchup_id?: number
          session_id?: number
          vote_count?: number
          winner_entry_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bb_matchup_vote_tallies_matchup_id_fkey"
            columns: ["matchup_id"]
            isOneToOne: false
            referencedRelation: "bb_session_matchups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_matchup_vote_tallies_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bb_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_matchup_vote_tallies_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "bb_session_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_session_entries: {
        Row: {
          active: boolean
          artist: string | null
          created_at: string
          entry_label: string
          id: number
          seed: number
          session_id: number
          source_label: string | null
          title: string | null
        }
        Insert: {
          active?: boolean
          artist?: string | null
          created_at?: string
          entry_label: string
          id?: number
          seed: number
          session_id: number
          source_label?: string | null
          title?: string | null
        }
        Update: {
          active?: boolean
          artist?: string | null
          created_at?: string
          entry_label?: string
          id?: number
          seed?: number
          session_id?: number
          source_label?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_session_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bb_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bb_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bb_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_session_matchups: {
        Row: {
          created_at: string
          higher_seed_entry_id: number | null
          id: number
          lower_seed_entry_id: number | null
          matchup_index: number
          notes: string | null
          opened_at: string | null
          round_number: number
          session_id: number
          source_label: string | null
          status: string
          vote_method: string
          voting_locked_at: string | null
          winner_confirmed_at: string | null
          winner_entry_id: number | null
        }
        Insert: {
          created_at?: string
          higher_seed_entry_id?: number | null
          id?: number
          lower_seed_entry_id?: number | null
          matchup_index: number
          notes?: string | null
          opened_at?: string | null
          round_number: number
          session_id: number
          source_label?: string | null
          status?: string
          vote_method?: string
          voting_locked_at?: string | null
          winner_confirmed_at?: string | null
          winner_entry_id?: number | null
        }
        Update: {
          created_at?: string
          higher_seed_entry_id?: number | null
          id?: number
          lower_seed_entry_id?: number | null
          matchup_index?: number
          notes?: string | null
          opened_at?: string | null
          round_number?: number
          session_id?: number
          source_label?: string | null
          status?: string
          vote_method?: string
          voting_locked_at?: string | null
          winner_confirmed_at?: string | null
          winner_entry_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_session_matchups_higher_seed_entry_id_fkey"
            columns: ["higher_seed_entry_id"]
            isOneToOne: false
            referencedRelation: "bb_session_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_session_matchups_lower_seed_entry_id_fkey"
            columns: ["lower_seed_entry_id"]
            isOneToOne: false
            referencedRelation: "bb_session_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_session_matchups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bb_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_session_matchups_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "bb_session_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_session_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          expected_matchups: number
          id: number
          opened_at: string | null
          round_name: string
          round_number: number
          session_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          expected_matchups: number
          id?: number
          opened_at?: string | null
          round_name: string
          round_number: number
          session_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          expected_matchups?: number
          id?: number
          opened_at?: string | null
          round_name?: string
          round_number?: number
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bb_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bb_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_sessions: {
        Row: {
          bracket_size: number
          created_at: string
          cue_seconds: number
          current_matchup_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          playlist_id: number | null
          remove_resleeve_seconds: number
          scoring_model: string
          session_code: string
          show_bracket: boolean
          show_logo: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_title: boolean
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          vote_method: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          bracket_size?: number
          created_at?: string
          cue_seconds?: number
          current_matchup_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          scoring_model?: string
          session_code: string
          show_bracket?: boolean
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          vote_method?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          bracket_size?: number
          created_at?: string
          cue_seconds?: number
          current_matchup_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          scoring_model?: string
          session_code?: string
          show_bracket?: boolean
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          vote_method?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_sessions_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_team_scores: {
        Row: {
          created_at: string
          id: number
          session_id: number
          team_id: number
          tie_break_points: number
          total_points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          session_id: number
          team_id: number
          tie_break_points?: number
          total_points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          session_id?: number
          team_id?: number
          tie_break_points?: number
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bb_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "bb_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_cards: {
        Row: {
          card_identifier: string
          card_number: number
          created_at: string
          grid: Json
          has_free_space: boolean
          id: number
          session_id: number
        }
        Insert: {
          card_identifier: string
          card_number: number
          created_at?: string
          grid: Json
          has_free_space?: boolean
          id?: number
          session_id: number
        }
        Update: {
          card_identifier?: string
          card_number?: number
          created_at?: string
          grid?: Json
          has_free_space?: boolean
          id?: number
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bingo_cards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bingo_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_game_pool_tracks: {
        Row: {
          created_at: string
          id: number
          preset_id: number
          sort_order: number
          track_key: string
        }
        Insert: {
          created_at?: string
          id?: never
          preset_id: number
          sort_order?: number
          track_key: string
        }
        Update: {
          created_at?: string
          id?: never
          preset_id?: number
          sort_order?: number
          track_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "bingo_game_pool_tracks_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "bingo_game_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_game_presets: {
        Row: {
          archived: boolean
          created_at: string
          created_from_session_id: number | null
          id: number
          name: string
          note: string | null
          pool_size: number
          source_playlist_ids: Json
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_from_session_id?: number | null
          id?: never
          name: string
          note?: string | null
          pool_size?: number
          source_playlist_ids?: Json
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_from_session_id?: number | null
          id?: never
          name?: string
          note?: string | null
          pool_size?: number
          source_playlist_ids?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bingo_game_presets_created_from_session_id_fkey"
            columns: ["created_from_session_id"]
            isOneToOne: false
            referencedRelation: "bingo_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_preset_crates: {
        Row: {
          call_order: Json
          crate_letter: string
          crate_name: string
          created_at: string
          created_for_round: number | null
          created_from_session_id: number | null
          id: number
          preset_id: number
        }
        Insert: {
          call_order: Json
          crate_letter: string
          crate_name: string
          created_at?: string
          created_for_round?: number | null
          created_from_session_id?: number | null
          id?: never
          preset_id: number
        }
        Update: {
          call_order?: Json
          crate_letter?: string
          crate_name?: string
          created_at?: string
          created_for_round?: number | null
          created_from_session_id?: number | null
          id?: never
          preset_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bingo_preset_crates_created_from_session_id_fkey"
            columns: ["created_from_session_id"]
            isOneToOne: false
            referencedRelation: "bingo_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bingo_preset_crates_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "bingo_game_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_session_calls: {
        Row: {
          album_name: string | null
          artist_name: string
          ball_number: number | null
          call_index: number
          called_at: string | null
          column_letter: string
          completed_at: string | null
          created_at: string
          id: number
          metadata_locked: boolean
          metadata_synced_at: string | null
          playlist_track_key: string | null
          position: string | null
          prep_started_at: string | null
          session_id: number
          side: string | null
          status: string
          track_title: string
        }
        Insert: {
          album_name?: string | null
          artist_name: string
          ball_number?: number | null
          call_index: number
          called_at?: string | null
          column_letter: string
          completed_at?: string | null
          created_at?: string
          id?: number
          metadata_locked?: boolean
          metadata_synced_at?: string | null
          playlist_track_key?: string | null
          position?: string | null
          prep_started_at?: string | null
          session_id: number
          side?: string | null
          status?: string
          track_title: string
        }
        Update: {
          album_name?: string | null
          artist_name?: string
          ball_number?: number | null
          call_index?: number
          called_at?: string | null
          column_letter?: string
          completed_at?: string | null
          created_at?: string
          id?: number
          metadata_locked?: boolean
          metadata_synced_at?: string | null
          playlist_track_key?: string | null
          position?: string | null
          prep_started_at?: string | null
          session_id?: number
          side?: string | null
          status?: string
          track_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bingo_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bingo_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bingo_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bingo_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_session_game_playlists: {
        Row: {
          call_order: Json
          created_at: string
          id: number
          playlist_letter: string
          playlist_name: string
          round_number: number
          session_id: number
        }
        Insert: {
          call_order: Json
          created_at?: string
          id?: number
          playlist_letter: string
          playlist_name: string
          round_number: number
          session_id: number
        }
        Update: {
          call_order?: Json
          created_at?: string
          id?: number
          playlist_letter?: string
          playlist_name?: string
          round_number?: number
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bingo_session_crates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bingo_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_session_round_tracks: {
        Row: {
          album_name: string | null
          artist_name: string
          created_at: string
          id: number
          playlist_track_key: string
          position: string | null
          round_number: number
          session_id: number
          side: string | null
          slot_index: number
          source_playlist_id: number | null
          track_title: string
        }
        Insert: {
          album_name?: string | null
          artist_name: string
          created_at?: string
          id?: number
          playlist_track_key: string
          position?: string | null
          round_number: number
          session_id: number
          side?: string | null
          slot_index: number
          source_playlist_id?: number | null
          track_title: string
        }
        Update: {
          album_name?: string | null
          artist_name?: string
          created_at?: string
          id?: number
          playlist_track_key?: string
          position?: string | null
          round_number?: number
          session_id?: number
          side?: string | null
          slot_index?: number
          source_playlist_id?: number | null
          track_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bingo_session_round_tracks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bingo_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bingo_session_round_tracks_source_playlist_id_fkey"
            columns: ["source_playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_sessions: {
        Row: {
          active_playlist_letter_by_round: Json | null
          auto_advance: boolean
          bingo_overlay: string
          call_reveal_at: string | null
          call_reveal_delay_seconds: number
          card_count: number
          card_label_mode: string
          card_layout: string
          clip_seconds: number
          countdown_started_at: string | null
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          favorite_note: string | null
          game_mode: string
          game_preset_id: number | null
          host_buffer_seconds: number
          id: number
          intermission_footer_text: string | null
          intermission_heading_text: string | null
          intermission_message_text: string | null
          is_favorite: boolean
          master_playlist_ids: Json | null
          next_game_rules_text: string | null
          next_game_scheduled_at: string | null
          paused_at: string | null
          paused_remaining_seconds: number | null
          place_vinyl_seconds: number
          playlist_id: number | null
          playlist_ids: number[] | null
          pool_exhaustion_policy: string
          prep_buffer_seconds: number
          recent_calls_limit: number
          remove_resleeve_seconds: number
          round_count: number
          round_crate_ids: Json | null
          round_end_policy: string
          round_modes: Json | null
          round_playlist_ids: Json | null
          seconds_to_next_call: number
          session_code: string
          show_countdown: boolean
          show_logo: boolean
          show_rounds: boolean
          show_title: boolean
          songs_per_round: number
          sonos_output_delay_ms: number
          start_slide_seconds: number
          started_at: string | null
          status: string
          thanks_events_heading_text: string | null
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          tie_break_policy: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
          welcome_rules_text: string | null
          welcome_tiebreak_text: string | null
        }
        Insert: {
          active_playlist_letter_by_round?: Json | null
          auto_advance?: boolean
          bingo_overlay?: string
          call_reveal_at?: string | null
          call_reveal_delay_seconds?: number
          card_count?: number
          card_label_mode?: string
          card_layout?: string
          clip_seconds?: number
          countdown_started_at?: string | null
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          favorite_note?: string | null
          game_mode: string
          game_preset_id?: number | null
          host_buffer_seconds?: number
          id?: number
          intermission_footer_text?: string | null
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          is_favorite?: boolean
          master_playlist_ids?: Json | null
          next_game_rules_text?: string | null
          next_game_scheduled_at?: string | null
          paused_at?: string | null
          paused_remaining_seconds?: number | null
          place_vinyl_seconds?: number
          playlist_id?: number | null
          playlist_ids?: number[] | null
          pool_exhaustion_policy?: string
          prep_buffer_seconds?: number
          recent_calls_limit?: number
          remove_resleeve_seconds?: number
          round_count?: number
          round_crate_ids?: Json | null
          round_end_policy?: string
          round_modes?: Json | null
          round_playlist_ids?: Json | null
          seconds_to_next_call?: number
          session_code: string
          show_countdown?: boolean
          show_logo?: boolean
          show_rounds?: boolean
          show_title?: boolean
          songs_per_round?: number
          sonos_output_delay_ms?: number
          start_slide_seconds?: number
          started_at?: string | null
          status?: string
          thanks_events_heading_text?: string | null
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          tie_break_policy?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
          welcome_rules_text?: string | null
          welcome_tiebreak_text?: string | null
        }
        Update: {
          active_playlist_letter_by_round?: Json | null
          auto_advance?: boolean
          bingo_overlay?: string
          call_reveal_at?: string | null
          call_reveal_delay_seconds?: number
          card_count?: number
          card_label_mode?: string
          card_layout?: string
          clip_seconds?: number
          countdown_started_at?: string | null
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          favorite_note?: string | null
          game_mode?: string
          game_preset_id?: number | null
          host_buffer_seconds?: number
          id?: number
          intermission_footer_text?: string | null
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          is_favorite?: boolean
          master_playlist_ids?: Json | null
          next_game_rules_text?: string | null
          next_game_scheduled_at?: string | null
          paused_at?: string | null
          paused_remaining_seconds?: number | null
          place_vinyl_seconds?: number
          playlist_id?: number | null
          playlist_ids?: number[] | null
          pool_exhaustion_policy?: string
          prep_buffer_seconds?: number
          recent_calls_limit?: number
          remove_resleeve_seconds?: number
          round_count?: number
          round_crate_ids?: Json | null
          round_end_policy?: string
          round_modes?: Json | null
          round_playlist_ids?: Json | null
          seconds_to_next_call?: number
          session_code?: string
          show_countdown?: boolean
          show_logo?: boolean
          show_rounds?: boolean
          show_title?: boolean
          songs_per_round?: number
          sonos_output_delay_ms?: number
          start_slide_seconds?: number
          started_at?: string | null
          status?: string
          thanks_events_heading_text?: string | null
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          tie_break_policy?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
          welcome_rules_text?: string | null
          welcome_tiebreak_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bingo_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bingo_sessions_game_preset_id_fkey"
            columns: ["game_preset_id"]
            isOneToOne: false
            referencedRelation: "bingo_game_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bingo_sessions_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      cacc_session_calls: {
        Row: {
          artist: string
          asked_at: string | null
          audio_clue_source: string | null
          call_index: number
          created_at: string
          host_notes: string | null
          id: number
          release_year: number | null
          reveal_level_1_image_url: string
          reveal_level_2_image_url: string
          reveal_level_3_image_url: string
          revealed_at: string | null
          round_number: number
          scored_at: string | null
          session_id: number
          source_label: string | null
          stage_revealed: number
          status: string
          title: string
        }
        Insert: {
          artist: string
          asked_at?: string | null
          audio_clue_source?: string | null
          call_index: number
          created_at?: string
          host_notes?: string | null
          id?: number
          release_year?: number | null
          reveal_level_1_image_url: string
          reveal_level_2_image_url: string
          reveal_level_3_image_url: string
          revealed_at?: string | null
          round_number: number
          scored_at?: string | null
          session_id: number
          source_label?: string | null
          stage_revealed?: number
          status?: string
          title: string
        }
        Update: {
          artist?: string
          asked_at?: string | null
          audio_clue_source?: string | null
          call_index?: number
          created_at?: string
          host_notes?: string | null
          id?: number
          release_year?: number | null
          reveal_level_1_image_url?: string
          reveal_level_2_image_url?: string
          reveal_level_3_image_url?: string
          revealed_at?: string | null
          round_number?: number
          scored_at?: string | null
          session_id?: number
          source_label?: string | null
          stage_revealed?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cacc_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cacc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cacc_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "cacc_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cacc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cacc_session_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: number
          opened_at: string | null
          round_number: number
          round_title: string | null
          session_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number: number
          round_title?: string | null
          session_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number?: number
          round_title?: string | null
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cacc_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cacc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cacc_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cacc_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cacc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cacc_sessions: {
        Row: {
          audio_clue_enabled: boolean
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          final_reveal_points: number
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          remove_resleeve_seconds: number
          round_count: number
          session_code: string
          show_logo: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_stage_hint: boolean
          show_title: boolean
          stage_one_points: number
          stage_two_points: number
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          audio_clue_enabled?: boolean
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          final_reveal_points?: number
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code: string
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_stage_hint?: boolean
          show_title?: boolean
          stage_one_points?: number
          stage_two_points?: number
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          audio_clue_enabled?: boolean
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          final_reveal_points?: number
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code?: string
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_stage_hint?: boolean
          show_title?: boolean
          stage_one_points?: number
          stage_two_points?: number
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cacc_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      cacc_team_scores: {
        Row: {
          awarded_points: number
          call_id: number
          created_at: string
          exact_match: boolean
          guessed_artist: string | null
          guessed_at_stage: number | null
          guessed_title: string | null
          id: number
          notes: string | null
          scored_at: string
          scored_by: string | null
          session_id: number
          team_id: number
          used_audio_clue: boolean
        }
        Insert: {
          awarded_points?: number
          call_id: number
          created_at?: string
          exact_match?: boolean
          guessed_artist?: string | null
          guessed_at_stage?: number | null
          guessed_title?: string | null
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id: number
          team_id: number
          used_audio_clue?: boolean
        }
        Update: {
          awarded_points?: number
          call_id?: number
          created_at?: string
          exact_match?: boolean
          guessed_artist?: string | null
          guessed_at_stage?: number | null
          guessed_title?: string | null
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          team_id?: number
          used_audio_clue?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cacc_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "cacc_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cacc_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cacc_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cacc_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "cacc_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ccat_round_scores: {
        Row: {
          awarded_points: number
          created_at: string
          guess_summary: string | null
          id: number
          notes: string | null
          rationale: string | null
          round_id: number
          scored_at: string
          scored_by: string | null
          session_id: number
          team_id: number
        }
        Insert: {
          awarded_points?: number
          created_at?: string
          guess_summary?: string | null
          id?: number
          notes?: string | null
          rationale?: string | null
          round_id: number
          scored_at?: string
          scored_by?: string | null
          session_id: number
          team_id: number
        }
        Update: {
          awarded_points?: number
          created_at?: string
          guess_summary?: string | null
          id?: number
          notes?: string | null
          rationale?: string | null
          round_id?: number
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ccat_round_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "ccat_session_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ccat_round_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ccat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ccat_round_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "ccat_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ccat_session_calls: {
        Row: {
          artist: string
          asked_at: string | null
          call_index: number
          crate_tag: string | null
          created_at: string
          host_notes: string | null
          id: number
          release_year: number | null
          revealed_at: string | null
          round_number: number
          scored_at: string | null
          session_id: number
          source_label: string | null
          status: string
          title: string
          track_in_round: number
        }
        Insert: {
          artist: string
          asked_at?: string | null
          call_index: number
          crate_tag?: string | null
          created_at?: string
          host_notes?: string | null
          id?: number
          release_year?: number | null
          revealed_at?: string | null
          round_number: number
          scored_at?: string | null
          session_id: number
          source_label?: string | null
          status?: string
          title: string
          track_in_round: number
        }
        Update: {
          artist?: string
          asked_at?: string | null
          call_index?: number
          crate_tag?: string | null
          created_at?: string
          host_notes?: string | null
          id?: number
          release_year?: number | null
          revealed_at?: string | null
          round_number?: number
          scored_at?: string | null
          session_id?: number
          source_label?: string | null
          status?: string
          title?: string
          track_in_round?: number
        }
        Relationships: [
          {
            foreignKeyName: "ccat_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ccat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ccat_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ccat_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ccat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ccat_session_rounds: {
        Row: {
          category_label: string
          closed_at: string | null
          created_at: string
          id: number
          opened_at: string | null
          points_bonus: number
          points_correct: number
          prompt_type: string
          round_number: number
          session_id: number
          status: string
          tracks_in_round: number
        }
        Insert: {
          category_label: string
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          points_bonus?: number
          points_correct?: number
          prompt_type: string
          round_number: number
          session_id: number
          status?: string
          tracks_in_round?: number
        }
        Update: {
          category_label?: string
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          points_bonus?: number
          points_correct?: number
          prompt_type?: string
          round_number?: number
          session_id?: number
          status?: string
          tracks_in_round?: number
        }
        Relationships: [
          {
            foreignKeyName: "ccat_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ccat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ccat_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ccat_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ccat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ccat_sessions: {
        Row: {
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          default_tracks_per_round: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          remove_resleeve_seconds: number
          round_count: number
          session_code: string
          show_logo: boolean
          show_prompt: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_title: boolean
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          default_tracks_per_round?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code: string
          show_logo?: boolean
          show_prompt?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          default_tracks_per_round?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code?: string
          show_logo?: boolean
          show_prompt?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ccat_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_playlist_items: {
        Row: {
          created_at: string
          id: number
          playlist_id: number
          sort_order: number
          track_key: string
        }
        Insert: {
          created_at?: string
          id?: never
          playlist_id: number
          sort_order?: number
          track_key: string
        }
        Update: {
          created_at?: string
          id?: never
          playlist_id?: number
          sort_order?: number
          track_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_playlists: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: number
          is_smart: boolean
          live_update: boolean
          match_rules: string
          name: string
          smart_rules: Json | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: never
          is_smart?: boolean
          live_update?: boolean
          match_rules?: string
          name: string
          smart_rules?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: never
          is_smart?: boolean
          live_update?: boolean
          match_rules?: string
          name?: string
          smart_rules?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      crate_items: {
        Row: {
          added_at: string | null
          crate_id: number | null
          id: number
          inventory_id: number | null
          notes: string | null
          position: number | null
          track_key: string | null
        }
        Insert: {
          added_at?: string | null
          crate_id?: number | null
          id?: never
          inventory_id?: number | null
          notes?: string | null
          position?: number | null
          track_key?: string | null
        }
        Update: {
          added_at?: string | null
          crate_id?: number | null
          id?: never
          inventory_id?: number | null
          notes?: string | null
          position?: number | null
          track_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crate_items_crate_id_fkey"
            columns: ["crate_id"]
            isOneToOne: false
            referencedRelation: "crates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crate_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      crates: {
        Row: {
          color: string | null
          created_at: string | null
          game_source: string | null
          icon: string | null
          id: number
          is_smart: boolean | null
          live_update: boolean | null
          match_rules: string | null
          name: string
          smart_rules: Json | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          game_source?: string | null
          icon?: string | null
          id?: never
          is_smart?: boolean | null
          live_update?: boolean | null
          match_rules?: string | null
          name: string
          smart_rules?: Json | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          game_source?: string | null
          icon?: string | null
          id?: never
          is_smart?: boolean | null
          live_update?: boolean | null
          match_rules?: string | null
          name?: string
          smart_rules?: Json | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dd_session_calls: {
        Row: {
          accepted_adjacent_decades: Json
          artist: string | null
          asked_at: string | null
          call_index: number
          created_at: string
          decade_start: number
          host_notes: string | null
          id: number
          release_year: number | null
          revealed_at: string | null
          round_number: number
          scored_at: string | null
          session_id: number
          source_label: string | null
          status: string
          title: string | null
        }
        Insert: {
          accepted_adjacent_decades?: Json
          artist?: string | null
          asked_at?: string | null
          call_index: number
          created_at?: string
          decade_start: number
          host_notes?: string | null
          id?: number
          release_year?: number | null
          revealed_at?: string | null
          round_number: number
          scored_at?: string | null
          session_id: number
          source_label?: string | null
          status?: string
          title?: string | null
        }
        Update: {
          accepted_adjacent_decades?: Json
          artist?: string | null
          asked_at?: string | null
          call_index?: number
          created_at?: string
          decade_start?: number
          host_notes?: string | null
          id?: number
          release_year?: number | null
          revealed_at?: string | null
          round_number?: number
          scored_at?: string | null
          session_id?: number
          source_label?: string | null
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dd_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dd_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "dd_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dd_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_session_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: number
          opened_at: string | null
          round_number: number
          round_title: string | null
          session_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number: number
          round_title?: string | null
          session_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number?: number
          round_title?: string | null
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dd_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dd_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_sessions: {
        Row: {
          adjacent_points: number
          adjacent_scoring_enabled: boolean
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          exact_points: number
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          playlist_id: number | null
          remove_resleeve_seconds: number
          round_count: number
          session_code: string
          show_logo: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_scoring_hint: boolean
          show_title: boolean
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          adjacent_points?: number
          adjacent_scoring_enabled?: boolean
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          exact_points?: number
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code: string
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_scoring_hint?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          adjacent_points?: number
          adjacent_scoring_enabled?: boolean
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          exact_points?: number
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code?: string
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_scoring_hint?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dd_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_sessions_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_team_scores: {
        Row: {
          adjacent_match: boolean
          awarded_points: number
          call_id: number
          created_at: string
          exact_match: boolean
          id: number
          notes: string | null
          scored_at: string
          scored_by: string | null
          selected_decade: number | null
          session_id: number
          team_id: number
        }
        Insert: {
          adjacent_match?: boolean
          awarded_points?: number
          call_id: number
          created_at?: string
          exact_match?: boolean
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          selected_decade?: number | null
          session_id: number
          team_id: number
        }
        Update: {
          adjacent_match?: boolean
          awarded_points?: number
          call_id?: number
          created_at?: string
          exact_match?: boolean
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          selected_decade?: number | null
          session_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "dd_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "dd_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dd_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "dd_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_sets: {
        Row: {
          created_at: string | null
          description: string | null
          download_count: number | null
          download_url: string | null
          duration: number | null
          event_id: number | null
          file_size: number | null
          file_url: string
          google_drive_id: string | null
          id: number
          is_live: boolean | null
          recorded_at: string | null
          storage_provider: string | null
          tags: string[] | null
          title: string
          track_listing: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          download_url?: string | null
          duration?: number | null
          event_id?: number | null
          file_size?: number | null
          file_url: string
          google_drive_id?: string | null
          id?: never
          is_live?: boolean | null
          recorded_at?: string | null
          storage_provider?: string | null
          tags?: string[] | null
          title: string
          track_listing?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          download_url?: string | null
          duration?: number | null
          event_id?: number | null
          file_size?: number | null
          file_url?: string
          google_drive_id?: string | null
          id?: never
          is_live?: boolean | null
          recorded_at?: string | null
          storage_provider?: string | null
          tags?: string[] | null
          title?: string
          track_listing?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dj_sets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_field_diagnostics: {
        Row: {
          album_id: number
          created_at: string
          field_name: string
          has_candidate_value: boolean
          http_status: number | null
          id: number
          outcome_code: string
          reason: string | null
          returned_keys: string[]
          run_id: string
          source_name: string
        }
        Insert: {
          album_id: number
          created_at?: string
          field_name: string
          has_candidate_value?: boolean
          http_status?: number | null
          id?: never
          outcome_code: string
          reason?: string | null
          returned_keys?: string[]
          run_id: string
          source_name: string
        }
        Update: {
          album_id?: number
          created_at?: string
          field_name?: string
          has_candidate_value?: boolean
          http_status?: number | null
          id?: never
          outcome_code?: string
          reason?: string | null
          returned_keys?: string[]
          run_id?: string
          source_name?: string
        }
        Relationships: []
      }
      enrichment_run_logs: {
        Row: {
          album_artist: string | null
          album_id: number
          album_title: string | null
          applied_updates: Json | null
          checked_sources: string[]
          conflict_fields: string[]
          created_at: string
          id: number
          notes: string | null
          phase: string
          proposed_updates: Json | null
          returned_fields: string[]
          returned_sources: string[]
          run_id: string
          selected_fields: string[]
          source_payload: Json | null
          update_status: string
        }
        Insert: {
          album_artist?: string | null
          album_id: number
          album_title?: string | null
          applied_updates?: Json | null
          checked_sources?: string[]
          conflict_fields?: string[]
          created_at?: string
          id?: never
          notes?: string | null
          phase?: string
          proposed_updates?: Json | null
          returned_fields?: string[]
          returned_sources?: string[]
          run_id: string
          selected_fields?: string[]
          source_payload?: Json | null
          update_status?: string
        }
        Update: {
          album_artist?: string | null
          album_id?: number
          album_title?: string | null
          applied_updates?: Json | null
          checked_sources?: string[]
          conflict_fields?: string[]
          created_at?: string
          id?: never
          notes?: string | null
          phase?: string
          proposed_updates?: Json | null
          returned_fields?: string[]
          returned_sources?: string[]
          run_id?: string
          selected_fields?: string[]
          source_payload?: Json | null
          update_status?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          allowed_formats: string[] | null
          allowed_tags: string[] | null
          crate_id: number | null
          created_at: string | null
          date: string
          featured_priority: number | null
          has_queue: boolean | null
          id: number
          image_url: string | null
          info: string | null
          info_url: string | null
          is_featured_grid: boolean | null
          is_featured_upnext: boolean | null
          is_recurring: boolean | null
          location: string | null
          parent_event_id: number | null
          queue_types: string[] | null
          time: string
          title: string
          venue_logo_url: string | null
        }
        Insert: {
          allowed_formats?: string[] | null
          allowed_tags?: string[] | null
          crate_id?: number | null
          created_at?: string | null
          date: string
          featured_priority?: number | null
          has_queue?: boolean | null
          id?: never
          image_url?: string | null
          info?: string | null
          info_url?: string | null
          is_featured_grid?: boolean | null
          is_featured_upnext?: boolean | null
          is_recurring?: boolean | null
          location?: string | null
          parent_event_id?: number | null
          queue_types?: string[] | null
          time?: string
          title: string
          venue_logo_url?: string | null
        }
        Update: {
          allowed_formats?: string[] | null
          allowed_tags?: string[] | null
          crate_id?: number | null
          created_at?: string | null
          date?: string
          featured_priority?: number | null
          has_queue?: boolean | null
          id?: never
          image_url?: string | null
          info?: string | null
          info_url?: string | null
          is_featured_grid?: boolean | null
          is_featured_upnext?: boolean | null
          is_recurring?: boolean | null
          location?: string | null
          parent_event_id?: number | null
          queue_types?: string[] | null
          time?: string
          title?: string
          venue_logo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_crate_id_fkey"
            columns: ["crate_id"]
            isOneToOne: false
            referencedRelation: "crates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      format_abbreviations: {
        Row: {
          abbreviation: string
          category: string
          created_at: string | null
          created_by: string | null
          full_name: string
          id: number
          use_count: number | null
        }
        Insert: {
          abbreviation: string
          category: string
          created_at?: string | null
          created_by?: string | null
          full_name: string
          id?: never
          use_count?: number | null
        }
        Update: {
          abbreviation?: string
          category?: string
          created_at?: string | null
          created_by?: string | null
          full_name?: string
          id?: never
          use_count?: number | null
        }
        Relationships: []
      }
      gi_round_team_picks: {
        Row: {
          awarded_points: number
          created_at: string
          id: number
          imposter_correct: boolean
          locked_at: string | null
          picked_call_id: number
          reason_correct: boolean
          reason_text: string | null
          resolved_at: string | null
          round_id: number
          scored_by: string | null
          session_id: number
          team_id: number
        }
        Insert: {
          awarded_points?: number
          created_at?: string
          id?: number
          imposter_correct?: boolean
          locked_at?: string | null
          picked_call_id: number
          reason_correct?: boolean
          reason_text?: string | null
          resolved_at?: string | null
          round_id: number
          scored_by?: string | null
          session_id: number
          team_id: number
        }
        Update: {
          awarded_points?: number
          created_at?: string
          id?: number
          imposter_correct?: boolean
          locked_at?: string | null
          picked_call_id?: number
          reason_correct?: boolean
          reason_text?: string | null
          resolved_at?: string | null
          round_id?: number
          scored_by?: string | null
          session_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "gi_round_team_picks_picked_call_id_fkey"
            columns: ["picked_call_id"]
            isOneToOne: false
            referencedRelation: "gi_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gi_round_team_picks_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "gi_session_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gi_round_team_picks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "gi_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gi_round_team_picks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "gi_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      gi_session_calls: {
        Row: {
          artist: string | null
          call_index: number
          created_at: string
          cued_at: string | null
          fits_category: boolean
          host_notes: string | null
          id: number
          is_imposter: boolean
          metadata_locked: boolean
          metadata_synced_at: string | null
          play_order: number
          played_at: string | null
          playlist_track_key: string | null
          record_label: string | null
          revealed_at: string | null
          round_id: number
          round_number: number
          session_id: number
          source_label: string | null
          status: string
          title: string | null
        }
        Insert: {
          artist?: string | null
          call_index: number
          created_at?: string
          cued_at?: string | null
          fits_category?: boolean
          host_notes?: string | null
          id?: number
          is_imposter?: boolean
          metadata_locked?: boolean
          metadata_synced_at?: string | null
          play_order: number
          played_at?: string | null
          playlist_track_key?: string | null
          record_label?: string | null
          revealed_at?: string | null
          round_id: number
          round_number: number
          session_id: number
          source_label?: string | null
          status?: string
          title?: string | null
        }
        Update: {
          artist?: string | null
          call_index?: number
          created_at?: string
          cued_at?: string | null
          fits_category?: boolean
          host_notes?: string | null
          id?: number
          is_imposter?: boolean
          metadata_locked?: boolean
          metadata_synced_at?: string | null
          play_order?: number
          played_at?: string | null
          playlist_track_key?: string | null
          record_label?: string | null
          revealed_at?: string | null
          round_id?: number
          round_number?: number
          session_id?: number
          source_label?: string | null
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gi_session_calls_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "gi_session_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gi_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "gi_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gi_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "gi_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "gi_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gi_session_rounds: {
        Row: {
          category_card_note: string | null
          category_label: string
          closed_at: string | null
          created_at: string
          id: number
          imposter_call_index: number
          opened_at: string | null
          reason_key: string | null
          round_number: number
          session_id: number
          status: string
        }
        Insert: {
          category_card_note?: string | null
          category_label: string
          closed_at?: string | null
          created_at?: string
          id?: number
          imposter_call_index: number
          opened_at?: string | null
          reason_key?: string | null
          round_number: number
          session_id: number
          status?: string
        }
        Update: {
          category_card_note?: string | null
          category_label?: string
          closed_at?: string | null
          created_at?: string
          id?: number
          imposter_call_index?: number
          opened_at?: string | null
          reason_key?: string | null
          round_number?: number
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gi_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "gi_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gi_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "gi_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "gi_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gi_sessions: {
        Row: {
          countdown_started_at: string | null
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          imposter_points: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          paused_at: string | null
          paused_remaining_seconds: number | null
          playlist_id: number | null
          reason_bonus_points: number
          reason_mode: string
          remove_resleeve_seconds: number
          reveal_mode: string
          round_count: number
          session_code: string
          show_category: boolean
          show_logo: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_title: boolean
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          countdown_started_at?: string | null
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          imposter_points?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          paused_at?: string | null
          paused_remaining_seconds?: number | null
          playlist_id?: number | null
          reason_bonus_points?: number
          reason_mode?: string
          remove_resleeve_seconds?: number
          reveal_mode?: string
          round_count?: number
          session_code: string
          show_category?: boolean
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          countdown_started_at?: string | null
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          imposter_points?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          paused_at?: string | null
          paused_remaining_seconds?: number | null
          playlist_id?: number | null
          reason_bonus_points?: number
          reason_mode?: string
          remove_resleeve_seconds?: number
          reveal_mode?: string
          round_count?: number
          session_code?: string
          show_category?: boolean
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gi_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gi_sessions_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      gi_team_scores: {
        Row: {
          created_at: string
          id: number
          imposter_hits: number
          reason_bonus_hits: number
          session_id: number
          team_id: number
          total_points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          imposter_hits?: number
          reason_bonus_hits?: number
          session_id: number
          team_id: number
          total_points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          imposter_hits?: number
          reason_bonus_hits?: number
          session_id?: number
          team_id?: number
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gi_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "gi_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gi_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "gi_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      image_assets: {
        Row: {
          archived: boolean
          bucket_name: string | null
          created_at: string
          id: number
          image_kind: string
          label: string | null
          public_url: string
          source_type: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          bucket_name?: string | null
          created_at?: string
          id?: never
          image_kind: string
          label?: string | null
          public_url: string
          source_type: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          bucket_name?: string | null
          created_at?: string
          id?: never
          image_kind?: string
          label?: string | null
          public_url?: string
          source_type?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      import_conflict_resolutions: {
        Row: {
          album_id: number | null
          field_name: string
          id: number
          kept_value: Json | null
          rejected_value: Json | null
          resolution: string
          resolved_at: string | null
          source: string
        }
        Insert: {
          album_id?: number | null
          field_name: string
          id?: never
          kept_value?: Json | null
          rejected_value?: Json | null
          resolution: string
          resolved_at?: string | null
          source: string
        }
        Update: {
          album_id?: number | null
          field_name?: string
          id?: never
          kept_value?: Json | null
          rejected_value?: Json | null
          resolution?: string
          resolved_at?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_conflict_resolutions_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          id: number
          import_date: string | null
          notes: string | null
          records_added: number | null
          records_removed: number | null
          records_updated: number | null
          status: string | null
        }
        Insert: {
          id?: never
          import_date?: string | null
          notes?: string | null
          records_added?: number | null
          records_removed?: number | null
          records_updated?: number | null
          status?: string | null
        }
        Update: {
          id?: never
          import_date?: string | null
          notes?: string | null
          records_added?: number | null
          records_removed?: number | null
          records_updated?: number | null
          status?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          created_at: string | null
          current_value: number | null
          date_added: string | null
          discogs_folder_id: number | null
          discogs_folder_name: string | null
          discogs_instance_id: number | null
          id: number
          is_cleaned: boolean | null
          last_played_at: string | null
          location: string | null
          media_condition: string | null
          owner: string | null
          personal_notes: string | null
          play_count: number | null
          purchase_date: string | null
          purchase_price: number | null
          release_id: number | null
          sleeve_condition: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          date_added?: string | null
          discogs_folder_id?: number | null
          discogs_folder_name?: string | null
          discogs_instance_id?: number | null
          id?: never
          is_cleaned?: boolean | null
          last_played_at?: string | null
          location?: string | null
          media_condition?: string | null
          owner?: string | null
          personal_notes?: string | null
          play_count?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          release_id?: number | null
          sleeve_condition?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          date_added?: string | null
          discogs_folder_id?: number | null
          discogs_folder_name?: string | null
          discogs_instance_id?: number | null
          id?: never
          is_cleaned?: boolean | null
          last_played_at?: string | null
          location?: string | null
          media_condition?: string | null
          owner?: string | null
          personal_notes?: string | null
          play_count?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          release_id?: number | null
          sleeve_condition?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      lgr_session_calls: {
        Row: {
          accepted_answers: Json
          answer_lyric: string
          answer_revealed_at: string | null
          artist: string
          asked_at: string | null
          call_index: number
          created_at: string
          cue_lyric: string
          host_notes: string | null
          id: number
          round_number: number
          scored_at: string | null
          session_id: number
          source_label: string | null
          status: string
          title: string
        }
        Insert: {
          accepted_answers?: Json
          answer_lyric: string
          answer_revealed_at?: string | null
          artist: string
          asked_at?: string | null
          call_index: number
          created_at?: string
          cue_lyric: string
          host_notes?: string | null
          id?: number
          round_number: number
          scored_at?: string | null
          session_id: number
          source_label?: string | null
          status?: string
          title: string
        }
        Update: {
          accepted_answers?: Json
          answer_lyric?: string
          answer_revealed_at?: string | null
          artist?: string
          asked_at?: string | null
          call_index?: number
          created_at?: string
          cue_lyric?: string
          host_notes?: string | null
          id?: number
          round_number?: number
          scored_at?: string | null
          session_id?: number
          source_label?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgr_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lgr_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lgr_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "lgr_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lgr_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lgr_session_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: number
          opened_at: string | null
          round_number: number
          round_title: string | null
          session_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number: number
          round_title?: string | null
          session_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number?: number
          round_title?: string | null
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgr_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lgr_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lgr_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgr_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lgr_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lgr_sessions: {
        Row: {
          close_match_policy: string
          countdown_started_at: string | null
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          judge_mode: string
          paused_at: string | null
          paused_remaining_seconds: number | null
          playlist_id: number | null
          remove_resleeve_seconds: number
          round_count: number
          session_code: string
          show_answer_mode: boolean
          show_logo: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_title: boolean
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          close_match_policy?: string
          countdown_started_at?: string | null
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          judge_mode?: string
          paused_at?: string | null
          paused_remaining_seconds?: number | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code: string
          show_answer_mode?: boolean
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          close_match_policy?: string
          countdown_started_at?: string | null
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          judge_mode?: string
          paused_at?: string | null
          paused_remaining_seconds?: number | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code?: string
          show_answer_mode?: boolean
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lgr_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgr_sessions_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      lgr_team_scores: {
        Row: {
          awarded_points: number
          call_id: number
          close_match: boolean
          created_at: string
          exact_match: boolean
          id: number
          notes: string | null
          scored_at: string
          scored_by: string | null
          session_id: number
          team_id: number
        }
        Insert: {
          awarded_points?: number
          call_id: number
          close_match?: boolean
          created_at?: string
          exact_match?: boolean
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id: number
          team_id: number
        }
        Update: {
          awarded_points?: number
          call_id?: number
          close_match?: boolean
          created_at?: string
          exact_match?: boolean
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "lgr_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "lgr_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgr_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lgr_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgr_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lgr_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      master_tag_links: {
        Row: {
          master_id: number
          tag_id: number
        }
        Insert: {
          master_id: number
          tag_id: number
        }
        Update: {
          master_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "master_tag_links_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "master_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      master_tags: {
        Row: {
          category: string | null
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: never
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: never
          name?: string
        }
        Relationships: []
      }
      masters: {
        Row: {
          allmusic_rating: number | null
          allmusic_review: string | null
          allmusic_similar_albums: string[] | null
          allmusic_url: string | null
          apple_music_url: string | null
          awards: string[] | null
          certifications: string[] | null
          chart_positions: string[] | null
          chorus: string | null
          composer: string | null
          composition: string | null
          conductor: string | null
          cover_image_url: string | null
          created_at: string | null
          critical_reception: string | null
          cultural_significance: string | null
          custom_links: Json | null
          discogs_master_id: string | null
          engineers: string[] | null
          genius_url: string | null
          genres: string[] | null
          id: number
          lastfm_similar_albums: string[] | null
          lastfm_url: string | null
          main_artist_id: number | null
          master_release_date: string | null
          musicbrainz_release_group_id: string | null
          musicians: string[] | null
          notes: string | null
          orchestra: string | null
          original_release_year: number | null
          pitchfork_review: string | null
          pitchfork_score: number | null
          producers: string[] | null
          recording_date: string | null
          recording_location: string | null
          recording_year: number | null
          songwriters: string[] | null
          sort_title: string | null
          spotify_url: string | null
          styles: string[] | null
          subtitle: string | null
          title: string
          wikipedia_url: string | null
        }
        Insert: {
          allmusic_rating?: number | null
          allmusic_review?: string | null
          allmusic_similar_albums?: string[] | null
          allmusic_url?: string | null
          apple_music_url?: string | null
          awards?: string[] | null
          certifications?: string[] | null
          chart_positions?: string[] | null
          chorus?: string | null
          composer?: string | null
          composition?: string | null
          conductor?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          critical_reception?: string | null
          cultural_significance?: string | null
          custom_links?: Json | null
          discogs_master_id?: string | null
          engineers?: string[] | null
          genius_url?: string | null
          genres?: string[] | null
          id?: never
          lastfm_similar_albums?: string[] | null
          lastfm_url?: string | null
          main_artist_id?: number | null
          master_release_date?: string | null
          musicbrainz_release_group_id?: string | null
          musicians?: string[] | null
          notes?: string | null
          orchestra?: string | null
          original_release_year?: number | null
          pitchfork_review?: string | null
          pitchfork_score?: number | null
          producers?: string[] | null
          recording_date?: string | null
          recording_location?: string | null
          recording_year?: number | null
          songwriters?: string[] | null
          sort_title?: string | null
          spotify_url?: string | null
          styles?: string[] | null
          subtitle?: string | null
          title: string
          wikipedia_url?: string | null
        }
        Update: {
          allmusic_rating?: number | null
          allmusic_review?: string | null
          allmusic_similar_albums?: string[] | null
          allmusic_url?: string | null
          apple_music_url?: string | null
          awards?: string[] | null
          certifications?: string[] | null
          chart_positions?: string[] | null
          chorus?: string | null
          composer?: string | null
          composition?: string | null
          conductor?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          critical_reception?: string | null
          cultural_significance?: string | null
          custom_links?: Json | null
          discogs_master_id?: string | null
          engineers?: string[] | null
          genius_url?: string | null
          genres?: string[] | null
          id?: never
          lastfm_similar_albums?: string[] | null
          lastfm_url?: string | null
          main_artist_id?: number | null
          master_release_date?: string | null
          musicbrainz_release_group_id?: string | null
          musicians?: string[] | null
          notes?: string | null
          orchestra?: string | null
          original_release_year?: number | null
          pitchfork_review?: string | null
          pitchfork_score?: number | null
          producers?: string[] | null
          recording_date?: string | null
          recording_location?: string | null
          recording_year?: number | null
          songwriters?: string[] | null
          sort_title?: string | null
          spotify_url?: string | null
          styles?: string[] | null
          subtitle?: string | null
          title?: string
          wikipedia_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "masters_main_artist_id_fkey"
            columns: ["main_artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      most_wanted: {
        Row: {
          id: number
          rank: number | null
          title: string
          url: string | null
        }
        Insert: {
          id?: never
          rank?: number | null
          title: string
          url?: string | null
        }
        Update: {
          id?: never
          rank?: number | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      ndr_session_calls: {
        Row: {
          accepted_artist_aliases: Json
          accepted_title_aliases: Json
          answer_revealed_at: string | null
          artist_answer: string
          asked_at: string | null
          call_index: number
          created_at: string
          host_notes: string | null
          id: number
          round_number: number
          scored_at: string | null
          session_id: number
          snippet_duration_seconds: number
          snippet_start_seconds: number
          source_label: string | null
          status: string
          title_answer: string
        }
        Insert: {
          accepted_artist_aliases?: Json
          accepted_title_aliases?: Json
          answer_revealed_at?: string | null
          artist_answer: string
          asked_at?: string | null
          call_index: number
          created_at?: string
          host_notes?: string | null
          id?: number
          round_number: number
          scored_at?: string | null
          session_id: number
          snippet_duration_seconds?: number
          snippet_start_seconds?: number
          source_label?: string | null
          status?: string
          title_answer: string
        }
        Update: {
          accepted_artist_aliases?: Json
          accepted_title_aliases?: Json
          answer_revealed_at?: string | null
          artist_answer?: string
          asked_at?: string | null
          call_index?: number
          created_at?: string
          host_notes?: string | null
          id?: number
          round_number?: number
          scored_at?: string | null
          session_id?: number
          snippet_duration_seconds?: number
          snippet_start_seconds?: number
          source_label?: string | null
          status?: string
          title_answer?: string
        }
        Relationships: [
          {
            foreignKeyName: "ndr_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ndr_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ndr_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ndr_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ndr_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ndr_session_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          expected_calls: number
          id: number
          opened_at: string | null
          round_name: string
          round_number: number
          session_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          expected_calls?: number
          id?: number
          opened_at?: string | null
          round_name: string
          round_number: number
          session_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          expected_calls?: number
          id?: number
          opened_at?: string | null
          round_name?: string
          round_number?: number
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ndr_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ndr_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ndr_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ndr_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ndr_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ndr_sessions: {
        Row: {
          answer_mode: string
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          playlist_id: number | null
          remove_resleeve_seconds: number
          round_count: number
          session_code: string
          show_logo: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_title: boolean
          snippet_seconds: number
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          answer_mode?: string
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code: string
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          snippet_seconds?: number
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          answer_mode?: string
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code?: string
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          snippet_seconds?: number
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ndr_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ndr_sessions_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      ndr_team_scores: {
        Row: {
          artist_correct: boolean
          awarded_points: number
          call_id: number
          created_at: string
          id: number
          notes: string | null
          scored_at: string
          scored_by: string | null
          session_id: number
          team_id: number
          title_correct: boolean
        }
        Insert: {
          artist_correct?: boolean
          awarded_points?: number
          call_id: number
          created_at?: string
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id: number
          team_id: number
          title_correct?: boolean
        }
        Update: {
          artist_correct?: boolean
          awarded_points?: number
          call_id?: number
          created_at?: string
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          team_id?: number
          title_correct?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ndr_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "ndr_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ndr_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ndr_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ndr_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "ndr_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ntt_session_calls: {
        Row: {
          accepted_artist_aliases: Json
          accepted_title_aliases: Json
          answer_revealed_at: string | null
          artist_answer: string
          asked_at: string | null
          call_index: number
          created_at: string
          host_notes: string | null
          id: number
          metadata_locked: boolean
          metadata_synced_at: string | null
          playlist_track_key: string | null
          round_number: number
          scored_at: string | null
          session_id: number
          snippet_duration_seconds: number
          snippet_start_seconds: number
          source_label: string | null
          status: string
          title_answer: string
        }
        Insert: {
          accepted_artist_aliases?: Json
          accepted_title_aliases?: Json
          answer_revealed_at?: string | null
          artist_answer: string
          asked_at?: string | null
          call_index: number
          created_at?: string
          host_notes?: string | null
          id?: number
          metadata_locked?: boolean
          metadata_synced_at?: string | null
          playlist_track_key?: string | null
          round_number: number
          scored_at?: string | null
          session_id: number
          snippet_duration_seconds?: number
          snippet_start_seconds?: number
          source_label?: string | null
          status?: string
          title_answer: string
        }
        Update: {
          accepted_artist_aliases?: Json
          accepted_title_aliases?: Json
          answer_revealed_at?: string | null
          artist_answer?: string
          asked_at?: string | null
          call_index?: number
          created_at?: string
          host_notes?: string | null
          id?: number
          metadata_locked?: boolean
          metadata_synced_at?: string | null
          playlist_track_key?: string | null
          round_number?: number
          scored_at?: string | null
          session_id?: number
          snippet_duration_seconds?: number
          snippet_start_seconds?: number
          source_label?: string | null
          status?: string
          title_answer?: string
        }
        Relationships: [
          {
            foreignKeyName: "ntt_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ntt_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ntt_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ntt_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ntt_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ntt_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ntt_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ntt_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ntt_sessions: {
        Row: {
          countdown_started_at: string | null
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          lock_in_rule: string
          lock_in_window_seconds: number
          paused_at: string | null
          paused_remaining_seconds: number | null
          playlist_id: number | null
          remove_resleeve_seconds: number
          round_count: number
          session_code: string
          show_logo: boolean
          show_rounds: boolean
          show_scoreboard: boolean
          show_title: boolean
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          countdown_started_at?: string | null
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          lock_in_rule?: string
          lock_in_window_seconds?: number
          paused_at?: string | null
          paused_remaining_seconds?: number | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code: string
          show_logo?: boolean
          show_rounds?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          countdown_started_at?: string | null
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          lock_in_rule?: string
          lock_in_window_seconds?: number
          paused_at?: string | null
          paused_remaining_seconds?: number | null
          playlist_id?: number | null
          remove_resleeve_seconds?: number
          round_count?: number
          session_code?: string
          show_logo?: boolean
          show_rounds?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ntt_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ntt_sessions_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      ntt_team_scores: {
        Row: {
          artist_correct: boolean
          awarded_points: number
          call_id: number
          created_at: string
          id: number
          notes: string | null
          scored_at: string
          scored_by: string | null
          session_id: number
          team_id: number
          title_correct: boolean
        }
        Insert: {
          artist_correct?: boolean
          awarded_points?: number
          call_id: number
          created_at?: string
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id: number
          team_id: number
          title_correct?: boolean
        }
        Update: {
          artist_correct?: boolean
          awarded_points?: number
          call_id?: number
          created_at?: string
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          team_id?: number
          title_correct?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ntt_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "ntt_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ntt_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ntt_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ntt_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "ntt_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ooc_session_calls: {
        Row: {
          alt_accept_original_artist: string | null
          asked_at: string | null
          call_index: number
          created_at: string
          host_notes: string | null
          id: number
          is_cover: boolean
          original_artist: string
          release_year: number | null
          revealed_at: string | null
          round_number: number
          scored_at: string | null
          session_id: number
          source_label: string | null
          spin_artist: string
          status: string
          track_title: string
        }
        Insert: {
          alt_accept_original_artist?: string | null
          asked_at?: string | null
          call_index: number
          created_at?: string
          host_notes?: string | null
          id?: number
          is_cover: boolean
          original_artist: string
          release_year?: number | null
          revealed_at?: string | null
          round_number: number
          scored_at?: string | null
          session_id: number
          source_label?: string | null
          spin_artist: string
          status?: string
          track_title: string
        }
        Update: {
          alt_accept_original_artist?: string | null
          asked_at?: string | null
          call_index?: number
          created_at?: string
          host_notes?: string | null
          id?: number
          is_cover?: boolean
          original_artist?: string
          release_year?: number | null
          revealed_at?: string | null
          round_number?: number
          scored_at?: string | null
          session_id?: number
          source_label?: string | null
          spin_artist?: string
          status?: string
          track_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ooc_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ooc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ooc_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ooc_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ooc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ooc_session_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: number
          opened_at: string | null
          round_number: number
          round_title: string | null
          session_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number: number
          round_title?: string | null
          session_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number?: number
          round_title?: string | null
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ooc_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ooc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ooc_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ooc_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ooc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ooc_sessions: {
        Row: {
          bonus_original_artist_points: number
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          points_correct_call: number
          remove_resleeve_seconds: number
          round_count: number
          session_code: string
          show_logo: boolean
          show_prompt: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_title: boolean
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          bonus_original_artist_points?: number
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          points_correct_call?: number
          remove_resleeve_seconds?: number
          round_count?: number
          session_code: string
          show_logo?: boolean
          show_prompt?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          bonus_original_artist_points?: number
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          points_correct_call?: number
          remove_resleeve_seconds?: number
          round_count?: number
          session_code?: string
          show_logo?: boolean
          show_prompt?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ooc_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ooc_team_scores: {
        Row: {
          artist_bonus_awarded: boolean
          awarded_points: number
          call_correct: boolean
          call_id: number
          called_original: boolean | null
          created_at: string
          id: number
          named_original_artist: string | null
          notes: string | null
          scored_at: string
          scored_by: string | null
          session_id: number
          team_id: number
        }
        Insert: {
          artist_bonus_awarded?: boolean
          awarded_points?: number
          call_correct?: boolean
          call_id: number
          called_original?: boolean | null
          created_at?: string
          id?: number
          named_original_artist?: string | null
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id: number
          team_id: number
        }
        Update: {
          artist_bonus_awarded?: boolean
          awarded_points?: number
          call_correct?: boolean
          call_id?: number
          called_original?: boolean | null
          created_at?: string
          id?: number
          named_original_artist?: string | null
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ooc_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "ooc_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ooc_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ooc_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ooc_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "ooc_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          embed_url: string
          id: number
          platform: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          embed_url: string
          id?: never
          platform: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          embed_url?: string
          id?: never
          platform?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      recordings: {
        Row: {
          bpm: number | null
          created_at: string | null
          credits: Json | null
          danceability: number | null
          duration_seconds: number | null
          energy: number | null
          id: number
          is_cover: boolean | null
          isrc: string | null
          lyrics: string | null
          lyrics_url: string | null
          musical_key: string | null
          notes: string | null
          original_artist: string | null
          title: string | null
          track_artist: string | null
          valence: number | null
          work_id: number | null
        }
        Insert: {
          bpm?: number | null
          created_at?: string | null
          credits?: Json | null
          danceability?: number | null
          duration_seconds?: number | null
          energy?: number | null
          id?: never
          is_cover?: boolean | null
          isrc?: string | null
          lyrics?: string | null
          lyrics_url?: string | null
          musical_key?: string | null
          notes?: string | null
          original_artist?: string | null
          title?: string | null
          track_artist?: string | null
          valence?: number | null
          work_id?: number | null
        }
        Update: {
          bpm?: number | null
          created_at?: string | null
          credits?: Json | null
          danceability?: number | null
          duration_seconds?: number | null
          energy?: number | null
          id?: never
          is_cover?: boolean | null
          isrc?: string | null
          lyrics?: string | null
          lyrics_url?: string | null
          musical_key?: string | null
          notes?: string | null
          original_artist?: string | null
          title?: string | null
          track_artist?: string | null
          valence?: number | null
          work_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recordings_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      release_tracks: {
        Row: {
          id: number
          position: string
          recording_id: number | null
          release_id: number | null
          side: string | null
          title_override: string | null
        }
        Insert: {
          id?: never
          position: string
          recording_id?: number | null
          release_id?: number | null
          side?: string | null
          title_override?: string | null
        }
        Update: {
          id?: never
          position?: string
          recording_id?: number | null
          release_id?: number | null
          side?: string | null
          title_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "release_tracks_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_tracks_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      releases: {
        Row: {
          barcode: string | null
          box_set: string | null
          catalog_number: string | null
          country: string | null
          created_at: string | null
          disc_metadata: Json | null
          discogs_companies: Json | null
          discogs_formats: Json | null
          discogs_identifiers: Json | null
          discogs_release_id: string | null
          format_details: string[] | null
          id: number
          label: string | null
          master_id: number | null
          matrix_numbers: Json | null
          media_type: string
          notes: string | null
          packaging: string | null
          pressing_plant: string | null
          qty: number | null
          release_date: string | null
          release_year: number | null
          rpm: string | null
          sound: string | null
          spars_code: string | null
          spotify_album_id: string | null
          studio: string | null
          track_count: number | null
          vinyl_color: string[] | null
          vinyl_weight: string | null
        }
        Insert: {
          barcode?: string | null
          box_set?: string | null
          catalog_number?: string | null
          country?: string | null
          created_at?: string | null
          disc_metadata?: Json | null
          discogs_companies?: Json | null
          discogs_formats?: Json | null
          discogs_identifiers?: Json | null
          discogs_release_id?: string | null
          format_details?: string[] | null
          id?: never
          label?: string | null
          master_id?: number | null
          matrix_numbers?: Json | null
          media_type: string
          notes?: string | null
          packaging?: string | null
          pressing_plant?: string | null
          qty?: number | null
          release_date?: string | null
          release_year?: number | null
          rpm?: string | null
          sound?: string | null
          spars_code?: string | null
          spotify_album_id?: string | null
          studio?: string | null
          track_count?: number | null
          vinyl_color?: string[] | null
          vinyl_weight?: string | null
        }
        Update: {
          barcode?: string | null
          box_set?: string | null
          catalog_number?: string | null
          country?: string | null
          created_at?: string | null
          disc_metadata?: Json | null
          discogs_companies?: Json | null
          discogs_formats?: Json | null
          discogs_identifiers?: Json | null
          discogs_release_id?: string | null
          format_details?: string[] | null
          id?: never
          label?: string | null
          master_id?: number | null
          matrix_numbers?: Json | null
          media_type?: string
          notes?: string | null
          packaging?: string | null
          pressing_plant?: string | null
          qty?: number | null
          release_date?: string | null
          release_year?: number | null
          rpm?: string | null
          sound?: string | null
          spars_code?: string | null
          spotify_album_id?: string | null
          studio?: string | null
          track_count?: number | null
          vinyl_color?: string[] | null
          vinyl_weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "releases_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "masters"
            referencedColumns: ["id"]
          },
        ]
      }
      requests_v3: {
        Row: {
          artist_name: string | null
          created_at: string | null
          event_id: number | null
          id: string
          inventory_id: number | null
          recording_id: number | null
          status: string | null
          track_title: string | null
          votes: number | null
        }
        Insert: {
          artist_name?: string | null
          created_at?: string | null
          event_id?: number | null
          id?: string
          inventory_id?: number | null
          recording_id?: number | null
          status?: string | null
          track_title?: string | null
          votes?: number | null
        }
        Update: {
          artist_name?: string | null
          created_at?: string | null
          event_id?: number | null
          id?: string
          inventory_id?: number | null
          recording_id?: number | null
          status?: string | null
          track_title?: string | null
          votes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_v3_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_v3_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_v3_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      sd_session_calls: {
        Row: {
          asked_at: string | null
          call_index: number
          created_at: string
          host_notes: string | null
          id: number
          release_year: number | null
          revealed_at: string | null
          round_number: number
          sample_timestamp: string | null
          sampled_artist: string
          sampled_title: string
          scored_at: string | null
          session_id: number
          source_artist: string
          source_label: string | null
          source_title: string
          status: string
        }
        Insert: {
          asked_at?: string | null
          call_index: number
          created_at?: string
          host_notes?: string | null
          id?: number
          release_year?: number | null
          revealed_at?: string | null
          round_number: number
          sample_timestamp?: string | null
          sampled_artist: string
          sampled_title: string
          scored_at?: string | null
          session_id: number
          source_artist: string
          source_label?: string | null
          source_title: string
          status?: string
        }
        Update: {
          asked_at?: string | null
          call_index?: number
          created_at?: string
          host_notes?: string | null
          id?: number
          release_year?: number | null
          revealed_at?: string | null
          round_number?: number
          sample_timestamp?: string | null
          sampled_artist?: string
          sampled_title?: string
          scored_at?: string | null
          session_id?: number
          source_artist?: string
          source_label?: string | null
          source_title?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sd_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sd_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sd_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sd_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sd_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sd_session_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: number
          opened_at: string | null
          round_number: number
          round_title: string | null
          session_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number: number
          round_title?: string | null
          session_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number?: number
          round_title?: string | null
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sd_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sd_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sd_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sd_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sd_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sd_sessions: {
        Row: {
          bonus_both_artists_points: number
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          points_correct_pair: number
          remove_resleeve_seconds: number
          round_count: number
          session_code: string
          show_logo: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_scoring_hint: boolean
          show_title: boolean
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          bonus_both_artists_points?: number
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          points_correct_pair?: number
          remove_resleeve_seconds?: number
          round_count?: number
          session_code: string
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_scoring_hint?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          bonus_both_artists_points?: number
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          points_correct_pair?: number
          remove_resleeve_seconds?: number
          round_count?: number
          session_code?: string
          show_logo?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_scoring_hint?: boolean
          show_title?: boolean
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sd_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      sd_team_scores: {
        Row: {
          awarded_points: number
          both_artists_named: boolean
          call_id: number
          created_at: string
          guessed_sampled_artist: string | null
          guessed_sampled_title: string | null
          guessed_source_artist: string | null
          guessed_source_title: string | null
          id: number
          notes: string | null
          pair_correct: boolean
          scored_at: string
          scored_by: string | null
          session_id: number
          team_id: number
        }
        Insert: {
          awarded_points?: number
          both_artists_named?: boolean
          call_id: number
          created_at?: string
          guessed_sampled_artist?: string | null
          guessed_sampled_title?: string | null
          guessed_source_artist?: string | null
          guessed_source_title?: string | null
          id?: number
          notes?: string | null
          pair_correct?: boolean
          scored_at?: string
          scored_by?: string | null
          session_id: number
          team_id: number
        }
        Update: {
          awarded_points?: number
          both_artists_named?: boolean
          call_id?: number
          created_at?: string
          guessed_sampled_artist?: string | null
          guessed_sampled_title?: string | null
          guessed_source_artist?: string | null
          guessed_source_title?: string | null
          id?: number
          notes?: string | null
          pair_correct?: boolean
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sd_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "sd_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sd_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sd_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sd_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "sd_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      social_embeds: {
        Row: {
          created_at: string | null
          embed_html: string
          id: string
          platform: string
          visible: boolean | null
        }
        Insert: {
          created_at?: string | null
          embed_html: string
          id?: string
          platform: string
          visible?: boolean | null
        }
        Update: {
          created_at?: string | null
          embed_html?: string
          id?: string
          platform?: string
          visible?: boolean | null
        }
        Relationships: []
      }
      tournament_candidates: {
        Row: {
          artist: string
          cover_image: string | null
          created_at: string
          event_id: number
          id: number
          inventory_id: number | null
          is_write_in: boolean
          status: string
          title: string
          vote_count: number
        }
        Insert: {
          artist: string
          cover_image?: string | null
          created_at?: string
          event_id: number
          id?: number
          inventory_id?: number | null
          is_write_in?: boolean
          status?: string
          title: string
          vote_count?: number
        }
        Update: {
          artist?: string
          cover_image?: string | null
          created_at?: string
          event_id?: number
          id?: number
          inventory_id?: number | null
          is_write_in?: boolean
          status?: string
          title?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_candidates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_candidates_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_deck_items: {
        Row: {
          created_at: string
          deck_id: number
          id: number
          is_tiebreaker: boolean
          item_index: number
          locked: boolean
          question_id: number | null
          round_number: number
          snapshot_payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          deck_id: number
          id?: number
          is_tiebreaker?: boolean
          item_index: number
          locked?: boolean
          question_id?: number | null
          round_number?: number
          snapshot_payload?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          deck_id?: number
          id?: number
          is_tiebreaker?: boolean
          item_index?: number
          locked?: boolean
          question_id?: number | null
          round_number?: number
          snapshot_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trivia_deck_items_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "trivia_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trivia_deck_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "trivia_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_decks: {
        Row: {
          build_mode: string
          cooldown_days: number
          crate_id: number | null
          created_at: string
          created_by: string | null
          deck_code: string
          event_id: number | null
          id: number
          locked_at: string | null
          playlist_id: number | null
          rules_payload: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          build_mode?: string
          cooldown_days?: number
          crate_id?: number | null
          created_at?: string
          created_by?: string | null
          deck_code: string
          event_id?: number | null
          id?: number
          locked_at?: string | null
          playlist_id?: number | null
          rules_payload?: Json
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          build_mode?: string
          cooldown_days?: number
          crate_id?: number | null
          created_at?: string
          created_by?: string | null
          deck_code?: string
          event_id?: number | null
          id?: number
          locked_at?: string | null
          playlist_id?: number | null
          rules_payload?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trivia_decks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trivia_decks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_import_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: number
          notes_text: string | null
          run_code: string
          scope_payload: Json
          source_mode: string
          source_payload: Json
          started_at: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: number
          notes_text?: string | null
          run_code: string
          scope_payload?: Json
          source_mode?: string
          source_payload?: Json
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: number
          notes_text?: string | null
          run_code?: string
          scope_payload?: Json
          source_mode?: string
          source_payload?: Json
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      trivia_question_assets: {
        Row: {
          asset_role: string
          asset_type: string
          bucket: string
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          height: number | null
          id: number
          mime_type: string | null
          object_path: string
          question_id: number
          sort_order: number
          width: number | null
        }
        Insert: {
          asset_role?: string
          asset_type?: string
          bucket?: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: number
          mime_type?: string | null
          object_path: string
          question_id: number
          sort_order?: number
          width?: number | null
        }
        Update: {
          asset_role?: string
          asset_type?: string
          bucket?: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: number
          mime_type?: string | null
          object_path?: string
          question_id?: number
          sort_order?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trivia_question_assets_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "trivia_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_question_facets: {
        Row: {
          category: string
          decade: string | null
          difficulty: string
          era: string | null
          genre: string | null
          has_media: boolean
          has_required_cue: boolean
          language: string | null
          question_id: number
          region: string | null
        }
        Insert: {
          category?: string
          decade?: string | null
          difficulty?: string
          era?: string | null
          genre?: string | null
          has_media?: boolean
          has_required_cue?: boolean
          language?: string | null
          question_id: number
          region?: string | null
        }
        Update: {
          category?: string
          decade?: string | null
          difficulty?: string
          era?: string | null
          genre?: string | null
          has_media?: boolean
          has_required_cue?: boolean
          language?: string | null
          question_id?: number
          region?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trivia_question_facets_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "trivia_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_question_scopes: {
        Row: {
          created_at: string
          created_by: string | null
          display_label: string | null
          id: number
          question_id: number
          scope_ref_id: number | null
          scope_type: string
          scope_value: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_label?: string | null
          id?: number
          question_id: number
          scope_ref_id?: number | null
          scope_type: string
          scope_value?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_label?: string | null
          id?: number
          question_id?: number
          scope_ref_id?: number | null
          scope_type?: string
          scope_value?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trivia_question_scopes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "trivia_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_question_sources: {
        Row: {
          citation_excerpt: string | null
          claim_text: string | null
          created_at: string
          created_by: string | null
          id: number
          is_primary: boolean
          question_id: number
          relationship_type: string
          sort_order: number
          source_record_id: number
          updated_at: string
          verification_notes: string | null
        }
        Insert: {
          citation_excerpt?: string | null
          claim_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          is_primary?: boolean
          question_id: number
          relationship_type?: string
          sort_order?: number
          source_record_id: number
          updated_at?: string
          verification_notes?: string | null
        }
        Update: {
          citation_excerpt?: string | null
          claim_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          is_primary?: boolean
          question_id?: number
          relationship_type?: string
          sort_order?: number
          source_record_id?: number
          updated_at?: string
          verification_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trivia_question_sources_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "trivia_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trivia_question_sources_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "trivia_source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_question_tags: {
        Row: {
          created_at: string
          id: number
          question_id: number
          tag: string
        }
        Insert: {
          created_at?: string
          id?: number
          question_id: number
          tag: string
        }
        Update: {
          created_at?: string
          id?: number
          question_id?: number
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "trivia_question_tags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "trivia_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_questions: {
        Row: {
          accepted_answers: Json
          answer_key: string
          answer_payload: Json
          archived_at: string | null
          created_at: string
          created_by: string | null
          cue_notes_text: string | null
          cue_payload: Json
          cue_source_payload: Json
          cue_source_type: string | null
          default_category: string
          default_difficulty: string
          display_element_type: string
          explanation_text: string | null
          id: number
          is_tiebreaker_eligible: boolean
          options_payload: Json
          primary_cue_end_seconds: number | null
          primary_cue_instruction: string | null
          primary_cue_start_seconds: number | null
          prompt_text: string
          published_at: string | null
          question_code: string
          question_type: string
          reveal_payload: Json
          source_note: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accepted_answers?: Json
          answer_key?: string
          answer_payload?: Json
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          cue_notes_text?: string | null
          cue_payload?: Json
          cue_source_payload?: Json
          cue_source_type?: string | null
          default_category?: string
          default_difficulty?: string
          display_element_type?: string
          explanation_text?: string | null
          id?: number
          is_tiebreaker_eligible?: boolean
          options_payload?: Json
          primary_cue_end_seconds?: number | null
          primary_cue_instruction?: string | null
          primary_cue_start_seconds?: number | null
          prompt_text: string
          published_at?: string | null
          question_code: string
          question_type?: string
          reveal_payload?: Json
          source_note?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accepted_answers?: Json
          answer_key?: string
          answer_payload?: Json
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          cue_notes_text?: string | null
          cue_payload?: Json
          cue_source_payload?: Json
          cue_source_type?: string | null
          default_category?: string
          default_difficulty?: string
          display_element_type?: string
          explanation_text?: string | null
          id?: number
          is_tiebreaker_eligible?: boolean
          options_payload?: Json
          primary_cue_end_seconds?: number | null
          primary_cue_instruction?: string | null
          primary_cue_start_seconds?: number | null
          prompt_text?: string
          published_at?: string | null
          question_code?: string
          question_type?: string
          reveal_payload?: Json
          source_note?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      trivia_session_calls: {
        Row: {
          accepted_answers: Json
          answer_key: string
          answer_payload: Json
          answer_revealed_at: string | null
          asked_at: string | null
          auto_cover_art_url: string | null
          auto_vinyl_label_url: string | null
          base_points: number
          bonus_points: number
          call_index: number
          category: string
          created_at: string
          cue_notes_text: string | null
          cue_payload: Json
          cue_source_payload: Json
          cue_source_type: string | null
          difficulty: string
          display_element_type: string
          display_image_override_url: string | null
          explanation_text: string | null
          id: number
          is_tiebreaker: boolean
          metadata_locked: boolean
          metadata_synced_at: string | null
          options_payload: Json
          playlist_track_key: string | null
          prep_status: string
          primary_cue_end_seconds: number | null
          primary_cue_instruction: string | null
          primary_cue_start_seconds: number | null
          question_id: number | null
          question_text: string
          question_type: string
          reveal_payload: Json
          round_number: number
          scored_at: string | null
          session_id: number
          source_album: string | null
          source_artist: string | null
          source_note: string | null
          source_position: string | null
          source_side: string | null
          source_title: string | null
          status: string
        }
        Insert: {
          accepted_answers?: Json
          answer_key: string
          answer_payload?: Json
          answer_revealed_at?: string | null
          asked_at?: string | null
          auto_cover_art_url?: string | null
          auto_vinyl_label_url?: string | null
          base_points?: number
          bonus_points?: number
          call_index: number
          category: string
          created_at?: string
          cue_notes_text?: string | null
          cue_payload?: Json
          cue_source_payload?: Json
          cue_source_type?: string | null
          difficulty: string
          display_element_type?: string
          display_image_override_url?: string | null
          explanation_text?: string | null
          id?: number
          is_tiebreaker?: boolean
          metadata_locked?: boolean
          metadata_synced_at?: string | null
          options_payload?: Json
          playlist_track_key?: string | null
          prep_status?: string
          primary_cue_end_seconds?: number | null
          primary_cue_instruction?: string | null
          primary_cue_start_seconds?: number | null
          question_id?: number | null
          question_text: string
          question_type?: string
          reveal_payload?: Json
          round_number: number
          scored_at?: string | null
          session_id: number
          source_album?: string | null
          source_artist?: string | null
          source_note?: string | null
          source_position?: string | null
          source_side?: string | null
          source_title?: string | null
          status?: string
        }
        Update: {
          accepted_answers?: Json
          answer_key?: string
          answer_payload?: Json
          answer_revealed_at?: string | null
          asked_at?: string | null
          auto_cover_art_url?: string | null
          auto_vinyl_label_url?: string | null
          base_points?: number
          bonus_points?: number
          call_index?: number
          category?: string
          created_at?: string
          cue_notes_text?: string | null
          cue_payload?: Json
          cue_source_payload?: Json
          cue_source_type?: string | null
          difficulty?: string
          display_element_type?: string
          display_image_override_url?: string | null
          explanation_text?: string | null
          id?: number
          is_tiebreaker?: boolean
          metadata_locked?: boolean
          metadata_synced_at?: string | null
          options_payload?: Json
          playlist_track_key?: string | null
          prep_status?: string
          primary_cue_end_seconds?: number | null
          primary_cue_instruction?: string | null
          primary_cue_start_seconds?: number | null
          question_id?: number | null
          question_text?: string
          question_type?: string
          reveal_payload?: Json
          round_number?: number
          scored_at?: string | null
          session_id?: number
          source_album?: string | null
          source_artist?: string | null
          source_note?: string | null
          source_position?: string | null
          source_side?: string | null
          source_title?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trivia_session_calls_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "trivia_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trivia_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trivia_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "trivia_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trivia_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "trivia_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trivia_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_sessions: {
        Row: {
          countdown_started_at: string | null
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          deck_id: number | null
          difficulty_easy_target: number
          difficulty_hard_target: number
          difficulty_medium_target: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          max_teams: number | null
          paused_at: string | null
          paused_remaining_seconds: number | null
          playlist_id: number | null
          question_categories: string[]
          questions_per_round: number
          remove_resleeve_seconds: number
          round_count: number
          score_mode: string
          session_code: string
          show_cue_hints: boolean
          show_leaderboard: boolean
          show_logo: boolean
          show_question_counter: boolean
          show_rounds: boolean
          show_title: boolean
          slips_batch_size: number | null
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          tie_breaker_count: number
          title: string
          trivia_overlay: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          countdown_started_at?: string | null
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          deck_id?: number | null
          difficulty_easy_target?: number
          difficulty_hard_target?: number
          difficulty_medium_target?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          max_teams?: number | null
          paused_at?: string | null
          paused_remaining_seconds?: number | null
          playlist_id?: number | null
          question_categories?: string[]
          questions_per_round?: number
          remove_resleeve_seconds?: number
          round_count?: number
          score_mode?: string
          session_code: string
          show_cue_hints?: boolean
          show_leaderboard?: boolean
          show_logo?: boolean
          show_question_counter?: boolean
          show_rounds?: boolean
          show_title?: boolean
          slips_batch_size?: number | null
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          tie_breaker_count?: number
          title: string
          trivia_overlay?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          countdown_started_at?: string | null
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          deck_id?: number | null
          difficulty_easy_target?: number
          difficulty_hard_target?: number
          difficulty_medium_target?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          max_teams?: number | null
          paused_at?: string | null
          paused_remaining_seconds?: number | null
          playlist_id?: number | null
          question_categories?: string[]
          questions_per_round?: number
          remove_resleeve_seconds?: number
          round_count?: number
          score_mode?: string
          session_code?: string
          show_cue_hints?: boolean
          show_leaderboard?: boolean
          show_logo?: boolean
          show_question_counter?: boolean
          show_rounds?: boolean
          show_title?: boolean
          slips_batch_size?: number | null
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          tie_breaker_count?: number
          title?: string
          trivia_overlay?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trivia_sessions_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "trivia_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trivia_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trivia_sessions_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "collection_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_source_records: {
        Row: {
          claim_text: string | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          excerpt_text: string | null
          fetched_at: string | null
          id: number
          import_run_id: number | null
          metadata_payload: Json
          published_at: string | null
          source_domain: string | null
          source_kind: string
          source_title: string | null
          source_url: string | null
          updated_at: string
          verification_notes: string | null
          verification_status: string
        }
        Insert: {
          claim_text?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          excerpt_text?: string | null
          fetched_at?: string | null
          id?: number
          import_run_id?: number | null
          metadata_payload?: Json
          published_at?: string | null
          source_domain?: string | null
          source_kind?: string
          source_title?: string | null
          source_url?: string | null
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string
        }
        Update: {
          claim_text?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          excerpt_text?: string | null
          fetched_at?: string | null
          id?: number
          import_run_id?: number | null
          metadata_payload?: Json
          published_at?: string | null
          source_domain?: string | null
          source_kind?: string
          source_title?: string | null
          source_url?: string | null
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trivia_source_records_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "trivia_import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_team_scores: {
        Row: {
          awarded_points: number
          call_id: number
          correct: boolean
          created_at: string
          id: number
          notes: string | null
          scored_at: string
          scored_by: string | null
          session_id: number
          team_id: number
        }
        Insert: {
          awarded_points?: number
          call_id: number
          correct?: boolean
          created_at?: string
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id: number
          team_id: number
        }
        Update: {
          awarded_points?: number
          call_id?: number
          correct?: boolean
          created_at?: string
          id?: number
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "trivia_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "trivia_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trivia_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trivia_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trivia_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "trivia_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      wantlist: {
        Row: {
          artist: string
          artist_album_norm: string | null
          artist_norm: string | null
          cover_image: string | null
          date_added_to_wantlist: string | null
          discogs_master_id: string | null
          discogs_release_id: string | null
          format: string | null
          id: number
          notes: string | null
          title: string
          title_norm: string | null
          year: string | null
        }
        Insert: {
          artist: string
          artist_album_norm?: string | null
          artist_norm?: string | null
          cover_image?: string | null
          date_added_to_wantlist?: string | null
          discogs_master_id?: string | null
          discogs_release_id?: string | null
          format?: string | null
          id?: never
          notes?: string | null
          title: string
          title_norm?: string | null
          year?: string | null
        }
        Update: {
          artist?: string
          artist_album_norm?: string | null
          artist_norm?: string | null
          cover_image?: string | null
          date_added_to_wantlist?: string | null
          discogs_master_id?: string | null
          discogs_release_id?: string | null
          format?: string | null
          id?: never
          notes?: string | null
          title?: string
          title_norm?: string | null
          year?: string | null
        }
        Relationships: []
      }
      wlc_session_calls: {
        Row: {
          answer_slot: number
          artist: string
          asked_at: string | null
          call_index: number
          correct_lyric: string
          created_at: string
          decoy_lyric_1: string
          decoy_lyric_2: string
          decoy_lyric_3: string | null
          dj_cue_hint: string | null
          host_notes: string | null
          id: number
          revealed_at: string | null
          round_number: number
          scored_at: string | null
          session_id: number
          source_label: string | null
          status: string
          title: string
        }
        Insert: {
          answer_slot?: number
          artist: string
          asked_at?: string | null
          call_index: number
          correct_lyric: string
          created_at?: string
          decoy_lyric_1: string
          decoy_lyric_2: string
          decoy_lyric_3?: string | null
          dj_cue_hint?: string | null
          host_notes?: string | null
          id?: number
          revealed_at?: string | null
          round_number: number
          scored_at?: string | null
          session_id: number
          source_label?: string | null
          status?: string
          title: string
        }
        Update: {
          answer_slot?: number
          artist?: string
          asked_at?: string | null
          call_index?: number
          correct_lyric?: string
          created_at?: string
          decoy_lyric_1?: string
          decoy_lyric_2?: string
          decoy_lyric_3?: string | null
          dj_cue_hint?: string | null
          host_notes?: string | null
          id?: number
          revealed_at?: string | null
          round_number?: number
          scored_at?: string | null
          session_id?: number
          source_label?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "wlc_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "wlc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      wlc_session_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload: Json | null
          session_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload?: Json | null
          session_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "wlc_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "wlc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      wlc_session_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: number
          opened_at: string | null
          round_number: number
          round_title: string | null
          session_id: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number: number
          round_title?: string | null
          session_id: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: number
          opened_at?: string | null
          round_number?: number
          round_title?: string | null
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wlc_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "wlc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      wlc_session_teams: {
        Row: {
          active: boolean
          created_at: string
          id: number
          session_id: number
          table_label: string | null
          team_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          session_id: number
          table_label?: string | null
          team_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          session_id?: number
          table_label?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "wlc_session_teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "wlc_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      wlc_sessions: {
        Row: {
          created_at: string
          cue_seconds: number
          current_call_index: number
          current_round: number
          default_intermission_seconds: number
          ended_at: string | null
          event_id: number | null
          find_record_seconds: number
          host_buffer_seconds: number
          id: number
          intermission_heading_text: string | null
          intermission_message_text: string | null
          lyric_points: number
          option_count: number
          remove_resleeve_seconds: number
          reveal_mode: string
          round_count: number
          session_code: string
          show_logo: boolean
          show_options: boolean
          show_round: boolean
          show_scoreboard: boolean
          show_title: boolean
          song_bonus_enabled: boolean
          song_bonus_points: number
          started_at: string | null
          status: string
          target_gap_seconds: number
          thanks_heading_text: string | null
          thanks_subheading_text: string | null
          title: string
          welcome_heading_text: string | null
          welcome_message_text: string | null
        }
        Insert: {
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          lyric_points?: number
          option_count?: number
          remove_resleeve_seconds?: number
          reveal_mode?: string
          round_count?: number
          session_code: string
          show_logo?: boolean
          show_options?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          song_bonus_enabled?: boolean
          song_bonus_points?: number
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Update: {
          created_at?: string
          cue_seconds?: number
          current_call_index?: number
          current_round?: number
          default_intermission_seconds?: number
          ended_at?: string | null
          event_id?: number | null
          find_record_seconds?: number
          host_buffer_seconds?: number
          id?: number
          intermission_heading_text?: string | null
          intermission_message_text?: string | null
          lyric_points?: number
          option_count?: number
          remove_resleeve_seconds?: number
          reveal_mode?: string
          round_count?: number
          session_code?: string
          show_logo?: boolean
          show_options?: boolean
          show_round?: boolean
          show_scoreboard?: boolean
          show_title?: boolean
          song_bonus_enabled?: boolean
          song_bonus_points?: number
          started_at?: string | null
          status?: string
          target_gap_seconds?: number
          thanks_heading_text?: string | null
          thanks_subheading_text?: string | null
          title?: string
          welcome_heading_text?: string | null
          welcome_message_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wlc_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      wlc_team_scores: {
        Row: {
          awarded_points: number
          call_id: number
          created_at: string
          guessed_artist: string | null
          guessed_option: number | null
          guessed_title: string | null
          id: number
          lyric_correct: boolean
          notes: string | null
          scored_at: string
          scored_by: string | null
          session_id: number
          song_bonus_awarded: boolean
          team_id: number
        }
        Insert: {
          awarded_points?: number
          call_id: number
          created_at?: string
          guessed_artist?: string | null
          guessed_option?: number | null
          guessed_title?: string | null
          id?: number
          lyric_correct?: boolean
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id: number
          song_bonus_awarded?: boolean
          team_id: number
        }
        Update: {
          awarded_points?: number
          call_id?: number
          created_at?: string
          guessed_artist?: string | null
          guessed_option?: number | null
          guessed_title?: string | null
          id?: number
          lyric_correct?: boolean
          notes?: string | null
          scored_at?: string
          scored_by?: string | null
          session_id?: number
          song_bonus_awarded?: boolean
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "wlc_team_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "wlc_session_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wlc_team_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "wlc_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wlc_team_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "wlc_session_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          created_at: string | null
          id: number
          iswc: string | null
          original_release_year: number | null
          primary_artist_id: number | null
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          iswc?: string | null
          original_release_year?: number | null
          primary_artist_id?: number | null
          title: string
        }
        Update: {
          created_at?: string | null
          id?: never
          iswc?: string | null
          original_release_year?: number | null
          primary_artist_id?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "works_primary_artist_id_fkey"
            columns: ["primary_artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      enrichment_pattern_stats: {
        Row: {
          dominant_outcome_code: string | null
          dominant_outcome_count: number | null
          dominant_outcome_pct: number | null
          field_name: string | null
          pattern_flag: boolean | null
          run_id: string | null
          source_name: string | null
          total_albums_checked: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_game_manifest: {
        Args: { session_id: number }
        Returns: {
          crate_id: number
          crate_name: string
          game_session_id: number
          inventory_id: number
          inventory_location: string
        }[]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

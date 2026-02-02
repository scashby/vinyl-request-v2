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
    };
  };
}

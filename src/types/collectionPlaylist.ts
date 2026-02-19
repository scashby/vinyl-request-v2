export interface CollectionPlaylist {
  id: number;
  name: string;
  icon: string;
  color: string;
  trackKeys: string[];
  createdAt: string;
  sortOrder: number;
  isSmart: boolean;
  smartRules: SmartPlaylistRules | null;
  matchRules: 'all' | 'any';
  liveUpdate: boolean;
}

export interface SmartPlaylistRules {
  rules: SmartPlaylistRule[];
  maxTracks?: number | null;
  selectedBy?:
    | 'random'
    | 'album'
    | 'artist'
    | 'genre'
    | 'title'
    | 'highest_rating'
    | 'lowest_rating'
    | 'most_recently_played'
    | 'least_recently_played'
    | 'most_often_played'
    | 'least_often_played'
    | 'most_recently_added'
    | 'least_recently_added';
}

export interface SmartPlaylistRule {
  field: SmartPlaylistFieldType;
  operator: SmartPlaylistOperatorType;
  value: SmartPlaylistRuleValue;
}

export type SmartPlaylistRuleValue =
  | string
  | number
  | boolean
  | {
      min: string | number;
      max: string | number;
    };

export type SmartPlaylistFieldType =
  | 'track_title'
  | 'track_artist'
  | 'album_title'
  | 'album_artist'
  | 'position'
  | 'side'
  | 'album_format'
  | 'duration_seconds'
  // Album / release fields
  | 'format'
  | 'country'
  | 'location'
  | 'status'
  | 'barcode'
  | 'catalog_number'
  | 'label'
  | 'owner'
  | 'personal_notes'
  | 'release_notes'
  | 'master_notes'
  | 'media_condition'
  | 'sleeve_condition'
  | 'package_sleeve_condition'
  | 'packaging'
  | 'studio'
  | 'sound'
  | 'vinyl_weight'
  | 'rpm'
  | 'spars_code'
  | 'box_set'
  | 'purchase_store'
  | 'notes'
  | 'composer'
  | 'conductor'
  | 'chorus'
  | 'composition'
  | 'orchestra'
  // Number fields
  | 'year_int'
  | 'decade'
  | 'my_rating'
  | 'play_count'
  | 'discs'
  | 'sides'
  | 'index_number'
  | 'purchase_price'
  | 'current_value'
  // Date fields
  | 'date_added'
  | 'purchase_date'
  | 'last_played_at'
  | 'last_cleaned_date'
  | 'original_release_date'
  | 'recording_date'
  // Boolean fields
  | 'for_sale'
  | 'is_live'
  // Array fields
  | 'custom_tags'
  | 'genre'
  | 'labels'
  | 'signed_by'
  | 'songwriters'
  | 'producers'
  | 'engineers'
  | 'musicians';

export type SmartPlaylistOperatorType =
  | 'contains'
  | 'is'
  | 'is_not'
  | 'does_not_contain'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal_to'
  | 'less_than_or_equal_to'
  | 'between'
  | 'before'
  | 'after'
  | 'includes'
  | 'excludes';

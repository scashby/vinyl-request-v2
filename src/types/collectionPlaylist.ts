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
}

export interface SmartPlaylistRule {
  field: SmartPlaylistFieldType;
  operator: SmartPlaylistOperatorType;
  value: string | number | boolean;
}

export type SmartPlaylistFieldType =
  | 'track_title'
  | 'track_artist'
  | 'album_title'
  | 'album_artist'
  | 'position'
  | 'side'
  | 'album_format'
  | 'duration_seconds';

export type SmartPlaylistOperatorType =
  | 'contains'
  | 'is'
  | 'is_not'
  | 'does_not_contain'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal_to'
  | 'less_than_or_equal_to';

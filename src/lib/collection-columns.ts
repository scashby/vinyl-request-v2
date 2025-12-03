// src/lib/collection-columns.ts

export type ColumnId =
  | 'image'
  | 'artist'
  | 'title'
  | 'year'
  | 'format'
  | 'folder'
  | 'media_condition'
  | 'custom_tags'
  | 'for_sale'
  | 'sale_price'
  | 'sale_platform'
  | 'sale_quantity'
  | 'date_added'
  | 'decade'
  | 'sides'
  | 'discogs_genres'
  | 'discogs_styles'
  | 'spotify_genres'
  | 'apple_music_genres'
  | 'spotify_label'
  | 'apple_music_label'
  | 'apple_music_genre'
  | 'spotify_popularity'
  | 'spotify_total_tracks'
  | 'apple_music_track_count'
  | 'is_1001'
  | 'steves_top_200'
  | 'this_weeks_top_10'
  | 'inner_circle_preferred'
  | 'is_box_set'
  | 'blocked'
  | 'blocked_sides'
  | 'discogs_master_id'
  | 'discogs_release_id'
  | 'spotify_id'
  | 'apple_music_id'
  | 'purchase_date'
  | 'purchase_store'
  | 'purchase_price'
  | 'current_value'
  | 'owner'
  | 'play_count'
  | 'last_cleaned_date'
  | 'signed_by'
  | 'wholesale_cost'
  | 'discogs_price_min'
  | 'discogs_price_median'
  | 'discogs_price_max'
  | 'discogs_price_updated_at'
  | 'master_release_date'
  | 'spotify_release_date'
  | 'apple_music_release_date'
  | 'last_enriched_at'
  | 'year_int'
  | 'artist_norm'
  | 'album_norm';

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  width: number;
  sortable: boolean;
  searchable: boolean;
}

export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  // Main Info
  { id: 'image', label: 'Image', width: 80, sortable: false, searchable: false },
  { id: 'artist', label: 'Artist', width: 200, sortable: true, searchable: true },
  { id: 'title', label: 'Title', width: 250, sortable: true, searchable: true },
  { id: 'year', label: 'Year', width: 80, sortable: true, searchable: true },
  { id: 'format', label: 'Format', width: 120, sortable: true, searchable: true },
  { id: 'folder', label: 'Folder', width: 150, sortable: true, searchable: true },

  // Details
  { id: 'media_condition', label: 'Condition', width: 100, sortable: true, searchable: true },
  { id: 'sides', label: 'Sides', width: 80, sortable: true, searchable: false },
  { id: 'decade', label: 'Decade', width: 100, sortable: true, searchable: true },
  { id: 'date_added', label: 'Date Added', width: 120, sortable: true, searchable: false },
  { id: 'discogs_genres', label: 'Genres', width: 200, sortable: false, searchable: true },
  { id: 'discogs_styles', label: 'Styles', width: 200, sortable: false, searchable: true },
  { id: 'spotify_genres', label: 'Spotify Genres', width: 200, sortable: false, searchable: true },
  { id: 'apple_music_genres', label: 'Apple Genres', width: 200, sortable: false, searchable: true },
  { id: 'spotify_label', label: 'Spotify Label', width: 150, sortable: true, searchable: true },
  { id: 'apple_music_label', label: 'Apple Label', width: 150, sortable: true, searchable: true },
  { id: 'apple_music_genre', label: 'Apple Genre', width: 150, sortable: true, searchable: true },
  { id: 'spotify_popularity', label: 'Popularity', width: 100, sortable: true, searchable: false },
  { id: 'spotify_total_tracks', label: 'Spotify Tracks', width: 120, sortable: true, searchable: false },
  { id: 'apple_music_track_count', label: 'Apple Tracks', width: 120, sortable: true, searchable: false },

  // Personal
  { id: 'purchase_date', label: 'Purchase Date', width: 120, sortable: true, searchable: false },
  { id: 'purchase_store', label: 'Purchase Store', width: 150, sortable: true, searchable: true },
  { id: 'purchase_price', label: 'Purchase Price', width: 120, sortable: true, searchable: false },
  { id: 'current_value', label: 'Current Value', width: 120, sortable: true, searchable: false },
  { id: 'owner', label: 'Owner', width: 120, sortable: true, searchable: true },
  { id: 'play_count', label: 'Play Count', width: 100, sortable: true, searchable: false },
  { id: 'last_cleaned_date', label: 'Last Cleaned', width: 120, sortable: true, searchable: false },
  { id: 'signed_by', label: 'Signed By', width: 150, sortable: false, searchable: true },

  // Collection
  { id: 'custom_tags', label: 'Tags', width: 200, sortable: false, searchable: true },
  { id: 'is_1001', label: '1001 Albums', width: 120, sortable: true, searchable: false },
  { id: 'steves_top_200', label: "Steve's Top 200", width: 140, sortable: true, searchable: false },
  { id: 'this_weeks_top_10', label: 'Top 10', width: 100, sortable: true, searchable: false },
  { id: 'inner_circle_preferred', label: 'Inner Circle', width: 120, sortable: true, searchable: false },
  { id: 'is_box_set', label: 'Box Set', width: 100, sortable: true, searchable: false },
  { id: 'blocked', label: 'Blocked', width: 100, sortable: true, searchable: false },
  { id: 'blocked_sides', label: 'Blocked Sides', width: 150, sortable: false, searchable: true },

  // Sale
  { id: 'for_sale', label: 'For Sale', width: 100, sortable: true, searchable: false },
  { id: 'sale_price', label: 'Sale Price', width: 120, sortable: true, searchable: false },
  { id: 'sale_platform', label: 'Platform', width: 120, sortable: true, searchable: true },
  { id: 'sale_quantity', label: 'Quantity', width: 100, sortable: true, searchable: false },
  { id: 'wholesale_cost', label: 'Wholesale Cost', width: 130, sortable: true, searchable: false },

  // Pricing Data
  { id: 'discogs_price_min', label: 'Discogs Min', width: 120, sortable: true, searchable: false },
  { id: 'discogs_price_median', label: 'Discogs Median', width: 130, sortable: true, searchable: false },
  { id: 'discogs_price_max', label: 'Discogs Max', width: 120, sortable: true, searchable: false },
  { id: 'discogs_price_updated_at', label: 'Price Updated', width: 140, sortable: true, searchable: false },

  // Advanced
  { id: 'discogs_master_id', label: 'Master ID', width: 120, sortable: false, searchable: true },
  { id: 'discogs_release_id', label: 'Release ID', width: 120, sortable: false, searchable: true },
  { id: 'spotify_id', label: 'Spotify ID', width: 120, sortable: false, searchable: true },
  { id: 'apple_music_id', label: 'Apple ID', width: 120, sortable: false, searchable: true },
  { id: 'master_release_date', label: 'Master Release', width: 130, sortable: true, searchable: false },
  { id: 'spotify_release_date', label: 'Spotify Release', width: 130, sortable: true, searchable: false },
  { id: 'apple_music_release_date', label: 'Apple Release', width: 130, sortable: true, searchable: false },
  { id: 'last_enriched_at', label: 'Last Enriched', width: 140, sortable: true, searchable: false },
  { id: 'year_int', label: 'Year (Int)', width: 100, sortable: true, searchable: false },
  { id: 'artist_norm', label: 'Artist (Normalized)', width: 200, sortable: true, searchable: false },
  { id: 'album_norm', label: 'Album (Normalized)', width: 200, sortable: true, searchable: false }
];

export interface ColumnGroup {
  id: string;
  label: string;
  icon: string;
  color: string;
  columns: ColumnId[];
}

export const COLUMN_GROUPS: ColumnGroup[] = [
  {
    id: 'main',
    label: 'Main Info',
    icon: '🎵',
    color: '#3b82f6',
    columns: ['image', 'artist', 'title', 'year', 'format', 'folder']
  },
  {
    id: 'details',
    label: 'Details',
    icon: '📋',
    color: '#8b5cf6',
    columns: [
      'media_condition',
      'sides',
      'decade',
      'date_added',
      'discogs_genres',
      'discogs_styles',
      'spotify_genres',
      'apple_music_genres',
      'spotify_label',
      'apple_music_label',
      'apple_music_genre',
      'spotify_popularity',
      'spotify_total_tracks',
      'apple_music_track_count'
    ]
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: '👤',
    color: '#ec4899',
    columns: [
      'purchase_date',
      'purchase_store',
      'purchase_price',
      'current_value',
      'owner',
      'play_count',
      'last_cleaned_date',
      'signed_by'
    ]
  },
  {
    id: 'collection',
    label: 'Collection',
    icon: '🏷️',
    color: '#10b981',
    columns: [
      'custom_tags',
      'is_1001',
      'steves_top_200',
      'this_weeks_top_10',
      'inner_circle_preferred',
      'is_box_set',
      'blocked',
      'blocked_sides'
    ]
  },
  {
    id: 'sale',
    label: 'Sale Info',
    icon: '💰',
    color: '#f59e0b',
    columns: [
      'for_sale',
      'sale_price',
      'sale_platform',
      'sale_quantity',
      'wholesale_cost',
      'discogs_price_min',
      'discogs_price_median',
      'discogs_price_max',
      'discogs_price_updated_at'
    ]
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: '🔧',
    color: '#6b7280',
    columns: [
      'discogs_master_id',
      'discogs_release_id',
      'spotify_id',
      'apple_music_id',
      'master_release_date',
      'spotify_release_date',
      'apple_music_release_date',
      'last_enriched_at',
      'year_int',
      'artist_norm',
      'album_norm'
    ]
  }
];

export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  'image',
  'artist',
  'title',
  'year',
  'format',
  'folder'
];

export function getColumnById(id: ColumnId): ColumnDefinition | undefined {
  return COLUMN_DEFINITIONS.find(col => col.id === id);
}

export function getColumnsByGroup(groupId: string): ColumnDefinition[] {
  const group = COLUMN_GROUPS.find(g => g.id === groupId);
  if (!group) return [];
  
  return group.columns
    .map(colId => getColumnById(colId))
    .filter((col): col is ColumnDefinition => col !== undefined);
}
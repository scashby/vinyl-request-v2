// src/lib/collection-columns.ts
// Complete column definitions with full CLZ Music Web compatibility

import { Album } from '../types/album';

export type ColumnId = keyof Album;

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  width: number;
  sortable: boolean;
  searchable: boolean;
  description?: string;
}

export interface ColumnGroup {
  id: string;
  label: string;
  icon: string;
  color: string;
  columns: ColumnId[];
  description?: string;
}

// ============================================================================
// COLUMN DEFINITIONS BY CATEGORY
// ============================================================================

export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  // CORE IDENTIFICATION
  { id: 'id', label: 'ID', width: 80, sortable: true, searchable: false },
  { id: 'image_url', label: 'Cover', width: 80, sortable: false, searchable: false },
  { id: 'artist', label: 'Artist', width: 200, sortable: true, searchable: true },
  { id: 'title', label: 'Title', width: 250, sortable: true, searchable: true },
  { id: 'sort_title', label: 'Sort Title', width: 250, sortable: true, searchable: true, description: 'Title formatted for alphabetization' },
  { id: 'subtitle', label: 'Subtitle', width: 200, sortable: true, searchable: true },
  { id: 'year', label: 'Year', width: 80, sortable: true, searchable: true },
  { id: 'year_int', label: 'Year (Int)', width: 100, sortable: true, searchable: false },
  { id: 'barcode', label: 'Barcode', width: 150, sortable: true, searchable: true, description: 'UPC/EAN barcode' },
  { id: 'cat_no', label: 'Catalog #', width: 120, sortable: true, searchable: true },
  { id: 'index_number', label: 'Index', width: 80, sortable: true, searchable: false, description: 'CLZ index number' },

  // PHYSICAL DETAILS
  { id: 'format', label: 'Format', width: 120, sortable: true, searchable: true },
  { id: 'folder', label: 'Folder', width: 150, sortable: true, searchable: true },
  { id: 'discs', label: 'Discs', width: 80, sortable: true, searchable: false, description: 'Number of physical discs' },
  { id: 'sides', label: 'Sides', width: 80, sortable: true, searchable: false, description: 'Sides per disc' },
  { id: 'length_seconds', label: 'Length', width: 100, sortable: true, searchable: false },
  { id: 'tracklists', label: 'Tracklist', width: 150, sortable: false, searchable: true },
  
  // CONDITION
  { id: 'media_condition', label: 'Media Condition', width: 120, sortable: true, searchable: true },
  { id: 'package_sleeve_condition', label: 'Sleeve Condition', width: 140, sortable: true, searchable: true },
  
  // VINYL SPECIFIC
  { id: 'vinyl_color', label: 'Vinyl Color', width: 120, sortable: true, searchable: true },
  { id: 'vinyl_weight', label: 'Vinyl Weight', width: 100, sortable: true, searchable: true },
  { id: 'rpm', label: 'RPM', width: 80, sortable: true, searchable: true },
  
  // TECHNICAL
  { id: 'sound', label: 'Sound', width: 100, sortable: true, searchable: true, description: 'Mono/Stereo/Quad' },
  { id: 'spars_code', label: 'SPARS', width: 80, sortable: true, searchable: true },
  { id: 'packaging', label: 'Packaging', width: 120, sortable: true, searchable: true },
  
  // RELEASE INFO
  { id: 'original_release_date', label: 'Original Release', width: 130, sortable: true, searchable: false },
  { id: 'original_release_year', label: 'Original Year', width: 110, sortable: true, searchable: false },
  { id: 'recording_date', label: 'Recording Date', width: 130, sortable: true, searchable: false },
  { id: 'recording_year', label: 'Recording Year', width: 120, sortable: true, searchable: false },
  { id: 'master_release_date', label: 'Master Release', width: 130, sortable: true, searchable: false },
  { id: 'country', label: 'Country', width: 100, sortable: true, searchable: true },
  { id: 'studio', label: 'Studio', width: 150, sortable: true, searchable: true },
  
  // COLLECTION STATUS
  { id: 'collection_status', label: 'Status', width: 130, sortable: true, searchable: true },
  { id: 'for_sale', label: 'For Sale', width: 100, sortable: true, searchable: false },
  { id: 'is_box_set', label: 'Box Set', width: 100, sortable: true, searchable: false },
  { id: 'is_live', label: 'Live Album', width: 100, sortable: true, searchable: false },
  { id: 'parent_id', label: 'Parent ID', width: 100, sortable: false, searchable: true },
  { id: 'child_album_ids', label: 'Child Albums', width: 120, sortable: false, searchable: false },
  
  // DWD FLAGS
  { id: 'is_1001', label: '1001 Albums', width: 120, sortable: true, searchable: false },
  { id: 'steves_top_200', label: "Steve's Top 200", width: 140, sortable: true, searchable: false },
  { id: 'this_weeks_top_10', label: 'Top 10', width: 100, sortable: true, searchable: false },
  { id: 'inner_circle_preferred', label: 'Inner Circle', width: 120, sortable: true, searchable: false },
  { id: 'blocked', label: 'Blocked', width: 100, sortable: true, searchable: false },
  { id: 'blocked_sides', label: 'Blocked Sides', width: 150, sortable: false, searchable: true },
  { id: 'blocked_tracks', label: 'Blocked Tracks', width: 150, sortable: false, searchable: true },
  
  // SALES & PRICING
  { id: 'sale_price', label: 'Sale Price', width: 120, sortable: true, searchable: false },
  { id: 'sale_platform', label: 'Platform', width: 120, sortable: true, searchable: true },
  { id: 'sale_quantity', label: 'Quantity', width: 100, sortable: true, searchable: false },
  { id: 'sale_notes', label: 'Sale Notes', width: 200, sortable: false, searchable: true },
  { id: 'sell_price', label: 'Sell Price', width: 120, sortable: true, searchable: false },
  { id: 'wholesale_cost', label: 'Wholesale Cost', width: 130, sortable: true, searchable: false },
  { id: 'discogs_price_min', label: 'Discogs Min', width: 120, sortable: true, searchable: false },
  { id: 'discogs_price_median', label: 'Discogs Median', width: 130, sortable: true, searchable: false },
  { id: 'discogs_price_max', label: 'Discogs Max', width: 120, sortable: true, searchable: false },
  { id: 'discogs_price_updated_at', label: 'Price Updated', width: 140, sortable: true, searchable: false },
  { id: 'pricing_notes', label: 'Pricing Notes', width: 200, sortable: false, searchable: true },
  
  // PURCHASE
  { id: 'purchase_date', label: 'Purchase Date', width: 120, sortable: true, searchable: false },
  { id: 'purchase_store', label: 'Purchase Store', width: 150, sortable: true, searchable: true },
  { id: 'purchase_price', label: 'Purchase Price', width: 120, sortable: true, searchable: false },
  { id: 'current_value', label: 'Current Value', width: 120, sortable: true, searchable: false },
  
  // PERSONAL
  { id: 'owner', label: 'Owner', width: 120, sortable: true, searchable: true },
  { id: 'my_rating', label: 'My Rating', width: 100, sortable: true, searchable: false },
  { id: 'play_count', label: 'Play Count', width: 100, sortable: true, searchable: false },
  { id: 'last_played_date', label: 'Last Played', width: 120, sortable: true, searchable: false },
  { id: 'last_cleaned_date', label: 'Last Cleaned', width: 120, sortable: true, searchable: false },
  { id: 'signed_by', label: 'Signed By', width: 150, sortable: false, searchable: true },
  { id: 'location', label: 'Location', width: 120, sortable: true, searchable: true },
  { id: 'storage_device_slot', label: 'Storage Slot', width: 120, sortable: true, searchable: true },
  
  // DATES
  { id: 'date_added', label: 'Date Added', width: 120, sortable: true, searchable: false },
  { id: 'modified_date', label: 'Modified Date', width: 140, sortable: true, searchable: false },
  { id: 'decade', label: 'Decade', width: 100, sortable: true, searchable: true },
  
  // GENRES
  // UPDATED: Replaced discogs_ columns with canonical genres/styles
  { id: 'genres', label: 'Genres', width: 200, sortable: false, searchable: true },
  { id: 'styles', label: 'Styles', width: 200, sortable: false, searchable: true },
  { id: 'spotify_genres', label: 'Spotify Genres', width: 200, sortable: false, searchable: true },
  { id: 'apple_music_genres', label: 'Apple Genres', width: 200, sortable: false, searchable: true },
  { id: 'apple_music_genre', label: 'Apple Genre', width: 150, sortable: true, searchable: true },
  
  // LABELS
  { id: 'spotify_label', label: 'Spotify Label', width: 150, sortable: true, searchable: true },
  { id: 'apple_music_label', label: 'Apple Label', width: 150, sortable: true, searchable: true },
  
  // EXTERNAL IDS - DISCOGS
  { id: 'discogs_master_id', label: 'Master ID', width: 120, sortable: false, searchable: true },
  { id: 'discogs_release_id', label: 'Release ID', width: 120, sortable: false, searchable: true },
  { id: 'master_release_id', label: 'Master Release ID', width: 140, sortable: false, searchable: true },
  { id: 'discogs_source', label: 'Discogs Source', width: 150, sortable: false, searchable: true },
  { id: 'discogs_notes', label: 'Discogs Notes', width: 200, sortable: false, searchable: true },
  
  // EXTERNAL IDS - SPOTIFY
  { id: 'spotify_id', label: 'Spotify ID', width: 120, sortable: false, searchable: true },
  { id: 'spotify_url', label: 'Spotify URL', width: 150, sortable: false, searchable: false },
  { id: 'spotify_popularity', label: 'Popularity', width: 100, sortable: true, searchable: false },
  { id: 'spotify_release_date', label: 'Spotify Release', width: 130, sortable: true, searchable: false },
  { id: 'spotify_total_tracks', label: 'Spotify Tracks', width: 120, sortable: true, searchable: false },
  { id: 'spotify_image_url', label: 'Spotify Image', width: 150, sortable: false, searchable: false },
  
  // EXTERNAL IDS - APPLE MUSIC
  { id: 'apple_music_id', label: 'Apple ID', width: 120, sortable: false, searchable: true },
  { id: 'apple_music_url', label: 'Apple URL', width: 150, sortable: false, searchable: false },
  { id: 'apple_music_release_date', label: 'Apple Release', width: 130, sortable: true, searchable: false },
  { id: 'apple_music_track_count', label: 'Apple Tracks', width: 120, sortable: true, searchable: false },
  { id: 'apple_music_artwork_url', label: 'Apple Artwork', width: 150, sortable: false, searchable: false },
  
  // ENRICHMENT
  { id: 'last_enriched_at', label: 'Last Enriched', width: 140, sortable: true, searchable: false },
  { id: 'enrichment_sources', label: 'Enrichment Sources', width: 180, sortable: false, searchable: true },
  
  // TAGS & NOTES
  { id: 'custom_tags', label: 'Tags', width: 200, sortable: false, searchable: true },
  { id: 'notes', label: 'Notes', width: 250, sortable: false, searchable: true },
  { id: 'extra', label: 'Extra Info', width: 200, sortable: false, searchable: true },
  
  // PEOPLE
  { id: 'engineers', label: 'Engineers', width: 180, sortable: false, searchable: true },
  { id: 'musicians', label: 'Musicians', width: 180, sortable: false, searchable: true },
  { id: 'producers', label: 'Producers', width: 180, sortable: false, searchable: true },
  { id: 'songwriters', label: 'Songwriters', width: 180, sortable: false, searchable: true },
  
  // CLASSICAL
  { id: 'chorus', label: 'Chorus', width: 150, sortable: true, searchable: true },
  { id: 'composer', label: 'Composer', width: 180, sortable: true, searchable: true },
  { id: 'composition', label: 'Composition', width: 200, sortable: true, searchable: true },
  { id: 'conductor', label: 'Conductor', width: 150, sortable: true, searchable: true },
  { id: 'orchestra', label: 'Orchestra', width: 180, sortable: true, searchable: true },
  
  // LOAN TRACKING
  { id: 'due_date', label: 'Due Date', width: 120, sortable: true, searchable: false },
  { id: 'loan_date', label: 'Loan Date', width: 120, sortable: true, searchable: false },
  { id: 'loaned_to', label: 'Loaned To', width: 150, sortable: true, searchable: true },
  
  // NORMALIZED
  { id: 'artist_norm', label: 'Artist (Norm)', width: 200, sortable: true, searchable: false },
  { id: 'album_norm', label: 'Album (Norm)', width: 200, sortable: true, searchable: false },
  { id: 'title_norm', label: 'Title (Norm)', width: 200, sortable: true, searchable: false },
  { id: 'artist_album_norm', label: 'Artist+Album (Norm)', width: 250, sortable: true, searchable: false },
];

// ============================================================================
// COLUMN GROUPS
// ============================================================================

export const COLUMN_GROUPS: ColumnGroup[] = [
  {
    id: 'essential',
    label: 'Essential',
    icon: '⭐',
    color: '#f59e0b',
    description: 'Core fields you always need',
    columns: ['image_url', 'artist', 'title', 'year', 'format', 'folder']
  },
  {
    id: 'identification',
    label: 'Identification',
    icon: '🔖',
    color: '#3b82f6',
    description: 'Barcodes, catalog numbers, and IDs',
    columns: ['id', 'barcode', 'cat_no', 'index_number', 'sort_title', 'subtitle']
  },
  {
    id: 'physical',
    label: 'Physical Details',
    icon: '💿',
    color: '#8b5cf6',
    description: 'Physical characteristics of the media',
    columns: [
      'discs',
      'sides',
      'length_seconds',
      'vinyl_color',
      'vinyl_weight',
      'rpm',
      'sound',
      'spars_code',
      'packaging',
      'tracklists'
    ]
  },
  {
    id: 'condition',
    label: 'Condition',
    icon: '⭐',
    color: '#10b981',
    description: 'Media and packaging condition',
    columns: ['media_condition', 'package_sleeve_condition']
  },
  {
    id: 'release',
    label: 'Release Info',
    icon: '📅',
    color: '#06b6d4',
    description: 'Release dates and recording info',
    columns: [
      'original_release_date',
      'original_release_year',
      'recording_date',
      'recording_year',
      'master_release_date',
      'country',
      'studio',
      'decade'
    ]
  },
  {
    id: 'collection',
    label: 'Collection Status',
    icon: '📚',
    color: '#ec4899',
    description: 'Collection management and flags',
    columns: [
      'collection_status',
      'for_sale',
      'is_box_set',
      'is_live',
      'parent_id',
      'child_album_ids',
      'is_1001',
      'steves_top_200',
      'this_weeks_top_10',
      'inner_circle_preferred',
      'blocked',
      'blocked_sides',
      'blocked_tracks'
    ]
  },
  {
    id: 'sales',
    label: 'Sales & Pricing',
    icon: '💰',
    color: '#22c55e',
    description: 'Sales info and pricing data',
    columns: [
      'sale_price',
      'sale_platform',
      'sale_quantity',
      'sale_notes',
      'sell_price',
      'wholesale_cost',
      'discogs_price_min',
      'discogs_price_median',
      'discogs_price_max',
      'discogs_price_updated_at',
      'pricing_notes'
    ]
  },
  {
    id: 'purchase',
    label: 'Purchase & Value',
    icon: '🛒',
    color: '#14b8a6',
    description: 'Purchase history and current value',
    columns: ['purchase_date', 'purchase_store', 'purchase_price', 'current_value']
  },
  {
    id: 'personal',
    label: 'Personal Tracking',
    icon: '👤',
    color: '#f43f5e',
    description: 'Your personal data and ratings',
    columns: [
      'owner',
      'my_rating',
      'play_count',
      'last_played_date',
      'last_cleaned_date',
      'signed_by',
      'location',
      'storage_device_slot'
    ]
  },
  {
    id: 'dates',
    label: 'Dates',
    icon: '📆',
    color: '#a855f7',
    description: 'Date tracking',
    columns: ['date_added', 'modified_date']
  },
  {
    id: 'metadata',
    label: 'Metadata',
    icon: '🎵',
    color: '#6366f1',
    description: 'Genres, styles, and labels',
    columns: [
      'genres', // UPDATED
      'styles', // UPDATED
      'spotify_genres',
      'apple_music_genres',
      'apple_music_genre',
      'spotify_label',
      'apple_music_label'
    ]
  },
  {
    id: 'discogs',
    label: 'Discogs',
    icon: '🔗',
    color: '#ea580c',
    description: 'Discogs integration',
    columns: [
      'discogs_master_id',
      'discogs_release_id',
      'master_release_id',
      'discogs_source',
      'discogs_notes'
    ]
  },
  {
    id: 'spotify',
    label: 'Spotify',
    icon: '🎧',
    color: '#22c55e',
    description: 'Spotify integration',
    columns: [
      'spotify_id',
      'spotify_url',
      'spotify_popularity',
      'spotify_release_date',
      'spotify_total_tracks',
      'spotify_image_url'
    ]
  },
  {
    id: 'apple',
    label: 'Apple Music',
    icon: '🍎',
    color: '#f43f5e',
    description: 'Apple Music integration',
    columns: [
      'apple_music_id',
      'apple_music_url',
      'apple_music_release_date',
      'apple_music_track_count',
      'apple_music_artwork_url'
    ]
  },
  {
    id: 'enrichment',
    label: 'Enrichment',
    icon: '✨',
    color: '#8b5cf6',
    description: 'Metadata enrichment tracking',
    columns: ['last_enriched_at', 'enrichment_sources']
  },
  {
    id: 'notes',
    label: 'Notes & Tags',
    icon: '📝',
    color: '#f59e0b',
    description: 'Custom notes and tags',
    columns: ['custom_tags', 'notes', 'extra']
  },
  {
    id: 'people',
    label: 'People & Credits',
    icon: '👥',
    color: '#06b6d4',
    description: 'Musicians, producers, engineers, etc.',
    columns: ['engineers', 'musicians', 'producers', 'songwriters']
  },
  {
    id: 'classical',
    label: 'Classical Music',
    icon: '🎻',
    color: '#ec4899',
    description: 'Classical music specific fields',
    columns: ['chorus', 'composer', 'composition', 'conductor', 'orchestra']
  },
  {
    id: 'loans',
    label: 'Loan Tracking',
    icon: '📤',
    color: '#14b8a6',
    description: 'Track loaned albums',
    columns: ['due_date', 'loan_date', 'loaned_to']
  },
  {
    id: 'normalized',
    label: 'Normalized Fields',
    icon: '🔧',
    color: '#6b7280',
    description: 'Search optimization fields',
    columns: ['artist_norm', 'album_norm', 'title_norm', 'artist_album_norm']
  }
];

// ============================================================================
// DEFAULT VISIBLE COLUMNS
// ============================================================================

export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  'image_url',
  'artist',
  'title',
  'year',
  'format',
  'media_condition',
  'custom_tags'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getColumnById(id: ColumnId): ColumnDefinition | undefined {
  return COLUMN_DEFINITIONS.find((col) => col.id === id);
}

export function getColumnsByGroup(groupId: string): ColumnDefinition[] {
  const group = COLUMN_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];

  return group.columns
    .map((colId) => getColumnById(colId))
    .filter((col): col is ColumnDefinition => col !== undefined);
}

export function getAllSearchableColumns(): ColumnDefinition[] {
  return COLUMN_DEFINITIONS.filter((col) => col.searchable);
}

export function getAllSortableColumns(): ColumnDefinition[] {
  return COLUMN_DEFINITIONS.filter((col) => col.sortable);
}
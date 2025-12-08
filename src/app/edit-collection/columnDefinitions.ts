// src/app/edit-collection/columnDefinitions.ts

export type ColumnId =
  // Main
  | 'checkbox'
  | 'owned'
  | 'for_sale_indicator'
  | 'menu'
  | 'artist'
  | 'title'
  | 'year'
  | 'barcode'
  | 'cat_no'
  | 'sort_title'
  | 'subtitle'
  | 'index_number'
  // Edition
  | 'format'
  | 'discs'
  | 'tracks'
  | 'length'
  // Details
  | 'box_set'
  | 'country'
  | 'extra'
  | 'is_live'
  | 'media_condition'
  | 'package_sleeve_condition'
  | 'packaging'
  | 'rpm'
  | 'sound'
  | 'spars_code'
  | 'storage_device_slot'
  | 'studio'
  | 'vinyl_color'
  | 'vinyl_weight'
  // Metadata
  | 'genres'
  | 'styles'
  | 'label'
  | 'original_release_date'
  | 'original_release_year'
  | 'recording_date'
  | 'recording_year'
  | 'master_release_date'
  // Classical
  | 'chorus'
  | 'composer'
  | 'composition'
  | 'conductor'
  | 'orchestra'
  // People
  | 'engineers'
  | 'musicians'
  | 'producers'
  | 'songwriters'
  // Personal
  | 'added_date'
  | 'collection_status'
  | 'folder'
  | 'location'
  | 'my_rating'
  | 'notes'
  | 'owner'
  | 'play_count'
  | 'last_played_date'
  | 'last_cleaned_date'
  | 'signed_by'
  | 'custom_tags'
  | 'modified_date'
  // Loan
  | 'due_date'
  | 'loan_date'
  | 'loaned_to'
  // Value
  | 'for_sale'
  | 'purchase_date'
  | 'purchase_store'
  | 'purchase_price'
  | 'current_value'
  | 'sale_price'
  | 'sale_platform'
  | 'sale_quantity'
  | 'wholesale_cost'
  | 'discogs_price_min'
  | 'discogs_price_median'
  | 'discogs_price_max'
  | 'pricing_notes'
  // Popularity
  | 'spotify_popularity';

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  width: string;
  sortable?: boolean;
}

export const COLUMN_DEFINITIONS: Record<ColumnId, ColumnDefinition> = {
  // Main
  checkbox: { id: 'checkbox', label: '', width: '40px' },
  owned: { id: 'owned', label: '✓', width: '40px' },
  for_sale_indicator: { id: 'for_sale_indicator', label: '$', width: '40px' },
  menu: { id: 'menu', label: '✏', width: '40px' },
  artist: { id: 'artist', label: 'Artist', width: '200px', sortable: true },
  title: { id: 'title', label: 'Title', width: '300px', sortable: true },
  year: { id: 'year', label: 'Year', width: '80px' },
  barcode: { id: 'barcode', label: 'Barcode', width: '150px' },
  cat_no: { id: 'cat_no', label: 'Cat No', width: '120px' },
  sort_title: { id: 'sort_title', label: 'Sort Title', width: '200px' },
  subtitle: { id: 'subtitle', label: 'Subtitle', width: '200px' },
  index_number: { id: 'index_number', label: 'Index', width: '80px' },
  
  // Edition
  format: { id: 'format', label: 'Format', width: '180px' },
  discs: { id: 'discs', label: 'Discs', width: '70px' },
  tracks: { id: 'tracks', label: 'Tracks', width: '80px' },
  length: { id: 'length', label: 'Length', width: '90px' },
  
  // Details
  box_set: { id: 'box_set', label: 'Box Set', width: '90px' },
  country: { id: 'country', label: 'Country', width: '100px' },
  extra: { id: 'extra', label: 'Extra', width: '150px' },
  is_live: { id: 'is_live', label: 'Is Live', width: '80px' },
  media_condition: { id: 'media_condition', label: 'Media Condition', width: '150px' },
  package_sleeve_condition: { id: 'package_sleeve_condition', label: 'Package/Sleeve Condition', width: '200px' },
  packaging: { id: 'packaging', label: 'Packaging', width: '120px' },
  rpm: { id: 'rpm', label: 'RPM', width: '80px' },
  sound: { id: 'sound', label: 'Sound', width: '100px' },
  spars_code: { id: 'spars_code', label: 'SPARS', width: '80px' },
  storage_device_slot: { id: 'storage_device_slot', label: 'Storage Device Slot', width: '160px' },
  studio: { id: 'studio', label: 'Studio', width: '150px' },
  vinyl_color: { id: 'vinyl_color', label: 'Vinyl Color', width: '120px' },
  vinyl_weight: { id: 'vinyl_weight', label: 'Vinyl Weight', width: '120px' },
  
  // Metadata
  genres: { id: 'genres', label: 'Genre', width: '150px' },
  styles: { id: 'styles', label: 'Styles', width: '150px' },
  label: { id: 'label', label: 'Label', width: '150px' },
  original_release_date: { id: 'original_release_date', label: 'Original Release Date', width: '160px' },
  original_release_year: { id: 'original_release_year', label: 'Original Release Year', width: '160px' },
  recording_date: { id: 'recording_date', label: 'Recording Date', width: '140px' },
  recording_year: { id: 'recording_year', label: 'Recording Year', width: '140px' },
  master_release_date: { id: 'master_release_date', label: 'Release Date', width: '130px' },
  
  // Classical
  chorus: { id: 'chorus', label: 'Chorus', width: '150px' },
  composer: { id: 'composer', label: 'Composer', width: '150px' },
  composition: { id: 'composition', label: 'Composition', width: '200px' },
  conductor: { id: 'conductor', label: 'Conductor', width: '150px' },
  orchestra: { id: 'orchestra', label: 'Orchestra', width: '150px' },
  
  // People
  engineers: { id: 'engineers', label: 'Engineer', width: '150px' },
  musicians: { id: 'musicians', label: 'Musician', width: '150px' },
  producers: { id: 'producers', label: 'Producer', width: '150px' },
  songwriters: { id: 'songwriters', label: 'Songwriter', width: '150px' },
  
  // Personal
  added_date: { id: 'added_date', label: 'Added Date', width: '120px' },
  collection_status: { id: 'collection_status', label: 'Collection Status', width: '150px' },
  folder: { id: 'folder', label: 'Folder', width: '150px' },
  location: { id: 'location', label: 'Location', width: '120px' },
  my_rating: { id: 'my_rating', label: 'My Rating', width: '100px' },
  notes: { id: 'notes', label: 'Notes', width: '200px' },
  owner: { id: 'owner', label: 'Owner', width: '120px' },
  play_count: { id: 'play_count', label: 'Play Count', width: '100px' },
  last_played_date: { id: 'last_played_date', label: 'Last Played Date', width: '140px' },
  last_cleaned_date: { id: 'last_cleaned_date', label: 'Last Cleaned Date', width: '150px' },
  signed_by: { id: 'signed_by', label: 'Signed by', width: '150px' },
  custom_tags: { id: 'custom_tags', label: 'Tags', width: '200px' },
  modified_date: { id: 'modified_date', label: 'Modified Date', width: '140px' },
  
  // Loan
  due_date: { id: 'due_date', label: 'Due Date', width: '120px' },
  loan_date: { id: 'loan_date', label: 'Loan Date', width: '120px' },
  loaned_to: { id: 'loaned_to', label: 'Loaned To', width: '150px' },
  
  // Value
  for_sale: { id: 'for_sale', label: 'For Sale', width: '90px' },
  purchase_date: { id: 'purchase_date', label: 'Purchase Date', width: '130px' },
  purchase_store: { id: 'purchase_store', label: 'Purchase Store', width: '150px' },
  purchase_price: { id: 'purchase_price', label: 'Purchase Price', width: '130px' },
  current_value: { id: 'current_value', label: 'Current Value', width: '130px' },
  sale_price: { id: 'sale_price', label: 'Sale Price', width: '120px' },
  sale_platform: { id: 'sale_platform', label: 'Sale Platform', width: '130px' },
  sale_quantity: { id: 'sale_quantity', label: 'Quantity', width: '90px' },
  wholesale_cost: { id: 'wholesale_cost', label: 'Wholesale Cost', width: '140px' },
  discogs_price_min: { id: 'discogs_price_min', label: 'Discogs Min', width: '120px' },
  discogs_price_median: { id: 'discogs_price_median', label: 'Discogs Median', width: '140px' },
  discogs_price_max: { id: 'discogs_price_max', label: 'Discogs Max', width: '120px' },
  pricing_notes: { id: 'pricing_notes', label: 'Pricing Notes', width: '200px' },
  
  // Popularity
  spotify_popularity: { id: 'spotify_popularity', label: 'Spotify Popularity', width: '160px' }
};

export const COLUMN_GROUPS = [
  {
    id: 'main',
    label: 'Main',
    icon: '📋',
    columns: [
      'checkbox', 'owned', 'for_sale_indicator', 'menu', 'artist', 'title', 
      'year', 'barcode', 'cat_no', 'sort_title', 'subtitle', 'index_number'
    ] as ColumnId[]
  },
  {
    id: 'edition',
    label: 'Edition',
    icon: '💿',
    columns: ['format', 'discs', 'tracks', 'length'] as ColumnId[]
  },
  {
    id: 'details',
    label: 'Details',
    icon: '📝',
    columns: [
      'box_set', 'country', 'extra', 'is_live', 'media_condition', 
      'package_sleeve_condition', 'packaging', 'rpm', 'sound', 'spars_code',
      'storage_device_slot', 'studio', 'vinyl_color', 'vinyl_weight'
    ] as ColumnId[]
  },
  {
    id: 'metadata',
    label: 'Metadata',
    icon: '📊',
    columns: [
      'genres', 'styles', 'label', 'original_release_date', 'original_release_year',
      'recording_date', 'recording_year', 'master_release_date'
    ] as ColumnId[]
  },
  {
    id: 'classical',
    label: 'Classical',
    icon: '🎻',
    columns: ['chorus', 'composer', 'composition', 'conductor', 'orchestra'] as ColumnId[]
  },
  {
    id: 'people',
    label: 'People',
    icon: '👥',
    columns: ['engineers', 'musicians', 'producers', 'songwriters'] as ColumnId[]
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: '👤',
    columns: [
      'added_date', 'collection_status', 'folder', 'location', 'my_rating', 'notes',
      'owner', 'play_count', 'last_played_date', 'last_cleaned_date', 'signed_by',
      'custom_tags', 'modified_date'
    ] as ColumnId[]
  },
  {
    id: 'loan',
    label: 'Loan',
    icon: '📤',
    columns: ['due_date', 'loan_date', 'loaned_to'] as ColumnId[]
  },
  {
    id: 'value',
    label: 'Value',
    icon: '💰',
    columns: [
      'for_sale', 'purchase_date', 'purchase_store', 'purchase_price', 'current_value',
      'sale_price', 'sale_platform', 'sale_quantity', 'wholesale_cost', 'discogs_price_min',
      'discogs_price_median', 'discogs_price_max', 'pricing_notes'
    ] as ColumnId[]
  },
  {
    id: 'popularity',
    label: 'Popularity',
    icon: '🔥',
    columns: ['spotify_popularity'] as ColumnId[]
  }
];

export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  'checkbox',
  'owned',
  'for_sale_indicator',
  'menu',
  'artist',
  'title',
  'master_release_date',
  'format',
  'discs',
  'tracks',
  'length',
  'genres',
  'label',
  'added_date'
];

export function getVisibleColumns(visibleIds: ColumnId[]): ColumnDefinition[] {
  return visibleIds.map(id => COLUMN_DEFINITIONS[id]).filter(Boolean);
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  column: ColumnId | null;
  direction: SortDirection;
}
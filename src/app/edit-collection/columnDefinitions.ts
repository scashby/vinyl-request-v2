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
  // Edition
  | 'format'
  | 'discs'
  | 'sides'
  | 'tracks'
  // Details
  | 'location'  // Fixed
  | 'country'
  | 'extra'
  | 'media_condition'
  | 'package_sleeve_condition'
  | 'rpm'
  | 'vinyl_color'
  | 'vinyl_weight'
  // Metadata
  | 'genres'
  | 'styles'
  | 'labels' // Added
  // People
  | 'engineers'
  | 'musicians'
  | 'producers'
  | 'songwriters'
  | 'secondary_artists' // Added
  // Personal
  | 'added_date'
  | 'collection_status'
  | 'my_rating'
  | 'personal_notes' // Renamed
  | 'release_notes'  // Added
  | 'owner'
  | 'custom_tags'
  | 'modified_date'
  // Value
  | 'for_sale'
  | 'purchase_price'
  | 'current_value';

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  width: string;
  sortable?: boolean;
  lockable?: boolean;
}

export const COLUMN_DEFINITIONS: Record<ColumnId, ColumnDefinition> = {
  // Main
  checkbox: { id: 'checkbox', label: '', width: '40px', lockable: true },
  owned: { id: 'owned', label: '✓', width: '40px', lockable: true },
  for_sale_indicator: { id: 'for_sale_indicator', label: '$', width: '40px', lockable: true },
  menu: { id: 'menu', label: '✏', width: '40px', lockable: true },
  artist: { id: 'artist', label: 'Artist', width: '200px', sortable: true, lockable: true },
  title: { id: 'title', label: 'Title', width: '300px', sortable: true, lockable: true },
  year: { id: 'year', label: 'Year', width: '80px', lockable: true },
  barcode: { id: 'barcode', label: 'Barcode', width: '150px' },
  cat_no: { id: 'cat_no', label: 'Cat No', width: '120px' },
  sort_title: { id: 'sort_title', label: 'Sort Title', width: '200px' },
  subtitle: { id: 'subtitle', label: 'Subtitle', width: '200px' },
  
  // Edition
  format: { id: 'format', label: 'Format', width: '180px' },
  discs: { id: 'discs', label: 'Discs', width: '70px' },
  sides: { id: 'sides', label: 'Sides', width: '70px' },
  tracks: { id: 'tracks', label: 'Tracks', width: '80px' },
  
  // Details
  location: { id: 'location', label: 'Location', width: '150px' },
  country: { id: 'country', label: 'Country', width: '100px' },
  extra: { id: 'extra', label: 'Extra', width: '150px' },
  media_condition: { id: 'media_condition', label: 'Media Cond', width: '150px' },
  package_sleeve_condition: { id: 'package_sleeve_condition', label: 'Sleeve Cond', width: '150px' },
  rpm: { id: 'rpm', label: 'RPM', width: '80px' },
  vinyl_color: { id: 'vinyl_color', label: 'Color', width: '120px' },
  vinyl_weight: { id: 'vinyl_weight', label: 'Weight', width: '120px' },
  
  // Metadata
  genres: { id: 'genres', label: 'Genre', width: '150px' },
  styles: { id: 'styles', label: 'Styles', width: '150px' },
  labels: { id: 'labels', label: 'Labels', width: '150px' },
  
  // People
  engineers: { id: 'engineers', label: 'Engineer', width: '150px' },
  musicians: { id: 'musicians', label: 'Musician', width: '150px' },
  producers: { id: 'producers', label: 'Producer', width: '150px' },
  songwriters: { id: 'songwriters', label: 'Songwriter', width: '150px' },
  secondary_artists: { id: 'secondary_artists', label: 'Feat. Artists', width: '200px' },
  
  // Personal
  added_date: { id: 'added_date', label: 'Added', width: '120px' },
  collection_status: { id: 'collection_status', label: 'Status', width: '150px' },
  my_rating: { id: 'my_rating', label: 'Rating', width: '100px' },
  personal_notes: { id: 'personal_notes', label: 'My Notes', width: '250px' },
  release_notes: { id: 'release_notes', label: 'Release Notes', width: '250px' },
  owner: { id: 'owner', label: 'Owner', width: '120px' },
  custom_tags: { id: 'custom_tags', label: 'Tags', width: '200px' },
  modified_date: { id: 'modified_date', label: 'Modified', width: '140px' },
  
  // Value
  for_sale: { id: 'for_sale', label: 'For Sale', width: '90px' },
  purchase_price: { id: 'purchase_price', label: 'Purch Price', width: '130px' },
  current_value: { id: 'current_value', label: 'Value', width: '130px' },
};

export const COLUMN_GROUPS = [
  {
    id: 'main',
    label: 'Main',
    icon: '📋',
    columns: [
      'checkbox', 'owned', 'for_sale_indicator', 'menu', 'artist', 'title', 
      'year', 'barcode', 'cat_no', 'sort_title', 'subtitle'
    ] as ColumnId[]
  },
  {
    id: 'edition',
    label: 'Edition',
    icon: '💿',
    columns: ['format', 'discs', 'sides', 'tracks', 'labels'] as ColumnId[]
  },
  {
    id: 'details',
    label: 'Details',
    icon: '📝',
    columns: [
      'location', 'country', 'extra', 'media_condition', 
      'package_sleeve_condition', 'rpm', 'vinyl_color', 'vinyl_weight'
    ] as ColumnId[]
  },
  {
    id: 'metadata',
    label: 'Metadata',
    icon: '📊',
    columns: ['genres', 'styles'] as ColumnId[]
  },
  {
    id: 'people',
    label: 'People',
    icon: '👥',
    columns: ['secondary_artists', 'engineers', 'musicians', 'producers', 'songwriters'] as ColumnId[]
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: '👤',
    columns: [
      'added_date', 'collection_status', 'location', 'my_rating', 'personal_notes', 'release_notes',
      'owner', 'custom_tags', 'modified_date'
    ] as ColumnId[]
  },
  {
    id: 'value',
    label: 'Value',
    icon: '💰',
    columns: [
      'for_sale', 'purchase_price', 'current_value'
    ] as ColumnId[]
  }
];

export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  'checkbox',
  'owned',
  'for_sale_indicator',
  'menu',
  'artist',
  'title',
  'format',
  'location',
  'personal_notes',
  'genres',
  'added_date'
];

export const DEFAULT_LOCKED_COLUMNS: ColumnId[] = [
  'checkbox',
  'owned',
  'for_sale_indicator',
  'menu',
  'artist',
  'title'
];
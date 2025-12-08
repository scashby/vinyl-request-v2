// src/app/edit-collection/columnDefinitions.ts

export type ColumnId =
  | 'checkbox'
  | 'owned'
  | 'image'
  | 'artist'
  | 'title'
  | 'year'
  | 'master_release'
  | 'format'
  | 'discs'
  | 'tracks'
  | 'length'
  | 'genres'
  | 'label'
  | 'added_date'
  | 'catalog_number'
  | 'barcode'
  | 'media_condition'
  | 'sleeve_condition'
  | 'country'
  | 'released'
  | 'spotify_popularity'
  | 'apple_music_popularity'
  | 'tags'
  | 'notes'
  | 'location'
  | 'purchase_price'
  | 'current_value'
  | 'sale_price'
  | 'for_sale';

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  width: string;
}

export const COLUMN_DEFINITIONS: Record<ColumnId, ColumnDefinition> = {
  checkbox: { id: 'checkbox', label: 'Select', width: '40px' },
  owned: { id: 'owned', label: '✓', width: '40px' },
  image: { id: 'image', label: 'Cover', width: '60px' },
  artist: { id: 'artist', label: 'Artist', width: '200px' },
  title: { id: 'title', label: 'Title', width: '250px' },
  year: { id: 'year', label: 'Year', width: '80px' },
  master_release: { id: 'master_release', label: 'Master Release', width: '130px' },
  format: { id: 'format', label: 'Format', width: '180px' },
  discs: { id: 'discs', label: 'Discs', width: '70px' },
  tracks: { id: 'tracks', label: 'Spotify Tracks', width: '130px' },
  length: { id: 'length', label: 'Length', width: '90px' },
  genres: { id: 'genres', label: 'Genres', width: '150px' },
  label: { id: 'label', label: 'Spotify Label', width: '150px' },
  added_date: { id: 'added_date', label: 'Added Date', width: '120px' },
  catalog_number: { id: 'catalog_number', label: 'Cat No', width: '120px' },
  barcode: { id: 'barcode', label: 'Barcode', width: '150px' },
  media_condition: { id: 'media_condition', label: 'Media Condition', width: '150px' },
  sleeve_condition: { id: 'sleeve_condition', label: 'Sleeve Condition', width: '150px' },
  country: { id: 'country', label: 'Country', width: '100px' },
  released: { id: 'released', label: 'Released', width: '100px' },
  spotify_popularity: { id: 'spotify_popularity', label: 'Spotify Popularity', width: '160px' },
  apple_music_popularity: { id: 'apple_music_popularity', label: 'Apple Music Popularity', width: '180px' },
  tags: { id: 'tags', label: 'Tags', width: '200px' },
  notes: { id: 'notes', label: 'Notes', width: '200px' },
  location: { id: 'location', label: 'Location', width: '120px' },
  purchase_price: { id: 'purchase_price', label: 'Purchase Price', width: '130px' },
  current_value: { id: 'current_value', label: 'Current Value', width: '130px' },
  sale_price: { id: 'sale_price', label: 'Sale Price', width: '120px' },
  for_sale: { id: 'for_sale', label: 'For Sale', width: '90px' }
};

export const COLUMN_GROUPS = [
  {
    id: 'main',
    label: 'Main',
    icon: '📋',
    columns: ['checkbox', 'owned', 'image', 'artist', 'title', 'year', 'master_release'] as ColumnId[]
  },
  {
    id: 'edition',
    label: 'Edition',
    icon: '💿',
    columns: ['format', 'discs', 'tracks', 'length'] as ColumnId[]
  },
  {
    id: 'metadata',
    label: 'Metadata',
    icon: '📊',
    columns: ['genres', 'label', 'catalog_number', 'barcode', 'country', 'released'] as ColumnId[]
  },
  {
    id: 'condition',
    label: 'Condition',
    icon: '⭐',
    columns: ['media_condition', 'sleeve_condition'] as ColumnId[]
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: '👤',
    columns: ['added_date', 'tags', 'notes', 'location'] as ColumnId[]
  },
  {
    id: 'value',
    label: 'Value',
    icon: '💰',
    columns: ['purchase_price', 'current_value', 'sale_price', 'for_sale'] as ColumnId[]
  },
  {
    id: 'popularity',
    label: 'Popularity',
    icon: '🔥',
    columns: ['spotify_popularity', 'apple_music_popularity'] as ColumnId[]
  }
];

export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  'checkbox',
  'owned',
  'image',
  'artist',
  'title',
  'year',
  'master_release',
  'format',
  'discs',
  'tracks',
  'length',
  'genres',
  'label'
];

// NO MORE canHideColumn function - ALL columns can be hidden
export function getVisibleColumns(visibleIds: ColumnId[]): ColumnDefinition[] {
  return visibleIds.map(id => COLUMN_DEFINITIONS[id]).filter(Boolean);
}
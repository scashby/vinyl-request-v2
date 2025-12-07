// src/app/edit-collection/columnDefinitions.ts
// Comprehensive column definitions matching CLZ Music Web functionality

import { Album } from '../../types/album';

export type ColumnId = 
  // System/Selection (Always Visible)
  | 'checkbox' | 'owned' | 'for_sale'
  // Main
  | 'artist' | 'title' | 'release_date' | 'genre' | 'format' | 'label'
  | 'barcode' | 'cat_no' | 'sort_title' | 'subtitle'
  // Details  
  | 'box_set' | 'country' | 'is_live' | 'media_condition'
  | 'packaging' | 'studio' | 'vinyl_color' | 'vinyl_weight'
  // Edition
  | 'discs' | 'tracks' | 'length'
  // Personal
  | 'added_date' | 'added_year' | 'collection_status'
  | 'current_value' | 'ebay_link' | 'last_played'
  | 'location' | 'modified_date' | 'my_rating'
  | 'notes' | 'owner' | 'play_count' | 'purchase_date' | 'purchase_price'
  | 'purchase_store' | 'purchase_year' | 'quantity' | 'tags';

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  category: 'Main' | 'Details' | 'Edition' | 'Personal';
  field: keyof Album | 'checkbox' | 'owned' | 'for_sale';
  sortable: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
  alwaysVisible?: boolean;
}

export interface ColumnGroup {
  id: string;
  label: string;
  icon: string;
  color: string;
  columns: ColumnId[];
  description?: string;
}

export const COLUMN_DEFINITIONS: Record<ColumnId, ColumnDefinition> = {
  // SYSTEM/SELECTION COLUMNS (Always Visible)
  checkbox: {
    id: 'checkbox',
    label: '☑',
    category: 'Main',
    field: 'checkbox',
    sortable: false,
    width: 40,
    align: 'center',
    alwaysVisible: true
  },
  owned: {
    id: 'owned',
    label: '✓',
    category: 'Main',
    field: 'owned',
    sortable: false,
    width: 40,
    align: 'center',
    alwaysVisible: true
  },
  for_sale: {
    id: 'for_sale',
    label: '$',
    category: 'Main',
    field: 'for_sale',
    sortable: false,
    width: 40,
    align: 'center',
    alwaysVisible: true
  },

  // MAIN COLUMNS
  artist: {
    id: 'artist',
    label: 'Artist',
    category: 'Main',
    field: 'artist',
    sortable: true,
    align: 'left'
  },
  title: {
    id: 'title',
    label: 'Title',
    category: 'Main',
    field: 'title',
    sortable: true,
    align: 'left'
  },
  release_date: {
    id: 'release_date',
    label: 'Release Date',
    category: 'Main',
    field: 'year',
    sortable: true,
    width: 100,
    align: 'left'
  },
  genre: {
    id: 'genre',
    label: 'Genre',
    category: 'Main',
    field: 'discogs_genres',
    sortable: true,
    width: 120,
    align: 'left'
  },
  format: {
    id: 'format',
    label: 'Format',
    category: 'Main',
    field: 'format',
    sortable: true,
    width: 150,
    align: 'left'
  },
  label: {
    id: 'label',
    label: 'Label',
    category: 'Main',
    field: 'spotify_label',
    sortable: true,
    width: 140,
    align: 'left'
  },
  barcode: {
    id: 'barcode',
    label: 'Barcode',
    category: 'Main',
    field: 'barcode',
    sortable: true,
    width: 120,
    align: 'left'
  },
  cat_no: {
    id: 'cat_no',
    label: 'Cat No',
    category: 'Main',
    field: 'notes',
    sortable: true,
    width: 100,
    align: 'left'
  },
  sort_title: {
    id: 'sort_title',
    label: 'Sort Title',
    category: 'Main',
    field: 'title',
    sortable: true,
    align: 'left'
  },
  subtitle: {
    id: 'subtitle',
    label: 'Subtitle',
    category: 'Main',
    field: 'notes',
    sortable: false,
    align: 'left'
  },

  // DETAILS COLUMNS
  box_set: {
    id: 'box_set',
    label: 'Box Set',
    category: 'Details',
    field: 'notes',
    sortable: false,
    width: 80,
    align: 'center'
  },
  country: {
    id: 'country',
    label: 'Country',
    category: 'Details',
    field: 'notes',
    sortable: true,
    width: 100,
    align: 'left'
  },
  is_live: {
    id: 'is_live',
    label: 'Is Live',
    category: 'Details',
    field: 'notes',
    sortable: false,
    width: 70,
    align: 'center'
  },
  media_condition: {
    id: 'media_condition',
    label: 'Media Condition',
    category: 'Details',
    field: 'notes',
    sortable: true,
    width: 120,
    align: 'left'
  },
  packaging: {
    id: 'packaging',
    label: 'Packaging',
    category: 'Details',
    field: 'notes',
    sortable: true,
    width: 100,
    align: 'left'
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    category: 'Details',
    field: 'notes',
    sortable: true,
    width: 120,
    align: 'left'
  },
  vinyl_color: {
    id: 'vinyl_color',
    label: 'Vinyl Color',
    category: 'Details',
    field: 'notes',
    sortable: true,
    width: 100,
    align: 'left'
  },
  vinyl_weight: {
    id: 'vinyl_weight',
    label: 'Vinyl Weight',
    category: 'Details',
    field: 'notes',
    sortable: true,
    width: 100,
    align: 'left'
  },

  // EDITION COLUMNS
  discs: {
    id: 'discs',
    label: 'Discs',
    category: 'Edition',
    field: 'discs',
    sortable: true,
    width: 60,
    align: 'center'
  },
  tracks: {
    id: 'tracks',
    label: 'Tracks',
    category: 'Edition',
    field: 'spotify_total_tracks',
    sortable: true,
    width: 70,
    align: 'center'
  },
  length: {
    id: 'length',
    label: 'Length',
    category: 'Edition',
    field: 'length_seconds',
    sortable: true,
    width: 80,
    align: 'left'
  },

  // PERSONAL COLUMNS
  added_date: {
    id: 'added_date',
    label: 'Added Date',
    category: 'Personal',
    field: 'date_added',
    sortable: true,
    width: 110,
    align: 'left'
  },
  added_year: {
    id: 'added_year',
    label: 'Added Year',
    category: 'Personal',
    field: 'date_added',
    sortable: true,
    width: 90,
    align: 'center'
  },
  collection_status: {
    id: 'collection_status',
    label: 'Collection Status',
    category: 'Personal',
    field: 'owned',
    sortable: true,
    width: 120,
    align: 'left'
  },
  current_value: {
    id: 'current_value',
    label: 'Current Value',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 100,
    align: 'right'
  },
  ebay_link: {
    id: 'ebay_link',
    label: 'eBay',
    category: 'Personal',
    field: 'notes',
    sortable: false,
    width: 80,
    align: 'center'
  },
  last_played: {
    id: 'last_played',
    label: 'Last Played Date',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 110,
    align: 'left'
  },
  location: {
    id: 'location',
    label: 'Location',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 100,
    align: 'left'
  },
  modified_date: {
    id: 'modified_date',
    label: 'Modified Date',
    category: 'Personal',
    field: 'date_added',
    sortable: true,
    width: 110,
    align: 'left'
  },
  my_rating: {
    id: 'my_rating',
    label: 'My Rating',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 90,
    align: 'center'
  },
  notes: {
    id: 'notes',
    label: 'Notes',
    category: 'Personal',
    field: 'notes',
    sortable: false,
    width: 150,
    align: 'left'
  },
  owner: {
    id: 'owner',
    label: 'Owner',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 100,
    align: 'left'
  },
  play_count: {
    id: 'play_count',
    label: 'Play Count',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 90,
    align: 'center'
  },
  purchase_date: {
    id: 'purchase_date',
    label: 'Purchase Date',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 110,
    align: 'left'
  },
  purchase_price: {
    id: 'purchase_price',
    label: 'Purchase Price',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 100,
    align: 'right'
  },
  purchase_store: {
    id: 'purchase_store',
    label: 'Purchase Store',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 120,
    align: 'left'
  },
  purchase_year: {
    id: 'purchase_year',
    label: 'Purchase Year',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 100,
    align: 'center'
  },
  quantity: {
    id: 'quantity',
    label: 'Quantity',
    category: 'Personal',
    field: 'notes',
    sortable: true,
    width: 80,
    align: 'center'
  },
  tags: {
    id: 'tags',
    label: 'Tags',
    category: 'Personal',
    field: 'notes',
    sortable: false,
    width: 150,
    align: 'left'
  }
};

// DEFAULT VISIBLE COLUMNS - Match 3:24 PM screenshot exactly
export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  'checkbox',
  'owned',
  'for_sale',
  'artist',
  'title',
  'release_date',
  'format',
  'discs',
  'tracks',
  'length',
  'genre',
  'label',
  'added_date'
];

export const COLUMN_GROUPS: ColumnGroup[] = [
  {
    id: 'main',
    label: 'Main',
    icon: '⭐',
    color: '#FF8C42',
    description: 'Core album information',
    columns: ['artist', 'title', 'release_date', 'genre', 'format', 'label', 'barcode', 'cat_no', 'sort_title', 'subtitle']
  },
  {
    id: 'details',
    label: 'Details',
    icon: '📋',
    color: '#5BA3D0',
    description: 'Detailed information',
    columns: ['box_set', 'country', 'is_live', 'media_condition', 'packaging', 'studio', 'vinyl_color', 'vinyl_weight']
  },
  {
    id: 'edition',
    label: 'Edition',
    icon: '💿',
    color: '#8B5CF6',
    description: 'Physical media details',
    columns: ['discs', 'tracks', 'length']
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: '👤',
    color: '#EC4899',
    description: 'Personal tracking',
    columns: [
      'added_date', 'added_year', 'collection_status', 'current_value', 'ebay_link',
      'last_played', 'location', 'modified_date', 'my_rating', 'notes', 'owner',
      'play_count', 'purchase_date', 'purchase_price', 'purchase_store',
      'purchase_year', 'quantity', 'tags'
    ]
  }
];

export function getColumnsByCategory(category: ColumnDefinition['category']): ColumnDefinition[] {
  return Object.values(COLUMN_DEFINITIONS).filter(col => col.category === category);
}

export function getAllCategories(): ColumnDefinition['category'][] {
  return ['Main', 'Details', 'Edition', 'Personal'];
}

export function getVisibleColumns(visibleColumnIds: ColumnId[]): ColumnDefinition[] {
  return visibleColumnIds
    .map(id => COLUMN_DEFINITIONS[id])
    .filter(col => col !== undefined);
}

export function canHideColumn(columnId: ColumnId): boolean {
  const col = COLUMN_DEFINITIONS[columnId];
  return col ? !col.alwaysVisible : false;
}

export function getColumnById(columnId: ColumnId): ColumnDefinition | undefined {
  return COLUMN_DEFINITIONS[columnId];
}
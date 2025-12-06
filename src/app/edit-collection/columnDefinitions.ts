// src/app/edit-collection/columnDefinitions.ts
// Complete column definitions for DWD Collection Browser
// Maps CLZ Music Web column structure to our database schema

import { Album } from '../../types/album';

export type ColumnId = string;

export type ColumnDefinition = {
  id: ColumnId;
  label: string;
  category: 'Main' | 'Details' | 'Edition' | 'Classical' | 'People' | 'Personal' | 'Loan';
  field: keyof Album | 'checkbox' | 'owned' | 'for_sale' | 'edit';
  sortable: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render?: (album: Album) => React.ReactNode;
  defaultVisible?: boolean;
  alwaysVisible?: boolean; // Can't be hidden (like checkbox, artist, title)
};

export interface ColumnGroup {
  id: string;
  label: string;
  icon: string;
  color: string;
  columns: ColumnId[];
  description?: string;
}

// Default visible columns (matches CLZ defaults)
export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  'checkbox',
  'owned',
  'for_sale',
  'edit',
  'artist',
  'title',
  'release_date',
  'master_release',
  'format',
  'discs',
  'tracks',
  'length',
  'genre',
  'label'
];

// Column definitions organized by category
export const COLUMN_DEFINITIONS: Record<ColumnId, ColumnDefinition> = {
  // ============================================================================
  // SYSTEM COLUMNS (Always visible)
  // ============================================================================
  checkbox: {
    id: 'checkbox',
    label: '☑',
    category: 'Main',
    field: 'checkbox',
    sortable: false,
    width: 30,
    align: 'center',
    defaultVisible: true,
    alwaysVisible: true
  },
  
  owned: {
    id: 'owned',
    label: '✓',
    category: 'Main',
    field: 'owned',
    sortable: false,
    width: 30,
    align: 'center',
    defaultVisible: true,
    alwaysVisible: true
  },
  
  for_sale: {
    id: 'for_sale',
    label: '$',
    category: 'Main',
    field: 'for_sale',
    sortable: true,
    width: 30,
    align: 'center',
    defaultVisible: true,
    alwaysVisible: true
  },
  
  edit: {
    id: 'edit',
    label: '✏',
    category: 'Main',
    field: 'edit',
    sortable: false,
    width: 30,
    align: 'center',
    defaultVisible: true,
    alwaysVisible: true
  },

  // ============================================================================
  // MAIN CATEGORY
  // ============================================================================
  artist: {
    id: 'artist',
    label: 'Artist',
    category: 'Main',
    field: 'artist',
    sortable: true,
    align: 'left',
    defaultVisible: true,
    alwaysVisible: true
  },
  
  title: {
    id: 'title',
    label: 'Title',
    category: 'Main',
    field: 'title',
    sortable: true,
    align: 'left',
    defaultVisible: true,
    alwaysVisible: true
  },
  
  barcode: {
    id: 'barcode',
    label: 'Barcode',
    category: 'Main',
    field: 'barcode',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  cat_no: {
    id: 'cat_no',
    label: 'Cat No',
    category: 'Main',
    field: 'cat_no',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  format: {
    id: 'format',
    label: 'Format',
    category: 'Main',
    field: 'format',
    sortable: true,
    width: 150,
    align: 'left',
    defaultVisible: true
  },
  
  genre: {
    id: 'genre',
    label: 'Genre',
    category: 'Main',
    field: 'discogs_genres',
    sortable: true,
    width: 130,
    align: 'left',
    defaultVisible: true
  },
  
  label: {
    id: 'label',
    label: 'Label',
    category: 'Main',
    field: 'spotify_label',
    sortable: true,
    width: 130,
    align: 'left',
    defaultVisible: true
  },
  
  release_date: {
    id: 'release_date',
    label: 'Release Date',
    category: 'Main',
    field: 'year',
    sortable: true,
    width: 110,
    align: 'left',
    defaultVisible: true
  },
  
  release_year: {
    id: 'release_year',
    label: 'Release Year',
    category: 'Main',
    field: 'year_int',
    sortable: true,
    width: 100,
    align: 'center',
    defaultVisible: false
  },
  
  sort_title: {
    id: 'sort_title',
    label: 'Sort Title',
    category: 'Main',
    field: 'sort_title',
    sortable: true,
    align: 'left',
    defaultVisible: false
  },
  
  subtitle: {
    id: 'subtitle',
    label: 'Subtitle',
    category: 'Main',
    field: 'subtitle',
    sortable: true,
    align: 'left',
    defaultVisible: false
  },

  // ============================================================================
  // DETAILS CATEGORY
  // ============================================================================
  box_set: {
    id: 'box_set',
    label: 'Box Set',
    category: 'Details',
    field: 'is_box_set',
    sortable: true,
    width: 80,
    align: 'center',
    defaultVisible: false
  },
  
  country: {
    id: 'country',
    label: 'Country',
    category: 'Details',
    field: 'country',
    sortable: true,
    width: 100,
    align: 'left',
    defaultVisible: false
  },
  
  extra: {
    id: 'extra',
    label: 'Extra',
    category: 'Details',
    field: 'extra',
    sortable: false,
    width: 150,
    align: 'left',
    defaultVisible: false
  },
  
  is_live: {
    id: 'is_live',
    label: 'Is Live',
    category: 'Details',
    field: 'is_live',
    sortable: true,
    width: 80,
    align: 'center',
    defaultVisible: false
  },
  
  media_condition: {
    id: 'media_condition',
    label: 'Media Condition',
    category: 'Details',
    field: 'media_condition',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  package_sleeve_condition: {
    id: 'package_sleeve_condition',
    label: 'Package/Sleeve Condition',
    category: 'Details',
    field: 'package_sleeve_condition',
    sortable: true,
    width: 180,
    align: 'left',
    defaultVisible: false
  },
  
  packaging: {
    id: 'packaging',
    label: 'Packaging',
    category: 'Details',
    field: 'packaging',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  rpm: {
    id: 'rpm',
    label: 'RPM',
    category: 'Details',
    field: 'rpm',
    sortable: true,
    width: 80,
    align: 'center',
    defaultVisible: false
  },
  
  sound: {
    id: 'sound',
    label: 'Sound',
    category: 'Details',
    field: 'sound',
    sortable: true,
    width: 100,
    align: 'left',
    defaultVisible: false
  },
  
  spars_code: {
    id: 'spars_code',
    label: 'SPARS',
    category: 'Details',
    field: 'spars_code',
    sortable: true,
    width: 80,
    align: 'center',
    defaultVisible: false
  },
  
  storage_device_slot: {
    id: 'storage_device_slot',
    label: 'Storage Device Slot',
    category: 'Details',
    field: 'storage_device_slot',
    sortable: true,
    width: 150,
    align: 'left',
    defaultVisible: false
  },
  
  studio: {
    id: 'studio',
    label: 'Studio',
    category: 'Details',
    field: 'studio',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  vinyl_color: {
    id: 'vinyl_color',
    label: 'Vinyl Color',
    category: 'Details',
    field: 'vinyl_color',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  vinyl_weight: {
    id: 'vinyl_weight',
    label: 'Vinyl Weight',
    category: 'Details',
    field: 'vinyl_weight',
    sortable: true,
    width: 100,
    align: 'left',
    defaultVisible: false
  },
  
  master_release: {
    id: 'master_release',
    label: 'Master Release',
    category: 'Details',
    field: 'master_release_date',
    sortable: true,
    width: 130,
    align: 'left',
    defaultVisible: true
  },
  
  original_release_date: {
    id: 'original_release_date',
    label: 'Original Release Date',
    category: 'Details',
    field: 'original_release_date',
    sortable: true,
    width: 150,
    align: 'left',
    defaultVisible: false
  },
  
  recording_date: {
    id: 'recording_date',
    label: 'Recording Date',
    category: 'Details',
    field: 'recording_date',
    sortable: true,
    width: 130,
    align: 'left',
    defaultVisible: false
  },

  // ============================================================================
  // EDITION CATEGORY
  // ============================================================================
  discs: {
    id: 'discs',
    label: 'Discs',
    category: 'Edition',
    field: 'discs',
    sortable: true,
    width: 50,
    align: 'center',
    defaultVisible: true
  },
  
  length: {
    id: 'length',
    label: 'Length',
    category: 'Edition',
    field: 'length_seconds',
    sortable: true,
    width: 70,
    align: 'left',
    defaultVisible: true
  },
  
  tracks: {
    id: 'tracks',
    label: 'Tracks',
    category: 'Edition',
    field: 'spotify_total_tracks',
    sortable: true,
    width: 60,
    align: 'center',
    defaultVisible: true
  },

  // ============================================================================
  // CLASSICAL CATEGORY
  // ============================================================================
  chorus: {
    id: 'chorus',
    label: 'Chorus',
    category: 'Classical',
    field: 'chorus',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  composer: {
    id: 'composer',
    label: 'Composer',
    category: 'Classical',
    field: 'composer',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  composition: {
    id: 'composition',
    label: 'Composition',
    category: 'Classical',
    field: 'composition',
    sortable: true,
    width: 150,
    align: 'left',
    defaultVisible: false
  },
  
  conductor: {
    id: 'conductor',
    label: 'Conductor',
    category: 'Classical',
    field: 'conductor',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  orchestra: {
    id: 'orchestra',
    label: 'Orchestra',
    category: 'Classical',
    field: 'orchestra',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },

  // ============================================================================
  // PEOPLE CATEGORY
  // ============================================================================
  engineers: {
    id: 'engineers',
    label: 'Engineer',
    category: 'People',
    field: 'engineers',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  musicians: {
    id: 'musicians',
    label: 'Musician',
    category: 'People',
    field: 'musicians',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  producers: {
    id: 'producers',
    label: 'Producer',
    category: 'People',
    field: 'producers',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  songwriters: {
    id: 'songwriters',
    label: 'Songwriter',
    category: 'People',
    field: 'songwriters',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },

  // ============================================================================
  // PERSONAL CATEGORY
  // ============================================================================
  added_date: {
    id: 'added_date',
    label: 'Added Date',
    category: 'Personal',
    field: 'date_added',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  collection_status: {
    id: 'collection_status',
    label: 'Collection Status',
    category: 'Personal',
    field: 'collection_status',
    sortable: true,
    width: 130,
    align: 'left',
    defaultVisible: false
  },
  
  current_value: {
    id: 'current_value',
    label: 'Current Value',
    category: 'Personal',
    field: 'current_value',
    sortable: true,
    width: 100,
    align: 'right',
    defaultVisible: false
  },
  
  index_number: {
    id: 'index_number',
    label: 'Index',
    category: 'Personal',
    field: 'index_number',
    sortable: true,
    width: 80,
    align: 'center',
    defaultVisible: false
  },
  
  last_cleaned_date: {
    id: 'last_cleaned_date',
    label: 'Last Cleaned Date',
    category: 'Personal',
    field: 'last_cleaned_date',
    sortable: true,
    width: 140,
    align: 'left',
    defaultVisible: false
  },
  
  last_played_date: {
    id: 'last_played_date',
    label: 'Last Played Date',
    category: 'Personal',
    field: 'last_played_date',
    sortable: true,
    width: 140,
    align: 'left',
    defaultVisible: false
  },
  
  location: {
    id: 'location',
    label: 'Location',
    category: 'Personal',
    field: 'location',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  modified_date: {
    id: 'modified_date',
    label: 'Modified Date',
    category: 'Personal',
    field: 'modified_date',
    sortable: true,
    width: 130,
    align: 'left',
    defaultVisible: false
  },
  
  my_rating: {
    id: 'my_rating',
    label: 'My Rating',
    category: 'Personal',
    field: 'my_rating',
    sortable: true,
    width: 100,
    align: 'center',
    defaultVisible: false
  },
  
  notes: {
    id: 'notes',
    label: 'Notes',
    category: 'Personal',
    field: 'notes',
    sortable: false,
    width: 200,
    align: 'left',
    defaultVisible: false
  },
  
  owner: {
    id: 'owner',
    label: 'Owner',
    category: 'Personal',
    field: 'owner',
    sortable: true,
    width: 100,
    align: 'left',
    defaultVisible: false
  },
  
  play_count: {
    id: 'play_count',
    label: 'Play Count',
    category: 'Personal',
    field: 'play_count',
    sortable: true,
    width: 90,
    align: 'center',
    defaultVisible: false
  },
  
  purchase_date: {
    id: 'purchase_date',
    label: 'Purchase Date',
    category: 'Personal',
    field: 'purchase_date',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  purchase_price: {
    id: 'purchase_price',
    label: 'Purchase Price',
    category: 'Personal',
    field: 'purchase_price',
    sortable: true,
    width: 110,
    align: 'right',
    defaultVisible: false
  },
  
  purchase_store: {
    id: 'purchase_store',
    label: 'Purchase Store',
    category: 'Personal',
    field: 'purchase_store',
    sortable: true,
    width: 130,
    align: 'left',
    defaultVisible: false
  },
  
  signed_by: {
    id: 'signed_by',
    label: 'Signed by',
    category: 'Personal',
    field: 'signed_by',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  },
  
  tags: {
    id: 'tags',
    label: 'Tags',
    category: 'Personal',
    field: 'custom_tags',
    sortable: false,
    width: 200,
    align: 'left',
    defaultVisible: false
  },

  // ============================================================================
  // LOAN CATEGORY
  // ============================================================================
  due_date: {
    id: 'due_date',
    label: 'Due Date',
    category: 'Loan',
    field: 'due_date',
    sortable: true,
    width: 110,
    align: 'left',
    defaultVisible: false
  },
  
  loan_date: {
    id: 'loan_date',
    label: 'Loan Date',
    category: 'Loan',
    field: 'loan_date',
    sortable: true,
    width: 110,
    align: 'left',
    defaultVisible: false
  },
  
  loaned_to: {
    id: 'loaned_to',
    label: 'Loaned To',
    category: 'Loan',
    field: 'loaned_to',
    sortable: true,
    width: 120,
    align: 'left',
    defaultVisible: false
  }
};

// ============================================================================
// COLUMN GROUPS FOR COLUMN SELECTOR UI
// ============================================================================

export const COLUMN_GROUPS: ColumnGroup[] = [
  {
    id: 'essential',
    label: 'Essential',
    icon: '⭐',
    color: '#f59e0b',
    description: 'Core fields always needed',
    columns: ['checkbox', 'owned', 'for_sale', 'edit', 'artist', 'title', 'format']
  },
  {
    id: 'identification',
    label: 'Identification',
    icon: '🔖',
    color: '#3b82f6',
    description: 'Barcodes, catalog numbers, IDs',
    columns: ['barcode', 'cat_no', 'index_number', 'sort_title', 'subtitle']
  },
  {
    id: 'physical',
    label: 'Physical Details',
    icon: '💿',
    color: '#8b5cf6',
    description: 'Physical characteristics',
    columns: ['discs', 'tracks', 'length', 'vinyl_color', 'vinyl_weight', 'rpm', 'sound', 'spars_code', 'packaging']
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
    description: 'Release dates and info',
    columns: ['release_date', 'release_year', 'master_release', 'original_release_date', 'recording_date', 'country', 'studio']
  },
  {
    id: 'collection',
    label: 'Collection Status',
    icon: '📚',
    color: '#ec4899',
    description: 'Collection flags',
    columns: ['collection_status', 'box_set', 'is_live']
  },
  {
    id: 'personal',
    label: 'Personal Tracking',
    icon: '👤',
    color: '#f43f5e',
    description: 'Personal data and ratings',
    columns: ['owner', 'my_rating', 'play_count', 'last_played_date', 'last_cleaned_date', 'signed_by', 'location', 'storage_device_slot', 'added_date', 'modified_date']
  },
  {
    id: 'metadata',
    label: 'Metadata',
    icon: '🎵',
    color: '#6366f1',
    description: 'Genres and labels',
    columns: ['genre', 'label']
  },
  {
    id: 'people',
    label: 'People & Credits',
    icon: '👥',
    color: '#06b6d4',
    description: 'Musicians, producers, etc.',
    columns: ['engineers', 'musicians', 'producers', 'songwriters']
  },
  {
    id: 'classical',
    label: 'Classical Music',
    icon: '🎻',
    color: '#ec4899',
    description: 'Classical-specific fields',
    columns: ['chorus', 'composer', 'composition', 'conductor', 'orchestra']
  },
  {
    id: 'loans',
    label: 'Loan Tracking',
    icon: '📤',
    color: '#14b8a6',
    description: 'Track loaned albums',
    columns: ['due_date', 'loan_date', 'loaned_to']
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getColumnsByCategory(category: ColumnDefinition['category']): ColumnDefinition[] {
  return Object.values(COLUMN_DEFINITIONS).filter(col => col.category === category);
}

export function getAllCategories(): ColumnDefinition['category'][] {
  return ['Main', 'Details', 'Edition', 'Classical', 'People', 'Personal', 'Loan'];
}

export function getVisibleColumns(visibleColumnIds: ColumnId[]): ColumnDefinition[] {
  return visibleColumnIds
    .map(id => COLUMN_DEFINITIONS[id])
    .filter(col => col !== undefined);
}

export function canHideColumn(columnId: ColumnId): boolean {
  const col = COLUMN_DEFINITIONS[columnId];
  return col && !col.alwaysVisible;
}

export function getColumnById(columnId: ColumnId): ColumnDefinition | undefined {
  return COLUMN_DEFINITIONS[columnId];
}
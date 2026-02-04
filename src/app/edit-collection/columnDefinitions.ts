// src/app/edit-collection/columnDefinitions.ts

export type ColumnId =
  // Main
  | 'checkbox'
  | 'owned'
  | 'menu'
  | 'artist'
  | 'title'
  | 'year'
  | 'barcode'
  | 'cat_no'
  | 'format'
  | 'labels'
  // Details
  | 'location'
  | 'country'
  | 'media_condition'
  | 'package_sleeve_condition'
  // Metadata
  | 'genres'
  | 'styles'
  | 'custom_tags'
  // Personal
  | 'added_date'
  | 'collection_status'
  | 'personal_notes'
  | 'release_notes'
  | 'owner'
  // Value
  | 'purchase_price'
  | 'current_value'
  | 'purchase_date'
  // Counts
  | 'tracks';

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
  menu: { id: 'menu', label: '✏', width: '40px', lockable: true },
  artist: { id: 'artist', label: 'Artist', width: '200px', sortable: true, lockable: true },
  title: { id: 'title', label: 'Title', width: '300px', sortable: true, lockable: true },
  year: { id: 'year', label: 'Year', width: '80px', lockable: true },
  barcode: { id: 'barcode', label: 'Barcode', width: '150px' },
  cat_no: { id: 'cat_no', label: 'Cat No', width: '120px' },
  format: { id: 'format', label: 'Format', width: '180px' },
  labels: { id: 'labels', label: 'Label', width: '160px' },

  // Details
  location: { id: 'location', label: 'Location', width: '150px' },
  country: { id: 'country', label: 'Country', width: '110px' },
  media_condition: { id: 'media_condition', label: 'Media Cond', width: '140px' },
  package_sleeve_condition: { id: 'package_sleeve_condition', label: 'Sleeve Cond', width: '140px' },

  // Metadata
  genres: { id: 'genres', label: 'Genre', width: '150px' },
  styles: { id: 'styles', label: 'Styles', width: '150px' },
  custom_tags: { id: 'custom_tags', label: 'Tags', width: '200px' },

  // Personal
  added_date: { id: 'added_date', label: 'Added', width: '120px' },
  collection_status: { id: 'collection_status', label: 'Status', width: '150px' },
  personal_notes: { id: 'personal_notes', label: 'My Notes', width: '250px' },
  release_notes: { id: 'release_notes', label: 'Release Notes', width: '250px' },
  owner: { id: 'owner', label: 'Owner', width: '120px' },

  // Value
  purchase_price: { id: 'purchase_price', label: 'Purch Price', width: '130px' },
  current_value: { id: 'current_value', label: 'Value', width: '130px' },
  purchase_date: { id: 'purchase_date', label: 'Purchase Date', width: '150px' },

  // Counts
  tracks: { id: 'tracks', label: 'Tracks', width: '80px' },
};

export const COLUMN_GROUPS = [
  {
    id: 'main',
    label: 'Main',
    icon: '📋',
    columns: [
      'checkbox', 'owned', 'menu', 'artist', 'title',
      'year', 'barcode', 'cat_no', 'format', 'labels'
    ] as ColumnId[]
  },
  {
    id: 'details',
    label: 'Details',
    icon: '📝',
    columns: [
      'location', 'country', 'media_condition', 'package_sleeve_condition'
    ] as ColumnId[]
  },
  {
    id: 'metadata',
    label: 'Metadata',
    icon: '📊',
    columns: ['genres', 'styles', 'custom_tags'] as ColumnId[]
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: '👤',
    columns: [
      'added_date', 'collection_status', 'personal_notes', 'release_notes', 'owner',
      'purchase_price', 'current_value', 'purchase_date'
    ] as ColumnId[]
  },
  {
    id: 'counts',
    label: 'Counts',
    icon: '🔢',
    columns: ['tracks'] as ColumnId[]
  }
];

export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  'checkbox',
  'owned',
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
  'menu',
  'artist',
  'title'
];

// ============================================================================
// HELPER FUNCTIONS & TYPES
// ============================================================================

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: ColumnId;
  direction: SortDirection;
}

export function getVisibleColumns(visibleIds: ColumnId[]): ColumnDefinition[] {
  return visibleIds
    .map(id => COLUMN_DEFINITIONS[id])
    .filter((col): col is ColumnDefinition => !!col);
}

export function splitColumnsByLock(columns: ColumnDefinition[], lockedIds: ColumnId[]) {
  const locked = columns.filter((col) => lockedIds.includes(col.id));
  const unlocked = columns.filter((col) => !lockedIds.includes(col.id));
  return { locked, unlocked };
}

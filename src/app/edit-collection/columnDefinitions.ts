// src/app/edit-collection/columnDefinitions.ts
// Column definitions matching the exact table structure from 3:24 PM screenshot

import { Album } from '../../types/album';

export type ColumnId = 
  | 'checkbox'
  | 'owned'
  | 'for_sale'
  | 'image'
  | 'artist'
  | 'title'
  | 'release_date'
  | 'format'
  | 'discs'
  | 'tracks'
  | 'length'
  | 'genre'
  | 'label'
  | 'added_date';

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  category: 'Main' | 'Details' | 'Edition' | 'Classical' | 'People' | 'Personal' | 'Loan';
  field: keyof Album | 'checkbox' | 'owned' | 'for_sale' | 'image';
  sortable: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
  alwaysVisible?: boolean; // System columns that can't be hidden
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
// COLUMN DEFINITIONS - EXACTLY MATCHING 3:24 PM SCREENSHOT
// ============================================================================

export const COLUMN_DEFINITIONS: Record<ColumnId, ColumnDefinition> = {
  // System columns (always visible)
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
  
  image: {
    id: 'image',
    label: '',
    category: 'Main',
    field: 'image',
    sortable: false,
    width: 60,
    align: 'center',
    alwaysVisible: true
  },

  // Data columns (can be toggled)
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
    width: 120,
    align: 'left'
  },
  
  format: {
    id: 'format',
    label: 'Format',
    category: 'Details',
    field: 'format',
    sortable: true,
    width: 150,
    align: 'left'
  },
  
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
  
  genre: {
    id: 'genre',
    label: 'Genre',
    category: 'Main',
    field: 'discogs_genres',
    sortable: true,
    width: 120,
    align: 'left'
  },
  
  label: {
    id: 'label',
    label: 'Label',
    category: 'Details',
    field: 'spotify_label',
    sortable: true,
    width: 140,
    align: 'left'
  },
  
  added_date: {
    id: 'added_date',
    label: 'Added Date',
    category: 'Personal',
    field: 'date_added',
    sortable: true,
    width: 120,
    align: 'left'
  }
};

// ============================================================================
// DEFAULT VISIBLE COLUMNS - MATCHES 3:24 PM SCREENSHOT EXACTLY
// ============================================================================

export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  'checkbox',
  'owned',
  'for_sale',
  'image',
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

// ============================================================================
// COLUMN GROUPS FOR SELECTOR UI (MATCHING CLZ STRUCTURE)
// ============================================================================

export const COLUMN_GROUPS: ColumnGroup[] = [
  {
    id: 'main',
    label: 'Main',
    icon: '⭐',
    color: '#FF8C42',
    description: 'Core album information',
    columns: ['artist', 'title', 'release_date', 'genre']
  },
  {
    id: 'details',
    label: 'Details',
    icon: '📋',
    color: '#5BA3D0',
    description: 'Detailed information',
    columns: ['format', 'label']
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
    columns: ['added_date']
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
  return col ? !col.alwaysVisible : false;
}

export function getColumnById(columnId: ColumnId): ColumnDefinition | undefined {
  return COLUMN_DEFINITIONS[columnId];
}
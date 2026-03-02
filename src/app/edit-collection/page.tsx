// src/app/edit-collection/page.tsx
'use client';

import { useCallback, useEffect, useState, useMemo, useRef, Suspense, Fragment, type ReactNode } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabaseClient';
import CollectionTable from '../../components/CollectionTable';
import ColumnSelector from '../../components/ColumnSelector';
import { ColumnId, COLUMN_DEFINITIONS, COLUMN_GROUPS, DEFAULT_VISIBLE_COLUMNS, DEFAULT_LOCKED_COLUMNS, SortState } from './columnDefinitions';
import type { Album } from '../../types/album';
import { toSafeStringArray, toSafeSearchString } from '../../types/album';
import EditAlbumModal from './EditAlbumModal';
import NewCrateModal from './crates/NewCrateModal';
import NewSmartCrateModal from './crates/NewSmartCrateModal';
import { AddToCrateModal } from './crates/AddToCrateModal';
import AddToPlaylistModal from './playlists/AddToPlaylistModal';
import PlaylistStudioModal, { type PlaylistStudioView } from './playlists/PlaylistStudioModal';
import Header from './Header';
import { ManageColumnFavoritesModal, type ColumnFavorite } from './ManageColumnFavoritesModal';
import { ManageSortFavoritesModal, type SortFavorite, type SortField } from './ManageSortFavoritesModal';
import SortSelectorModal from './SortSelectorModal';
import type { Crate } from '../../types/crate';
import type { CollectionPlaylist } from '../../types/collectionPlaylist';
import type { SmartPlaylistRules } from '../../types/collectionPlaylist';
import type { CollectionTrackRow } from '../../types/collectionTrackRow';
import { albumMatchesSmartCrate } from '../../lib/crateUtils';
import { trackMatchesSmartPlaylist } from '../../lib/playlistUtils';
import CollectionInfoPanel from './components/CollectionInfoPanel';
import { BoxIcon } from '../../components/BoxIcon';
import { getDisplayFormat } from '../../utils/formatDisplay';
import {
  getAlbumArtist,
  getAlbumDecade,
  getAlbumFormat,
  getAlbumGenres,
  getAlbumTags,
  getAlbumTitle,
  getAlbumYearInt,
  getAlbumYearValue
} from './albumHelpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;

type SortOption = 
  | 'artist-asc' | 'artist-desc' 
  | 'title-asc' | 'title-desc' 
  | 'year-desc' | 'year-asc' 
  | 'added-desc' | 'added-asc' 
  | 'format-asc' | 'format-desc' 
  | 'tags-count-desc' | 'tags-count-asc' 
  | 'condition-asc' | 'condition-desc'
  | 'location-asc' | 'location-desc'
  | 'decade-desc' | 'decade-asc';

type TrackSortOption =
  | 'album-asc' | 'album-desc'
  | 'track-asc' | 'track-desc'
  | 'artist-asc' | 'artist-desc'
  | 'position-asc' | 'position-desc'
  | 'duration-asc' | 'duration-desc';

const SORT_OPTIONS: { value: SortOption; label: string; category: string }[] = [
  { value: 'artist-asc', label: 'Artist (A→Z)', category: 'Basic' },
  { value: 'artist-desc', label: 'Artist (Z→A)', category: 'Basic' },
  { value: 'title-asc', label: 'Title (A→Z)', category: 'Basic' },
  { value: 'title-desc', label: 'Title (Z→A)', category: 'Basic' },
  { value: 'year-desc', label: 'Year (Newest First)', category: 'Time' },
  { value: 'year-asc', label: 'Year (Oldest First)', category: 'Time' },
  { value: 'decade-desc', label: 'Decade (Newest)', category: 'Time' },
  { value: 'decade-asc', label: 'Decade (Oldest)', category: 'Time' },
  { value: 'added-desc', label: 'Date Added (Newest)', category: 'Time' },
  { value: 'added-asc', label: 'Date Added (Oldest)', category: 'Time' },
  { value: 'format-asc', label: 'Format (A→Z)', category: 'Physical' },
  { value: 'format-desc', label: 'Format (Z→A)', category: 'Physical' },
  { value: 'location-asc', label: 'Location (A→Z)', category: 'Physical' },
  { value: 'location-desc', label: 'Location (Z→A)', category: 'Physical' },
  { value: 'condition-asc', label: 'Condition (A→Z)', category: 'Physical' },
  { value: 'condition-desc', label: 'Condition (Z→A)', category: 'Physical' },
  { value: 'tags-count-desc', label: 'Most Tags', category: 'Metadata' },
  { value: 'tags-count-asc', label: 'Fewest Tags', category: 'Metadata' }
];

const TRACK_SORT_OPTIONS: { value: TrackSortOption; label: string; category: string }[] = [
  { value: 'album-asc', label: 'Album (A→Z)', category: 'Album' },
  { value: 'album-desc', label: 'Album (Z→A)', category: 'Album' },
  { value: 'artist-asc', label: 'Track Artist (A→Z)', category: 'Track' },
  { value: 'artist-desc', label: 'Track Artist (Z→A)', category: 'Track' },
  { value: 'track-asc', label: 'Track Title (A→Z)', category: 'Track' },
  { value: 'track-desc', label: 'Track Title (Z→A)', category: 'Track' },
  { value: 'position-asc', label: 'Position (A1→B1...)', category: 'Order' },
  { value: 'position-desc', label: 'Position (Reverse)', category: 'Order' },
  { value: 'duration-asc', label: 'Duration (Shortest)', category: 'Duration' },
  { value: 'duration-desc', label: 'Duration (Longest)', category: 'Duration' },
];

type AppViewMode = 'collection' | 'album-track' | 'playlist';
type SidebarMode = 'format' | 'crates' | 'playlists';
type TrackListSource = 'crates' | 'playlists';
type ColumnSelectorMode = AppViewMode;
type TrackViewColumnId =
  | 'checkbox'
  | 'track_title'
  | 'track_artist'
  | 'album_title'
  | 'album_artist'
  | 'position'
  | 'length'
  | 'my_rating'
  | 'format'
  | 'genre'
  | 'label'
  | 'year'
  | 'added_date'
  | 'location'
  | 'collection_status'
  | 'personal_notes';

type Playlist = CollectionPlaylist;

const PLAYLIST_STORAGE_KEYS = [
  'collection-playlists-backup-v2',
  'collection-track-playlists',
  'collection-playlists-recovery-migrated-v1',
];

const clearPlaylistRecoveryStorage = () => {
  for (const key of PLAYLIST_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
};

interface TrackAlbumGroup {
  inventoryId: number;
  albumArtist: string;
  albumTitle: string;
  trackCount: number;
  totalSeconds: number;
  tracks: CollectionTrackRow[];
  sideTotals: Array<{ side: string; totalSeconds: number; trackCount: number }>;
}

const MEDIA_TYPE_FACETS = new Set([
  'Vinyl',
  'CD',
  'Cassette',
  '8-Track',
  'DVD',
  'All Media',
  'Box Set',
  'SACD',
  'Flexi-disc',
]);

const formatTrackDuration = (seconds: number | null | undefined): string => {
  if (!seconds || seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${remain.toString().padStart(2, '0')}`;
};

const parseDurationLabelToSeconds = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parts = value.split(':').map((item) => Number(item));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

const normalizeTrackPosition = (position: string | null | undefined, fallback: number): string => {
  const raw = (position ?? '').trim();
  if (raw) return raw;
  return String(fallback);
};

const TRACK_VIEW_COLUMN_DEFINITIONS: Record<TrackViewColumnId, { id: TrackViewColumnId; label: string }> = {
  checkbox: { id: 'checkbox', label: '' },
  track_title: { id: 'track_title', label: 'Track' },
  track_artist: { id: 'track_artist', label: 'Track Artist' },
  album_title: { id: 'album_title', label: 'Album' },
  album_artist: { id: 'album_artist', label: 'Album Artist' },
  position: { id: 'position', label: 'Pos' },
  length: { id: 'length', label: 'Length' },
  my_rating: { id: 'my_rating', label: 'Rating' },
  format: { id: 'format', label: 'Format' },
  genre: { id: 'genre', label: 'Genre' },
  label: { id: 'label', label: 'Label' },
  year: { id: 'year', label: 'Year' },
  added_date: { id: 'added_date', label: 'Added' },
  location: { id: 'location', label: 'Location' },
  collection_status: { id: 'collection_status', label: 'Status' },
  personal_notes: { id: 'personal_notes', label: 'Notes' },
};

const TRACK_VIEW_COLUMN_GROUPS: Array<{ id: string; label: string; icon: string; columns: TrackViewColumnId[] }> = [
  {
    id: 'track-main',
    label: 'Main',
    icon: '🎵',
    columns: ['checkbox', 'track_title', 'track_artist', 'album_title', 'album_artist', 'position', 'length', 'my_rating'],
  },
  {
    id: 'track-edition',
    label: 'Edition',
    icon: '💿',
    columns: ['format', 'year', 'added_date'],
  },
  {
    id: 'track-metadata',
    label: 'Metadata',
    icon: '🏷️',
    columns: ['genre', 'label'],
  },
  {
    id: 'track-personal',
    label: 'Personal',
    icon: '📝',
    columns: ['location', 'collection_status', 'personal_notes'],
  },
];

const DEFAULT_ALBUM_TRACK_VISIBLE_COLUMNS: TrackViewColumnId[] = [
  'checkbox',
  'track_title',
  'track_artist',
  'album_title',
  'position',
  'length',
];

const DEFAULT_PLAYLIST_VISIBLE_COLUMNS: TrackViewColumnId[] = [
  'checkbox',
  'track_title',
  'track_artist',
  'album_title',
  'position',
  'length',
  'my_rating',
];

const TRACK_COLUMN_CONTROL_IDS = new Set<TrackViewColumnId>(['checkbox']);
const TRACK_COLUMN_RIGHT_ALIGN_IDS = new Set<TrackViewColumnId>(['length', 'my_rating']);
const COLLECTION_CONTROL_COLUMNS: ColumnId[] = ['checkbox', 'owned', 'for_sale_indicator', 'menu'];

const DEFAULT_COLLECTION_COLUMN_FAVORITES: ColumnFavorite[] = [
  {
    id: 'collection-favorite-my-list',
    name: 'My List View columns',
    columns: ['Artist', 'Title', 'Format', 'My Notes', 'Genre', 'Added'],
  },
  {
    id: 'collection-favorite-duplicates',
    name: 'My Find Duplicates columns',
    columns: ['Artist', 'Title', 'Year', 'Label', 'Discs', 'Tracks', 'Added'],
  },
];

const DEFAULT_COLLECTION_SORT_FAVORITES: SortFavorite[] = [
  {
    id: 'collection-sort-artist-title',
    name: 'Artist | Title',
    fields: [
      { field: 'Artist', direction: 'asc' },
      { field: 'Title', direction: 'asc' },
    ],
  },
  {
    id: 'collection-sort-added',
    name: 'Added Date/Time',
    fields: [
      { field: 'Added Date', direction: 'desc' },
    ],
  },
  {
    id: 'collection-sort-format-artist',
    name: 'Format | Artist',
    fields: [
      { field: 'Format', direction: 'asc' },
      { field: 'Artist', direction: 'asc' },
    ],
  },
];

const TRACK_COLUMN_FIELD_GROUPS: Record<string, string[]> = {
  Main: ['Track', 'Track Artist', 'Album', 'Album Artist', 'Position', 'Length', 'Rating'],
  Edition: ['Format', 'Year', 'Added Date'],
  Metadata: ['Genre', 'Label'],
  Personal: ['Location', 'Collection Status', 'Notes'],
};

const DEFAULT_ALBUM_TRACK_COLUMN_FAVORITES: ColumnFavorite[] = [
  {
    id: 'album-track-favorite-default',
    name: 'My Album / Track columns',
    columns: ['Track', 'Track Artist', 'Album', 'Position', 'Length'],
  },
];

const DEFAULT_PLAYLIST_COLUMN_FAVORITES: ColumnFavorite[] = [
  {
    id: 'playlist-favorite-default',
    name: 'My Playlist columns',
    columns: ['Track', 'Track Artist', 'Album', 'Position', 'Length', 'Rating'],
  },
];

const TRACK_SORT_FIELD_GROUPS: Record<string, string[]> = {
  Main: ['Album', 'Album Artist', 'Track Title', 'Track Artist', 'Position', 'Duration', 'Rating', 'Year', 'Added Date'],
  Metadata: ['Genre', 'Label', 'Format'],
  Personal: ['Location', 'Collection Status'],
};

const DEFAULT_ALBUM_TRACK_SORT_FAVORITES: SortFavorite[] = [
  {
    id: 'album-track-sort-default',
    name: 'Album | Position',
    fields: [
      { field: 'Album', direction: 'asc' },
      { field: 'Position', direction: 'asc' },
    ],
  },
];

const DEFAULT_PLAYLIST_SORT_FAVORITES: SortFavorite[] = [
  {
    id: 'playlist-sort-default',
    name: 'Track Artist | Track Title',
    fields: [
      { field: 'Track Artist', direction: 'asc' },
      { field: 'Track Title', direction: 'asc' },
    ],
  },
];

const COLLECTION_COLUMN_FIELD_GROUPS: Record<string, string[]> = Object.fromEntries(
  COLUMN_GROUPS.map((group) => [
    group.label,
    group.columns
      .map((columnId) => COLUMN_DEFINITIONS[columnId]?.label)
      .filter((label): label is string => Boolean(label)),
  ])
);

const COLLECTION_SORT_FIELD_GROUPS: Record<string, string[]> = {
  Main: [
    'Artist',
    'Barcode',
    'Cat No',
    'Core AlbumID',
    'Format',
    'Genre',
    'Label',
    'Original Release Date',
    'Original Release Month',
    'Original Release Year',
    'Recording Date',
    'Recording Month',
    'Recording Year',
    'Release Date',
    'Release Month',
    'Release Year',
    'Sort Title',
    'Subtitle',
    'Title',
  ],
  Details: [
    'Box Set',
    'Country',
    'Extra',
    'Is Live',
    'Media Condition',
    'Package/Sleeve Condition',
    'Packaging',
    'RPM',
    'Sound',
    'SPARS',
    'Storage Device',
    'Storage Device Slot',
    'Studio',
    'Vinyl Color',
    'Vinyl Weight',
  ],
  Edition: ['Discs', 'Length', 'Tracks'],
  Classical: ['Chorus', 'Composer', 'Composition', 'Conductor', 'Orchestra'],
  People: ['Engineer', 'Musician', 'Producer', 'Songwriter'],
  Personal: [
    'Added Date',
    'Added Year',
    'Collection Status',
    'Current Value',
    'Index',
    'Last Cleaned Date',
    'Last Cleaned Year',
    'Last Played Date',
    'Location',
    'Modified Date',
    'My Rating',
    'Notes',
    'Owner',
    'Play Count',
    'Played Year',
    'Purchase Date',
    'Purchase Price',
    'Purchase Store',
    'Purchase Year',
    'Quantity',
    'Signed by',
    'Tags',
  ],
  Loan: ['Due Date', 'Loan Date', 'Loaned To'],
};

const formatDisplayDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTrackStatus = (status: string | null | undefined): string => {
  if (!status) return '—';
  switch (status) {
    case 'wishlist':
    case 'wish_list':
      return 'Wish List';
    case 'incoming':
    case 'on_order':
      return 'On Order';
    case 'sold':
      return 'Sold';
    case 'active':
      return 'In Collection';
    case 'for_sale':
      return 'For Sale';
    default:
      return status;
  }
};

const formatTrackArrayValues = (values: string[] | null | undefined): string => {
  if (!values || values.length === 0) return '—';
  return values.join(' | ');
};

const getTrackPositionLabel = (row: CollectionTrackRow): string => {
  const positionNumber = (row.position.match(/\d+/g) ?? [row.position]).slice(-1)[0];
  return row.side ? `${row.side}${positionNumber}` : row.position;
};

const isCollectionColumnId = (value: string): value is ColumnId =>
  Object.prototype.hasOwnProperty.call(COLUMN_DEFINITIONS, value);

const isTrackViewColumnId = (value: string): value is TrackViewColumnId =>
  Object.prototype.hasOwnProperty.call(TRACK_VIEW_COLUMN_DEFINITIONS, value);

const mapFavoriteColumnsToCollectionColumns = (favorite: ColumnFavorite | null): ColumnId[] => {
  if (!favorite) return [];

  const byLabel = Object.values(COLUMN_DEFINITIONS).reduce((acc, definition) => {
    acc[definition.label.toLowerCase()] = definition.id;
    return acc;
  }, {} as Record<string, ColumnId>);

  const aliases: Record<string, ColumnId> = {
    genre: 'genres',
    genres: 'genres',
    style: 'styles',
    styles: 'styles',
    label: 'labels',
    labels: 'labels',
    'my notes': 'personal_notes',
    notes: 'personal_notes',
    owner: 'owner',
    location: 'location',
    format: 'format',
    artist: 'artist',
    title: 'title',
    year: 'year',
    barcode: 'barcode',
    'cat no': 'cat_no',
    'cat no.': 'cat_no',
    discs: 'discs',
    tracks: 'tracks',
    length: 'length',
    added: 'added_date',
    'added date': 'added_date',
    status: 'collection_status',
    rating: 'my_rating',
  };

  return favorite.columns
    .map((column) => {
      const key = column.toLowerCase().trim();
      return byLabel[key] ?? aliases[key] ?? null;
    })
    .filter((columnId): columnId is ColumnId => Boolean(columnId))
    .filter((columnId, index, arr) => arr.indexOf(columnId) === index);
};

const mapFavoriteColumnsToTrackColumns = (favorite: ColumnFavorite | null): TrackViewColumnId[] => {
  if (!favorite) return [];

  const byLabel = Object.values(TRACK_VIEW_COLUMN_DEFINITIONS).reduce((acc, definition) => {
    acc[definition.label.toLowerCase()] = definition.id;
    return acc;
  }, {} as Record<string, TrackViewColumnId>);

  const aliases: Record<string, TrackViewColumnId> = {
    track: 'track_title',
    title: 'album_title',
    'track title': 'track_title',
    artist: 'track_artist',
    'track artist': 'track_artist',
    album: 'album_title',
    'album title': 'album_title',
    'album artist': 'album_artist',
    pos: 'position',
    position: 'position',
    length: 'length',
    duration: 'length',
    rating: 'my_rating',
    format: 'format',
    genre: 'genre',
    label: 'label',
    year: 'year',
    added: 'added_date',
    'added date': 'added_date',
    location: 'location',
    status: 'collection_status',
    'collection status': 'collection_status',
    notes: 'personal_notes',
    'my notes': 'personal_notes',
  };

  return favorite.columns
    .map((column) => {
      const key = column.toLowerCase().trim();
      return byLabel[key] ?? aliases[key] ?? null;
    })
    .filter((columnId): columnId is TrackViewColumnId => Boolean(columnId))
    .filter((columnId, index, arr) => arr.indexOf(columnId) === index);
};

const getAlbumSortMetric = (album: Album, fieldName: string): string | number | null => {
  const field = fieldName.toLowerCase().trim();

  if (field === 'artist') return getAlbumArtist(album);
  if (field === 'title') return getAlbumTitle(album);
  if (field === 'sort title') return album.sort_title ?? getAlbumTitle(album);
  if (field === 'format') return getDisplayFormat(getAlbumFormat(album));
  if (field === 'genre') return toSafeStringArray(getAlbumGenres(album)).join(' | ');
  if (field === 'label') return album.release?.label ?? album.label ?? '';
  if (field === 'cat no' || field === 'cat no.') return album.cat_no ?? album.catalog_number ?? album.release?.catalog_number ?? '';
  if (field === 'barcode') return album.barcode ?? album.release?.barcode ?? '';
  if (field === 'location') return album.location ?? '';
  if (field === 'collection status') return album.collection_status ?? album.status ?? '';
  if (field === 'my rating') return album.my_rating ?? 0;
  if (field === 'purchase price') return album.purchase_price ?? 0;
  if (field === 'current value') return album.current_value ?? 0;
  if (field === 'play count') return album.play_count ?? 0;
  if (field === 'tracks') return album.release?.release_tracks?.length ?? album.tracks?.length ?? 0;
  if (field === 'discs') return album.discs ?? album.release?.qty ?? 0;
  if (field === 'index' || field === 'core albumid') return album.index_number ?? album.id ?? 0;
  if (field === 'added year') return new Date(album.date_added ?? '').getFullYear() || 0;
  if (field === 'release year' || field === 'original release year' || field === 'recording year') return getAlbumYearInt(album) ?? 0;
  if (field === 'decade') return getAlbumDecade(album) ?? 0;

  if (
    field === 'added date' ||
    field === 'added date/time' ||
    field === 'release date' ||
    field === 'original release date' ||
    field === 'recording date' ||
    field === 'purchase date' ||
    field === 'modified date' ||
    field === 'last played date'
  ) {
    const source =
      field === 'purchase date' ? album.purchase_date :
      field === 'modified date' || field === 'last played date' ? album.last_played_at :
      field === 'release date' || field === 'original release date' || field === 'recording date' ? album.master_release_date :
      album.date_added;
    const parsed = Date.parse(source ?? '');
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  }

  if (field === 'media condition') return album.media_condition ?? '';
  if (field === 'package/sleeve condition') return album.package_sleeve_condition ?? album.sleeve_condition ?? '';
  if (field === 'tags') return toSafeStringArray(album.custom_tags ?? getAlbumTags(album)).join(' | ');

  return null;
};

const compareAlbumSortMetric = (
  aValue: string | number | null,
  bValue: string | number | null,
  direction: 'asc' | 'desc'
): number => {
  const multiplier = direction === 'asc' ? 1 : -1;
  const aNull = aValue == null || aValue === '';
  const bNull = bValue == null || bValue === '';
  if (aNull && bNull) return 0;
  if (aNull) return 1 * multiplier;
  if (bNull) return -1 * multiplier;

  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return (aValue - bValue) * multiplier;
  }

  return String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base', numeric: true }) * multiplier;
};

const sortAlbumsByFavoriteFields = (albums: Album[], fields: SortField[]): Album[] => {
  if (fields.length === 0) return albums;
  const sortable = [...albums];
  sortable.sort((a, b) => {
    for (const field of fields) {
      const cmp = compareAlbumSortMetric(
        getAlbumSortMetric(a, field.field),
        getAlbumSortMetric(b, field.field),
        field.direction
      );
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return sortable;
};

const getTrackSortMetric = (row: CollectionTrackRow, fieldName: string): string | number | null => {
  const field = fieldName.toLowerCase().trim();
  if (field === 'album') return row.albumTitle;
  if (field === 'album artist') return row.albumArtist;
  if (field === 'track title' || field === 'track') return row.trackTitle;
  if (field === 'track artist' || field === 'artist') return row.trackArtist;
  if (field === 'position' || field === 'pos') return getTrackPositionSortValue(row.position, row.side);
  if (field === 'duration' || field === 'length') return row.durationSeconds ?? 0;
  if (field === 'rating' || field === 'my rating') return row.myRating ?? 0;
  if (field === 'year') return row.yearInt ?? 0;
  if (field === 'format') return row.trackFormatFacets.join(' | ') || row.albumMediaType;
  if (field === 'genre') return formatTrackArrayValues(row.genres);
  if (field === 'label') return formatTrackArrayValues(row.labels ?? (row.label ? [row.label] : []));
  if (field === 'location') return row.location ?? '';
  if (field === 'collection status') return formatTrackStatus(row.status);
  if (field === 'added date') {
    const parsed = Date.parse(row.dateAdded ?? '');
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  }
  return null;
};

const compareTrackSortMetric = (
  aValue: string | number | null,
  bValue: string | number | null,
  direction: 'asc' | 'desc'
): number => {
  const multiplier = direction === 'asc' ? 1 : -1;
  const aNull = aValue == null || aValue === '';
  const bNull = bValue == null || bValue === '';
  if (aNull && bNull) return 0;
  if (aNull) return 1 * multiplier;
  if (bNull) return -1 * multiplier;
  if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * multiplier;
  return String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base', numeric: true }) * multiplier;
};

const sortTrackRowsByFavoriteFields = (rows: CollectionTrackRow[], fields: SortField[]): CollectionTrackRow[] => {
  if (fields.length === 0) return rows;
  const sortable = [...rows];
  sortable.sort((a, b) => {
    for (const field of fields) {
      const cmp = compareTrackSortMetric(
        getTrackSortMetric(a, field.field),
        getTrackSortMetric(b, field.field),
        field.direction
      );
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return sortable;
};

const pickSmartPlaylistMix = (
  matches: CollectionTrackRow[],
  maxTracks: number,
  allowArtistConcentration: boolean,
  allowAlbumConcentration: boolean
): Set<string> => {
  const shuffled = [...matches];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // For broad mixes (no explicit artist rule), keep artist repeats low:
  // up to 15 tracks => max 1 per artist, otherwise max 2 per artist.
  const artistCap = allowArtistConcentration ? Number.POSITIVE_INFINITY : (maxTracks <= 15 ? 1 : 2);
  // Unless album is explicitly part of the rule, keep album repeats at 1.
  const albumCap = allowAlbumConcentration ? Number.POSITIVE_INFINITY : 1;

  const artistCounts = new Map<string, number>();
  const albumCounts = new Map<string, number>();
  const selected = new Set<string>();

  shuffled.forEach((row) => {
    if (selected.size >= maxTracks) return;
    const artist = row.trackArtist || row.albumArtist || '';
    const album = row.albumTitle || '';
    const artistCount = artistCounts.get(artist) ?? 0;
    const albumCount = albumCounts.get(album) ?? 0;
    if (artistCount >= artistCap || albumCount >= albumCap) return;
    selected.add(row.key);
    artistCounts.set(artist, artistCount + 1);
    albumCounts.set(album, albumCount + 1);
  });

  return selected;
};

const getDateScore = (value: string | null | undefined): number => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

const selectSmartPlaylistKeys = (
  matches: CollectionTrackRow[],
  maxTracks: number,
  selectedBy: NonNullable<SmartPlaylistRules['selectedBy']>,
  allowArtistConcentration: boolean,
  allowAlbumConcentration: boolean
): Set<string> => {
  if (selectedBy === 'random') {
    return pickSmartPlaylistMix(matches, maxTracks, allowArtistConcentration, allowAlbumConcentration);
  }

  const sorted = [...matches];
  sorted.sort((a, b) => {
    switch (selectedBy) {
      case 'album':
        return `${a.albumTitle} ${a.trackTitle}`.localeCompare(`${b.albumTitle} ${b.trackTitle}`);
      case 'artist':
        return `${a.trackArtist} ${a.trackTitle}`.localeCompare(`${b.trackArtist} ${b.trackTitle}`);
      case 'genre':
        return `${a.genres?.[0] ?? ''} ${a.trackTitle}`.localeCompare(`${b.genres?.[0] ?? ''} ${b.trackTitle}`);
      case 'title':
        return a.trackTitle.localeCompare(b.trackTitle);
      case 'highest_rating':
        return (b.myRating ?? 0) - (a.myRating ?? 0);
      case 'lowest_rating':
        return (a.myRating ?? 0) - (b.myRating ?? 0);
      case 'most_recently_played':
        return getDateScore(b.lastPlayedAt) - getDateScore(a.lastPlayedAt);
      case 'least_recently_played':
        return getDateScore(a.lastPlayedAt) - getDateScore(b.lastPlayedAt);
      case 'most_often_played':
        return (b.playCount ?? 0) - (a.playCount ?? 0);
      case 'least_often_played':
        return (a.playCount ?? 0) - (b.playCount ?? 0);
      case 'most_recently_added':
        return getDateScore(b.dateAdded) - getDateScore(a.dateAdded);
      case 'least_recently_added':
        return getDateScore(a.dateAdded) - getDateScore(b.dateAdded);
      default:
        return 0;
    }
  });

  return new Set(sorted.slice(0, maxTracks).map((row) => row.key));
};

const buildSmartPlaylistTrackKeys = (
  rows: CollectionTrackRow[],
  config: {
    smartRules: SmartPlaylistRules;
    matchRules: 'all' | 'any';
  }
): string[] => {
  const tempPlaylist: CollectionPlaylist = {
    id: -1,
    name: '__temp_smart__',
    icon: '⚡',
    color: '#3b82f6',
    trackKeys: [],
    createdAt: new Date().toISOString(),
    sortOrder: 0,
    isSmart: true,
    smartRules: config.smartRules,
    matchRules: config.matchRules,
    liveUpdate: true,
  };

  const matches = rows.filter((row) => trackMatchesSmartPlaylist(row, tempPlaylist));
  const maxTracks = config.smartRules.maxTracks ?? null;
  if (typeof maxTracks !== 'number' || maxTracks <= 0 || matches.length <= maxTracks) {
    return matches.map((row) => row.key);
  }

  const rules = config.smartRules.rules ?? [];
  const hasArtistRule = rules.some((rule) => rule.field === 'track_artist' || rule.field === 'album_artist');
  const hasAlbumRule = rules.some((rule) => rule.field === 'album_title');
  const selectedBy = config.smartRules.selectedBy ?? 'random';

  return Array.from(
    selectSmartPlaylistKeys(matches, maxTracks, selectedBy, hasArtistRule, hasAlbumRule)
  );
};

const getTrackPositionSortValue = (position: string, side: string | null): number => {
  const parsedSide = (side ?? position.trim().charAt(0)).toUpperCase();
  const sideWeight = parsedSide >= 'A' && parsedSide <= 'Z' ? parsedSide.charCodeAt(0) - 65 : 100;
  const match = position.match(/\d+/g);
  const number = match?.length ? Number(match[match.length - 1]) : 999;
  return sideWeight * 1000 + (Number.isNaN(number) ? 999 : number);
};

const canonicalizeFormatFacet = (value: string): string | null => {
  const token = value.trim().toLowerCase();
  if (!token) return null;

  const mapped: Array<[RegExp, string]> = [
    [/^vinyl$/, 'Vinyl'],
    [/^cd$|^compact disc$/, 'CD'],
    [/^cassette$|^cass$/, 'Cassette'],
    [/^8[- ]?track cartridge$|^8[- ]?track$/, '8-Track'],
    [/^dvd$/, 'DVD'],
    [/^all media$/, 'All Media'],
    [/^box set$/, 'Box Set'],
    [/^lp$/, 'LP'],
    [/^ep$/, 'EP'],
    [/^single$/, 'Single'],
    [/^album$/, 'Album'],
    [/^mini-album$/, 'Mini-Album'],
    [/^maxi-single$/, 'Maxi-Single'],
    [/^7"$/, '7"'],
    [/^10"$/, '10"'],
    [/^12"$/, '12"'],
    [/^45 rpm$|^45$/, '45 RPM'],
    [/^33 ?1\/3 rpm$|^33⅓ rpm$|^33 rpm$/, '33 RPM'],
    [/^78 rpm$|^78$/, '78 RPM'],
    [/^reissue$/, 'Reissue'],
    [/^stereo$/, 'Stereo'],
    [/^mono$/, 'Mono'],
  ];

  for (const [regex, label] of mapped) {
    if (regex.test(token)) return label;
  }

  return null;
};

const buildTrackFormatFacets = (album: Album): string[] => {
  const rawTokens: string[] = [];
  const mediaType = album.release?.media_type;
  if (mediaType) rawTokens.push(mediaType);

  const details = album.release?.format_details ?? [];
  details.forEach((entry) => {
    if (!entry) return;
    rawTokens.push(entry);
    entry
      .split(/[,/]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => rawTokens.push(part));
  });

  const facets = new Set<string>();
  rawTokens.forEach((token) => {
    const normalized = canonicalizeFormatFacet(token);
    if (normalized) facets.add(normalized);
  });

  return Array.from(facets);
};

const buildTrackRuleMetadata = (album: Album) => {
  const release = album.release;
  const master = release?.master;
  const masterTagLinks = master?.master_tag_links ?? [];
  const combinedGenres = Array.from(
    new Set([
      ...toSafeStringArray(master?.genres ?? album.genres),
      ...toSafeStringArray(master?.styles ?? album.styles),
    ])
  );
  const normalizedTags = masterTagLinks
    .map((link) => link.master_tags?.name)
    .filter((name): name is string => Boolean(name));

  return {
    format: getAlbumFormat(album),
    country: release?.country ?? album.country ?? null,
    location: album.location ?? null,
    status: album.status ?? null,
    barcode: release?.barcode ?? album.barcode ?? null,
    catalogNumber: release?.catalog_number ?? album.catalog_number ?? album.cat_no ?? null,
    label: release?.label ?? album.label ?? null,
    owner: album.owner ?? null,
    personalNotes: album.personal_notes ?? null,
    releaseNotes: album.release_notes ?? release?.notes ?? null,
    masterNotes: album.master_notes ?? master?.notes ?? null,
    mediaCondition: album.media_condition ?? null,
    sleeveCondition: album.sleeve_condition ?? null,
    packageSleeveCondition: album.package_sleeve_condition ?? null,
    packaging: release?.packaging ?? album.packaging ?? null,
    studio: release?.studio ?? album.studio ?? null,
    sound: release?.sound ?? album.sound ?? null,
    vinylWeight: release?.vinyl_weight ?? album.vinyl_weight ?? null,
    rpm: release?.rpm ?? album.rpm ?? null,
    sparsCode: release?.spars_code ?? album.spars_code ?? null,
    boxSet: release?.box_set ?? album.box_set ?? null,
    purchaseStore: album.purchase_store ?? null,
    notes: album.notes ?? null,
    composer: album.composer ?? null,
    conductor: album.conductor ?? null,
    chorus: album.chorus ?? null,
    composition: album.composition ?? null,
    orchestra: album.orchestra ?? null,
    yearInt: getAlbumYearInt(album) ?? null,
    decade: getAlbumDecade(album),
    myRating: album.my_rating ?? null,
    playCount: album.play_count ?? null,
    discs: release?.qty ?? album.discs ?? null,
    sides: album.sides ?? null,
    indexNumber: album.index_number ?? null,
    purchasePrice: album.purchase_price ?? null,
    currentValue: album.current_value ?? null,
    dateAdded: album.date_added ?? null,
    purchaseDate: album.purchase_date ?? null,
    lastPlayedAt: album.last_played_at ?? null,
    lastCleanedDate: album.last_cleaned_date ?? null,
    originalReleaseDate: album.master_release_date ?? null,
    recordingDate: album.recording_date ?? null,
    forSale: album.status === 'for_sale' || album.for_sale === true,
    isLive: album.is_live === true,
    customTags: toSafeStringArray(album.custom_tags ?? album.tags ?? normalizedTags),
    genres: combinedGenres,
    labels: toSafeStringArray(album.labels ?? release?.label),
    signedBy: toSafeStringArray(album.signed_by),
    songwriters: toSafeStringArray(album.songwriters),
    producers: toSafeStringArray(album.producers),
    engineers: toSafeStringArray(album.engineers),
    musicians: toSafeStringArray(album.musicians),
  };
};

function CollectionBrowserPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracksHydrated, setTracksHydrated] = useState(false);
  const [tracksHydrating, setTracksHydrating] = useState(false);
  const tracksHydratedRef = useRef(false);
  const albumsLoadVersionRef = useRef(0);
  const loadingOwnerLoadVersionRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchTypeDropdown, setShowSearchTypeDropdown] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<AppViewMode>('collection');
  const [trackSource, setTrackSource] = useState<TrackListSource>('crates');
  const [folderMode, setFolderMode] = useState<SidebarMode>('format');
  const [selectedFolderValue, setSelectedFolderValue] = useState<string | null>(null);
  const [selectedCrateId, setSelectedCrateId] = useState<number | null>(null);
  const [crates, setCrates] = useState<Crate[]>([]);
  const [crateItemCounts, setCrateItemCounts] = useState<Record<number, number>>({});
  const [crateItemsByCrate, setCrateItemsByCrate] = useState<Record<number, Set<number>>>({});
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [showPlaylistStudioModal, setShowPlaylistStudioModal] = useState(false);
  const [playlistStudioInitialView, setPlaylistStudioInitialView] = useState<PlaylistStudioView>('library');
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const [collectionFilter, setCollectionFilter] = useState<string>('All');
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  
  const [folderSearch, setFolderSearch] = useState('');
  
  const [folderSortByCount, setFolderSortByCount] = useState(false);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<number>>(new Set());
  const [selectedTrackKeys, setSelectedTrackKeys] = useState<Set<string>>(new Set());
  const [expandedAlbumIds, setExpandedAlbumIds] = useState<Set<number>>(new Set());
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null);
  const [showFolderModeDropdown, setShowFolderModeDropdown] = useState(false);
  const [showNewCrateModal, setShowNewCrateModal] = useState(false);
  const [showNewSmartCrateModal, setShowNewSmartCrateModal] = useState(false);
  const [showAddToCrateModal, setShowAddToCrateModal] = useState(false);
  const [editingCrate, setEditingCrate] = useState<Crate | null>(null);
  const [returnToAddToCrate, setReturnToAddToCrate] = useState(false);
  const [newlyCreatedCrateId, setNewlyCreatedCrateId] = useState<number | null>(null);
  
  const [sortBy, setSortBy] = useState<SortOption>('artist-asc');
  const [trackSortBy, setTrackSortBy] = useState<TrackSortOption>('album-asc');
  const [trackFormatFilterMode, setTrackFormatFilterMode] = useState<'include' | 'exclude'>('include');
  const [trackFormatFilters, setTrackFormatFilters] = useState<Set<string>>(new Set());
  
  const [showSortSelector, setShowSortSelector] = useState(false);
  const [showSortFavoritesDropdown, setShowSortFavoritesDropdown] = useState(false);
  const [showViewModeDropdown, setShowViewModeDropdown] = useState(false);
  const [showColumnFavoritesDropdown, setShowColumnFavoritesDropdown] = useState(false);
  const [showTrackFormatDropdown, setShowTrackFormatDropdown] = useState(false);
  const [, setSmartPlaylistMixNonce] = useState(0);

  const [tableSortState, setTableSortState] = useState<SortState>({
    column: null,
    direction: null
  });

  const [collectionVisibleColumns, setCollectionVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [albumTrackVisibleColumns, setAlbumTrackVisibleColumns] = useState<TrackViewColumnId[]>(DEFAULT_ALBUM_TRACK_VISIBLE_COLUMNS);
  const [playlistVisibleColumns, setPlaylistVisibleColumns] = useState<TrackViewColumnId[]>(DEFAULT_PLAYLIST_VISIBLE_COLUMNS);
  const [lockedColumns, setLockedColumns] = useState<ColumnId[]>(DEFAULT_LOCKED_COLUMNS);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [columnSelectorMode, setColumnSelectorMode] = useState<ColumnSelectorMode>('collection');
  const [showManageColumnFavoritesModal, setShowManageColumnFavoritesModal] = useState(false);
  const [showManageSortFavoritesModal, setShowManageSortFavoritesModal] = useState(false);
  const [collectionColumnFavorites, setCollectionColumnFavorites] = useState<ColumnFavorite[]>(DEFAULT_COLLECTION_COLUMN_FAVORITES);
  const [albumTrackColumnFavorites, setAlbumTrackColumnFavorites] = useState<ColumnFavorite[]>(DEFAULT_ALBUM_TRACK_COLUMN_FAVORITES);
  const [playlistColumnFavorites, setPlaylistColumnFavorites] = useState<ColumnFavorite[]>(DEFAULT_PLAYLIST_COLUMN_FAVORITES);
  const [selectedCollectionColumnFavoriteId, setSelectedCollectionColumnFavoriteId] = useState<string>(DEFAULT_COLLECTION_COLUMN_FAVORITES[0]?.id ?? '');
  const [selectedAlbumTrackColumnFavoriteId, setSelectedAlbumTrackColumnFavoriteId] = useState<string>(DEFAULT_ALBUM_TRACK_COLUMN_FAVORITES[0]?.id ?? '');
  const [selectedPlaylistColumnFavoriteId, setSelectedPlaylistColumnFavoriteId] = useState<string>(DEFAULT_PLAYLIST_COLUMN_FAVORITES[0]?.id ?? '');
  const [collectionSortFavorites, setCollectionSortFavorites] = useState<SortFavorite[]>(DEFAULT_COLLECTION_SORT_FAVORITES);
  const [albumTrackSortFavorites, setAlbumTrackSortFavorites] = useState<SortFavorite[]>(DEFAULT_ALBUM_TRACK_SORT_FAVORITES);
  const [playlistSortFavorites, setPlaylistSortFavorites] = useState<SortFavorite[]>(DEFAULT_PLAYLIST_SORT_FAVORITES);
  const [selectedCollectionSortFavoriteId, setSelectedCollectionSortFavoriteId] = useState<string>(DEFAULT_COLLECTION_SORT_FAVORITES[0]?.id ?? '');
  const [selectedAlbumTrackSortFavoriteId, setSelectedAlbumTrackSortFavoriteId] = useState<string>(DEFAULT_ALBUM_TRACK_SORT_FAVORITES[0]?.id ?? '');
  const [selectedPlaylistSortFavoriteId, setSelectedPlaylistSortFavoriteId] = useState<string>(DEFAULT_PLAYLIST_SORT_FAVORITES[0]?.id ?? '');
  const [activeCollectionSortFields, setActiveCollectionSortFields] = useState<SortField[]>(
    DEFAULT_COLLECTION_SORT_FAVORITES[0]?.fields ?? []
  );
  const [activeAlbumTrackSortFields, setActiveAlbumTrackSortFields] = useState<SortField[]>(
    DEFAULT_ALBUM_TRACK_SORT_FAVORITES[0]?.fields ?? []
  );
  const [activePlaylistSortFields, setActivePlaylistSortFields] = useState<SortField[]>(
    DEFAULT_PLAYLIST_SORT_FAVORITES[0]?.fields ?? []
  );

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const activeColumnFavorites = useMemo(() => {
    if (viewMode === 'collection') return collectionColumnFavorites;
    if (viewMode === 'album-track') return albumTrackColumnFavorites;
    return playlistColumnFavorites;
  }, [albumTrackColumnFavorites, collectionColumnFavorites, playlistColumnFavorites, viewMode]);

  const activeSelectedColumnFavoriteId = useMemo(() => {
    if (viewMode === 'collection') return selectedCollectionColumnFavoriteId;
    if (viewMode === 'album-track') return selectedAlbumTrackColumnFavoriteId;
    return selectedPlaylistColumnFavoriteId;
  }, [
    selectedAlbumTrackColumnFavoriteId,
    selectedCollectionColumnFavoriteId,
    selectedPlaylistColumnFavoriteId,
    viewMode,
  ]);

  const activeSortFavorites = useMemo(() => {
    if (viewMode === 'collection') return collectionSortFavorites;
    if (viewMode === 'album-track') return albumTrackSortFavorites;
    return playlistSortFavorites;
  }, [albumTrackSortFavorites, collectionSortFavorites, playlistSortFavorites, viewMode]);

  const activeSelectedSortFavoriteId = useMemo(() => {
    if (viewMode === 'collection') return selectedCollectionSortFavoriteId;
    if (viewMode === 'album-track') return selectedAlbumTrackSortFavoriteId;
    return selectedPlaylistSortFavoriteId;
  }, [
    selectedAlbumTrackSortFavoriteId,
    selectedCollectionSortFavoriteId,
    selectedPlaylistSortFavoriteId,
    viewMode,
  ]);

  const activeSortFields = useMemo(() => {
    if (viewMode === 'collection') return activeCollectionSortFields;
    if (viewMode === 'album-track') return activeAlbumTrackSortFields;
    return activePlaylistSortFields;
  }, [activeAlbumTrackSortFields, activeCollectionSortFields, activePlaylistSortFields, viewMode]);

  const activeSortFavoriteName = useMemo(() => {
    return activeSortFavorites.find((favorite) => favorite.id === activeSelectedSortFavoriteId)?.name ?? '';
  }, [activeSelectedSortFavoriteId, activeSortFavorites]);

  const getSortFavoriteDisplayLabel = useCallback((favorite: SortFavorite) => {
    if (!favorite.fields?.length) return favorite.name;
    return favorite.fields
      .map((field) => `${field.field} ${field.direction === 'asc' ? '↑' : '↓'}`)
      .join(' | ');
  }, []);

  const activeColumnFavoriteModalTitle =
    viewMode === 'collection'
      ? 'Manage Column Favorites'
      : viewMode === 'album-track'
        ? 'Manage Album / Track Column Favorites'
        : 'Manage Playlist Column Favorites';

  const activeSortFavoriteModalTitle =
    viewMode === 'collection'
      ? 'Manage Sorting Favorites'
      : viewMode === 'album-track'
        ? 'Manage Album / Track Sorting Favorites'
        : 'Manage Playlist Sorting Favorites';

  const activeColumnFieldGroups = viewMode === 'collection'
    ? COLLECTION_COLUMN_FIELD_GROUPS
    : TRACK_COLUMN_FIELD_GROUPS;

  const activeSortFieldGroups = viewMode === 'collection'
    ? COLLECTION_SORT_FIELD_GROUPS
    : TRACK_SORT_FIELD_GROUPS;

  useEffect(() => {
    clearPlaylistRecoveryStorage();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('collection-visible-columns');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        const filtered = parsed.filter(isCollectionColumnId);
        if (filtered.length > 0) {
          setCollectionVisibleColumns(filtered);
        }
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('collection-album-track-visible-columns');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as string[];
      const filtered = parsed.filter(isTrackViewColumnId);
      if (filtered.length > 0) {
        setAlbumTrackVisibleColumns(filtered);
      }
    } catch {
      // Invalid JSON, use defaults
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('collection-playlist-visible-columns');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as string[];
      const filtered = parsed.filter(isTrackViewColumnId);
      if (filtered.length > 0) {
        setPlaylistVisibleColumns(filtered);
      }
    } catch {
      // Invalid JSON, use defaults
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('collection-locked-columns');
    if (stored) {
      try {
        setLockedColumns(JSON.parse(stored));
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  useEffect(() => {
    const storedViewMode = localStorage.getItem('collection-view-mode');
    if (storedViewMode === 'collection' || storedViewMode === 'album-track' || storedViewMode === 'playlist') {
      setViewMode(storedViewMode);
    }
  }, []);

  useEffect(() => {
    const storedFavorites = localStorage.getItem('collection-column-favorites');
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites) as ColumnFavorite[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCollectionColumnFavorites(parsed);
          setSelectedCollectionColumnFavoriteId(parsed[0].id);
        }
      } catch {
        // ignore invalid local storage
      }
    }

    const storedSelectedFavorite = localStorage.getItem('collection-selected-column-favorite-id');
    if (storedSelectedFavorite) {
      setSelectedCollectionColumnFavoriteId(storedSelectedFavorite);
    }
  }, []);

  useEffect(() => {
    const storedFavorites = localStorage.getItem('collection-album-track-column-favorites');
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites) as ColumnFavorite[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAlbumTrackColumnFavorites(parsed);
          setSelectedAlbumTrackColumnFavoriteId(parsed[0].id);
        }
      } catch {
        // ignore invalid local storage
      }
    }

    const storedSelectedFavorite = localStorage.getItem('collection-selected-album-track-column-favorite-id');
    if (storedSelectedFavorite) {
      setSelectedAlbumTrackColumnFavoriteId(storedSelectedFavorite);
    }
  }, []);

  useEffect(() => {
    const storedFavorites = localStorage.getItem('collection-playlist-column-favorites');
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites) as ColumnFavorite[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPlaylistColumnFavorites(parsed);
          setSelectedPlaylistColumnFavoriteId(parsed[0].id);
        }
      } catch {
        // ignore invalid local storage
      }
    }

    const storedSelectedFavorite = localStorage.getItem('collection-selected-playlist-column-favorite-id');
    if (storedSelectedFavorite) {
      setSelectedPlaylistColumnFavoriteId(storedSelectedFavorite);
    }
  }, []);

  useEffect(() => {
    const storedFavorites = localStorage.getItem('collection-sort-favorites');
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites) as SortFavorite[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCollectionSortFavorites(parsed);
          setSelectedCollectionSortFavoriteId(parsed[0].id);
        }
      } catch {
        // ignore invalid local storage
      }
    }

    const storedSelectedFavorite = localStorage.getItem('collection-selected-sort-favorite-id');
    if (storedSelectedFavorite) {
      setSelectedCollectionSortFavoriteId(storedSelectedFavorite);
    }
  }, []);

  useEffect(() => {
    const storedFavorites = localStorage.getItem('collection-album-track-sort-favorites');
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites) as SortFavorite[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAlbumTrackSortFavorites(parsed);
          setSelectedAlbumTrackSortFavoriteId(parsed[0].id);
        }
      } catch {
        // ignore invalid local storage
      }
    }

    const storedSelectedFavorite = localStorage.getItem('collection-selected-album-track-sort-favorite-id');
    if (storedSelectedFavorite) {
      setSelectedAlbumTrackSortFavoriteId(storedSelectedFavorite);
    }
  }, []);

  useEffect(() => {
    const storedFavorites = localStorage.getItem('collection-playlist-sort-favorites');
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites) as SortFavorite[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPlaylistSortFavorites(parsed);
          setSelectedPlaylistSortFavoriteId(parsed[0].id);
        }
      } catch {
        // ignore invalid local storage
      }
    }

    const storedSelectedFavorite = localStorage.getItem('collection-selected-playlist-sort-favorite-id');
    if (storedSelectedFavorite) {
      setSelectedPlaylistSortFavoriteId(storedSelectedFavorite);
    }
  }, []);

  const handleCollectionColumnsChange = useCallback((columns: ColumnId[]) => {
    setCollectionVisibleColumns(columns);
    localStorage.setItem('collection-visible-columns', JSON.stringify(columns));
  }, []);

  const handleAlbumTrackColumnsChange = useCallback((columns: TrackViewColumnId[]) => {
    setAlbumTrackVisibleColumns(columns);
    localStorage.setItem('collection-album-track-visible-columns', JSON.stringify(columns));
  }, []);

  const handlePlaylistColumnsChange = useCallback((columns: TrackViewColumnId[]) => {
    setPlaylistVisibleColumns(columns);
    localStorage.setItem('collection-playlist-visible-columns', JSON.stringify(columns));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('collection-sort-preference');
    if (stored && SORT_OPTIONS.some(opt => opt.value === stored)) {
      setSortBy(stored as SortOption);
    }

    const storedTrackSort = localStorage.getItem('collection-track-sort-preference');
    if (storedTrackSort && TRACK_SORT_OPTIONS.some(opt => opt.value === storedTrackSort)) {
      setTrackSortBy(storedTrackSort as TrackSortOption);
    }

    const storedTrackFilterMode = localStorage.getItem('collection-track-format-filter-mode');
    if (storedTrackFilterMode === 'include' || storedTrackFilterMode === 'exclude') {
      setTrackFormatFilterMode(storedTrackFilterMode);
    }

    const storedTrackFilters = localStorage.getItem('collection-track-format-filters');
    if (storedTrackFilters) {
      try {
        const parsed = JSON.parse(storedTrackFilters) as string[];
        setTrackFormatFilters(new Set(parsed));
      } catch {
        // ignore invalid local storage
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('collection-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('collection-column-favorites', JSON.stringify(collectionColumnFavorites));
  }, [collectionColumnFavorites]);

  useEffect(() => {
    localStorage.setItem('collection-album-track-column-favorites', JSON.stringify(albumTrackColumnFavorites));
  }, [albumTrackColumnFavorites]);

  useEffect(() => {
    localStorage.setItem('collection-playlist-column-favorites', JSON.stringify(playlistColumnFavorites));
  }, [playlistColumnFavorites]);

  useEffect(() => {
    localStorage.setItem('collection-selected-column-favorite-id', selectedCollectionColumnFavoriteId);
  }, [selectedCollectionColumnFavoriteId]);

  useEffect(() => {
    localStorage.setItem('collection-selected-album-track-column-favorite-id', selectedAlbumTrackColumnFavoriteId);
  }, [selectedAlbumTrackColumnFavoriteId]);

  useEffect(() => {
    localStorage.setItem('collection-selected-playlist-column-favorite-id', selectedPlaylistColumnFavoriteId);
  }, [selectedPlaylistColumnFavoriteId]);

  useEffect(() => {
    localStorage.setItem('collection-sort-favorites', JSON.stringify(collectionSortFavorites));
  }, [collectionSortFavorites]);

  useEffect(() => {
    localStorage.setItem('collection-album-track-sort-favorites', JSON.stringify(albumTrackSortFavorites));
  }, [albumTrackSortFavorites]);

  useEffect(() => {
    localStorage.setItem('collection-playlist-sort-favorites', JSON.stringify(playlistSortFavorites));
  }, [playlistSortFavorites]);

  useEffect(() => {
    localStorage.setItem('collection-selected-sort-favorite-id', selectedCollectionSortFavoriteId);
  }, [selectedCollectionSortFavoriteId]);

  useEffect(() => {
    localStorage.setItem('collection-selected-album-track-sort-favorite-id', selectedAlbumTrackSortFavoriteId);
  }, [selectedAlbumTrackSortFavoriteId]);

  useEffect(() => {
    localStorage.setItem('collection-selected-playlist-sort-favorite-id', selectedPlaylistSortFavoriteId);
  }, [selectedPlaylistSortFavoriteId]);

  useEffect(() => {
    if (!selectedCollectionSortFavoriteId) return;
    const selected = collectionSortFavorites.find((favorite) => favorite.id === selectedCollectionSortFavoriteId);
    if (selected) {
      setActiveCollectionSortFields(selected.fields);
    }
  }, [collectionSortFavorites, selectedCollectionSortFavoriteId]);

  useEffect(() => {
    if (!selectedAlbumTrackSortFavoriteId) return;
    const selected = albumTrackSortFavorites.find((favorite) => favorite.id === selectedAlbumTrackSortFavoriteId);
    if (selected) {
      setActiveAlbumTrackSortFields(selected.fields);
    }
  }, [albumTrackSortFavorites, selectedAlbumTrackSortFavoriteId]);

  useEffect(() => {
    if (!selectedPlaylistSortFavoriteId) return;
    const selected = playlistSortFavorites.find((favorite) => favorite.id === selectedPlaylistSortFavoriteId);
    if (selected) {
      setActivePlaylistSortFields(selected.fields);
    }
  }, [playlistSortFavorites, selectedPlaylistSortFavoriteId]);

  useEffect(() => {
    localStorage.setItem('collection-track-sort-preference', trackSortBy);
  }, [trackSortBy]);

  useEffect(() => {
    localStorage.setItem('collection-track-format-filter-mode', trackFormatFilterMode);
  }, [trackFormatFilterMode]);

  useEffect(() => {
    localStorage.setItem('collection-track-format-filters', JSON.stringify(Array.from(trackFormatFilters)));
  }, [trackFormatFilters]);

  const handleApplyColumnFavorite = useCallback((favoriteId: string) => {
    setShowColumnFavoritesDropdown(false);
    if (viewMode === 'collection') {
      setSelectedCollectionColumnFavoriteId(favoriteId);
      const favorite = collectionColumnFavorites.find((item) => item.id === favoriteId) ?? null;
      const mapped = mapFavoriteColumnsToCollectionColumns(favorite);
      if (mapped.length === 0) return;
      const nextColumns = [...new Set([...COLLECTION_CONTROL_COLUMNS, ...mapped])];
      handleCollectionColumnsChange(nextColumns);
      return;
    }

    if (viewMode === 'album-track') {
      setSelectedAlbumTrackColumnFavoriteId(favoriteId);
      const favorite = albumTrackColumnFavorites.find((item) => item.id === favoriteId) ?? null;
      const mapped = mapFavoriteColumnsToTrackColumns(favorite);
      if (mapped.length === 0) return;
      const nextColumns = [...new Set(['checkbox' as TrackViewColumnId, ...mapped])];
      handleAlbumTrackColumnsChange(nextColumns);
      return;
    }

    setSelectedPlaylistColumnFavoriteId(favoriteId);
    const favorite = playlistColumnFavorites.find((item) => item.id === favoriteId) ?? null;
    const mapped = mapFavoriteColumnsToTrackColumns(favorite);
    if (mapped.length === 0) return;
    const nextColumns = [...new Set(['checkbox' as TrackViewColumnId, ...mapped])];
    handlePlaylistColumnsChange(nextColumns);
  }, [
    albumTrackColumnFavorites,
    collectionColumnFavorites,
    handleAlbumTrackColumnsChange,
    handleCollectionColumnsChange,
    handlePlaylistColumnsChange,
    playlistColumnFavorites,
    viewMode,
  ]);

  const handleApplySortFavorite = useCallback((favoriteId: string) => {
    setShowSortFavoritesDropdown(false);
    if (viewMode === 'collection') {
      setSelectedCollectionSortFavoriteId(favoriteId);
      const favorite = collectionSortFavorites.find((item) => item.id === favoriteId) ?? null;
      if (!favorite || favorite.fields.length === 0) return;
      setActiveCollectionSortFields(favorite.fields);
      setTableSortState({ column: null, direction: null });
      return;
    }

    if (viewMode === 'album-track') {
      setSelectedAlbumTrackSortFavoriteId(favoriteId);
      const favorite = albumTrackSortFavorites.find((item) => item.id === favoriteId) ?? null;
      if (!favorite || favorite.fields.length === 0) return;
      setActiveAlbumTrackSortFields(favorite.fields);
      return;
    }

    setSelectedPlaylistSortFavoriteId(favoriteId);
    const favorite = playlistSortFavorites.find((item) => item.id === favoriteId) ?? null;
    if (!favorite || favorite.fields.length === 0) return;
    setActivePlaylistSortFields(favorite.fields);
  }, [albumTrackSortFavorites, collectionSortFavorites, playlistSortFavorites, viewMode]);

  const handleSaveSortFields = useCallback((fields: SortField[]) => {
    if (viewMode === 'collection') {
      const targetId = selectedCollectionSortFavoriteId || collectionSortFavorites[0]?.id;
      if (!targetId) {
        setShowSortSelector(false);
        return;
      }
      setCollectionSortFavorites((prev) =>
        prev.map((favorite) => (favorite.id === targetId ? { ...favorite, fields } : favorite))
      );
      setSelectedCollectionSortFavoriteId(targetId);
      setActiveCollectionSortFields(fields);
      setTableSortState({ column: null, direction: null });
      setShowSortSelector(false);
      return;
    }

    if (viewMode === 'album-track') {
      const targetId = selectedAlbumTrackSortFavoriteId || albumTrackSortFavorites[0]?.id;
      if (!targetId) {
        setShowSortSelector(false);
        return;
      }
      setAlbumTrackSortFavorites((prev) =>
        prev.map((favorite) => (favorite.id === targetId ? { ...favorite, fields } : favorite))
      );
      setSelectedAlbumTrackSortFavoriteId(targetId);
      setActiveAlbumTrackSortFields(fields);
      setShowSortSelector(false);
      return;
    }

    const targetId = selectedPlaylistSortFavoriteId || playlistSortFavorites[0]?.id;
    if (!targetId) {
      setShowSortSelector(false);
      return;
    }
    setPlaylistSortFavorites((prev) =>
      prev.map((favorite) => (favorite.id === targetId ? { ...favorite, fields } : favorite))
    );
    setSelectedPlaylistSortFavoriteId(targetId);
    setActivePlaylistSortFields(fields);
    setShowSortSelector(false);
  }, [
    albumTrackSortFavorites,
    collectionSortFavorites,
    playlistSortFavorites,
    selectedAlbumTrackSortFavoriteId,
    selectedCollectionSortFavoriteId,
    selectedPlaylistSortFavoriteId,
    viewMode,
  ]);

  const handleTableSortChange = useCallback((column: ColumnId) => {
    setSelectedCollectionSortFavoriteId('');
    setActiveCollectionSortFields([]);
    setTableSortState(prev => {
      if (prev.column === column) {
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { column: null, direction: null };
        }
      }
      return { column, direction: 'asc' };
    });
  }, []);

  const loadAlbums = useCallback(async (options?: { includeTracks?: boolean; showSpinner?: boolean }) => {
    const includeTracks = options?.includeTracks ?? tracksHydratedRef.current;
    const showSpinner = options?.showSpinner ?? !includeTracks;
    const loadVersion = albumsLoadVersionRef.current + 1;
    albumsLoadVersionRef.current = loadVersion;

    const stopSpinnerIfOwner = () => {
      if (!showSpinner) return;
      if (loadingOwnerLoadVersionRef.current !== loadVersion) return;
      loadingOwnerLoadVersionRef.current = null;
      setLoading(false);
    };

    if (showSpinner) {
      loadingOwnerLoadVersionRef.current = loadVersion;
      setLoading(true);
    }

    try {
      const pageSize = includeTracks ? 80 : 100;
      const fetchPage = async (page: number) => {
        const url = new URL('/api/library/albums', window.location.origin);
        url.searchParams.set('page', String(page));
        url.searchParams.set('pageSize', String(pageSize));
        url.searchParams.set('includeTracks', includeTracks ? 'true' : 'false');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error('Error loading albums via library API:', payload?.error || res.status);
          return null;
        }
        return {
          batch: Array.isArray(payload?.data) ? (payload.data as Album[]) : [],
          hasMore: Boolean(payload?.hasMore),
        };
      };

      const first = await fetchPage(0);
      if (loadVersion !== albumsLoadVersionRef.current) {
        stopSpinnerIfOwner();
        return;
      }

      if (!first) {
        stopSpinnerIfOwner();
        return;
      }

      let all = [...first.batch];
      setAlbums(all);
      stopSpinnerIfOwner();

      if (!first.hasMore || first.batch.length === 0) {
        if (includeTracks) {
          tracksHydratedRef.current = true;
          setTracksHydrated(true);
        }
        return;
      }

      let page = 1;
      while (true) {
        const next = await fetchPage(page);
        if (loadVersion !== albumsLoadVersionRef.current) return;
        if (!next || next.batch.length === 0) break;
        all = all.concat(next.batch);
        setAlbums(all);
        if (!next.hasMore) break;
        page += 1;
      }

      if (includeTracks && loadVersion === albumsLoadVersionRef.current) {
        tracksHydratedRef.current = true;
        setTracksHydrated(true);
      }
    } catch (error) {
      console.error('Unexpected error loading albums:', error);
      stopSpinnerIfOwner();
    }
  }, []);

  const ensureTracksHydrated = useCallback(async () => {
    if (tracksHydratedRef.current || tracksHydrating) return;
    setTracksHydrating(true);
    try {
      await loadAlbums({ includeTracks: true, showSpinner: false });
    } finally {
      setTracksHydrating(false);
    }
  }, [loadAlbums, tracksHydrating]);

  const loadCrates = useCallback(async () => {
    const { data, error } = await supabase
      .from('crates')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading crates:', error);
      return;
    }

    if (data) {
      setCrates(data as unknown as Crate[]);
    }

    const { data: crateItems, error: crateItemsError } = await supabase
      .from('crate_items')
      .select('crate_id, inventory_id');

    if (crateItemsError) {
      console.error('Error loading crate items:', crateItemsError);
      return;
    }

    const counts = (crateItems ?? []).reduce((acc, item) => {
      if (item.crate_id && item.inventory_id) {
        acc[item.crate_id] = (acc[item.crate_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<number, number>);

    const itemMap = (crateItems ?? []).reduce((acc, item) => {
      if (!item.crate_id || !item.inventory_id) return acc;
      if (!acc[item.crate_id]) {
        acc[item.crate_id] = new Set<number>();
      }
      acc[item.crate_id].add(item.inventory_id);
      return acc;
    }, {} as Record<number, Set<number>>);

    setCrateItemCounts(counts);
    setCrateItemsByCrate(itemMap);
  }, []);

  const loadPlaylists = useCallback(async () => {
    const { data: playlistRows, error: playlistError } = await supabase
      .from('collection_playlists')
      .select('id, name, icon, color, sort_order, created_at, is_smart, smart_rules, match_rules, live_update')
      .order('sort_order', { ascending: true });

    if (playlistError) {
      console.error('Error loading playlists:', playlistError);
      return;
    }

    const { data: playlistItems, error: itemsError } = await supabase
      .from('collection_playlist_items')
      .select('playlist_id, track_key, sort_order')
      .order('sort_order', { ascending: true });

    if (itemsError) {
      console.error('Error loading playlist items:', itemsError);
      return;
    }

    const tracksByPlaylist = (playlistItems ?? []).reduce((acc, item) => {
      if (!item.playlist_id || !item.track_key) return acc;
      if (!acc[item.playlist_id]) {
        acc[item.playlist_id] = [];
      }
      acc[item.playlist_id].push(item.track_key);
      return acc;
    }, {} as Record<number, string[]>);

    const mapped: Playlist[] = (playlistRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon || '🎵',
      color: row.color || '#3578b3',
      trackKeys: tracksByPlaylist[row.id] ?? [],
      createdAt: row.created_at || new Date().toISOString(),
      sortOrder: row.sort_order ?? 0,
      isSmart: !!row.is_smart,
      smartRules: row.smart_rules ?? null,
      matchRules: row.match_rules === 'any' ? 'any' : 'all',
      liveUpdate: row.live_update !== false,
    }));

    setPlaylists(mapped);
    // This app no longer auto-restores playlists from browser storage.
    clearPlaylistRecoveryStorage();
  }, []);

  useEffect(() => {
    tracksHydratedRef.current = false;
    setTracksHydrated(false);
    void loadAlbums({ includeTracks: false, showSpinner: true });
    loadCrates();
    loadPlaylists();
  }, [loadAlbums, loadCrates, loadPlaylists]);

  useEffect(() => {
    if (viewMode !== 'collection') {
      void ensureTracksHydrated();
    }
  }, [ensureTracksHydrated, viewMode]);

  const filteredAndSortedAlbums = useMemo(() => {
    let filtered = albums.filter(album => {
      if (collectionFilter === 'For Sale' && album.status !== 'for_sale') return false;
      
      if (selectedLetter !== 'All') {
        const firstChar = getAlbumArtist(album).charAt(0).toUpperCase();
        if (selectedLetter === '0-9') {
          if (!/[0-9]/.test(firstChar)) return false;
        } else {
          if (firstChar !== selectedLetter) return false;
        }
      }

      if (viewMode === 'collection' && folderMode === 'crates' && selectedCrateId !== null) {
        const selectedCrate = crates.find(c => c.id === selectedCrateId);
        if (selectedCrate) {
          if (selectedCrate.is_smart) {
            if (!albumMatchesSmartCrate(album, selectedCrate)) {
              return false;
            }
          } else {
            const crateInventoryIds = crateItemsByCrate[selectedCrate.id];
            if (!crateInventoryIds?.has(album.id)) {
              return false;
            }
          }
        }
      }

      if (viewMode === 'collection' && folderMode === 'format' && selectedFolderValue) {
        if ((album.release?.media_type || 'Unknown') !== selectedFolderValue) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          getAlbumArtist(album),
          getAlbumTitle(album),
          getAlbumFormat(album),
          getAlbumYearValue(album),
          toSafeSearchString(getAlbumTags(album)),
          // FIXED: Search canonical genres instead of discogs_genres
          toSafeSearchString(getAlbumGenres(album)),
          toSafeSearchString(album.release?.label)
        ].join(' ').toLowerCase();
        
        if (!searchable.includes(q)) return false;
      }

      return true;
    });

    if (tableSortState.column && tableSortState.direction) {
      const { column, direction } = tableSortState;
      const multiplier = direction === 'asc' ? 1 : -1;
      
      filtered = [...filtered].sort((a, b) => {
        if (column === 'artist') {
          return multiplier * getAlbumArtist(a).localeCompare(getAlbumArtist(b));
        } else if (column === 'title') {
          return multiplier * getAlbumTitle(a).localeCompare(getAlbumTitle(b));
        }
        return 0;
      });
    } else if (viewMode === 'collection' && activeCollectionSortFields.length > 0) {
      filtered = sortAlbumsByFavoriteFields(filtered, activeCollectionSortFields);
    } else {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case 'artist-asc': return getAlbumArtist(a).localeCompare(getAlbumArtist(b));
          case 'artist-desc': return getAlbumArtist(b).localeCompare(getAlbumArtist(a));
          case 'title-asc': return getAlbumTitle(a).localeCompare(getAlbumTitle(b));
          case 'title-desc': return getAlbumTitle(b).localeCompare(getAlbumTitle(a));
          case 'year-desc': return (getAlbumYearInt(b) || 0) - (getAlbumYearInt(a) || 0);
          case 'year-asc': return (getAlbumYearInt(a) || 0) - (getAlbumYearInt(b) || 0);
          case 'decade-desc': return (getAlbumDecade(b) || 0) - (getAlbumDecade(a) || 0);
          case 'decade-asc': return (getAlbumDecade(a) || 0) - (getAlbumDecade(b) || 0);
          case 'added-desc': return (b.date_added || '').localeCompare(a.date_added || '');
          case 'added-asc': return (a.date_added || '').localeCompare(b.date_added || '');
          case 'format-asc':
            return getDisplayFormat(getAlbumFormat(a)).localeCompare(getDisplayFormat(getAlbumFormat(b)));
          case 'format-desc':
            return getDisplayFormat(getAlbumFormat(b)).localeCompare(getDisplayFormat(getAlbumFormat(a)));
          case 'location-asc': return (a.location || '').localeCompare(b.location || '');
          case 'location-desc': return (b.location || '').localeCompare(a.location || '');
          case 'condition-asc': return (a.media_condition || '').localeCompare(b.media_condition || '');
          case 'condition-desc': return (b.media_condition || '').localeCompare(a.media_condition || '');
          case 'tags-count-desc': return toSafeStringArray(getAlbumTags(b)).length - toSafeStringArray(getAlbumTags(a)).length;
          case 'tags-count-asc': return toSafeStringArray(getAlbumTags(a)).length - toSafeStringArray(getAlbumTags(b)).length;
          default: return 0;
        }
      });
    }

    return filtered;
  }, [activeCollectionSortFields, albums, collectionFilter, selectedLetter, selectedFolderValue, selectedCrateId, folderMode, crates, searchQuery, sortBy, tableSortState, crateItemsByCrate, viewMode]);

  const folderCounts = useMemo(() => {
    return albums.reduce((acc, album) => {
      const itemKey = album.release?.media_type || 'Unknown';
      acc[itemKey] = (acc[itemKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [albums]);

  const cratesWithCounts = useMemo(() => {
    return crates.map(crate => {
      let count = 0;
      if (crate.is_smart) {
        count = albums.filter(album => albumMatchesSmartCrate(album, crate)).length;
      } else {
        count = crateItemCounts[crate.id] || 0;
      }
      return { ...crate, album_count: count };
    });
  }, [crates, albums, crateItemCounts]);

  const allTrackRows = useMemo<CollectionTrackRow[]>(() => {
    const rows: CollectionTrackRow[] = [];

    albums.forEach((album) => {
      if (collectionFilter === 'For Sale' && album.status !== 'for_sale') {
        return;
      }
      const albumArtist = getAlbumArtist(album);
      const albumTitle = getAlbumTitle(album);
      const albumMediaType = album.release?.media_type || 'Unknown';
      const trackFormatFacets = buildTrackFormatFacets(album);
      const trackRuleMetadata = buildTrackRuleMetadata(album);
      const releaseTracks = album.release?.release_tracks ?? [];

      if (releaseTracks.length > 0) {
        releaseTracks.forEach((track, index) => {
          const position = normalizeTrackPosition(track.position, index + 1);
          const side = track.side ? track.side.toUpperCase() : null;
          const key = `${album.id}:${track.id ?? `p:${position}`}:${track.recording?.id ?? index}`;
          rows.push({
            key,
            inventoryId: album.id,
            releaseTrackId: track.id ?? null,
            recordingId: track.recording?.id ?? null,
            albumArtist,
            albumTitle,
            trackArtist: track.recording?.track_artist || albumArtist,
            trackTitle: track.title_override ?? track.recording?.title ?? 'Untitled',
            position,
            side,
            durationSeconds: track.recording?.duration_seconds ?? null,
            durationLabel: formatTrackDuration(track.recording?.duration_seconds ?? null),
            albumMediaType,
            trackFormatFacets,
            ...trackRuleMetadata,
          });
        });
        return;
      }

      const fallbackTracks = album.tracks ?? [];
      fallbackTracks.forEach((track, index) => {
        if (track.type === 'header') return;
        const position = normalizeTrackPosition(track.position, index + 1);
        const side = track.side ? track.side.toUpperCase() : null;
        const key = `${album.id}:fallback:${index}:${position}`;
        rows.push({
          key,
          inventoryId: album.id,
          releaseTrackId: null,
          recordingId: null,
          albumArtist,
          albumTitle,
          trackArtist: track.artist ?? albumArtist,
          trackTitle: track.title,
          position,
          side,
          durationSeconds: parseDurationLabelToSeconds(track.duration),
          durationLabel: track.duration ?? '—',
          albumMediaType,
          trackFormatFacets,
          ...trackRuleMetadata,
        });
      });
    });

    return rows;
  }, [albums, collectionFilter]);

  const trackFormatCounts = useMemo(() => {
    return allTrackRows.reduce((acc, row) => {
      const facets = row.trackFormatFacets.length > 0 ? row.trackFormatFacets : [row.albumMediaType];
      facets.forEach((facet) => {
        acc[facet] = (acc[facet] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
  }, [allTrackRows]);

  const smartPlaylistValueOptions = useMemo(() => {
    const collect = (values: Array<string | null | undefined>) =>
      Array.from(
        new Set(
          values
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b));

    const collectArrayValues = (values: Array<string[] | null | undefined>) =>
      collect(values.flatMap((items) => items ?? []));

    return {
      format: collectArrayValues(
        allTrackRows.map((row) => row.trackFormatFacets.filter((facet) => !MEDIA_TYPE_FACETS.has(facet)))
      ),
      album_format: collect(allTrackRows.map((row) => row.albumMediaType)),
      country: collect(allTrackRows.map((row) => row.country)),
      year_int: collect(allTrackRows.map((row) => (row.yearInt != null ? String(row.yearInt) : null))),
      decade: collect(allTrackRows.map((row) => (row.decade != null ? String(row.decade) : null))),
      my_rating: collect(allTrackRows.map((row) => (row.myRating != null ? String(row.myRating) : null))),
      side: collect(allTrackRows.map((row) => row.side)),
      genre: collectArrayValues(allTrackRows.map((row) => row.genres)),
      label: collect(allTrackRows.map((row) => row.label)),
      date_added: collect(allTrackRows.map((row) => row.dateAdded)),
      purchase_date: collect(allTrackRows.map((row) => row.purchaseDate)),
      last_played_at: collect(allTrackRows.map((row) => row.lastPlayedAt)),
      last_cleaned_date: collect(allTrackRows.map((row) => row.lastCleanedDate)),
      original_release_date: collect(allTrackRows.map((row) => row.originalReleaseDate)),
      recording_date: collect(allTrackRows.map((row) => row.recordingDate)),
    };
  }, [allTrackRows]);

  const playlistCounts = useMemo(() => {
    return playlists.reduce((acc, playlist) => {
      if (playlist.isSmart && playlist.liveUpdate && tracksHydrated) {
        const matched = allTrackRows.filter((row) => trackMatchesSmartPlaylist(row, playlist)).length;
        const maxTracks = playlist.smartRules?.maxTracks ?? null;
        acc[playlist.id] = typeof maxTracks === 'number' && maxTracks > 0 ? Math.min(matched, maxTracks) : matched;
      } else {
        acc[playlist.id] = playlist.trackKeys.length;
      }
      return acc;
    }, {} as Record<number, number>);
  }, [allTrackRows, playlists, tracksHydrated]);

  const smartPlaylistSelectedKeys = useMemo(() => {
    if (!tracksHydrated) return {};
    const result: Record<number, Set<string>> = {};

    playlists.forEach((playlist) => {
      if (!playlist.isSmart || !playlist.liveUpdate) return;
      const maxTracks = playlist.smartRules?.maxTracks ?? null;
      if (typeof maxTracks !== 'number' || maxTracks <= 0) return;

      const matches = allTrackRows.filter((row) => trackMatchesSmartPlaylist(row, playlist));
      if (matches.length <= maxTracks) {
        result[playlist.id] = new Set(matches.map((row) => row.key));
        return;
      }

      const rules = playlist.smartRules?.rules ?? [];
      const hasArtistRule = rules.some((rule) => rule.field === 'track_artist' || rule.field === 'album_artist');
      const hasAlbumRule = rules.some((rule) => rule.field === 'album_title');
      const selectedBy = playlist.smartRules?.selectedBy ?? 'random';

      result[playlist.id] = selectSmartPlaylistKeys(
        matches,
        maxTracks,
        selectedBy,
        hasArtistRule,
        hasAlbumRule
      );
    });

    return result;
  }, [allTrackRows, playlists, tracksHydrated]);

  const filteredTrackRows = useMemo(() => {
    let rows = allTrackRows;

    const selectedCrate = selectedCrateId !== null ? crates.find((crate) => crate.id === selectedCrateId) : null;

    if (trackSource === 'crates' && selectedCrate) {
      if (selectedCrate.is_smart) {
        const allowedAlbumIds = new Set(
          albums.filter((album) => albumMatchesSmartCrate(album, selectedCrate)).map((album) => album.id)
        );
        rows = rows.filter((row) => allowedAlbumIds.has(row.inventoryId));
      } else {
        const allowedInventoryIds = crateItemsByCrate[selectedCrate.id];
        rows = rows.filter((row) => allowedInventoryIds?.has(row.inventoryId));
      }
    }

    if (trackSource === 'playlists' && selectedPlaylistId) {
      const playlist = playlists.find((item) => item.id === selectedPlaylistId);
      if (playlist) {
        if (playlist.isSmart && playlist.liveUpdate) {
          rows = rows.filter((row) => trackMatchesSmartPlaylist(row, playlist));
          const selectedKeys = smartPlaylistSelectedKeys[playlist.id];
          if (selectedKeys) {
            rows = rows.filter((row) => selectedKeys.has(row.key));
          }
        } else {
          const allowedKeys = new Set(playlist.trackKeys);
          rows = rows.filter((row) => {
            if (allowedKeys.has(row.key)) return true;
            const legacyReleaseTrackKey = row.releaseTrackId != null ? `${row.inventoryId}:${row.releaseTrackId}` : null;
            const legacyPositionKey = `${row.inventoryId}:${row.position}`;
            return (
              (legacyReleaseTrackKey !== null && allowedKeys.has(legacyReleaseTrackKey)) ||
              allowedKeys.has(legacyPositionKey)
            );
          });
        }
      }
    }

    if (selectedLetter !== 'All') {
      rows = rows.filter((row) => {
        const firstChar = row.trackArtist.charAt(0).toUpperCase();
        if (selectedLetter === '0-9') return /[0-9]/.test(firstChar);
        return firstChar === selectedLetter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((row) => {
        const searchable = `${row.trackTitle} ${row.trackArtist} ${row.albumTitle} ${row.albumArtist} ${row.position} ${row.side ?? ''} ${row.albumMediaType} ${row.trackFormatFacets.join(' ')}`.toLowerCase();
        return searchable.includes(q);
      });
    }

    if (trackFormatFilters.size > 0) {
      if (trackFormatFilterMode === 'include') {
        rows = rows.filter((row) => {
          const facets = row.trackFormatFacets.length > 0 ? row.trackFormatFacets : [row.albumMediaType];
          return Array.from(trackFormatFilters).every((required) => facets.includes(required));
        });
      } else {
        rows = rows.filter((row) => {
          const facets = row.trackFormatFacets.length > 0 ? row.trackFormatFacets : [row.albumMediaType];
          return !facets.some((facet) => trackFormatFilters.has(facet));
        });
      }
    }

    const trackFavoriteFields =
      viewMode === 'album-track'
        ? activeAlbumTrackSortFields
        : viewMode === 'playlist'
          ? activePlaylistSortFields
          : [];

    if (trackFavoriteFields.length > 0) {
      rows = sortTrackRowsByFavoriteFields(rows, trackFavoriteFields);
    } else {
      rows = [...rows].sort((a, b) => {
        switch (trackSortBy) {
          case 'album-asc':
            return `${a.albumArtist} ${a.albumTitle}`.localeCompare(`${b.albumArtist} ${b.albumTitle}`);
          case 'album-desc':
            return `${b.albumArtist} ${b.albumTitle}`.localeCompare(`${a.albumArtist} ${a.albumTitle}`);
          case 'track-asc':
            return a.trackTitle.localeCompare(b.trackTitle);
          case 'track-desc':
            return b.trackTitle.localeCompare(a.trackTitle);
          case 'artist-asc':
            return a.trackArtist.localeCompare(b.trackArtist);
          case 'artist-desc':
            return b.trackArtist.localeCompare(a.trackArtist);
          case 'duration-asc':
            return (a.durationSeconds ?? 0) - (b.durationSeconds ?? 0);
          case 'duration-desc':
            return (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0);
          case 'position-desc':
            return getTrackPositionSortValue(b.position, b.side) - getTrackPositionSortValue(a.position, a.side);
          case 'position-asc':
          default:
            return getTrackPositionSortValue(a.position, a.side) - getTrackPositionSortValue(b.position, b.side);
        }
      });
    }

    return rows;
  }, [
    allTrackRows,
    trackSource,
    selectedCrateId,
    crates,
    albums,
    crateItemsByCrate,
    selectedPlaylistId,
    playlists,
    smartPlaylistSelectedKeys,
    selectedLetter,
    searchQuery,
    trackFormatFilters,
    trackFormatFilterMode,
    trackSortBy,
    activeAlbumTrackSortFields,
    activePlaylistSortFields,
    viewMode,
  ]);

  const groupedTrackRows = useMemo<TrackAlbumGroup[]>(() => {
    const grouped = new Map<number, TrackAlbumGroup>();

    filteredTrackRows.forEach((row) => {
      const existing = grouped.get(row.inventoryId) ?? {
        inventoryId: row.inventoryId,
        albumArtist: row.albumArtist,
        albumTitle: row.albumTitle,
        trackCount: 0,
        totalSeconds: 0,
        tracks: [],
        sideTotals: [],
      };

      existing.tracks.push(row);
      existing.trackCount += 1;
      existing.totalSeconds += row.durationSeconds ?? 0;
      grouped.set(row.inventoryId, existing);
    });

    const results = Array.from(grouped.values());
    results.forEach((group) => {
      group.tracks.sort((a, b) => {
        if (trackSortBy === 'track-asc') return a.trackTitle.localeCompare(b.trackTitle);
        if (trackSortBy === 'track-desc') return b.trackTitle.localeCompare(a.trackTitle);
        if (trackSortBy === 'artist-asc') return a.trackArtist.localeCompare(b.trackArtist);
        if (trackSortBy === 'artist-desc') return b.trackArtist.localeCompare(a.trackArtist);
        if (trackSortBy === 'duration-asc') return (a.durationSeconds ?? 0) - (b.durationSeconds ?? 0);
        if (trackSortBy === 'duration-desc') return (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0);
        if (trackSortBy === 'position-desc') {
          return getTrackPositionSortValue(b.position, b.side) - getTrackPositionSortValue(a.position, a.side);
        }
        return getTrackPositionSortValue(a.position, a.side) - getTrackPositionSortValue(b.position, b.side);
      });

      const sideMap = new Map<string, { totalSeconds: number; trackCount: number }>();
      group.tracks.forEach((track) => {
        const side = track.side ?? '';
        if (!side) return;
        const item = sideMap.get(side) ?? { totalSeconds: 0, trackCount: 0 };
        item.totalSeconds += track.durationSeconds ?? 0;
        item.trackCount += 1;
        sideMap.set(side, item);
      });
      group.sideTotals = Array.from(sideMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([side, totals]) => ({
          side,
          totalSeconds: totals.totalSeconds,
          trackCount: totals.trackCount,
        }));
    });

    return results.sort((a, b) => {
      if (trackSortBy === 'album-desc') {
        const artistCmp = b.albumArtist.localeCompare(a.albumArtist);
        if (artistCmp !== 0) return artistCmp;
        return b.albumTitle.localeCompare(a.albumTitle);
      }

      if (trackSortBy === 'duration-desc' || trackSortBy === 'duration-asc') {
        const mult = trackSortBy === 'duration-desc' ? -1 : 1;
        const cmp = (a.totalSeconds - b.totalSeconds) * mult;
        if (cmp !== 0) return cmp;
      }

      if (trackSortBy === 'artist-desc' || trackSortBy === 'artist-asc') {
        const mult = trackSortBy === 'artist-desc' ? -1 : 1;
        const cmp = a.albumArtist.localeCompare(b.albumArtist) * mult;
        if (cmp !== 0) return cmp;
      }

      const artistCmp = a.albumArtist.localeCompare(b.albumArtist);
      if (artistCmp !== 0) return artistCmp;
      return a.albumTitle.localeCompare(b.albumTitle);
    });
  }, [filteredTrackRows, trackSortBy]);

  useEffect(() => {
    if (selectedAlbumId) return;
    if (viewMode === 'collection' && filteredAndSortedAlbums.length > 0) {
      setSelectedAlbumId(filteredAndSortedAlbums[0].id);
      return;
    }
    if (viewMode === 'album-track' && filteredTrackRows.length > 0) {
      setSelectedAlbumId(filteredTrackRows[0].inventoryId);
    }
  }, [filteredAndSortedAlbums, selectedAlbumId, viewMode, filteredTrackRows]);

  useEffect(() => {
    if (viewMode !== 'album-track') return;
    if (groupedTrackRows.length === 0) return;
    setExpandedAlbumIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set(groupedTrackRows.map((group) => group.inventoryId));
    });
  }, [viewMode, groupedTrackRows]);

  const handleExpandAllAlbums = useCallback(() => {
    setExpandedAlbumIds(new Set(groupedTrackRows.map((group) => group.inventoryId)));
  }, [groupedTrackRows]);

  const handleCollapseAllAlbums = useCallback(() => {
    setExpandedAlbumIds(new Set());
  }, []);

  const sortedFolderItems = useMemo(() => {
    return Object.entries(folderCounts)
      .sort((a, b) => {
        if (folderSortByCount) {
          return b[1] - a[1];
        } else {
          return a[0].localeCompare(b[0]);
        }
      })
      .filter(([item]) => 
        !folderSearch || item.toLowerCase().includes(folderSearch.toLowerCase())
      );
  }, [folderCounts, folderSortByCount, folderSearch]);

  const sortedPlaylists = useMemo(() => {
    const list = [...playlists].filter((playlist) => !folderSearch || playlist.name.toLowerCase().includes(folderSearch.toLowerCase()));
    list.sort((a, b) => {
      if (folderSortByCount) {
        return (playlistCounts[b.id] || 0) - (playlistCounts[a.id] || 0);
      }
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [playlists, folderSearch, folderSortByCount, playlistCounts]);

  const sortedTrackFormats = useMemo(() => {
    return Object.entries(trackFormatCounts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [trackFormatCounts]);

  const trackFormatSummary = useMemo(() => {
    if (trackFormatFilters.size === 0) return 'All Formats';
    const values = Array.from(trackFormatFilters);
    if (values.length === 1) {
      return `${trackFormatFilterMode === 'include' ? 'Only' : 'Exclude'} ${values[0]}`;
    }
    return `${trackFormatFilterMode === 'include' ? 'Only' : 'Exclude'} ${values.length} formats`;
  }, [trackFormatFilters, trackFormatFilterMode]);

  const selectedAlbum = useMemo(() => {
    return albums.find(a => a.id === selectedAlbumId) || null;
  }, [albums, selectedAlbumId]);

  const selectedPlaylist = useMemo(() => {
    if (!selectedPlaylistId) return null;
    return playlists.find((playlist) => playlist.id === selectedPlaylistId) || null;
  }, [playlists, selectedPlaylistId]);

  const handleAlbumClick = useCallback((album: Album) => {
    setSelectedAlbumId(album.id);
  }, []);

  const handleSelectionChange = useCallback((albumIds: Set<string>) => {
    setSelectedAlbumIds(new Set(Array.from(albumIds).map(id => Number(id))));
  }, []);

  const handleEditAlbum = useCallback((albumId: number) => {
    setEditingAlbumId(albumId);
  }, []);

  const selectedAlbumsAsStrings = useMemo(() => {
    return new Set(Array.from(selectedAlbumIds).map(id => String(id)));
  }, [selectedAlbumIds]);

  useEffect(() => {
    if (viewMode !== 'collection') {
      setFolderMode(trackSource);
      setSelectedFolderValue(null);
    } else if (folderMode === 'playlists') {
      setFolderMode('format');
    }
    setSelectedAlbumIds(new Set());
    setSelectedTrackKeys(new Set());
    setShowColumnFavoritesDropdown(false);
    setShowSortFavoritesDropdown(false);
    setShowSortSelector(false);
    if (viewMode === 'collection') {
      setExpandedAlbumIds(new Set());
      setShowTrackFormatDropdown(false);
    }
  }, [viewMode, trackSource, folderMode]);

  const handleFolderModeChange = useCallback((mode: SidebarMode) => {
    setFolderMode(mode);
    setShowFolderModeDropdown(false);
    setSelectedFolderValue(null);
    setSelectedCrateId(null);
    setSelectedPlaylistId(null);
    if (mode === 'playlists') {
      setTrackSource('playlists');
      if (viewMode === 'collection') {
        setViewMode('playlist');
      }
    } else if (mode === 'crates') {
      setTrackSource('crates');
    }
  }, [viewMode]);

  const handleViewModeChange = useCallback((mode: AppViewMode) => {
    if (mode === 'playlist') {
      setTrackSource('playlists');
      setFolderMode('playlists');
    }
    setViewMode(mode);
    setShowFolderModeDropdown(false);
  }, []);

  const handleRefreshSmartPlaylistMix = useCallback(() => {
    setSmartPlaylistMixNonce((prev) => prev + 1);
  }, []);

  const handleAddToCrates = useCallback(async (crateIds: number[]) => {
    if (selectedAlbumIds.size === 0 || crateIds.length === 0) return;

    try {
      const albumIds = Array.from(selectedAlbumIds);
      
      const records = [];
      for (const crateId of crateIds) {
        for (const albumId of albumIds) {
          records.push({
            crate_id: crateId,
            inventory_id: albumId,
          });
        }
      }

      const { error } = await supabase
        .from('crate_items')
        .insert(records);

      if (error) {
        if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
          throw error;
        }
      }

      await loadCrates();
      setSelectedAlbumIds(new Set());
      
      const crateNames = crates
        .filter(c => crateIds.includes(c.id))
        .map(c => c.name)
        .join(', ');
      
      console.log(`✅ Added ${albumIds.length} album(s) to: ${crateNames}`);
    } catch (err) {
      console.error('Failed to add albums to crates:', err);
      throw err;
    }
  }, [selectedAlbumIds, crates, loadCrates]);

  const toggleTrackSelection = useCallback((trackKey: string) => {
    setSelectedTrackKeys((prev) => {
      const next = new Set(prev);
      if (next.has(trackKey)) {
        next.delete(trackKey);
      } else {
        next.add(trackKey);
      }
      return next;
    });
  }, []);

  const toggleAlbumExpanded = useCallback((albumId: number) => {
    setExpandedAlbumIds((prev) => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
      }
      return next;
    });
  }, []);

  const handleCreatePlaylist = useCallback(async (playlist: { name: string; icon: string; color: string; trackKeys: string[] }) => {
    try {
      const maxSort = playlists.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), -1);
      const nextSortOrder = maxSort + 1;
      const dedupedTrackKeys = Array.from(new Set((playlist.trackKeys ?? []).map((key) => String(key ?? '').trim()).filter(Boolean)));

      const { data, error } = await supabase
        .from('collection_playlists')
        .insert({
          name: playlist.name.trim(),
          icon: playlist.icon,
          color: playlist.color,
          sort_order: nextSortOrder,
          is_smart: false,
          smart_rules: null,
          match_rules: 'all',
          live_update: true,
        })
        .select('id')
        .single();

      if (error || !data) {
        throw error || new Error('Failed to create playlist');
      }

      if (dedupedTrackKeys.length > 0) {
        const rows = dedupedTrackKeys.map((trackKey, index) => ({
          playlist_id: data.id,
          track_key: trackKey,
          sort_order: index,
        }));
        const { error: itemError } = await supabase
          .from('collection_playlist_items')
          .insert(rows);
        if (itemError) throw itemError;
      }

      await loadPlaylists();
      setSelectedPlaylistId(data.id);
      setTrackSource('playlists');
      setViewMode('playlist');
    } catch (err) {
      console.error('Failed to create playlist:', err);
      alert('Failed to create playlist. Please try again.');
    }
  }, [loadPlaylists, playlists]);

  const handleUpdatePlaylist = useCallback(async (playlist: Playlist) => {
    try {
      const previous = playlists.find((item) => item.id === playlist.id);
      const dedupeTrackKeys = (keys: string[]) => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const key of keys) {
          const value = String(key ?? '').trim();
          if (!value) continue;
          if (seen.has(value)) continue;
          seen.add(value);
          out.push(value);
        }
        return out;
      };

      const nextManualTrackKeys = !playlist.isSmart ? dedupeTrackKeys(playlist.trackKeys ?? []) : [];
      const prevManualTrackKeys = previous && !previous.isSmart ? dedupeTrackKeys(previous.trackKeys ?? []) : [];
      const manualTracksChanged =
        !playlist.isSmart &&
        (nextManualTrackKeys.length !== prevManualTrackKeys.length ||
          nextManualTrackKeys.some((key, idx) => key !== prevManualTrackKeys[idx]));

      const { error } = await supabase
        .from('collection_playlists')
        .update({
          name: playlist.name,
          icon: playlist.icon,
          color: playlist.color,
          is_smart: playlist.isSmart,
          smart_rules: playlist.smartRules,
          match_rules: playlist.matchRules,
          live_update: playlist.liveUpdate,
        })
        .eq('id', playlist.id);

      if (error) throw error;

      if (manualTracksChanged) {
        const { error: deleteItemsError } = await supabase
          .from('collection_playlist_items')
          .delete()
          .eq('playlist_id', playlist.id);
        if (deleteItemsError) throw deleteItemsError;

        const chunkSize = 500;
        for (let i = 0; i < nextManualTrackKeys.length; i += chunkSize) {
          const chunk = nextManualTrackKeys.slice(i, i + chunkSize);
          const items = chunk.map((trackKey, index) => ({
            playlist_id: playlist.id,
            track_key: trackKey,
            sort_order: i + index,
          }));
          const { error: insertItemsError } = await supabase
            .from('collection_playlist_items')
            .insert(items);
          if (insertItemsError) throw insertItemsError;
        }
      }

      // Only materialize a static snapshot when explicitly switching from live -> static.
      if (
        playlist.isSmart &&
        playlist.smartRules &&
        previous?.liveUpdate === true &&
        playlist.liveUpdate === false
      ) {
        const snapshotTrackKeys = buildSmartPlaylistTrackKeys(allTrackRows, {
          smartRules: playlist.smartRules,
          matchRules: playlist.matchRules,
        });
        if (snapshotTrackKeys.length > 0) {
          const { error: deleteItemsError } = await supabase
            .from('collection_playlist_items')
            .delete()
            .eq('playlist_id', playlist.id);
          if (deleteItemsError) throw deleteItemsError;

          const items = snapshotTrackKeys.map((trackKey, index) => ({
            playlist_id: playlist.id,
            track_key: trackKey,
            sort_order: index,
          }));
          const { error: insertItemsError } = await supabase
            .from('collection_playlist_items')
            .insert(items);
          if (insertItemsError) throw insertItemsError;
        } else {
          // Keep existing items if snapshot unexpectedly resolves empty.
          console.warn(`Skipped snapshot materialization for playlist ${playlist.id}: no tracks matched.`);
        }
      }
      await loadPlaylists();
    } catch (err) {
      console.error('Failed to update playlist:', err);
      alert('Failed to update playlist. Please try again.');
    }
  }, [allTrackRows, loadPlaylists, playlists]);

  const handleCreateSmartPlaylist = useCallback(async (payload: {
    name: string;
    color: string;
    matchRules: 'all' | 'any';
    liveUpdate: boolean;
    smartRules: SmartPlaylistRules;
  }) => {
    try {
      const maxSort = playlists.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), -1);
      const nextSortOrder = maxSort + 1;
      const snapshotTrackKeys = payload.liveUpdate
        ? []
        : buildSmartPlaylistTrackKeys(allTrackRows, {
            smartRules: payload.smartRules,
            matchRules: payload.matchRules,
          });
      const { data, error } = await supabase
        .from('collection_playlists')
        .insert({
          name: payload.name.trim(),
          icon: '⚡',
          color: payload.color,
          sort_order: nextSortOrder,
          is_smart: true,
          smart_rules: payload.smartRules,
          match_rules: payload.matchRules,
          live_update: payload.liveUpdate,
        })
        .select('id')
        .single();

      if (error || !data) throw error || new Error('Failed to create smart playlist');
      if (!payload.liveUpdate && snapshotTrackKeys.length > 0) {
        const items = snapshotTrackKeys.map((trackKey, index) => ({
          playlist_id: data.id,
          track_key: trackKey,
          sort_order: index,
        }));
        const { error: itemsError } = await supabase
          .from('collection_playlist_items')
          .insert(items);
        if (itemsError) throw itemsError;
      }
      await loadPlaylists();
      setSelectedPlaylistId(data.id);
      setTrackSource('playlists');
      setViewMode('playlist');
    } catch (err) {
      console.error('Failed to create smart playlist:', err);
      alert('Failed to create smart playlist. Please try again.');
    }
  }, [allTrackRows, loadPlaylists, playlists]);

		  const handleDeletePlaylist = useCallback(async (playlistId: number, playlistName: string) => {
		    if (!confirm(`Delete playlist "${playlistName}"? This cannot be undone.`)) {
		      return;
		    }

		    const { data: { session } } = await supabase.auth.getSession();
		    const accessToken = session?.access_token;
		    const res = await fetch(`/api/playlists/${playlistId}`, {
		      method: 'DELETE',
		      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
		    });
		    const payload = await res.json().catch(() => ({}));
		    if (!res.ok) {
		      throw new Error(payload?.error || `Failed to delete playlist (${res.status})`);
		    }

	    if (selectedPlaylistId === playlistId) {
	      setSelectedPlaylistId(null);
	    }
      if (playlists.length <= 1) {
        clearPlaylistRecoveryStorage();
      }
	    await loadPlaylists();
	  }, [loadPlaylists, playlists.length, selectedPlaylistId]);

		  const handleDeleteAllPlaylists = useCallback(async () => {
		    const { data: { session } } = await supabase.auth.getSession();
		    const accessToken = session?.access_token;
		    const res = await fetch('/api/playlists?confirm=yes', {
		      method: 'DELETE',
		      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
		    });
		    const payload = await res.json().catch(() => ({}));
		    if (!res.ok) {
		      throw new Error(payload?.error || `Failed to delete playlists (${res.status})`);
		    }
		    setSelectedPlaylistId(null);
        clearPlaylistRecoveryStorage();
		    await loadPlaylists();
		  }, [loadPlaylists]);

  const handleReorderPlaylists = useCallback(async (orderedPlaylists: Playlist[]) => {
    try {
      const updates = orderedPlaylists.map((playlist, index) => ({
        id: playlist.id,
        sort_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('collection_playlists')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
        if (error) throw error;
      }

      await loadPlaylists();
    } catch (err) {
      console.error('Failed to reorder playlists:', err);
      alert('Failed to reorder playlists. Please try again.');
    }
  }, [loadPlaylists]);

  const handleAddToPlaylists = useCallback(async (playlistIds: number[]) => {
    if (selectedTrackKeys.size === 0 || playlistIds.length === 0) return;

    try {
      const trackKeys = Array.from(selectedTrackKeys);
      const records: Array<{ playlist_id: number; track_key: string; sort_order: number }> = [];

      playlists.forEach((playlist) => {
        if (!playlistIds.includes(playlist.id)) return;
        const existingKeys = new Set(playlist.trackKeys);
        let sortOrderBase = playlist.trackKeys.length;
        trackKeys.forEach((trackKey) => {
          if (existingKeys.has(trackKey)) return;
          records.push({
            playlist_id: playlist.id,
            track_key: trackKey,
            sort_order: sortOrderBase,
          });
          sortOrderBase += 1;
        });
      });

      if (records.length > 0) {
        const { error } = await supabase
          .from('collection_playlist_items')
          .insert(records);
        if (error) throw error;
      }

      await loadPlaylists();
      setSelectedTrackKeys(new Set());
      setShowAddToPlaylistModal(false);
    } catch (err) {
      console.error('Failed to add tracks to playlists:', err);
      alert('Failed to add tracks to playlists. Please try again.');
    }
  }, [loadPlaylists, playlists, selectedTrackKeys]);

  const resolvedAlbumTrackColumns = useMemo<TrackViewColumnId[]>(() => {
    const deduped = albumTrackVisibleColumns
      .filter((id, index, arr) => arr.indexOf(id) === index)
      .filter(isTrackViewColumnId);
    return deduped.length > 0 ? deduped : [...DEFAULT_ALBUM_TRACK_VISIBLE_COLUMNS];
  }, [albumTrackVisibleColumns]);

  const resolvedPlaylistColumns = useMemo<TrackViewColumnId[]>(() => {
    const deduped = playlistVisibleColumns
      .filter((id, index, arr) => arr.indexOf(id) === index)
      .filter(isTrackViewColumnId);
    return deduped.length > 0 ? deduped : [...DEFAULT_PLAYLIST_VISIBLE_COLUMNS];
  }, [playlistVisibleColumns]);

  const getTrackColumnLabel = useCallback((columnId: TrackViewColumnId): string => {
    return TRACK_VIEW_COLUMN_DEFINITIONS[columnId]?.label || columnId;
  }, []);

  const renderTrackCell = useCallback((row: CollectionTrackRow, columnId: TrackViewColumnId): ReactNode => {
    switch (columnId) {
      case 'checkbox': {
        const isChecked = selectedTrackKeys.has(row.key);
        return (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => toggleTrackSelection(row.key)}
            onClick={(e) => e.stopPropagation()}
          />
        );
      }
      case 'track_title':
        return row.trackTitle || '—';
      case 'track_artist':
        return row.trackArtist || row.albumArtist || '—';
      case 'album_title':
        return row.albumTitle || '—';
      case 'album_artist':
        return row.albumArtist || '—';
      case 'position':
        return getTrackPositionLabel(row);
      case 'length':
        return row.durationLabel || '—';
      case 'my_rating':
        return row.myRating ?? '—';
      case 'format':
        return row.trackFormatFacets.join(' | ') || row.albumMediaType || '—';
      case 'genre':
        return formatTrackArrayValues(row.genres);
      case 'label':
        return formatTrackArrayValues(row.labels ?? (row.label ? [row.label] : []));
      case 'year':
        return row.yearInt ?? '—';
      case 'added_date':
        return formatDisplayDate(row.dateAdded);
      case 'location':
        return row.location || '—';
      case 'collection_status':
        return formatTrackStatus(row.status);
      case 'personal_notes':
        return row.personalNotes || '—';
      default:
        return '—';
    }
  }, [selectedTrackKeys, toggleTrackSelection]);

  const renderAlbumGroupCell = useCallback((
    group: TrackAlbumGroup,
    columnId: TrackViewColumnId,
    isExpanded: boolean,
    allTracksSelected: boolean
  ): ReactNode => {
    const firstTrack = group.tracks[0] ?? null;

    switch (columnId) {
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={allTracksSelected}
            onChange={(e) => {
              e.stopPropagation();
              const keys = group.tracks.map((track) => track.key);
              setSelectedTrackKeys((prev) => {
                const next = new Set(prev);
                if (allTracksSelected) {
                  keys.forEach((key) => next.delete(key));
                } else {
                  keys.forEach((key) => next.add(key));
                }
                return next;
              });
            }}
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'track_title':
        return (
          <>
            <span className="mr-2 text-[#4b5563]">{isExpanded ? '▾' : '▸'}</span>
            {group.albumTitle}
          </>
        );
      case 'track_artist':
      case 'album_artist':
        return group.albumArtist;
      case 'album_title':
        return (
          <>
            {group.trackCount} tracks
            {group.sideTotals.length > 0 && (
              <span className="ml-2 text-[#6b7280] text-xs">
                {group.sideTotals.map((side) => `Side ${side.side}: ${formatTrackDuration(side.totalSeconds)}`).join(' | ')}
              </span>
            )}
          </>
        );
      case 'position':
        return '—';
      case 'length':
        return group.totalSeconds > 0 ? formatTrackDuration(group.totalSeconds) : '—';
      case 'my_rating':
        return '—';
      case 'format':
        return firstTrack ? (firstTrack.trackFormatFacets.join(' | ') || firstTrack.albumMediaType || '—') : '—';
      case 'genre':
        return firstTrack ? formatTrackArrayValues(firstTrack.genres) : '—';
      case 'label':
        return firstTrack ? formatTrackArrayValues(firstTrack.labels ?? (firstTrack.label ? [firstTrack.label] : [])) : '—';
      case 'year':
        return firstTrack?.yearInt ?? '—';
      case 'added_date':
        return firstTrack ? formatDisplayDate(firstTrack.dateAdded) : '—';
      case 'location':
        return firstTrack?.location || '—';
      case 'collection_status':
        return formatTrackStatus(firstTrack?.status);
      case 'personal_notes':
        return firstTrack?.personalNotes || '—';
      default:
        return '—';
    }
  }, []);

  const activeColumnSelectorConfig = useMemo(() => {
    if (columnSelectorMode === 'collection') {
      return {
        visibleColumns: collectionVisibleColumns as string[],
        columnDefinitions: COLUMN_DEFINITIONS as unknown as Record<string, { id: string; label: string }>,
        columnGroups: COLUMN_GROUPS as unknown as Array<{ id: string; label: string; icon: string; columns: string[] }>,
        defaultVisibleColumns: DEFAULT_VISIBLE_COLUMNS as string[],
        selectedColumnsTitle: 'My Collection columns',
      };
    }

    if (columnSelectorMode === 'album-track') {
      return {
        visibleColumns: resolvedAlbumTrackColumns as string[],
        columnDefinitions: TRACK_VIEW_COLUMN_DEFINITIONS as unknown as Record<string, { id: string; label: string }>,
        columnGroups: TRACK_VIEW_COLUMN_GROUPS as Array<{ id: string; label: string; icon: string; columns: string[] }>,
        defaultVisibleColumns: DEFAULT_ALBUM_TRACK_VISIBLE_COLUMNS as string[],
        selectedColumnsTitle: 'My Album / Track columns',
      };
    }

    return {
      visibleColumns: resolvedPlaylistColumns as string[],
      columnDefinitions: TRACK_VIEW_COLUMN_DEFINITIONS as unknown as Record<string, { id: string; label: string }>,
      columnGroups: TRACK_VIEW_COLUMN_GROUPS as Array<{ id: string; label: string; icon: string; columns: string[] }>,
      defaultVisibleColumns: DEFAULT_PLAYLIST_VISIBLE_COLUMNS as string[],
      selectedColumnsTitle: 'My Playlist columns',
    };
  }, [collectionVisibleColumns, columnSelectorMode, resolvedAlbumTrackColumns, resolvedPlaylistColumns]);

  const handleActiveColumnsChange = useCallback((columns: string[]) => {
    if (columnSelectorMode === 'collection') {
      handleCollectionColumnsChange(columns.filter(isCollectionColumnId));
      return;
    }

    if (columnSelectorMode === 'album-track') {
      handleAlbumTrackColumnsChange(columns.filter(isTrackViewColumnId));
      return;
    }

    handlePlaylistColumnsChange(columns.filter(isTrackViewColumnId));
  }, [columnSelectorMode, handleAlbumTrackColumnsChange, handleCollectionColumnsChange, handlePlaylistColumnsChange]);

  return (
    <>
      <style>{`
        body > div:first-child > nav,
        body > div:first-child > header:not(.clz-header),
        body > nav,
        body > header:not(.clz-header),
        [class*="navigation"],
        [class*="Navigation"],
        [class*="navbar"],
        [class*="NavBar"],
        body > [class*="sidebar"]:not(.clz-sidebar),
        body > [class*="Sidebar"]:not(.clz-sidebar) {
          display: none !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
      `}</style>

      <div className="fixed inset-0 flex flex-col overflow-hidden z-[9999] font-sans">
        <Header 
          albums={albums} 
          loadAlbums={loadAlbums} 
          loadCrates={loadCrates}
          filteredAndSortedAlbums={filteredAndSortedAlbums}
          selectedAlbumIds={selectedAlbumIds}
          onOpenManagePlaylists={() => {
            setPlaylistStudioInitialView('library');
            setShowPlaylistStudioModal(true);
          }}
          onOpenExportCsvTxt={() => setShowExportModal(true)}
        />

        <div className="bg-[#3A3A3A] text-white px-4 py-2 flex items-center justify-between gap-5 h-[48px] shrink-0">
          <div className="flex gap-2 items-center shrink-0">
            <button title="Add new albums to collection" className="bg-[#368CF8] hover:bg-[#2c72c9] text-white border-none px-3 py-1.5 rounded cursor-pointer text-[13px] font-medium flex items-center gap-1 whitespace-nowrap transition-colors">
              <span className="text-[16px]">+</span>
              <span>Add Albums</span>
            </button>

            <div className="relative">
              <button onClick={() => setShowCollectionDropdown(!showCollectionDropdown)} title="Filter by collection status" className="bg-[#2a2a2a] text-white border border-[#555] px-3 py-1.5 rounded cursor-pointer text-[13px] flex items-center gap-1.5 hover:bg-[#333] transition-colors">
                <span>📚</span>
                <span>{collectionFilter}</span>
                <span className="text-[10px]">▼</span>
              </button>
              
              {showCollectionDropdown && (
                <>
                  <div onClick={() => setShowCollectionDropdown(false)} className="fixed inset-0 z-[99]" />
                  <div className="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-[#555] rounded z-[100] min-w-[150px] shadow-lg">
                    {['All', 'For Sale'].map(filter => (
                      <button 
                        key={filter}
                        onClick={() => { setCollectionFilter(filter); setShowCollectionDropdown(false); }}
                        className={`w-full px-4 py-2 text-left text-[13px] hover:bg-[#3a3a3a] ${collectionFilter === filter ? 'text-[#5A9BD5] font-bold' : 'text-white'}`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-0.5 items-center flex-1 justify-center">
            <button onClick={() => setSelectedLetter('All')} title="Show all albums" className={`bg-transparent text-white border-none px-2 py-1 cursor-pointer text-xs rounded-sm transition-colors ${selectedLetter === 'All' ? 'bg-[#5A9BD5]' : 'hover:bg-white/10'}`}>All</button>
            <button onClick={() => setSelectedLetter('0-9')} title="Filter by numbers" className={`bg-transparent text-white border-none px-2 py-1 cursor-pointer text-xs rounded-sm transition-colors ${selectedLetter === '0-9' ? 'bg-[#5A9BD5]' : 'hover:bg-white/10'}`}>0-9</button>
            {alphabet.map(letter => (
              <button key={letter} onClick={() => setSelectedLetter(letter)} title={`Filter by letter ${letter}`} className={`bg-transparent text-white border-none px-2 py-1 cursor-pointer text-xs rounded-sm transition-colors ${selectedLetter === letter ? 'bg-[#5A9BD5]' : 'hover:bg-white/10'}`}>{letter}</button>
            ))}
          </div>

          <div className="flex items-center shrink-0">
            {viewMode !== 'collection' && (
              <div className="relative mr-1.5">
                <button
                  onClick={() => setShowTrackFormatDropdown(!showTrackFormatDropdown)}
                  title="Track format filters"
                  className="bg-[#2a2a2a] text-white border border-[#555] px-2.5 py-1.5 cursor-pointer text-[12px] rounded h-8 hover:bg-[#333] transition-colors"
                >
                  🎚 {trackFormatSummary}
                </button>
                {showTrackFormatDropdown && (
                  <>
                    <div onClick={() => setShowTrackFormatDropdown(false)} className="fixed inset-0 z-[99]" />
                    <div className="absolute right-0 top-full mt-1 w-[280px] max-h-[320px] overflow-auto bg-[#2a2a2a] border border-[#555] rounded z-[100] shadow-lg p-2">
                      <div className="flex gap-1 mb-2">
                        <button
                          onClick={() => setTrackFormatFilterMode('include')}
                          className={`flex-1 px-2 py-1 text-[11px] rounded border ${trackFormatFilterMode === 'include' ? 'bg-[#5A9BD5] border-[#5A9BD5] text-white' : 'bg-[#3a3a3a] border-[#555] text-white'}`}
                        >
                          Include
                        </button>
                        <button
                          onClick={() => setTrackFormatFilterMode('exclude')}
                          className={`flex-1 px-2 py-1 text-[11px] rounded border ${trackFormatFilterMode === 'exclude' ? 'bg-[#5A9BD5] border-[#5A9BD5] text-white' : 'bg-[#3a3a3a] border-[#555] text-white'}`}
                        >
                          Exclude
                        </button>
                      </div>
                      <button
                        onClick={() => setTrackFormatFilters(new Set())}
                        className="w-full mb-2 px-2 py-1 text-[11px] rounded border border-[#555] bg-[#3a3a3a] text-white hover:bg-[#444]"
                      >
                        Clear Format Filters
                      </button>
                      {sortedTrackFormats.map(([format, count]) => {
                        const checked = trackFormatFilters.has(format);
                        return (
                          <label key={format} className="flex items-center justify-between px-2 py-1.5 rounded text-[12px] text-white hover:bg-[#3a3a3a] cursor-pointer">
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setTrackFormatFilters((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(format)) next.delete(format);
                                    else next.add(format);
                                    return next;
                                  });
                                }}
                              />
                              <span>{format}</span>
                            </span>
                            <span className="text-[#bbb]">{count}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="relative">
              <button onClick={() => setShowSearchTypeDropdown(!showSearchTypeDropdown)} title="Search type" className="bg-[#2a2a2a] text-white border border-[#555] border-r-0 px-2.5 py-1.5 cursor-pointer text-[13px] rounded-l flex items-center gap-1 h-8 hover:bg-[#333] transition-colors">
                <span>🔍</span>
                <span className="text-[10px]">▼</span>
              </button>
            </div>
            <input type="text" placeholder={viewMode === 'collection' ? 'Search albums...' : 'Search tracks, artist, album...'} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} title="Search your collection" className="bg-[#2a2a2a] text-white border border-[#555] border-l-0 px-3 py-1.5 rounded-r text-[13px] w-[220px] h-8 outline-none" />
          </div>
        </div>

        {viewMode === 'collection' && selectedAlbumIds.size > 0 && (
          <div className="bg-[#5BA3D0] text-white px-4 py-2 flex items-center gap-2 h-10 shrink-0">
            <button onClick={() => setSelectedAlbumIds(new Set())} title="Clear selection" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">✕ Cancel</button>
            <button title="Select all albums" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">☑ All</button>
            <button title="Edit selected albums" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">✏️ Edit</button>
            <button title="Remove selected albums" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">🗑 Remove</button>
            <button onClick={() => setShowAddToCrateModal(true)} title="Add selected albums to a crate" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">📦 Add to Crate</button>
            <button title="Export selected to PDF" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">🖨 Print to PDF</button>
            <button title="More actions" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">⋮</button>
            <div className="flex-1" />
            <span className="text-xs font-medium">{selectedAlbumIds.size} of {filteredAndSortedAlbums.length} selected</span>
          </div>
        )}

        {viewMode !== 'collection' && selectedTrackKeys.size > 0 && (
          <div className="bg-[#5BA3D0] text-white px-4 py-2 flex items-center gap-2 h-10 shrink-0">
            <button onClick={() => setSelectedTrackKeys(new Set())} title="Clear selection" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">✕ Cancel</button>
            <button onClick={() => setSelectedTrackKeys(new Set(filteredTrackRows.map((row) => row.key)))} title="Select all tracks" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">☑ All</button>
            <button onClick={() => setShowAddToPlaylistModal(true)} title="Add selected tracks to playlist(s)" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">🎵 Add to Playlist</button>
            <div className="flex-1" />
            <span className="text-xs font-medium">{selectedTrackKeys.size} of {filteredTrackRows.length} selected</span>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="hidden md:flex w-[220px] bg-[#2C2C2C] text-white flex-col overflow-hidden border-r border-[#1a1a1a] shrink-0">
            <div className="p-2.5 border-b border-[#1a1a1a] flex justify-between items-center shrink-0">
              <div className="relative">
                <button onClick={() => setShowFolderModeDropdown(!showFolderModeDropdown)} title="Change view mode" className="bg-[#3a3a3a] text-white border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-xs flex items-center gap-1.5">
                  <span>{folderMode === 'crates' ? '📦' : folderMode === 'playlists' ? '🎵' : '📁'}</span>
                  <span>{folderMode === 'crates' ? 'Crates' : folderMode === 'playlists' ? 'Playlists' : 'Format'}</span>
                  <span className="text-[10px]">▼</span>
                </button>

                {showFolderModeDropdown && (
                  <>
                    <div onClick={() => setShowFolderModeDropdown(false)} className="fixed inset-0 z-[99]" />
                    <div className="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-[#555] rounded z-[100] min-w-[180px] shadow-lg">
                      {viewMode === 'collection' && (
                        <>
                          <div className="px-3 py-2 text-[10px] font-semibold text-[#999] uppercase tracking-wider">Collection</div>
                          <button onClick={() => handleFolderModeChange('format')} className={`w-full px-4 py-2 bg-transparent border-none text-left cursor-pointer text-[13px] text-white flex items-center gap-2 hover:bg-[#3a3a3a] ${folderMode === 'format' ? 'bg-[#5A9BD5]' : ''}`}>
                            <span>📁</span>
                            <span>Format</span>
                          </button>
                        </>
                      )}

                      <div className="px-3 py-2 text-[10px] font-semibold text-[#999] uppercase tracking-wider mt-1 border-t border-[#444]">
                        {viewMode === 'collection' ? 'Crates' : 'Track Sources'}
                      </div>
                      <button onClick={() => handleFolderModeChange('crates')} className={`w-full px-4 py-2 bg-transparent border-none text-left cursor-pointer text-[13px] text-white flex items-center gap-2 hover:bg-[#3a3a3a] ${folderMode === 'crates' ? 'bg-[#5A9BD5]' : ''}`}>
                        <span>📦</span>
                        <span>Crates</span>
                      </button>
                      {viewMode !== 'collection' && (
                        <button onClick={() => handleFolderModeChange('playlists')} className={`w-full px-4 py-2 bg-transparent border-none text-left cursor-pointer text-[13px] text-white flex items-center gap-2 hover:bg-[#3a3a3a] ${folderMode === 'playlists' ? 'bg-[#5A9BD5]' : ''}`}>
                          <span>🎵</span>
                          <span>Playlists</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button title="View options" className="bg-transparent text-white border-none cursor-pointer text-base p-1">☰</button>
            </div>

            <div className="p-2.5 border-b border-[#1a1a1a] shrink-0">
              <div className="flex gap-1.5 items-center flex-nowrap">
                <input
                  type="text"
                  placeholder={folderMode === 'crates' ? 'Search crates...' : folderMode === 'playlists' ? 'Search playlists...' : 'Search format...'}
                  value={folderSearch}
                  onChange={(e) => setFolderSearch(e.target.value)}
                  title={folderMode === 'crates' ? 'Filter crates' : folderMode === 'playlists' ? 'Filter playlists' : 'Filter formats'}
                  className="flex-1 px-2 py-1.5 bg-[#3a3a3a] text-white border border-[#555] rounded text-xs outline-none"
                />
                <button onClick={() => setFolderSortByCount(!folderSortByCount)} title={folderSortByCount ? "Sort alphabetically" : "Sort by count"} className="bg-[#3a3a3a] text-white border border-[#555] px-2 py-1 rounded cursor-pointer text-xs shrink-0">{folderSortByCount ? '🔢' : '🔤'}</button>
                {viewMode !== 'collection' && folderMode === 'playlists' && (
                  <button
                    onClick={() => {
                      setPlaylistStudioInitialView('manual');
                      setShowPlaylistStudioModal(true);
                    }}
                    title="Create playlist"
                    className="bg-[#3a3a3a] text-white border border-[#555] px-2 py-1 rounded cursor-pointer text-xs shrink-0"
                  >
                    ＋
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 min-h-0">
              {folderMode === 'format' ? (
                <>
                  <button onClick={() => setSelectedFolderValue(null)} title="Show all albums" className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${!selectedFolderValue ? 'bg-[#5A9BD5]' : ''}`}>
                    <span>[All Albums]</span>
                    <span className={`text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold ${!selectedFolderValue ? 'bg-[#3578b3]' : 'bg-[#555]'}`}>{albums.length}</span>
                  </button>

                  {sortedFolderItems.map(([format, count]) => (
                    <button key={format} onClick={() => setSelectedFolderValue(format)} title={`Filter by ${format}`} className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedFolderValue === format ? 'bg-[#5A9BD5]' : ''}`}>
                      <span>{format}</span>
                      <span className={`text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold ${selectedFolderValue === format ? 'bg-[#3578b3]' : 'bg-[#555]'}`}>{count}</span>
                    </button>
                  ))}
                </>
              ) : folderMode === 'crates' ? (
                <>
                  <button onClick={() => setSelectedCrateId(null)} title="Show all albums" className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedCrateId === null ? 'bg-[#5A9BD5]' : ''}`}>
                    <span>📚 [All Albums]</span>
                    <span className={`text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold ${selectedCrateId === null ? 'bg-[#3578b3]' : 'bg-[#555]'}`}>{albums.length}</span>
                  </button>

                  {cratesWithCounts
                    .filter(crate => !folderSearch || crate.name.toLowerCase().includes(folderSearch.toLowerCase()))
                    .map(crate => (
                    <button key={crate.id} onClick={() => setSelectedCrateId(crate.id)} title={`Filter by ${crate.name}`} className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedCrateId === crate.id ? 'bg-[#5A9BD5]' : ''}`}>
                      <span className="flex items-center gap-1.5 min-w-0">
                        {crate.is_smart ? (
                          <BoxIcon color={crate.icon} size={16} />
                        ) : (
                          <span>{crate.icon}</span>
                        )}
                        <span className="truncate">{crate.name}</span>
                      </span>
                      <span className={`text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold ${selectedCrateId === crate.id ? 'bg-[#3578b3]' : 'bg-[#555]'}`}>{crate.album_count || 0}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button onClick={() => setSelectedPlaylistId(null)} title="Show all tracks" className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedPlaylistId === null ? 'bg-[#5A9BD5]' : ''}`}>
                    <span>🎵 [All Tracks]</span>
                    <span className={`text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold ${selectedPlaylistId === null ? 'bg-[#3578b3]' : 'bg-[#555]'}`}>{allTrackRows.length}</span>
                  </button>
                  {sortedPlaylists.map((playlist) => (
                      <button key={playlist.id} onClick={() => setSelectedPlaylistId(playlist.id)} title={`Filter by ${playlist.name}`} className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedPlaylistId === playlist.id ? 'bg-[#5A9BD5]' : ''}`}>
                        <span className="flex items-center gap-1.5 min-w-0">
                          {playlist.isSmart ? (
                            <span style={{ color: playlist.color }}>⚡</span>
                          ) : (
                            <span style={{ color: playlist.color }}>{playlist.icon}</span>
                          )}
                          <span className="truncate">{playlist.name}</span>
                        </span>
                        <span className={`text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold ${selectedPlaylistId === playlist.id ? 'bg-[#3578b3]' : 'bg-[#555]'}`}>{playlistCounts[playlist.id] || 0}</span>
                      </button>
                    ))}
                </>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">
            <div className="px-3 py-1.5 border-b border-[#555] flex items-center justify-between bg-[#4a4a4a] h-10 shrink-0">
              <div className="flex gap-1.5 items-center">
                <div className="relative">
                  <button onClick={() => setShowViewModeDropdown(!showViewModeDropdown)} title="Change view mode" className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white flex items-center gap-1">
                    <span>{viewMode === 'collection' ? '☰' : viewMode === 'album-track' ? '🧱' : '🎵'}</span>
                    <span style={{ fontSize: '9px' }}>▼</span>
                  </button>
                  {showViewModeDropdown && (
                    <>
                      <div onClick={() => setShowViewModeDropdown(false)} className="fixed inset-0 z-[99]" />
                      <div className="absolute top-full left-0 mt-1 bg-white border border-[#ddd] rounded shadow-lg z-[100] min-w-[220px]">
                        <button onClick={() => { handleViewModeChange('collection'); setShowViewModeDropdown(false); }} className={`w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] flex items-center justify-between hover:bg-[#f5f5f5] ${viewMode === 'collection' ? 'bg-[#e3f2fd]' : ''}`}>
                          <span>Collection Table</span>
                          {viewMode === 'collection' && <span className="text-[#2196F3]">✓</span>}
                        </button>
                        <button onClick={() => { handleViewModeChange('album-track'); setShowViewModeDropdown(false); }} className={`w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] flex items-center justify-between hover:bg-[#f5f5f5] ${viewMode === 'album-track' ? 'bg-[#e3f2fd]' : ''}`}>
                          <span>Album / Track Builder</span>
                          {viewMode === 'album-track' && <span className="text-[#2196F3]">✓</span>}
                        </button>
                        <button onClick={() => { handleViewModeChange('playlist'); setShowViewModeDropdown(false); }} className={`w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] flex items-center justify-between hover:bg-[#f5f5f5] ${viewMode === 'playlist' ? 'bg-[#e3f2fd]' : ''}`}>
                          <span>Playlist View</span>
                          {viewMode === 'playlist' && <span className="text-[#2196F3]">✓</span>}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setShowSortFavoritesDropdown(false);
                      setShowColumnFavoritesDropdown(false);
                      setShowSortSelector(true);
                    }}
                    title="Change Sorting"
                    className="bg-[#3a3a3a] border border-[#555] rounded-l rounded-r-none border-r-0 px-2 py-1 cursor-pointer text-xs text-white flex items-center justify-center hover:bg-[#444]"
                  >
                    <span className="text-sm leading-none">⇅</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowColumnFavoritesDropdown(false);
                        setShowSortFavoritesDropdown(!showSortFavoritesDropdown);
                      }}
                      title="Sorting Favorites"
                      className="bg-[#3a3a3a] border border-[#555] rounded-r rounded-l-none px-2 py-1 cursor-pointer text-xs text-white flex items-center justify-center hover:bg-[#444]"
                    >
                      <span className="text-[11px]">▼</span>
                    </button>
                    {showSortFavoritesDropdown && (
                      <>
                        <div onClick={() => setShowSortFavoritesDropdown(false)} className="fixed inset-0 z-[99]" />
                        <div className="absolute top-full left-0 mt-1 bg-white border border-[#ddd] rounded shadow-lg z-[100] min-w-[260px]">
                          <button
                            onClick={() => {
                              setShowSortFavoritesDropdown(false);
                              setShowManageSortFavoritesModal(true);
                            }}
                            className="w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] font-semibold hover:bg-[#f5f5f5]"
                          >
                            Manage Favorites
                          </button>
                          <div className="px-3 py-1 text-[10px] font-semibold text-[#999] uppercase tracking-wider border-t border-[#eee] bg-[#fafafa]">
                            Favorites
                          </div>
                          {activeSortFavorites.map((favorite) => (
                            <button
                              key={favorite.id}
                              onClick={() => handleApplySortFavorite(favorite.id)}
                              className={`w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] flex items-center justify-between hover:bg-[#f5f5f5] ${activeSelectedSortFavoriteId === favorite.id ? 'bg-[#e3f2fd]' : ''}`}
                            >
                              <span className="truncate pr-3">{getSortFavoriteDisplayLabel(favorite)}</span>
                              {activeSelectedSortFavoriteId === favorite.id && <span className="text-[#2196F3]">✓</span>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setShowSortFavoritesDropdown(false);
                      setShowColumnFavoritesDropdown(false);
                      setColumnSelectorMode(viewMode);
                      setShowColumnSelector(true);
                    }}
                    title="Change Columns"
                    className="bg-[#3a3a3a] border border-[#555] rounded-l rounded-r-none border-r-0 px-2 py-1 cursor-pointer text-xs text-white flex items-center justify-center hover:bg-[#444]"
                  >
                    <span className="text-sm leading-none">▦</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowSortFavoritesDropdown(false);
                        setShowColumnFavoritesDropdown(!showColumnFavoritesDropdown);
                      }}
                      title="Column Favorites"
                      className="bg-[#3a3a3a] border border-[#555] rounded-r rounded-l-none px-2 py-1 cursor-pointer text-xs text-white flex items-center justify-center hover:bg-[#444]"
                    >
                      <span className="text-[11px]">▼</span>
                    </button>
                    {showColumnFavoritesDropdown && (
                      <>
                        <div onClick={() => setShowColumnFavoritesDropdown(false)} className="fixed inset-0 z-[99]" />
                        <div className="absolute top-full left-0 mt-1 bg-white border border-[#ddd] rounded shadow-lg z-[100] min-w-[260px]">
                          <button
                            onClick={() => {
                              setShowColumnFavoritesDropdown(false);
                              setShowManageColumnFavoritesModal(true);
                            }}
                            className="w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] font-semibold hover:bg-[#f5f5f5]"
                          >
                            Manage Favorites
                          </button>
                          <div className="px-3 py-1 text-[10px] font-semibold text-[#999] uppercase tracking-wider border-t border-[#eee] bg-[#fafafa]">
                            Favorites
                          </div>
                          {activeColumnFavorites.map((favorite) => (
                            <button
                              key={favorite.id}
                              onClick={() => handleApplyColumnFavorite(favorite.id)}
                              className={`w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] flex items-center justify-between hover:bg-[#f5f5f5] ${activeSelectedColumnFavoriteId === favorite.id ? 'bg-[#e3f2fd]' : ''}`}
                            >
                              <span>{favorite.name}</span>
                              {activeSelectedColumnFavoriteId === favorite.id && <span className="text-[#2196F3]">✓</span>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs text-[#ddd] font-semibold">
                {loading
                  ? 'Loading...'
                  : viewMode === 'collection'
                    ? `${filteredAndSortedAlbums.length} albums`
                    : `${filteredTrackRows.length} tracks${tracksHydrating ? ' (loading track data...)' : ''}`}
              </div>
              {viewMode === 'album-track' && groupedTrackRows.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {folderMode === 'playlists' && selectedPlaylist?.isSmart && selectedPlaylist.liveUpdate && (
                    <button
                      onClick={handleRefreshSmartPlaylistMix}
                      title="Refresh smart playlist mix"
                      className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white"
                    >
                      Refresh mix
                    </button>
                  )}
                  <button
                    onClick={handleExpandAllAlbums}
                    title="Expand all albums"
                    className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white"
                  >
                    Expand all
                  </button>
                  <button
                    onClick={handleCollapseAllAlbums}
                    title="Collapse all albums"
                    className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white"
                  >
                    Collapse all
                  </button>
                </div>
              )}
              {viewMode === 'playlist' && folderMode === 'playlists' && selectedPlaylist?.isSmart && selectedPlaylist.liveUpdate && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleRefreshSmartPlaylistMix}
                    title="Refresh smart playlist mix"
                    className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white"
                  >
                    Refresh mix
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden bg-white min-h-0">
              {loading ? (
                <div className="p-10 text-center text-[#666]">Loading albums...</div>
              ) : viewMode !== 'collection' && !tracksHydrated && allTrackRows.length === 0 ? (
                <div className="p-10 text-center text-[#666]">Loading track data...</div>
              ) : (
                viewMode === 'collection' ? (
                  <CollectionTable albums={filteredAndSortedAlbums} visibleColumns={collectionVisibleColumns} lockedColumns={lockedColumns} onAlbumClick={handleAlbumClick} selectedAlbums={selectedAlbumsAsStrings} onSelectionChange={handleSelectionChange} sortState={tableSortState} onSortChange={handleTableSortChange} onEditAlbum={handleEditAlbum} />
                ) : viewMode === 'album-track' ? (
                  <div className="h-full overflow-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-[#f5f5f5] border-b border-[#ddd]">
                        <tr>
                          {resolvedAlbumTrackColumns.map((columnId) => {
                            const isControlCol = TRACK_COLUMN_CONTROL_IDS.has(columnId);
                            const isRightAligned = TRACK_COLUMN_RIGHT_ALIGN_IDS.has(columnId);
                            return (
                              <th
                                key={`album-track-header-${columnId}`}
                                className={`${isControlCol ? 'w-[42px]' : ''} px-2 py-2 ${isControlCol ? 'text-center' : isRightAligned ? 'text-right' : 'text-left'} font-semibold text-[#666]`}
                              >
                                {columnId === 'checkbox' ? (
                                  <input
                                    type="checkbox"
                                    checked={filteredTrackRows.length > 0 && selectedTrackKeys.size === filteredTrackRows.length}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedTrackKeys(new Set(filteredTrackRows.map((row) => row.key)));
                                      } else {
                                        setSelectedTrackKeys(new Set());
                                      }
                                    }}
                                  />
                                ) : (
                                  getTrackColumnLabel(columnId)
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {groupedTrackRows.map((group) => {
                          const isExpanded = expandedAlbumIds.has(group.inventoryId);
                          const allTracksSelected = group.tracks.length > 0 && group.tracks.every((track) => selectedTrackKeys.has(track.key));
                          return (
                            <Fragment key={`group-${group.inventoryId}`}>
                              <tr
                                key={`album-${group.inventoryId}`}
                                onClick={() => {
                                  setSelectedAlbumId(group.inventoryId);
                                  toggleAlbumExpanded(group.inventoryId);
                                }}
                                className={`border-b border-[#ddd] cursor-pointer ${selectedAlbumId === group.inventoryId ? 'bg-[#eef6ff]' : 'bg-[#f8fafc] hover:bg-[#f1f5f9]'}`}
                              >
                                {resolvedAlbumTrackColumns.map((columnId) => {
                                  const isControlCol = TRACK_COLUMN_CONTROL_IDS.has(columnId);
                                  const isRightAligned = TRACK_COLUMN_RIGHT_ALIGN_IDS.has(columnId);
                                  const textColor = isControlCol ? 'text-[#4b5563]' : columnId === 'track_title' ? 'text-[#111827] font-semibold' : columnId === 'track_artist' ? 'text-[#1f2937]' : 'text-[#4b5563]';
                                  return (
                                    <td
                                      key={`${group.inventoryId}-${columnId}`}
                                      className={`px-2 py-2 ${isControlCol ? 'text-center' : isRightAligned ? 'text-right' : 'text-left'} ${textColor}`}
                                    >
                                      {renderAlbumGroupCell(group, columnId, isExpanded, allTracksSelected)}
                                    </td>
                                  );
                                })}
                              </tr>
                              {isExpanded &&
                                group.tracks.map((row) => (
                                  <tr
                                    key={row.key}
                                    onClick={() => setSelectedAlbumId(row.inventoryId)}
                                    className={`border-b border-[#eee] cursor-pointer ${selectedAlbumId === row.inventoryId ? 'bg-[#f8fbff]' : 'hover:bg-[#fafafa]'}`}
                                  >
                                    {resolvedAlbumTrackColumns.map((columnId) => {
                                      const isControlCol = TRACK_COLUMN_CONTROL_IDS.has(columnId);
                                      const isRightAligned = TRACK_COLUMN_RIGHT_ALIGN_IDS.has(columnId);
                                      const textColor = isControlCol ? 'text-[#4b5563]' : columnId === 'track_title' ? 'text-[#1f2937]' : columnId === 'track_artist' ? 'text-[#374151]' : 'text-[#4b5563]';
                                      const titleIndent = columnId === 'track_title' ? 'pl-7' : '';
                                      return (
                                        <td
                                          key={`${row.key}-${columnId}`}
                                          className={`px-2 py-2 ${titleIndent} ${isControlCol ? 'text-center' : isRightAligned ? 'text-right' : 'text-left'} ${textColor}`}
                                        >
                                          {renderTrackCell(row, columnId)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    {groupedTrackRows.length === 0 && (
                      <div className="p-10 text-center text-[#666] text-sm">No tracks match the current filters.</div>
                    )}
                  </div>
                ) : (
                  <div className="h-full overflow-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-[#f5f5f5] border-b border-[#ddd]">
                        <tr>
                          {resolvedPlaylistColumns.map((columnId) => {
                            const isControlCol = TRACK_COLUMN_CONTROL_IDS.has(columnId);
                            const isRightAligned = TRACK_COLUMN_RIGHT_ALIGN_IDS.has(columnId);
                            return (
                              <th
                                key={`playlist-header-${columnId}`}
                                className={`${isControlCol ? 'w-[42px]' : ''} px-2 py-2 ${isControlCol ? 'text-center' : isRightAligned ? 'text-right' : 'text-left'} font-semibold text-[#666]`}
                              >
                                {columnId === 'checkbox' ? (
                                  <input
                                    type="checkbox"
                                    checked={filteredTrackRows.length > 0 && selectedTrackKeys.size === filteredTrackRows.length}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedTrackKeys(new Set(filteredTrackRows.map((row) => row.key)));
                                      } else {
                                        setSelectedTrackKeys(new Set());
                                      }
                                    }}
                                  />
                                ) : (
                                  getTrackColumnLabel(columnId)
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTrackRows.map((row) => (
                          <tr
                            key={row.key}
                            onClick={() => setSelectedAlbumId(row.inventoryId)}
                            className={`border-b border-[#eee] cursor-pointer ${selectedAlbumId === row.inventoryId ? 'bg-[#f8fbff]' : 'hover:bg-[#fafafa]'}`}
                          >
                            {resolvedPlaylistColumns.map((columnId) => {
                              const isControlCol = TRACK_COLUMN_CONTROL_IDS.has(columnId);
                              const isRightAligned = TRACK_COLUMN_RIGHT_ALIGN_IDS.has(columnId);
                              const textColor = isControlCol ? 'text-[#4b5563]' : columnId === 'track_title' ? 'text-[#1f2937]' : columnId === 'track_artist' ? 'text-[#374151]' : 'text-[#4b5563]';
                              return (
                                <td
                                  key={`${row.key}-${columnId}`}
                                  className={`px-2 py-2 ${isControlCol ? 'text-center' : isRightAligned ? 'text-right' : 'text-left'} ${textColor}`}
                                >
                                  {renderTrackCell(row, columnId)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredTrackRows.length === 0 && (
                      <div className="p-10 text-center text-[#666] text-sm">No tracks match the current filters.</div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          <div className="hidden lg:flex w-[380px] bg-white border-l border-[#ddd] overflow-auto flex-col shrink-0">
            {/* Action Toolbar */}
            <div className="px-3 py-1.5 border-b border-[#555] flex items-center justify-between bg-[#4a4a4a] h-10 shrink-0">
              <div className="flex gap-1.5 items-center">
                <button onClick={() => selectedAlbumId && handleEditAlbum(selectedAlbumId)} title="Edit album details" className="bg-[#3a3a3a] border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-sm text-white">✏️</button>
                <button title="Share album" className="bg-[#3a3a3a] border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-sm text-white">↗️</button>
                <button title="Search on eBay" className="bg-[#3a3a3a] border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-xs text-white font-semibold">eBay</button>
                <button title="More actions" className="bg-[#3a3a3a] border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-sm text-white">⋮</button>
              </div>
              
              <button title="Select visible fields" className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white flex items-center gap-1">
                <span>⊞</span>
                <span className="text-[9px]">▼</span>
              </button>
            </div>
            
            <CollectionInfoPanel 
                album={selectedAlbum} 
                onClose={() => setSelectedAlbumId(null)}
            />
          </div>
        </div>
      </div>

      {showColumnSelector && (
        <ColumnSelector
          visibleColumns={activeColumnSelectorConfig.visibleColumns}
          onColumnsChange={handleActiveColumnsChange}
          onClose={() => setShowColumnSelector(false)}
          columnDefinitions={activeColumnSelectorConfig.columnDefinitions}
          columnGroups={activeColumnSelectorConfig.columnGroups}
          defaultVisibleColumns={activeColumnSelectorConfig.defaultVisibleColumns}
          selectedColumnsTitle={activeColumnSelectorConfig.selectedColumnsTitle}
        />
      )}
      <SortSelectorModal
        isOpen={showSortSelector}
        onClose={() => setShowSortSelector(false)}
        favoriteName={activeSortFavoriteName}
        fields={activeSortFields}
        sortFields={activeSortFieldGroups}
        onSave={handleSaveSortFields}
      />
      <ManageColumnFavoritesModal
        isOpen={showManageColumnFavoritesModal}
        onClose={() => setShowManageColumnFavoritesModal(false)}
        favorites={activeColumnFavorites}
        onSave={(favorites) => {
          if (viewMode === 'collection') {
            setCollectionColumnFavorites(favorites);
            if (!favorites.some((item) => item.id === selectedCollectionColumnFavoriteId)) {
              setSelectedCollectionColumnFavoriteId(favorites[0]?.id ?? '');
            }
          } else if (viewMode === 'album-track') {
            setAlbumTrackColumnFavorites(favorites);
            if (!favorites.some((item) => item.id === selectedAlbumTrackColumnFavoriteId)) {
              setSelectedAlbumTrackColumnFavoriteId(favorites[0]?.id ?? '');
            }
          } else {
            setPlaylistColumnFavorites(favorites);
            if (!favorites.some((item) => item.id === selectedPlaylistColumnFavoriteId)) {
              setSelectedPlaylistColumnFavoriteId(favorites[0]?.id ?? '');
            }
          }
          setShowManageColumnFavoritesModal(false);
        }}
        selectedId={activeSelectedColumnFavoriteId}
        onSelect={(id) => {
          if (viewMode === 'collection') {
            setSelectedCollectionColumnFavoriteId(id);
            const favorite = collectionColumnFavorites.find((item) => item.id === id) ?? null;
            const mapped = mapFavoriteColumnsToCollectionColumns(favorite);
            if (mapped.length > 0) {
              handleCollectionColumnsChange([...new Set([...COLLECTION_CONTROL_COLUMNS, ...mapped])]);
            }
          } else if (viewMode === 'album-track') {
            setSelectedAlbumTrackColumnFavoriteId(id);
            const favorite = albumTrackColumnFavorites.find((item) => item.id === id) ?? null;
            const mapped = mapFavoriteColumnsToTrackColumns(favorite);
            if (mapped.length > 0) {
              handleAlbumTrackColumnsChange([...new Set(['checkbox' as TrackViewColumnId, ...mapped])]);
            }
          } else {
            setSelectedPlaylistColumnFavoriteId(id);
            const favorite = playlistColumnFavorites.find((item) => item.id === id) ?? null;
            const mapped = mapFavoriteColumnsToTrackColumns(favorite);
            if (mapped.length > 0) {
              handlePlaylistColumnsChange([...new Set(['checkbox' as TrackViewColumnId, ...mapped])]);
            }
          }
        }}
        title={activeColumnFavoriteModalTitle}
        columnFields={activeColumnFieldGroups}
      />
      <ManageSortFavoritesModal
        isOpen={showManageSortFavoritesModal}
        onClose={() => setShowManageSortFavoritesModal(false)}
        favorites={activeSortFavorites}
        onSave={(favorites) => {
          if (viewMode === 'collection') {
            setCollectionSortFavorites(favorites);
            const nextId = favorites.some((item) => item.id === selectedCollectionSortFavoriteId)
              ? selectedCollectionSortFavoriteId
              : (favorites[0]?.id ?? '');
            setSelectedCollectionSortFavoriteId(nextId);
            const nextFavorite = favorites.find((item) => item.id === nextId) ?? null;
            setActiveCollectionSortFields(nextFavorite?.fields ?? []);
            setTableSortState({ column: null, direction: null });
          } else if (viewMode === 'album-track') {
            setAlbumTrackSortFavorites(favorites);
            const nextId = favorites.some((item) => item.id === selectedAlbumTrackSortFavoriteId)
              ? selectedAlbumTrackSortFavoriteId
              : (favorites[0]?.id ?? '');
            setSelectedAlbumTrackSortFavoriteId(nextId);
            const nextFavorite = favorites.find((item) => item.id === nextId) ?? null;
            setActiveAlbumTrackSortFields(nextFavorite?.fields ?? []);
          } else {
            setPlaylistSortFavorites(favorites);
            const nextId = favorites.some((item) => item.id === selectedPlaylistSortFavoriteId)
              ? selectedPlaylistSortFavoriteId
              : (favorites[0]?.id ?? '');
            setSelectedPlaylistSortFavoriteId(nextId);
            const nextFavorite = favorites.find((item) => item.id === nextId) ?? null;
            setActivePlaylistSortFields(nextFavorite?.fields ?? []);
          }
          setShowManageSortFavoritesModal(false);
        }}
        selectedId={activeSelectedSortFavoriteId}
        onSelect={(id) => {
          if (viewMode === 'collection') {
            setSelectedCollectionSortFavoriteId(id);
            const favorite = collectionSortFavorites.find((item) => item.id === id) ?? null;
            if (favorite && favorite.fields.length > 0) {
              setActiveCollectionSortFields(favorite.fields);
              setTableSortState({ column: null, direction: null });
            }
          } else if (viewMode === 'album-track') {
            setSelectedAlbumTrackSortFavoriteId(id);
            const favorite = albumTrackSortFavorites.find((item) => item.id === id) ?? null;
            if (favorite && favorite.fields.length > 0) {
              setActiveAlbumTrackSortFields(favorite.fields);
            }
          } else {
            setSelectedPlaylistSortFavoriteId(id);
            const favorite = playlistSortFavorites.find((item) => item.id === id) ?? null;
            if (favorite && favorite.fields.length > 0) {
              setActivePlaylistSortFields(favorite.fields);
            }
          }
        }}
        title={activeSortFavoriteModalTitle}
        sortFields={activeSortFieldGroups}
      />
      {editingAlbumId && <EditAlbumModal albumId={editingAlbumId} onClose={() => setEditingAlbumId(null)} onRefresh={loadAlbums} onNavigate={(newAlbumId) => setEditingAlbumId(newAlbumId)} allAlbumIds={filteredAndSortedAlbums.map(a => a.id)} />}
      {showNewCrateModal && <NewCrateModal isOpen={showNewCrateModal} onClose={() => { setShowNewCrateModal(false); setEditingCrate(null); if (returnToAddToCrate) { setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }}} onCrateCreated={async (newCrateId) => { await loadCrates(); setEditingCrate(null); if (returnToAddToCrate) { setNewlyCreatedCrateId(newCrateId); setShowNewCrateModal(false); setShowAddToCrateModal(true); } else { setShowNewCrateModal(false); }}} editingCrate={editingCrate} />}
      {showNewSmartCrateModal && <NewSmartCrateModal isOpen={showNewSmartCrateModal} onClose={() => { setShowNewSmartCrateModal(false); setEditingCrate(null); }} onCrateCreated={() => { loadCrates(); setShowNewSmartCrateModal(false); setEditingCrate(null); }} editingCrate={editingCrate} />}
      {showAddToCrateModal && <AddToCrateModal isOpen={showAddToCrateModal} onClose={() => { setShowAddToCrateModal(false); setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }} crates={cratesWithCounts} onAddToCrates={handleAddToCrates} selectedCount={selectedAlbumIds.size} onOpenNewCrate={() => { setReturnToAddToCrate(true); setShowAddToCrateModal(false); setEditingCrate(null); setShowNewCrateModal(true); }} autoSelectCrateId={newlyCreatedCrateId} />}
      {showAddToPlaylistModal && (
        <AddToPlaylistModal
          isOpen={showAddToPlaylistModal}
          onClose={() => setShowAddToPlaylistModal(false)}
          playlists={playlists}
          selectedTrackCount={selectedTrackKeys.size}
          onAdd={handleAddToPlaylists}
          onOpenNewPlaylist={() => {
            setShowAddToPlaylistModal(false);
            setPlaylistStudioInitialView('manual');
            setShowPlaylistStudioModal(true);
          }}
        />
      )}
      {showPlaylistStudioModal && (
        <PlaylistStudioModal
          isOpen={showPlaylistStudioModal}
          initialView={playlistStudioInitialView}
          onClose={() => setShowPlaylistStudioModal(false)}
          playlists={playlists}
          smartValueOptions={smartPlaylistValueOptions}
          onReorderPlaylists={handleReorderPlaylists}
          onDeletePlaylist={handleDeletePlaylist}
          onDeleteAllPlaylists={handleDeleteAllPlaylists}
          onCreateManualPlaylist={handleCreatePlaylist}
          onCreateSmartPlaylist={handleCreateSmartPlaylist}
          onUpdatePlaylist={handleUpdatePlaylist}
          onImported={loadPlaylists}
        />
      )}
      {showExportModal && (
        <ExportCsvTxtModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          viewMode={viewMode}
          allAlbums={albums}
          currentAlbums={filteredAndSortedAlbums}
          selectedAlbumIds={selectedAlbumIds}
          allTracks={allTrackRows}
          currentTracks={filteredTrackRows}
          selectedTrackKeys={selectedTrackKeys}
          playlists={playlists}
          selectedPlaylistId={selectedPlaylistId}
          visibleColumns={collectionVisibleColumns}
        />
      )}
    </>
  );
}

function ExportCsvTxtModal({
  isOpen,
  onClose,
  viewMode,
  allAlbums,
  currentAlbums,
  selectedAlbumIds,
  allTracks,
  currentTracks,
  selectedTrackKeys,
  playlists,
  selectedPlaylistId,
  visibleColumns
}: {
  isOpen: boolean;
  onClose: () => void;
  viewMode: AppViewMode;
  allAlbums: Album[];
  currentAlbums: Album[];
  selectedAlbumIds: Set<number>;
  allTracks: CollectionTrackRow[];
  currentTracks: CollectionTrackRow[];
  selectedTrackKeys: Set<string>;
  playlists: Playlist[];
  selectedPlaylistId: number | null;
  visibleColumns: ColumnId[];
}) {
  type TrackExportColumnId =
    | 'album_artist'
    | 'album_title'
    | 'track_artist'
    | 'track_title'
    | 'position'
    | 'side'
    | 'length'
    | 'format'
    | 'playlist';

  const trackColumnLabels: Record<TrackExportColumnId, string> = {
    album_artist: 'Album Artist',
    album_title: 'Album',
    track_artist: 'Track Artist',
    track_title: 'Track',
    position: 'Position',
    side: 'Side',
    length: 'Length',
    format: 'Format',
    playlist: 'Playlist',
  };

  const defaultColumnFavorites: ColumnFavorite[] = [
    {
      id: 'favorite-my-export',
      name: 'My Print / Export columns',
      columns: ['Artist', 'Title', 'Format', 'Discs', 'Tracks', 'Length', 'Barcode', 'Cat No', 'Genre', 'Label', 'Added'],
    },
  ];

  const [formatType, setFormatType] = useState<'csv' | 'txt'>('csv');
  const [scope, setScope] = useState<'all' | 'current' | 'selected'>('current');
  const [delimiter, setDelimiter] = useState<string>(',');
  const [enclosure, setEnclosure] = useState<'double' | 'single' | 'none'>('double');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [filename, setFilename] = useState('collection_export');
  const [columnFavorites, setColumnFavorites] = useState<ColumnFavorite[]>(defaultColumnFavorites);
  const [selectedColumnFavoriteId, setSelectedColumnFavoriteId] = useState<string>(defaultColumnFavorites[0].id);
  const [showManageColumnFavorites, setShowManageColumnFavorites] = useState(false);
  const [selectedAlbumColumns, setSelectedAlbumColumns] = useState<ColumnId[]>(
    visibleColumns.filter((id) => !['checkbox', 'owned', 'for_sale_indicator', 'menu'].includes(id))
  );
  const [selectedTrackColumns, setSelectedTrackColumns] = useState<TrackExportColumnId[]>([
    'album_artist',
    'album_title',
    'track_artist',
    'track_title',
    'position',
    'side',
    'length',
    'format',
  ]);

  useEffect(() => {
    if (formatType === 'txt') {
      setDelimiter('\t');
      setEnclosure('none');
    } else if (delimiter === '\t') {
      setDelimiter(',');
      setEnclosure('double');
    }
  }, [formatType, delimiter]);

  useEffect(() => {
    if (!isOpen) return;
    const storedFavorites = localStorage.getItem('collection-export-column-favorites');
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites) as ColumnFavorite[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setColumnFavorites(parsed);
          setSelectedColumnFavoriteId(parsed[0].id);
        }
      } catch {
        // ignore invalid local storage
      }
    }

    const storedSelectedColumns = localStorage.getItem('collection-export-selected-album-columns');
    if (storedSelectedColumns) {
      try {
        const parsed = JSON.parse(storedSelectedColumns) as ColumnId[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedAlbumColumns(parsed);
        }
      } catch {
        // ignore invalid local storage
      }
    }
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('collection-export-column-favorites', JSON.stringify(columnFavorites));
  }, [columnFavorites]);

  useEffect(() => {
    localStorage.setItem('collection-export-selected-album-columns', JSON.stringify(selectedAlbumColumns));
  }, [selectedAlbumColumns]);

  if (!isOpen) return null;

  const exportableAlbumColumns = Object.values(COLUMN_DEFINITIONS)
    .map((definition) => definition.id)
    .filter((id): id is ColumnId => !['checkbox', 'owned', 'for_sale_indicator', 'menu'].includes(id));

  const selectedFavorite = columnFavorites.find((favorite) => favorite.id === selectedColumnFavoriteId) ?? null;

  const favoriteToColumnIds = (favorite: ColumnFavorite | null): ColumnId[] => {
    if (!favorite) return [];

    const byLabel = Object.values(COLUMN_DEFINITIONS).reduce((acc, definition) => {
      acc[definition.label.toLowerCase()] = definition.id;
      return acc;
    }, {} as Record<string, ColumnId>);

    const aliases: Record<string, ColumnId> = {
      genre: 'genres',
      style: 'styles',
      tag: 'custom_tags',
      tags: 'custom_tags',
      'cat no': 'cat_no',
      'cat no.': 'cat_no',
      location: 'location',
      owner: 'owner',
      format: 'format',
      artist: 'artist',
      title: 'title',
      year: 'year',
      barcode: 'barcode',
      discs: 'discs',
      tracks: 'tracks',
      length: 'length',
      label: 'labels',
      labels: 'labels',
      added: 'added_date',
      'added date': 'added_date',
      status: 'collection_status',
      'media condition': 'media_condition',
      'sleeve condition': 'package_sleeve_condition',
      notes: 'personal_notes',
      'purchase price': 'purchase_price',
      value: 'current_value',
    };

    const resolved = favorite.columns
      .map((column) => {
        const key = column.toLowerCase().trim();
        return byLabel[key] ?? aliases[key] ?? null;
      })
      .filter((columnId): columnId is ColumnId => Boolean(columnId))
      .filter((columnId, index, arr) => arr.indexOf(columnId) === index);

    return resolved.filter((columnId) => exportableAlbumColumns.includes(columnId));
  };

  const exportAlbumColumns = selectedAlbumColumns.filter((columnId) => exportableAlbumColumns.includes(columnId));

  const selectedAlbums = allAlbums.filter((album) => selectedAlbumIds.has(album.id));
  const selectedTracks = allTracks.filter((track) => selectedTrackKeys.has(track.key));
  const selectedPlaylist = selectedPlaylistId ? playlists.find((playlist) => playlist.id === selectedPlaylistId) : null;
  const datasetCount = viewMode === 'collection'
    ? { all: allAlbums.length, current: currentAlbums.length, selected: selectedAlbums.length }
    : { all: allTracks.length, current: currentTracks.length, selected: selectedTracks.length };

  const albumRows = scope === 'all' ? allAlbums : scope === 'selected' ? selectedAlbums : currentAlbums;
  const trackRows = scope === 'all' ? allTracks : scope === 'selected' ? selectedTracks : currentTracks;

  const resolveAlbumValue = (album: Album, column: ColumnId): string => {
    switch (column) {
      case 'artist': return getAlbumArtist(album);
      case 'title': return getAlbumTitle(album);
      case 'year': return String(getAlbumYearValue(album) ?? '');
      case 'format': return getDisplayFormat(getAlbumFormat(album));
      case 'barcode': return album.barcode || album.release?.barcode || '';
      case 'cat_no': return album.cat_no || album.catalog_number || album.release?.catalog_number || '';
      case 'discs': return String(album.discs ?? album.release?.qty ?? '');
      case 'tracks': return String(album.release?.release_tracks?.length ?? album.tracks?.length ?? '');
      case 'length': {
        const seconds = (album.release?.release_tracks ?? []).reduce((sum, track) => sum + (track.recording?.duration_seconds ?? 0), 0);
        return seconds ? formatTrackDuration(seconds) : '';
      }
      case 'genres': return (album.genres ?? album.release?.master?.genres ?? []).join(' | ');
      case 'styles': return (album.styles ?? album.release?.master?.styles ?? []).join(' | ');
      case 'labels': return (album.labels ?? (album.label ? [album.label] : [])).join(' | ');
      case 'location': return album.location || '';
      case 'collection_status': return album.collection_status || album.status || '';
      case 'media_condition': return album.media_condition || '';
      case 'package_sleeve_condition': return album.package_sleeve_condition || album.sleeve_condition || '';
      case 'purchase_price': return album.purchase_price != null ? String(album.purchase_price) : '';
      case 'current_value': return album.current_value != null ? String(album.current_value) : '';
      case 'added_date': return album.date_added || '';
      case 'personal_notes': return album.personal_notes || '';
      case 'custom_tags': return (album.custom_tags ?? []).join(' | ');
      case 'owner': return album.owner || '';
      default: return '';
    }
  };

  const headers = viewMode === 'collection'
    ? exportAlbumColumns.map((id) => COLUMN_DEFINITIONS[id]?.label || id)
    : selectedTrackColumns.map((id) => trackColumnLabels[id]);

  const rows = viewMode === 'collection'
    ? albumRows.map((album) => exportAlbumColumns.map((col) => resolveAlbumValue(album, col)))
    : trackRows.map((track) =>
        selectedTrackColumns.map((columnId) => {
          if (columnId === 'album_artist') return track.albumArtist;
          if (columnId === 'album_title') return track.albumTitle;
          if (columnId === 'track_artist') return track.trackArtist;
          if (columnId === 'track_title') return track.trackTitle;
          if (columnId === 'position') return track.position;
          if (columnId === 'side') return track.side ?? '';
          if (columnId === 'length') return track.durationLabel;
          if (columnId === 'format') return track.trackFormatFacets.join(' | ') || track.albumMediaType;
          if (columnId === 'playlist') return selectedPlaylist?.name ?? '';
          return '';
        })
      );

  const quoteChar = enclosure === 'double' ? '"' : enclosure === 'single' ? '\'' : '';
  const escaped = (value: string): string => {
    if (!quoteChar) return value.replace(/\r?\n/g, ' ');
    const escapedQuotes = value.replace(new RegExp(quoteChar, 'g'), `${quoteChar}${quoteChar}`);
    return `${quoteChar}${escapedQuotes}${quoteChar}`;
  };

  const renderedLines = [
    ...(includeHeaders ? [headers.map((value) => escaped(value)).join(delimiter)] : []),
    ...rows.map((row) => row.map((value) => escaped(String(value ?? ''))).join(delimiter)),
  ];

  const previewText = renderedLines.slice(0, 40).join('\n');

  const download = () => {
    const text = renderedLines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename || 'export'}.${formatType}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30003]" onClick={onClose}>
        <div className="bg-white rounded-lg w-[1000px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="m-0 text-lg font-semibold text-gray-900">Export to CSV / TXT</h2>
          <button onClick={onClose} className="bg-transparent border-none text-2xl cursor-pointer text-gray-500">×</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="border border-gray-200 rounded p-3">
              <div className="text-sm font-semibold text-gray-900 mb-2">Scope</div>
              <label className="flex items-center gap-2 text-sm mb-1">
                <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} />
                <span>{viewMode === 'collection' ? 'All Albums' : 'All Tracks'} ({datasetCount.all})</span>
              </label>
              <label className="flex items-center gap-2 text-sm mb-1">
                <input type="radio" checked={scope === 'current'} onChange={() => setScope('current')} />
                <span>Current List ({datasetCount.current})</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={scope === 'selected'} onChange={() => setScope('selected')} />
                <span>Selected ({datasetCount.selected})</span>
              </label>
            </div>

            <div className="border border-gray-200 rounded p-3">
              <div className="text-sm font-semibold text-gray-900 mb-2 flex items-center justify-between">
                <span>Columns</span>
                {viewMode === 'collection' && (
                  <button onClick={() => setShowManageColumnFavorites(true)} className="px-2 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer">
                    Manage
                  </button>
                )}
              </div>
              {viewMode === 'collection' ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <select
                      value={selectedColumnFavoriteId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setSelectedColumnFavoriteId(nextId);
                        const favorite = columnFavorites.find((item) => item.id === nextId) ?? null;
                        const mapped = favoriteToColumnIds(favorite);
                        if (mapped.length > 0) {
                          setSelectedAlbumColumns(mapped);
                        }
                      }}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                    >
                      {columnFavorites.map((favorite) => (
                        <option key={favorite.id} value={favorite.id}>{favorite.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const mapped = favoriteToColumnIds(selectedFavorite);
                        if (mapped.length > 0) setSelectedAlbumColumns(mapped);
                      }}
                      className="px-2 py-1.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  <div className="max-h-[120px] overflow-auto border border-gray-200 rounded p-2 text-xs">
                    {exportableAlbumColumns.map((columnId) => {
                      const checked = selectedAlbumColumns.includes(columnId);
                      return (
                        <label key={columnId} className="flex items-center gap-2 mb-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedAlbumColumns((prev) => {
                                if (prev.includes(columnId)) {
                                  return prev.filter((item) => item !== columnId);
                                }
                                return [...prev, columnId];
                              });
                            }}
                          />
                          <span>{COLUMN_DEFINITIONS[columnId].label}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="max-h-[120px] overflow-auto border border-gray-200 rounded p-2 text-xs">
                  {Object.entries(trackColumnLabels).map(([columnId, label]) => {
                    const id = columnId as TrackExportColumnId;
                    const checked = selectedTrackColumns.includes(id);
                    return (
                      <label key={columnId} className="flex items-center gap-2 mb-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedTrackColumns((prev) => {
                              if (prev.includes(id)) {
                                return prev.filter((item) => item !== id);
                              }
                              return [...prev, id];
                            });
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <button onClick={() => setFormatType('csv')} className={`px-4 py-2 rounded text-sm font-semibold ${formatType === 'csv' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}>CSV</button>
            <button onClick={() => setFormatType('txt')} className={`px-4 py-2 rounded text-sm font-semibold ${formatType === 'txt' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}>TXT</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="border border-gray-200 rounded p-3">
              <div className="text-sm font-semibold mb-2">Field Delimiter</div>
              {[
                { label: 'Semicolon', value: ';' },
                { label: 'Comma', value: ',' },
                { label: 'Tab', value: '\t' },
                { label: 'Space', value: ' ' },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-2 text-sm mb-1">
                  <input type="radio" checked={delimiter === item.value} onChange={() => setDelimiter(item.value)} />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="border border-gray-200 rounded p-3">
              <div className="text-sm font-semibold mb-2">Field Enclosure</div>
              {[
                { label: 'Double Quote', value: 'double' as const },
                { label: 'Single Quote', value: 'single' as const },
                { label: 'None', value: 'none' as const },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-2 text-sm mb-1">
                  <input type="radio" checked={enclosure === item.value} onChange={() => setEnclosure(item.value)} />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="border border-gray-200 rounded p-3">
              <div className="text-sm font-semibold mb-2">Options</div>
              <label className="flex items-center gap-2 text-sm mb-3">
                <input type="checkbox" checked={includeHeaders} onChange={(e) => setIncludeHeaders(e.target.checked)} />
                <span>Include Field Names as First Row</span>
              </label>
              <div className="text-sm font-semibold mb-1">Filename</div>
              <input value={filename} onChange={(e) => setFilename(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
          </div>

          <div className="border border-gray-200 rounded p-3">
            <div className="text-sm font-semibold mb-2">Preview</div>
            <pre className="text-[12px] leading-5 bg-gray-50 border border-gray-200 rounded p-3 max-h-[260px] overflow-auto whitespace-pre-wrap">{previewText}</pre>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 border-none rounded text-sm cursor-pointer hover:bg-gray-200">Cancel</button>
          <button onClick={download} className="px-4 py-2 bg-blue-500 text-white border-none rounded text-sm cursor-pointer hover:bg-blue-600">Generate File</button>
        </div>
        </div>
      </div>

      <ManageColumnFavoritesModal
        isOpen={showManageColumnFavorites}
        onClose={() => setShowManageColumnFavorites(false)}
        favorites={columnFavorites}
        onSave={(favorites) => {
          setColumnFavorites(favorites);
          setShowManageColumnFavorites(false);
        }}
        selectedId={selectedColumnFavoriteId}
        onSelect={setSelectedColumnFavoriteId}
      />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen text-base text-gray-500">
        Loading...
      </div>
    }>
      <CollectionBrowserPage />
    </Suspense>
  );
}
// AUDIT: updated for UI parity (sort control alignment).

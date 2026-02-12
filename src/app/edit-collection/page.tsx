// src/app/edit-collection/page.tsx
'use client';

import { useCallback, useEffect, useState, useMemo, Suspense, Fragment } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CollectionTable from '../../components/CollectionTable';
import ColumnSelector from '../../components/ColumnSelector';
import { ColumnId, COLUMN_DEFINITIONS, DEFAULT_VISIBLE_COLUMNS, DEFAULT_LOCKED_COLUMNS, SortState } from './columnDefinitions';
import type { Album } from '../../types/album';
import { toSafeStringArray, toSafeSearchString } from '../../types/album';
import EditAlbumModal from './EditAlbumModal';
import NewCrateModal from './crates/NewCrateModal';
import NewSmartCrateModal from './crates/NewSmartCrateModal';
import { AddToCrateModal } from './crates/AddToCrateModal';
import NewPlaylistModal from './playlists/NewPlaylistModal';
import AddToPlaylistModal from './playlists/AddToPlaylistModal';
import ManagePlaylistsModal from './playlists/ManagePlaylistsModal';
import NewSmartPlaylistModal from './playlists/NewSmartPlaylistModal';
import Header from './Header';
import { ManageColumnFavoritesModal, type ColumnFavorite } from './ManageColumnFavoritesModal';
import type { Crate } from '../../types/crate';
import type { CollectionPlaylist } from '../../types/collectionPlaylist';
import type { SmartPlaylistRule } from '../../types/collectionPlaylist';
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

type AppViewMode = 'collection' | 'album-track';
type SidebarMode = 'format' | 'crates' | 'playlists';
type TrackListSource = 'crates' | 'playlists';
type CrateGameKey = 'bingo' | 'trivia' | 'brackets';

type Playlist = CollectionPlaylist;

interface TrackAlbumGroup {
  inventoryId: number;
  albumArtist: string;
  albumTitle: string;
  trackCount: number;
  totalSeconds: number;
  tracks: CollectionTrackRow[];
  sideTotals: Array<{ side: string; totalSeconds: number; trackCount: number }>;
}

type CrateGameFlags = Record<number, Record<CrateGameKey, boolean>>;

const CRATE_GAME_LABELS: { key: CrateGameKey; icon: string; label: string }[] = [
  { key: 'bingo', icon: '🎱', label: 'Bingo' },
  { key: 'trivia', icon: '❓', label: 'Trivia' },
  { key: 'brackets', icon: '🏆', label: 'Brackets' },
];

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
    is1001: (album as unknown as { is_1001?: boolean | null }).is_1001 === true,
    customTags: toSafeStringArray(album.custom_tags ?? album.tags ?? normalizedTags),
    discogsGenres: toSafeStringArray(master?.genres ?? album.genres),
    spotifyGenres: toSafeStringArray((album as unknown as { spotify_genres?: unknown }).spotify_genres),
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
  const [crateGameFlags, setCrateGameFlags] = useState<CrateGameFlags>({});
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [showManagePlaylistsModal, setShowManagePlaylistsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [showNewSmartPlaylistModal, setShowNewSmartPlaylistModal] = useState(false);
  
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
  
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showViewModeDropdown, setShowViewModeDropdown] = useState(false);
  const [showTrackFormatDropdown, setShowTrackFormatDropdown] = useState(false);

  const [tableSortState, setTableSortState] = useState<SortState>({
    column: null,
    direction: null
  });

  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [lockedColumns, setLockedColumns] = useState<ColumnId[]>(DEFAULT_LOCKED_COLUMNS);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  useEffect(() => {
    const stored = localStorage.getItem('collection-visible-columns');
    if (stored) {
      try {
        setVisibleColumns(JSON.parse(stored));
      } catch {
        // Invalid JSON, use defaults
      }
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
    const storedFlags = localStorage.getItem('collection-crate-game-flags');
    if (storedFlags) {
      try {
        setCrateGameFlags(JSON.parse(storedFlags) as CrateGameFlags);
      } catch {
        // Invalid JSON, ignore
      }
    }

    const storedViewMode = localStorage.getItem('collection-view-mode');
    if (storedViewMode === 'collection' || storedViewMode === 'album-track') {
      setViewMode(storedViewMode);
    }
  }, []);

  const handleColumnsChange = useCallback((columns: ColumnId[]) => {
    setVisibleColumns(columns);
    localStorage.setItem('collection-visible-columns', JSON.stringify(columns));
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
    localStorage.setItem('collection-crate-game-flags', JSON.stringify(crateGameFlags));
  }, [crateGameFlags]);

  useEffect(() => {
    localStorage.setItem('collection-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('collection-track-sort-preference', trackSortBy);
  }, [trackSortBy]);

  useEffect(() => {
    localStorage.setItem('collection-track-format-filter-mode', trackFormatFilterMode);
  }, [trackFormatFilterMode]);

  useEffect(() => {
    localStorage.setItem('collection-track-format-filters', JSON.stringify(Array.from(trackFormatFilters)));
  }, [trackFormatFilters]);

  const handleSortChange = useCallback((newSort: SortOption) => {
    setSortBy(newSort);
    localStorage.setItem('collection-sort-preference', newSort);
    setShowSortDropdown(false);
    setTableSortState({ column: null, direction: null });
  }, []);

  const handleTrackSortChange = useCallback((newSort: TrackSortOption) => {
    setTrackSortBy(newSort);
    setShowSortDropdown(false);
  }, []);

  const handleTableSortChange = useCallback((column: ColumnId) => {
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

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allRows: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let keepGoing = true;

    while (keepGoing) {
      const { data: batch, error } = await supabase
        .from('inventory')
        .select(
          `id,
           release_id,
           status,
           personal_notes,
           media_condition,
           sleeve_condition,
           location,
           date_added,
           created_at,
           purchase_price,
           current_value,
           purchase_date,
           owner,
           play_count,
           last_played_at,
             release:releases (
               id,
               master_id,
               media_type,
               label,
               catalog_number,
               barcode,
               country,
               release_date,
               release_year,
               discogs_release_id,
               spotify_album_id,
               notes,
               track_count,
               qty,
               format_details,
               release_tracks:release_tracks (
                 id,
                 position,
                 side,
                 title_override,
                 recording:recordings (
                   id,
                   title,
                   duration_seconds
                 )
               ),
               master:masters (
                 id,
                 title,
                 original_release_year,
                 notes,
                 discogs_master_id,
                 cover_image_url,
                 genres,
                 styles,
               artist:artists (id, name),
               master_tag_links:master_tag_links (
                 master_tags (name)
               )
             )
           )`
        )
        .order('id', { ascending: true })
        .range(from, from + batchSize - 1);

      if (error) {
        console.error('Error loading albums:', error);
        break;
      }

      if (!batch || batch.length === 0) break;

      allRows = allRows.concat(batch);
      keepGoing = batch.length === batchSize;
      from += batchSize;
    }

    const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
      Array.isArray(value) ? value[0] ?? null : value ?? null;

    const mapped = allRows.map((row) => {
      const release = toSingle(row.release);
      const master = toSingle(release?.master);
      return {
        ...row,
        release,
        release_notes: release?.notes ?? null,
        master_notes: master?.notes ?? null,
      };
    });

    setAlbums(mapped as Album[]);
    setLoading(false);
  }, []);

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
    const { data: playlistRows, error: playlistError } = await (supabase as any)
      .from('collection_playlists')
      .select('id, name, icon, color, sort_order, created_at, is_smart, smart_rules, match_rules, live_update')
      .order('sort_order', { ascending: true });

    if (playlistError) {
      console.error('Error loading playlists:', playlistError);
      return;
    }

    const { data: playlistItems, error: itemsError } = await (supabase as any)
      .from('collection_playlist_items')
      .select('playlist_id, track_key, sort_order')
      .order('sort_order', { ascending: true });

    if (itemsError) {
      console.error('Error loading playlist items:', itemsError);
      return;
    }

    if ((playlistRows ?? []).length === 0) {
      const legacy = localStorage.getItem('collection-track-playlists');
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy) as Array<{
            name: string;
            icon?: string;
            color?: string;
            trackKeys?: string[];
            createdAt?: string;
          }>;

          if (parsed.length > 0) {
            for (let i = 0; i < parsed.length; i += 1) {
              const legacyPlaylist = parsed[i];
              const { data: inserted, error: insertError } = await (supabase as any)
                .from('collection_playlists')
                .insert({
                  name: legacyPlaylist.name,
                  icon: legacyPlaylist.icon || '🎵',
                  color: legacyPlaylist.color || '#3578b3',
                  sort_order: i,
                  created_at: legacyPlaylist.createdAt || new Date().toISOString(),
                  is_smart: false,
                  smart_rules: null,
                  match_rules: 'all',
                  live_update: true,
                })
                .select('id')
                .single();

              if (insertError || !inserted) {
                throw insertError || new Error('Failed to import legacy playlist');
              }

              const trackKeys = legacyPlaylist.trackKeys || [];
              if (trackKeys.length > 0) {
                const records = trackKeys.map((trackKey, idx) => ({
                  playlist_id: inserted.id,
                  track_key: trackKey,
                  sort_order: idx,
                }));
                const { error: itemsInsertError } = await (supabase as any)
                  .from('collection_playlist_items')
                  .insert(records);
                if (itemsInsertError) throw itemsInsertError;
              }
            }

            localStorage.removeItem('collection-track-playlists');
            await loadPlaylists();
            return;
          }
        } catch (legacyError) {
          console.error('Failed importing legacy local playlists:', legacyError);
        }
      }
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
  }, []);

  useEffect(() => {
    loadAlbums();
    loadCrates();
    loadPlaylists();
  }, [loadAlbums, loadCrates, loadPlaylists]);

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
  }, [albums, collectionFilter, selectedLetter, selectedFolderValue, selectedCrateId, folderMode, crates, searchQuery, sortBy, tableSortState, crateItemsByCrate, viewMode]);

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

  const playlistCounts = useMemo(() => {
    return playlists.reduce((acc, playlist) => {
      acc[playlist.id] = playlist.isSmart
        ? allTrackRows.filter((row) => trackMatchesSmartPlaylist(row, playlist)).length
        : playlist.trackKeys.length;
      return acc;
    }, {} as Record<number, number>);
  }, [allTrackRows, playlists]);

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
        if (playlist.isSmart) {
          rows = rows.filter((row) => trackMatchesSmartPlaylist(row, playlist));
        } else {
          const allowedKeys = new Set(playlist.trackKeys);
          rows = rows.filter((row) => allowedKeys.has(row.key));
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
    selectedLetter,
    searchQuery,
    trackFormatFilters,
    trackFormatFilterMode,
    trackSortBy,
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
      return new Set([groupedTrackRows[0].inventoryId]);
    });
  }, [viewMode, groupedTrackRows]);

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

  const sortOptionsByCategory = useMemo(() => {
    return SORT_OPTIONS.reduce((acc, opt) => {
      if (!acc[opt.category]) acc[opt.category] = [];
      acc[opt.category].push(opt);
      return acc;
    }, {} as Record<string, typeof SORT_OPTIONS>);
  }, []);

  const trackSortOptionsByCategory = useMemo(() => {
    return TRACK_SORT_OPTIONS.reduce((acc, opt) => {
      if (!acc[opt.category]) acc[opt.category] = [];
      acc[opt.category].push(opt);
      return acc;
    }, {} as Record<string, typeof TRACK_SORT_OPTIONS>);
  }, []);

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
    if (viewMode === 'album-track') {
      setFolderMode(trackSource);
      setSelectedFolderValue(null);
    } else if (folderMode === 'playlists') {
      setFolderMode('format');
    }
    setSelectedAlbumIds(new Set());
    setSelectedTrackKeys(new Set());
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
      setViewMode('album-track');
    } else if (mode === 'crates') {
      setTrackSource('crates');
    }
  }, []);

  const handleViewModeChange = useCallback((mode: AppViewMode) => {
    setViewMode(mode);
    setShowFolderModeDropdown(false);
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

  const toggleCrateGameFlag = useCallback((crateId: number, flag: CrateGameKey) => {
    setCrateGameFlags((prev) => {
      const existing = prev[crateId] ?? { bingo: false, trivia: false, brackets: false };
      return {
        ...prev,
        [crateId]: {
          ...existing,
          [flag]: !existing[flag],
        },
      };
    });
  }, []);

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

  const handleCreatePlaylist = useCallback(async (playlist: { name: string; icon: string; color: string }) => {
    try {
      const maxSort = playlists.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), -1);
      const nextSortOrder = maxSort + 1;

      const { data, error } = await (supabase as any)
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

      await loadPlaylists();
      setSelectedPlaylistId(data.id);
      setShowNewPlaylistModal(false);
      setTrackSource('playlists');
      setViewMode('album-track');
    } catch (err) {
      console.error('Failed to create playlist:', err);
      alert('Failed to create playlist. Please try again.');
    }
  }, [loadPlaylists, playlists]);

  const handleUpdatePlaylist = useCallback(async (playlist: Playlist) => {
    try {
      const { error } = await (supabase as any)
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
      await loadPlaylists();
    } catch (err) {
      console.error('Failed to update playlist:', err);
      alert('Failed to update playlist. Please try again.');
    }
  }, [loadPlaylists]);

  const handleCreateSmartPlaylist = useCallback(async (payload: {
    name: string;
    color: string;
    matchRules: 'all' | 'any';
    liveUpdate: boolean;
    smartRules: { rules: SmartPlaylistRule[] };
  }) => {
    try {
      const maxSort = playlists.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), -1);
      const nextSortOrder = maxSort + 1;
      const { data, error } = await (supabase as any)
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
      await loadPlaylists();
      setSelectedPlaylistId(data.id);
      setShowNewSmartPlaylistModal(false);
      setTrackSource('playlists');
      setViewMode('album-track');
    } catch (err) {
      console.error('Failed to create smart playlist:', err);
      alert('Failed to create smart playlist. Please try again.');
    }
  }, [loadPlaylists, playlists]);

  const handleDeletePlaylist = useCallback(async (playlistId: number, playlistName: string) => {
    if (!confirm(`Delete playlist "${playlistName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('collection_playlists')
        .delete()
        .eq('id', playlistId);

      if (error) throw error;

      if (selectedPlaylistId === playlistId) {
        setSelectedPlaylistId(null);
      }
      await loadPlaylists();
    } catch (err) {
      console.error('Failed to delete playlist:', err);
      alert('Failed to delete playlist. Please try again.');
    }
  }, [loadPlaylists, selectedPlaylistId]);

  const handleReorderPlaylists = useCallback(async (orderedPlaylists: Playlist[]) => {
    try {
      const updates = orderedPlaylists.map((playlist, index) => ({
        id: playlist.id,
        sort_order: index,
      }));

      for (const update of updates) {
        const { error } = await (supabase as any)
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
        const { error } = await (supabase as any)
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
          onOpenManagePlaylists={() => setShowManagePlaylistsModal(true)}
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
            {viewMode === 'album-track' && (
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

        {viewMode === 'album-track' && selectedTrackKeys.size > 0 && (
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
                      {viewMode === 'album-track' && (
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
                {viewMode === 'album-track' && folderMode === 'playlists' && (
                  <button onClick={() => setShowNewPlaylistModal(true)} title="Create playlist" className="bg-[#3a3a3a] text-white border border-[#555] px-2 py-1 rounded cursor-pointer text-xs shrink-0">＋</button>
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
                        {viewMode === 'album-track' && (
                          <span className="flex items-center gap-0.5">
                            {CRATE_GAME_LABELS.map((badge) => {
                              const enabled = crateGameFlags[crate.id]?.[badge.key] ?? false;
                              return (
                                <span
                                  key={`${crate.id}-${badge.key}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleCrateGameFlag(crate.id, badge.key);
                                  }}
                                  title={`${badge.label} ${enabled ? 'enabled' : 'disabled'}`}
                                  className={`text-[10px] leading-none px-1 py-0.5 rounded ${enabled ? 'bg-white/25' : 'opacity-40 hover:opacity-80'}`}
                                >
                                  {badge.icon}
                                </span>
                              );
                            })}
                          </span>
                        )}
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
                    <span>{viewMode === 'collection' ? '☰' : '🎵'}</span>
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
                      </div>
                    </>
                  )}
                </div>
                
                <div className="relative">
                  <button onClick={() => setShowSortDropdown(!showSortDropdown)} title="Change sort order" className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white flex items-center gap-1">
                    <span>↕️</span>
                    <span className="text-[9px]">▼</span>
                  </button>
                  
                  {showSortDropdown && (
                    <>
                      <div onClick={() => setShowSortDropdown(false)} className="fixed inset-0 z-[99]" />
                      <div className="absolute top-full left-0 mt-1 bg-white border border-[#ddd] rounded shadow-lg z-[100] min-w-[240px] max-h-[400px] overflow-y-auto">
                        {viewMode === 'collection'
                          ? Object.entries(sortOptionsByCategory).map(([category, options]) => (
                              <div key={category}>
                                <div className="px-3 py-2 text-[11px] font-semibold text-[#999] uppercase tracking-wider bg-[#f8f8f8] border-b border-[#e8e8e8]">{category}</div>
                                {options.map(opt => (
                                  <button key={opt.value} onClick={() => handleSortChange(opt.value)} className={`w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] flex items-center justify-between hover:bg-[#f5f5f5] ${sortBy === opt.value ? 'bg-[#e3f2fd]' : ''}`}>
                                    <span>{opt.label}</span>
                                    {sortBy === opt.value && <span className="text-[#2196F3]">✓</span>}
                                  </button>
                                ))}
                              </div>
                            ))
                          : Object.entries(trackSortOptionsByCategory).map(([category, options]) => (
                              <div key={category}>
                                <div className="px-3 py-2 text-[11px] font-semibold text-[#999] uppercase tracking-wider bg-[#f8f8f8] border-b border-[#e8e8e8]">{category}</div>
                                {options.map(opt => (
                                  <button key={opt.value} onClick={() => handleTrackSortChange(opt.value)} className={`w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] flex items-center justify-between hover:bg-[#f5f5f5] ${trackSortBy === opt.value ? 'bg-[#e3f2fd]' : ''}`}>
                                    <span>{opt.label}</span>
                                    {trackSortBy === opt.value && <span className="text-[#2196F3]">✓</span>}
                                  </button>
                                ))}
                              </div>
                            ))}
                      </div>
                    </>
                  )}
                </div>
                
                <button onClick={() => setShowColumnSelector(true)} title="Select visible columns" className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white flex items-center gap-1">
                  <span>⊞</span>
                  <span className="text-[9px]">▼</span>
                </button>
              </div>
              <div className="text-xs text-[#ddd] font-semibold">
                {loading ? 'Loading...' : viewMode === 'collection' ? `${filteredAndSortedAlbums.length} albums` : `${filteredTrackRows.length} tracks`}
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-white min-h-0">
              {loading ? (
                <div className="p-10 text-center text-[#666]">Loading albums...</div>
              ) : (
                viewMode === 'collection' ? (
                  <CollectionTable albums={filteredAndSortedAlbums} visibleColumns={visibleColumns} lockedColumns={lockedColumns} onAlbumClick={handleAlbumClick} selectedAlbums={selectedAlbumsAsStrings} onSelectionChange={handleSelectionChange} sortState={tableSortState} onSortChange={handleTableSortChange} onEditAlbum={handleEditAlbum} />
                ) : (
                  <div className="h-full overflow-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-[#f5f5f5] border-b border-[#ddd]">
                        <tr>
                          <th className="w-[42px] px-2 py-2 text-left font-semibold text-[#666]">
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
                          </th>
                          <th className="px-2 py-2 text-left font-semibold text-[#666]">Track</th>
                          <th className="px-2 py-2 text-left font-semibold text-[#666]">Artist</th>
                          <th className="px-2 py-2 text-left font-semibold text-[#666]">Album</th>
                          <th className="px-2 py-2 text-left font-semibold text-[#666]">Pos</th>
                          <th className="px-2 py-2 text-right font-semibold text-[#666]">Length</th>
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
                                <td className="px-2 py-2">
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
                                </td>
                                <td className="px-2 py-2 text-[#111827] font-semibold">
                                  <span className="mr-2 text-[#4b5563]">{isExpanded ? '▾' : '▸'}</span>
                                  {group.albumTitle}
                                </td>
                                <td className="px-2 py-2 text-[#1f2937]">{group.albumArtist}</td>
                                <td className="px-2 py-2 text-[#4b5563]">
                                  {group.trackCount} tracks
                                  {group.sideTotals.length > 0 && (
                                    <span className="ml-2 text-[#6b7280] text-xs">
                                      {group.sideTotals.map((side) => `Side ${side.side}: ${formatTrackDuration(side.totalSeconds)}`).join(' | ')}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-[#4b5563]">—</td>
                                <td className="px-2 py-2 text-right text-[#4b5563]">
                                  {group.totalSeconds > 0 ? formatTrackDuration(group.totalSeconds) : '—'}
                                </td>
                              </tr>
                              {isExpanded &&
                                group.tracks.map((row) => {
                                  const isChecked = selectedTrackKeys.has(row.key);
                                  const positionNumber = (row.position.match(/\d+/g) ?? [row.position]).slice(-1)[0];
                                  const positionLabel = row.side ? `${row.side}${positionNumber}` : row.position;
                                  return (
                                    <tr
                                      key={row.key}
                                      onClick={() => setSelectedAlbumId(row.inventoryId)}
                                      className={`border-b border-[#eee] cursor-pointer ${selectedAlbumId === row.inventoryId ? 'bg-[#f8fbff]' : 'hover:bg-[#fafafa]'}`}
                                    >
                                      <td className="px-2 py-2">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleTrackSelection(row.key)}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </td>
                                      <td className="px-2 py-2 text-[#1f2937] pl-7">{row.trackTitle}</td>
                                      <td className="px-2 py-2 text-[#374151]">{row.trackArtist}</td>
                                      <td className="px-2 py-2 text-[#6b7280]">{row.albumTitle}</td>
                                      <td className="px-2 py-2 text-[#4b5563]">{positionLabel}</td>
                                      <td className="px-2 py-2 text-right text-[#4b5563]">{row.durationLabel}</td>
                                    </tr>
                                  );
                                })}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    {groupedTrackRows.length === 0 && (
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

      {showColumnSelector && <ColumnSelector visibleColumns={visibleColumns} onColumnsChange={handleColumnsChange} onClose={() => setShowColumnSelector(false)} />}
      {editingAlbumId && <EditAlbumModal albumId={editingAlbumId} onClose={() => setEditingAlbumId(null)} onRefresh={loadAlbums} onNavigate={(newAlbumId) => setEditingAlbumId(newAlbumId)} allAlbumIds={filteredAndSortedAlbums.map(a => a.id)} />}
      {showNewCrateModal && <NewCrateModal isOpen={showNewCrateModal} onClose={() => { setShowNewCrateModal(false); setEditingCrate(null); if (returnToAddToCrate) { setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }}} onCrateCreated={async (newCrateId) => { await loadCrates(); setEditingCrate(null); if (returnToAddToCrate) { setNewlyCreatedCrateId(newCrateId); setShowNewCrateModal(false); setShowAddToCrateModal(true); } else { setShowNewCrateModal(false); }}} editingCrate={editingCrate} />}
      {showNewSmartCrateModal && <NewSmartCrateModal isOpen={showNewSmartCrateModal} onClose={() => { setShowNewSmartCrateModal(false); setEditingCrate(null); }} onCrateCreated={() => { loadCrates(); setShowNewSmartCrateModal(false); setEditingCrate(null); }} editingCrate={editingCrate} />}
      {showAddToCrateModal && <AddToCrateModal isOpen={showAddToCrateModal} onClose={() => { setShowAddToCrateModal(false); setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }} crates={cratesWithCounts} onAddToCrates={handleAddToCrates} selectedCount={selectedAlbumIds.size} onOpenNewCrate={() => { setReturnToAddToCrate(true); setShowAddToCrateModal(false); setEditingCrate(null); setShowNewCrateModal(true); }} autoSelectCrateId={newlyCreatedCrateId} />}
      {showNewPlaylistModal && (
        <NewPlaylistModal
          isOpen={showNewPlaylistModal}
          editingPlaylist={editingPlaylist && !editingPlaylist.isSmart ? editingPlaylist : null}
          onClose={() => {
            setShowNewPlaylistModal(false);
            setEditingPlaylist(null);
          }}
          onCreate={handleCreatePlaylist}
          onUpdate={handleUpdatePlaylist}
        />
      )}
      {showNewSmartPlaylistModal && (
        <NewSmartPlaylistModal
          isOpen={showNewSmartPlaylistModal}
          editingPlaylist={editingPlaylist?.isSmart ? editingPlaylist : null}
          onClose={() => {
            setShowNewSmartPlaylistModal(false);
            setEditingPlaylist(null);
          }}
          onCreate={handleCreateSmartPlaylist}
          onUpdate={handleUpdatePlaylist}
        />
      )}
      {showAddToPlaylistModal && (
        <AddToPlaylistModal
          isOpen={showAddToPlaylistModal}
          onClose={() => setShowAddToPlaylistModal(false)}
          playlists={playlists}
          selectedTrackCount={selectedTrackKeys.size}
          onAdd={handleAddToPlaylists}
          onOpenNewPlaylist={() => {
            setShowAddToPlaylistModal(false);
            setEditingPlaylist(null);
            setShowNewPlaylistModal(true);
          }}
        />
      )}
      {showManagePlaylistsModal && (
        <ManagePlaylistsModal
          isOpen={showManagePlaylistsModal}
          onClose={() => setShowManagePlaylistsModal(false)}
          playlists={playlists}
          onReorder={handleReorderPlaylists}
          onDelete={handleDeletePlaylist}
          onEdit={(playlist) => {
            setShowManagePlaylistsModal(false);
            setEditingPlaylist(playlist);
            setShowNewPlaylistModal(true);
          }}
          onEditSmart={(playlist) => {
            setShowManagePlaylistsModal(false);
            setEditingPlaylist(playlist);
            setShowNewSmartPlaylistModal(true);
          }}
          onOpenNewPlaylist={() => {
            setShowManagePlaylistsModal(false);
            setEditingPlaylist(null);
            setShowNewPlaylistModal(true);
          }}
          onOpenNewSmartPlaylist={() => {
            setShowManagePlaylistsModal(false);
            setEditingPlaylist(null);
            setShowNewSmartPlaylistModal(true);
          }}
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
          visibleColumns={visibleColumns}
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
    {
      id: 'favorite-bingo',
      name: 'Bingo Export',
      columns: ['Artist', 'Title', 'Format', 'Length', 'Cat No'],
    },
    {
      id: 'favorite-trivia',
      name: 'Trivia Export',
      columns: ['Artist', 'Title', 'Year', 'Genre', 'Label'],
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

  const applyPlaylistPreset = (preset: 'bingo_csv' | 'trivia_txt' | 'brackets_csv') => {
    setScope('current');

    if (preset === 'bingo_csv') {
      setFormatType('csv');
      setDelimiter(',');
      setEnclosure('double');
      setIncludeHeaders(true);
      setFilename('bingo_playlist_export');
      setSelectedTrackColumns(['track_title', 'track_artist', 'album_title', 'position', 'side', 'length', 'format', 'playlist']);
      return;
    }

    if (preset === 'trivia_txt') {
      setFormatType('txt');
      setDelimiter('\t');
      setEnclosure('none');
      setIncludeHeaders(true);
      setFilename('trivia_playlist_export');
      setSelectedTrackColumns(['track_title', 'track_artist', 'album_title', 'playlist']);
      return;
    }

    setFormatType('csv');
    setDelimiter(',');
    setEnclosure('double');
    setIncludeHeaders(true);
    setFilename('brackets_playlist_export');
    setSelectedTrackColumns(['track_title', 'track_artist', 'album_title', 'length', 'playlist']);
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

          {viewMode === 'album-track' && (
            <div className="mb-4 border border-gray-200 rounded p-3">
              <div className="text-sm font-semibold text-gray-900 mb-2">Playlist Presets</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => applyPlaylistPreset('bingo_csv')} className="px-3 py-1.5 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 cursor-pointer">Bingo CSV Preset</button>
                <button onClick={() => applyPlaylistPreset('trivia_txt')} className="px-3 py-1.5 text-xs rounded bg-indigo-500 text-white hover:bg-indigo-600 cursor-pointer">Trivia TXT Preset</button>
                <button onClick={() => applyPlaylistPreset('brackets_csv')} className="px-3 py-1.5 text-xs rounded bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer">Brackets CSV Preset</button>
              </div>
            </div>
          )}

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

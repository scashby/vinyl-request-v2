// src/app/edit-collection/page.tsx
'use client';

import { useCallback, useEffect, useState, useMemo, Suspense } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CollectionTable from '../../components/CollectionTable';
import ColumnSelector from '../../components/ColumnSelector';
import { ColumnId, DEFAULT_VISIBLE_COLUMNS, DEFAULT_LOCKED_COLUMNS, SortState } from './columnDefinitions';
import type { Album } from '../../types/album';
import { toSafeStringArray, toSafeSearchString } from '../../types/album';
import EditAlbumModal from './EditAlbumModal';
import NewCrateModal from './crates/NewCrateModal';
import NewSmartCrateModal from './crates/NewSmartCrateModal';
import { AddToCrateModal } from './crates/AddToCrateModal';
import Header from './Header';
import type { Crate } from '../../types/crate';
import { albumMatchesSmartCrate } from '../../lib/crateUtils';
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

type AppViewMode = 'collection' | 'album-track';
type SidebarMode = 'format' | 'crates' | 'playlists';
type TrackListSource = 'crates' | 'playlists';
type CrateGameKey = 'bingo' | 'trivia' | 'brackets';

interface Playlist {
  id: string;
  name: string;
  icon: string;
  color: string;
  trackKeys: string[];
  createdAt: string;
}

interface CollectionTrackRow {
  key: string;
  inventoryId: number;
  releaseTrackId: number | null;
  recordingId: number | null;
  albumArtist: string;
  albumTitle: string;
  trackArtist: string;
  trackTitle: string;
  position: string;
  side: string | null;
  durationSeconds: number | null;
  durationLabel: string;
}

type CrateGameFlags = Record<number, Record<CrateGameKey, boolean>>;

const CRATE_GAME_LABELS: { key: CrateGameKey; icon: string; label: string }[] = [
  { key: 'bingo', icon: '🎱', label: 'Bingo' },
  { key: 'trivia', icon: '❓', label: 'Trivia' },
  { key: 'brackets', icon: '🏆', label: 'Brackets' },
];

const PLAYLIST_PRESET_ICONS = ['🎵', '🎧', '🔥', '⭐', '💿', '🎤'];

const formatTrackDuration = (seconds: number | null | undefined): string => {
  if (!seconds || seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${remain.toString().padStart(2, '0')}`;
};

const normalizeTrackPosition = (position: string | null | undefined, fallback: number): string => {
  const raw = (position ?? '').trim();
  if (raw) return raw;
  return String(fallback);
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
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  
  const [collectionFilter, setCollectionFilter] = useState<string>('All');
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  
  const [folderSearch, setFolderSearch] = useState('');
  
  const [folderSortByCount, setFolderSortByCount] = useState(false);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<number>>(new Set());
  const [selectedTrackKeys, setSelectedTrackKeys] = useState<Set<string>>(new Set());
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
  
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showViewModeDropdown, setShowViewModeDropdown] = useState(false);

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

    const storedPlaylists = localStorage.getItem('collection-track-playlists');
    if (storedPlaylists) {
      try {
        setPlaylists(JSON.parse(storedPlaylists) as Playlist[]);
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
  }, []);

  useEffect(() => {
    localStorage.setItem('collection-crate-game-flags', JSON.stringify(crateGameFlags));
  }, [crateGameFlags]);

  useEffect(() => {
    localStorage.setItem('collection-track-playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem('collection-view-mode', viewMode);
  }, [viewMode]);

  const handleSortChange = useCallback((newSort: SortOption) => {
    setSortBy(newSort);
    localStorage.setItem('collection-sort-preference', newSort);
    setShowSortDropdown(false);
    setTableSortState({ column: null, direction: null });
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

  useEffect(() => {
    loadAlbums();
    loadCrates();
  }, [loadAlbums, loadCrates]);

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

  const playlistCounts = useMemo(() => {
    return playlists.reduce((acc, playlist) => {
      acc[playlist.id] = playlist.trackKeys.length;
      return acc;
    }, {} as Record<string, number>);
  }, [playlists]);

  const allTrackRows = useMemo<CollectionTrackRow[]>(() => {
    const rows: CollectionTrackRow[] = [];

    albums.forEach((album) => {
      if (collectionFilter === 'For Sale' && album.status !== 'for_sale') {
        return;
      }
      const albumArtist = getAlbumArtist(album);
      const albumTitle = getAlbumTitle(album);
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
          durationSeconds: null,
          durationLabel: track.duration ?? '—',
        });
      });
    });

    return rows;
  }, [albums, collectionFilter]);

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
        const allowedKeys = new Set(playlist.trackKeys);
        rows = rows.filter((row) => allowedKeys.has(row.key));
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
        const searchable = `${row.trackTitle} ${row.trackArtist} ${row.albumTitle} ${row.albumArtist} ${row.position} ${row.side ?? ''}`.toLowerCase();
        return searchable.includes(q);
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
    selectedLetter,
    searchQuery,
  ]);

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

  const handleCreatePlaylist = useCallback((playlist: Omit<Playlist, 'id' | 'createdAt' | 'trackKeys'>) => {
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name: playlist.name,
      icon: playlist.icon,
      color: playlist.color,
      trackKeys: [],
      createdAt: new Date().toISOString(),
    };
    setPlaylists((prev) => [...prev, newPlaylist]);
    setSelectedPlaylistId(newPlaylist.id);
    setShowNewPlaylistModal(false);
    setTrackSource('playlists');
    setViewMode('album-track');
  }, []);

  const handleAddToPlaylists = useCallback((playlistIds: string[]) => {
    if (selectedTrackKeys.size === 0 || playlistIds.length === 0) return;
    const trackKeys = Array.from(selectedTrackKeys);
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (!playlistIds.includes(playlist.id)) return playlist;
        const merged = new Set([...playlist.trackKeys, ...trackKeys]);
        return { ...playlist, trackKeys: Array.from(merged) };
      })
    );
    setSelectedTrackKeys(new Set());
    setShowAddToPlaylistModal(false);
  }, [selectedTrackKeys]);

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
                          <span style={{ color: playlist.color }}>{playlist.icon}</span>
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
                        {Object.entries(sortOptionsByCategory).map(([category, options]) => (
                          <div key={category}>
                            <div className="px-3 py-2 text-[11px] font-semibold text-[#999] uppercase tracking-wider bg-[#f8f8f8] border-b border-[#e8e8e8]">{category}</div>
                            {options.map(opt => (
                              <button key={opt.value} onClick={() => handleSortChange(opt.value)} className={`w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] flex items-center justify-between hover:bg-[#f5f5f5] ${sortBy === opt.value ? 'bg-[#e3f2fd]' : ''}`}>
                                <span>{opt.label}</span>
                                {sortBy === opt.value && <span className="text-[#2196F3]">✓</span>}
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
                        {filteredTrackRows.map((row) => {
                          const isChecked = selectedTrackKeys.has(row.key);
                          const isSelectedAlbum = selectedAlbumId === row.inventoryId;
                          const positionLabel = row.side ? `${row.side}${row.position.replace(/^[A-Za-z]/, '')}` : row.position;
                          return (
                            <tr
                              key={row.key}
                              onClick={() => setSelectedAlbumId(row.inventoryId)}
                              className={`border-b border-[#eee] cursor-pointer ${isSelectedAlbum ? 'bg-[#f3f9ff]' : 'hover:bg-[#fafafa]'}`}
                            >
                              <td className="px-2 py-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleTrackSelection(row.key)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="px-2 py-2 text-[#1f2937]">{row.trackTitle}</td>
                              <td className="px-2 py-2 text-[#374151]">{row.trackArtist}</td>
                              <td className="px-2 py-2 text-[#4b5563]">{row.albumTitle}</td>
                              <td className="px-2 py-2 text-[#4b5563]">{positionLabel}</td>
                              <td className="px-2 py-2 text-right text-[#4b5563]">{row.durationLabel}</td>
                            </tr>
                          );
                        })}
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

      {showColumnSelector && <ColumnSelector visibleColumns={visibleColumns} onColumnsChange={handleColumnsChange} onClose={() => setShowColumnSelector(false)} />}
      {editingAlbumId && <EditAlbumModal albumId={editingAlbumId} onClose={() => setEditingAlbumId(null)} onRefresh={loadAlbums} onNavigate={(newAlbumId) => setEditingAlbumId(newAlbumId)} allAlbumIds={filteredAndSortedAlbums.map(a => a.id)} />}
      {showNewCrateModal && <NewCrateModal isOpen={showNewCrateModal} onClose={() => { setShowNewCrateModal(false); setEditingCrate(null); if (returnToAddToCrate) { setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }}} onCrateCreated={async (newCrateId) => { await loadCrates(); setEditingCrate(null); if (returnToAddToCrate) { setNewlyCreatedCrateId(newCrateId); setShowNewCrateModal(false); setShowAddToCrateModal(true); } else { setShowNewCrateModal(false); }}} editingCrate={editingCrate} />}
      {showNewSmartCrateModal && <NewSmartCrateModal isOpen={showNewSmartCrateModal} onClose={() => { setShowNewSmartCrateModal(false); setEditingCrate(null); }} onCrateCreated={() => { loadCrates(); setShowNewSmartCrateModal(false); setEditingCrate(null); }} editingCrate={editingCrate} />}
      {showAddToCrateModal && <AddToCrateModal isOpen={showAddToCrateModal} onClose={() => { setShowAddToCrateModal(false); setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }} crates={cratesWithCounts} onAddToCrates={handleAddToCrates} selectedCount={selectedAlbumIds.size} onOpenNewCrate={() => { setReturnToAddToCrate(true); setShowAddToCrateModal(false); setEditingCrate(null); setShowNewCrateModal(true); }} autoSelectCrateId={newlyCreatedCrateId} />}
      {showNewPlaylistModal && (
        <NewPlaylistModal
          isOpen={showNewPlaylistModal}
          onClose={() => setShowNewPlaylistModal(false)}
          onCreate={handleCreatePlaylist}
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
            setShowNewPlaylistModal(true);
          }}
        />
      )}
    </>
  );
}

function NewPlaylistModal({
  isOpen,
  onClose,
  onCreate
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (playlist: { name: string; icon: string; color: string }) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎵');
  const [color, setColor] = useState('#2196F3');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30002]" onClick={onClose}>
      <div className="bg-white rounded-lg w-[420px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">New Playlist</h2>
          <button onClick={onClose} className="bg-transparent border-none text-2xl cursor-pointer text-gray-500">×</button>
        </div>
        <div className="p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Playlist Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Bingo Round 1"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none focus:border-blue-500 mb-4"
          />
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {PLAYLIST_PRESET_ICONS.map((preset) => (
                <button key={preset} onClick={() => setIcon(preset)} className={`w-10 h-10 border rounded flex items-center justify-center text-xl ${icon === preset ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 h-10 border border-gray-300 rounded cursor-pointer" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 border-none rounded text-sm cursor-pointer">Cancel</button>
          <button
            onClick={() => {
              if (!name.trim()) return;
              onCreate({ name: name.trim(), icon, color });
              setName('');
              setIcon('🎵');
              setColor('#2196F3');
            }}
            disabled={!name.trim()}
            className={`px-4 py-2 text-white border-none rounded text-sm cursor-pointer ${name.trim() ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}
          >
            Create Playlist
          </button>
        </div>
      </div>
    </div>
  );
}

function AddToPlaylistModal({
  isOpen,
  onClose,
  playlists,
  selectedTrackCount,
  onAdd,
  onOpenNewPlaylist
}: {
  isOpen: boolean;
  onClose: () => void;
  playlists: Playlist[];
  selectedTrackCount: number;
  onAdd: (playlistIds: string[]) => void;
  onOpenNewPlaylist: () => void;
}) {
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedPlaylistIds(new Set());
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredPlaylists = playlists.filter((playlist) => playlist.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30002]" onClick={onClose}>
      <div className="bg-white rounded-md w-[500px] max-h-[600px] flex flex-col overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="m-0 text-base font-semibold text-gray-900">Add {selectedTrackCount} Track{selectedTrackCount !== 1 ? 's' : ''} to Playlist</h3>
          <button onClick={onClose} className="bg-transparent border-none text-xl cursor-pointer text-gray-500">×</button>
        </div>
        <div className="px-4 py-3 border-b border-gray-200 flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search playlists..." className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-[13px] outline-none focus:border-blue-500" />
          <button onClick={onOpenNewPlaylist} className="px-3 py-1.5 bg-blue-500 text-white border-none rounded text-[13px] cursor-pointer">New Playlist</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredPlaylists.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-[13px]">
              {playlists.length === 0 ? 'No playlists available yet.' : 'No playlists match your search.'}
            </div>
          ) : (
            filteredPlaylists.map((playlist) => {
              const checked = selectedPlaylistIds.has(playlist.id);
              return (
                <label key={playlist.id} className="flex items-center justify-between px-2 py-2 rounded cursor-pointer hover:bg-gray-100">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedPlaylistIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(playlist.id)) next.delete(playlist.id);
                          else next.add(playlist.id);
                          return next;
                        });
                      }}
                    />
                    <span>{playlist.icon}</span>
                    <span className="text-[13px] text-gray-900">{playlist.name}</span>
                  </span>
                  <span className="text-[12px] text-gray-500">{playlist.trackKeys.length}</span>
                </label>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-[13px] cursor-pointer">Cancel</button>
          <button
            onClick={() => onAdd(Array.from(selectedPlaylistIds))}
            disabled={selectedPlaylistIds.size === 0}
            className={`px-4 py-1.5 border-none rounded text-[13px] text-white ${selectedPlaylistIds.size > 0 ? 'bg-blue-500 hover:bg-blue-600 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'}`}
          >
            Add to Playlist
          </button>
        </div>
      </div>
    </div>
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

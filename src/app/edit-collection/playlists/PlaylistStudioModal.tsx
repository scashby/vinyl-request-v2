'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as supabaseTyped } from 'src/lib/supabaseClient';
import type {
  CollectionPlaylist,
  SmartPlaylistFieldType,
  SmartPlaylistOperatorType,
  SmartPlaylistRule,
  SmartPlaylistRuleValue,
  SmartPlaylistRules,
} from '../../../types/collectionPlaylist';
import { SHARED_COLOR_PRESETS, SHARED_ICON_PRESETS } from '../iconPresets';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;

export type PlaylistStudioView = 'library' | 'manual' | 'smart' | 'import';

type PlaylistTrackItem = {
  track_key: string;
  sort_order: number;
  track_title: string | null;
  artist_name: string | null;
  album_name: string | null;
  side: string | null;
  position: string | null;
};

type InventorySearchCandidate = {
  track_key: string;
  inventory_id: number | null;
  title: string;
  artist: string;
  side: string | null;
  position: string | null;
  score: number;
};

type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number | null;
  canImport?: boolean;
  importReason?: string | null;
  snapshotId?: string | null;
};

type PlaylistsPayload = {
  playlists?: SpotifyPlaylist[];
  scope?: string;
  error?: string;
};

type ImportResume = {
  spotifyPlaylistId?: string;
  snapshotId?: string | null;
  nextOffset?: number | null;
  maxPages?: number;
};

type MatchCandidate = {
  track_key: string;
  inventory_id?: number | null;
  title: string;
  artist: string;
  side?: string | null;
  position?: string | null;
  score: number;
};

type UnmatchedTrack = {
  row_id: string;
  title?: string;
  artist?: string;
  candidates: MatchCandidate[];
};

interface PlaylistStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: PlaylistStudioView;
  playlists: CollectionPlaylist[];
  smartValueOptions?: Partial<Record<string, string[]>>;
  onReorderPlaylists: (playlists: CollectionPlaylist[]) => Promise<void>;
  onDeletePlaylist: (playlistId: number, playlistName: string) => Promise<void>;
  onDeleteAllPlaylists: () => Promise<void>;
  onCreateManualPlaylist: (playlist: { name: string; icon: string; color: string; trackKeys: string[] }) => Promise<void>;
  onCreateSmartPlaylist: (payload: {
    name: string;
    color: string;
    matchRules: 'all' | 'any';
    liveUpdate: boolean;
    smartRules: SmartPlaylistRules;
  }) => Promise<void>;
  onUpdatePlaylist: (playlist: CollectionPlaylist) => Promise<void>;
  onImported: () => Promise<void>;
}

type SmartFieldType = 'text' | 'number' | 'date' | 'boolean' | 'array';

const FIELD_OPTIONS: { value: SmartPlaylistFieldType; label: string; type: SmartFieldType }[] = [
  { value: 'track_title', label: 'Track Title', type: 'text' },
  { value: 'track_artist', label: 'Track Artist', type: 'text' },
  { value: 'album_title', label: 'Album Title', type: 'text' },
  { value: 'album_artist', label: 'Album Artist', type: 'text' },
  { value: 'position', label: 'Position', type: 'text' },
  { value: 'side', label: 'Side', type: 'text' },
  { value: 'album_format', label: 'Media Type', type: 'text' },
  { value: 'duration_seconds', label: 'Duration Seconds', type: 'number' },
  { value: 'format', label: 'Format Detail', type: 'text' },
  { value: 'country', label: 'Country', type: 'text' },
  { value: 'year_int', label: 'Year', type: 'number' },
  { value: 'decade', label: 'Decade', type: 'number' },
  { value: 'my_rating', label: 'Rating', type: 'number' },
  { value: 'date_added', label: 'Date Added', type: 'date' },
  { value: 'purchase_date', label: 'Purchase Date', type: 'date' },
  { value: 'last_played_at', label: 'Last Played', type: 'date' },
  { value: 'last_cleaned_date', label: 'Last Cleaned', type: 'date' },
  { value: 'original_release_date', label: 'Original Release Date', type: 'date' },
  { value: 'recording_date', label: 'Recording Date', type: 'date' },
  { value: 'custom_tags', label: 'Tags', type: 'array' },
  { value: 'genre', label: 'Genre', type: 'array' },
  { value: 'label', label: 'Label', type: 'text' },
];

const DROPDOWN_FIELDS = new Set<SmartPlaylistFieldType>([
  'format',
  'album_format',
  'country',
  'year_int',
  'decade',
  'my_rating',
  'side',
  'genre',
  'label',
  'date_added',
  'purchase_date',
  'last_played_at',
  'last_cleaned_date',
  'original_release_date',
  'recording_date',
]);

const LEGACY_RULE_FIELD_MAP: Partial<Record<string, SmartPlaylistFieldType>> = {
  discogs_genres: 'genre',
  spotify_genres: 'genre',
};

const LIMIT_SELECTION_OPTIONS: Array<{ value: NonNullable<SmartPlaylistRules['selectedBy']>; label: string }> = [
  { value: 'random', label: 'Random' },
  { value: 'album', label: 'Album' },
  { value: 'artist', label: 'Artist' },
  { value: 'genre', label: 'Genre' },
  { value: 'title', label: 'Title' },
  { value: 'highest_rating', label: 'Highest Rating' },
  { value: 'lowest_rating', label: 'Lowest Rating' },
  { value: 'most_recently_played', label: 'Most Recently Played' },
  { value: 'least_recently_played', label: 'Least Recently Played' },
  { value: 'most_often_played', label: 'Most Often Played' },
  { value: 'least_often_played', label: 'Least Often Played' },
  { value: 'most_recently_added', label: 'Most Recently Added' },
  { value: 'least_recently_added', label: 'Least Recently Added' },
];

const SMART_PLAYLIST_COLORS = [
  '#0ea5e9',
  '#22c55e',
  '#ef4444',
  '#f59e0b',
  '#14b8a6',
  '#ec4899',
  '#6366f1',
  '#a855f7',
  '#64748b',
  '#111827',
];

const NAV_ITEMS: Array<{ id: PlaylistStudioView; label: string; emoji: string; detail: string }> = [
  { id: 'library', label: 'Playlist Library', emoji: '🧭', detail: 'reorder, edit, delete' },
  { id: 'manual', label: 'Manual Builder', emoji: '🎛️', detail: 'hand-picked tracks' },
  { id: 'smart', label: 'Smart Builder', emoji: '🧠', detail: 'rules + auto logic' },
  { id: 'import', label: 'Import Console', emoji: '📥', detail: 'spotify + csv' },
];

const normalizeRuleField = (field: string): SmartPlaylistFieldType =>
  LEGACY_RULE_FIELD_MAP[field] ?? (field as SmartPlaylistFieldType);

const getOperatorsForFieldType = (fieldType: SmartFieldType): { value: SmartPlaylistOperatorType; label: string }[] => {
  switch (fieldType) {
    case 'number':
      return [
        { value: 'is', label: 'Is' },
        { value: 'is_not', label: 'Is Not' },
        { value: 'greater_than', label: 'Greater Than' },
        { value: 'less_than', label: 'Less Than' },
        { value: 'greater_than_or_equal_to', label: 'Greater Than or Equal' },
        { value: 'less_than_or_equal_to', label: 'Less Than or Equal' },
        { value: 'between', label: 'Between' },
      ];
    case 'date':
      return [
        { value: 'is', label: 'Is' },
        { value: 'before', label: 'Before' },
        { value: 'after', label: 'After' },
        { value: 'between', label: 'Between' },
      ];
    case 'boolean':
      return [{ value: 'is', label: 'Is' }];
    case 'array':
      return [
        { value: 'includes', label: 'Includes' },
        { value: 'excludes', label: 'Excludes' },
      ];
    default:
      return [
        { value: 'contains', label: 'Contains' },
        { value: 'is', label: 'Is' },
        { value: 'is_not', label: 'Is Not' },
        { value: 'does_not_contain', label: 'Does Not Contain' },
      ];
  }
};

const firstIconFromInput = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return Array.from(trimmed)[0] ?? '';
};

const dedupeTrackKeys = (keys: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    const value = String(key ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

const formatTrackPositionLabel = (side: string | null, position: string | null) => {
  const sideValue = String(side ?? '').trim();
  const positionValue = String(position ?? '').trim();
  if (!positionValue) return sideValue || null;
  if (!sideValue) return positionValue;
  const normalizedSide = sideValue.toUpperCase();
  const normalizedPosition = positionValue.toUpperCase();
  if (
    normalizedPosition === normalizedSide ||
    normalizedPosition.startsWith(normalizedSide)
  ) {
    return positionValue;
  }
  return `${sideValue}${positionValue}`;
};

const isBetweenValue = (
  value: SmartPlaylistRuleValue
): value is { min: string | number; max: string | number } => {
  return typeof value === 'object' && value !== null && 'min' in value && 'max' in value;
};

const inferPlaylistNameFromFile = (file: File) => file.name.replace(/\.[^.]+$/, '').trim() || 'CSV Import';

export function PlaylistStudioModal({
  isOpen,
  onClose,
  initialView = 'library',
  playlists,
  smartValueOptions,
  onReorderPlaylists,
  onDeletePlaylist,
  onDeleteAllPlaylists,
  onCreateManualPlaylist,
  onCreateSmartPlaylist,
  onUpdatePlaylist,
  onImported,
}: PlaylistStudioModalProps) {
  const [view, setView] = useState<PlaylistStudioView>('library');
  const [localPlaylists, setLocalPlaylists] = useState<CollectionPlaylist[]>(playlists);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [libraryBusy, setLibraryBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [manualEditingId, setManualEditingId] = useState<number | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualIcon, setManualIcon] = useState('🎵');
  const [manualColor, setManualColor] = useState('#0ea5e9');
  const [manualIconSearch, setManualIconSearch] = useState('');
  const [manualIconInput, setManualIconInput] = useState('🎵');
  const [manualTracks, setManualTracks] = useState<PlaylistTrackItem[]>([]);
  const [manualTracksLoading, setManualTracksLoading] = useState(false);
  const [manualTrackSearch, setManualTrackSearch] = useState('');
  const [manualTrackSearchResults, setManualTrackSearchResults] = useState<InventorySearchCandidate[]>([]);
  const [manualTrackSearching, setManualTrackSearching] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  const [smartEditingId, setSmartEditingId] = useState<number | null>(null);
  const [smartName, setSmartName] = useState('');
  const [smartColor, setSmartColor] = useState('#0ea5e9');
  const [smartMatchRules, setSmartMatchRules] = useState<'all' | 'any'>('all');
  const [smartLiveUpdate, setSmartLiveUpdate] = useState(true);
  const [smartRules, setSmartRules] = useState<SmartPlaylistRule[]>([]);
  const [smartMaxTracks, setSmartMaxTracks] = useState('');
  const [smartSelectedBy, setSmartSelectedBy] = useState<NonNullable<SmartPlaylistRules['selectedBy']>>('random');
  const [smartSaving, setSmartSaving] = useState(false);

  const [importMode, setImportMode] = useState<'spotify' | 'csv'>('spotify');
  const [destinationMode, setDestinationMode] = useState<'new' | 'existing'>('new');
  const [destinationPlaylistId, setDestinationPlaylistId] = useState<number | null>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(true);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [spotifyQuery, setSpotifyQuery] = useState('');
  const [spotifyScope, setSpotifyScope] = useState('');
  const [spotifyImportingId, setSpotifyImportingId] = useState<string | null>(null);
  const [spotifyPlaylistNameOverride, setSpotifyPlaylistNameOverride] = useState('');
  const [resume, setResume] = useState<ImportResume | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPlaylistName, setCsvPlaylistName] = useState('');

  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [lastImportedPlaylistId, setLastImportedPlaylistId] = useState<number | null>(null);
  const [unmatchedRows, setUnmatchedRows] = useState<UnmatchedTrack[]>([]);
  const [resolvingTrackKey, setResolvingTrackKey] = useState<string | null>(null);

  const appendablePlaylists = useMemo(
    () => localPlaylists.filter((playlist) => !playlist.isSmart),
    [localPlaylists]
  );

  const manualEditingPlaylist = useMemo(() => {
    if (!manualEditingId) return null;
    return localPlaylists.find((playlist) => playlist.id === manualEditingId && !playlist.isSmart) ?? null;
  }, [localPlaylists, manualEditingId]);

  const smartEditingPlaylist = useMemo(() => {
    if (!smartEditingId) return null;
    return localPlaylists.find((playlist) => playlist.id === smartEditingId && playlist.isSmart) ?? null;
  }, [localPlaylists, smartEditingId]);

  const filteredManualIcons = useMemo(() => {
    const query = manualIconSearch.trim().toLowerCase();
    if (!query) return SHARED_ICON_PRESETS;
    return SHARED_ICON_PRESETS.filter((preset) => {
      return preset.icon.includes(query) || preset.keywords.some((keyword) => keyword.includes(query));
    });
  }, [manualIconSearch]);

  const manualTrackKeys = useMemo(() => {
    return dedupeTrackKeys(manualTracks.map((track) => track.track_key));
  }, [manualTracks]);

  const filteredSpotifyPlaylists = useMemo(() => {
    const query = spotifyQuery.trim().toLowerCase();
    if (!query) return spotifyPlaylists;
    return spotifyPlaylists.filter((playlist) => playlist.name.toLowerCase().includes(query));
  }, [spotifyPlaylists, spotifyQuery]);

  const getSupabaseAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const formatApiError = (payload: unknown, res: Response) => {
    const typedPayload = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const base = String(typedPayload.error ?? `Request failed (${res.status})`);
    const details = typedPayload.details ? ` (${String(typedPayload.details)})` : '';
    const step = typedPayload.step ? ` [step: ${String(typedPayload.step)}]` : '';
    const scope = typedPayload.scope ? ` [scope: ${String(typedPayload.scope)}]` : '';
    return base + details + step + scope;
  };

  const decorateUnmatched = (rows: unknown): UnmatchedTrack[] => {
    const list = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
    const base = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return list.map((row, index) => ({
      row_id: `${base}-${index}`,
      title: typeof row.title === 'string' ? row.title : undefined,
      artist: typeof row.artist === 'string' ? row.artist : undefined,
      candidates: Array.isArray(row.candidates)
        ? (row.candidates as MatchCandidate[]).filter((candidate) => String(candidate?.track_key ?? '').trim().length > 0)
        : [],
    }));
  };

  const resetManualComposer = useCallback(() => {
    setManualEditingId(null);
    setManualName('');
    setManualIcon('🎵');
    setManualIconInput('🎵');
    setManualColor('#0ea5e9');
    setManualIconSearch('');
    setManualTracks([]);
    setManualTrackSearch('');
    setManualTrackSearchResults([]);
    setManualTrackSearching(false);
  }, []);

  const resetSmartComposer = useCallback(() => {
    setSmartEditingId(null);
    setSmartName('');
    setSmartColor('#0ea5e9');
    setSmartMatchRules('all');
    setSmartLiveUpdate(true);
    setSmartRules([]);
    setSmartMaxTracks('');
    setSmartSelectedBy('random');
  }, []);

  const resetImportState = useCallback(() => {
    setImportSummary(null);
    setUnmatchedRows([]);
    setLastImportedPlaylistId(null);
    setResume(null);
    setRetryAfterSeconds(null);
  }, []);

  const openManualCreate = useCallback(() => {
    resetManualComposer();
    setError(null);
    setNotice(null);
    setView('manual');
  }, [resetManualComposer]);

  const openManualEdit = useCallback((playlist: CollectionPlaylist) => {
    if (playlist.isSmart) return;
    setManualEditingId(playlist.id);
    setManualName(playlist.name);
    setManualIcon(playlist.icon || '🎵');
    setManualIconInput(playlist.icon || '🎵');
    setManualColor(playlist.color || '#0ea5e9');
    setManualIconSearch('');
    setManualTracks(
      (playlist.trackKeys ?? []).map((trackKey, index) => ({
        track_key: trackKey,
        sort_order: index,
        track_title: null,
        artist_name: null,
        album_name: null,
        side: null,
        position: null,
      }))
    );
    setManualTrackSearch('');
    setManualTrackSearchResults([]);
    setError(null);
    setNotice(null);
    setView('manual');
  }, []);

  const openSmartCreate = useCallback(() => {
    resetSmartComposer();
    setError(null);
    setNotice(null);
    setView('smart');
  }, [resetSmartComposer]);

  const openSmartEdit = useCallback((playlist: CollectionPlaylist) => {
    if (!playlist.isSmart) return;

    const normalizedRules = (playlist.smartRules?.rules ?? [])
      .map((rule) => ({ ...rule, field: normalizeRuleField(rule.field) }))
      .filter((rule) => FIELD_OPTIONS.some((field) => field.value === rule.field));

    setSmartEditingId(playlist.id);
    setSmartName(playlist.name);
    setSmartColor(playlist.color || '#0ea5e9');
    setSmartMatchRules(playlist.matchRules);
    setSmartLiveUpdate(playlist.liveUpdate);
    setSmartRules(normalizedRules);
    setSmartMaxTracks(
      playlist.smartRules?.maxTracks && playlist.smartRules.maxTracks > 0
        ? String(playlist.smartRules.maxTracks)
        : ''
    );
    setSmartSelectedBy(playlist.smartRules?.selectedBy ?? 'random');
    setError(null);
    setNotice(null);
    setView('smart');
  }, []);

  const loadSpotifyPlaylists = useCallback(async () => {
    setSpotifyLoading(true);
    setError(null);
    try {
      const headers = await getSupabaseAuthHeaders();
      const res = await fetch('/api/spotify/playlists', {
        cache: 'no-store',
        headers,
      });
      const payload = (await res.json().catch(() => ({}))) as PlaylistsPayload;

      if (res.status === 401) {
        setSpotifyConnected(false);
        setSpotifyPlaylists([]);
        setSpotifyScope('');
        return;
      }
      if (!res.ok) {
        throw new Error(formatApiError(payload, res));
      }

      setSpotifyConnected(true);
      setSpotifyPlaylists(Array.isArray(payload.playlists) ? payload.playlists : []);
      setSpotifyScope(payload.scope ?? '');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to load Spotify playlists');
    } finally {
      setSpotifyLoading(false);
    }
  }, [getSupabaseAuthHeaders]);

  useEffect(() => {
    if (!isOpen) return;
    setLocalPlaylists(playlists);
    setView(initialView);
    setError(null);
    setNotice(null);
    resetImportState();

    if (initialView === 'manual') {
      resetManualComposer();
    }
    if (initialView === 'smart') {
      resetSmartComposer();
    }
  }, [
    initialView,
    isOpen,
    playlists,
    resetImportState,
    resetManualComposer,
    resetSmartComposer,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    setLocalPlaylists(playlists);
  }, [isOpen, playlists]);

  useEffect(() => {
    if (!isOpen || view !== 'import' || importMode !== 'spotify') return;
    void loadSpotifyPlaylists();
  }, [importMode, isOpen, loadSpotifyPlaylists, view]);

  useEffect(() => {
    if (destinationMode !== 'existing') return;
    if (appendablePlaylists.length === 0) {
      setDestinationPlaylistId(null);
      return;
    }
    const exists = appendablePlaylists.some((playlist) => playlist.id === destinationPlaylistId);
    if (!exists) setDestinationPlaylistId(appendablePlaylists[0].id);
  }, [appendablePlaylists, destinationMode, destinationPlaylistId]);

  useEffect(() => {
    if (!isOpen || view !== 'manual' || !manualEditingPlaylist) return;

    let active = true;
    const loadTracks = async () => {
      setManualTracksLoading(true);
      try {
        const headers = await getSupabaseAuthHeaders();
        const res = await fetch(`/api/playlists/${manualEditingPlaylist.id}/tracks`, {
          cache: 'no-store',
          headers,
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(formatApiError(payload, res));

        const items = Array.isArray(payload.items) ? (payload.items as PlaylistTrackItem[]) : [];
        if (!active) return;
        setManualTracks(items);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load playlist tracks');
      } finally {
        if (active) setManualTracksLoading(false);
      }
    };

    void loadTracks();

    return () => {
      active = false;
    };
  }, [getSupabaseAuthHeaders, isOpen, manualEditingPlaylist, view]);

  useEffect(() => {
    if (!isOpen || view !== 'manual') return;
    const query = manualTrackSearch.trim();
    if (query.length < 2) {
      setManualTrackSearchResults([]);
      setManualTrackSearching(false);
      return;
    }

    const controller = new AbortController();
    setManualTrackSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const url = new URL('/api/library/tracks/search', window.location.origin);
        url.searchParams.set('q', query);
        url.searchParams.set('limit', '8');

        const headers = await getSupabaseAuthHeaders();
        const res = await fetch(url.toString(), { headers, signal: controller.signal });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(formatApiError(payload, res));

        const mapped = Array.isArray(payload.results)
          ? (payload.results as Array<Record<string, unknown>>).map((item) => ({
              track_key: String(item.track_key ?? '').trim(),
              inventory_id: typeof item.inventory_id === 'number' ? item.inventory_id : null,
              title: String(item.track_title ?? item.title ?? '').trim(),
              artist: String(item.track_artist ?? item.artist ?? '').trim(),
              side: typeof item.side === 'string' ? item.side : null,
              position: typeof item.position === 'string' ? item.position : null,
              score: typeof item.score === 'number' ? item.score : 0,
            }))
          : [];
        setManualTrackSearchResults(mapped.filter((item) => item.track_key.length > 0));
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === 'AbortError') return;
        setError(searchError instanceof Error ? searchError.message : 'Track search failed');
      } finally {
        setManualTrackSearching(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [getSupabaseAuthHeaders, isOpen, manualTrackSearch, view]);

  const movePlaylist = async (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= localPlaylists.length) return;

    const next = [...localPlaylists];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setLocalPlaylists(next);
    setError(null);

    try {
      setLibraryBusy(true);
      await onReorderPlaylists(next);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Failed to reorder playlists');
      setLocalPlaylists(playlists);
    } finally {
      setLibraryBusy(false);
    }
  };

  const moveManualTrack = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= manualTracks.length) return;

    const next = [...manualTracks];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setManualTracks(next.map((row, idx) => ({ ...row, sort_order: idx })));
  };

  const removeManualTrack = (index: number) => {
    setManualTracks((prev) =>
      prev
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, sort_order: itemIndex }))
    );
  };

  const saveManualPlaylist = async () => {
    if (!manualName.trim()) {
      setError('Playlist name is required');
      return;
    }

    setManualSaving(true);
    setError(null);

    try {
      if (manualEditingPlaylist) {
        await onUpdatePlaylist({
          ...manualEditingPlaylist,
          name: manualName.trim(),
          icon: manualIcon,
          color: manualColor,
          trackKeys: manualTrackKeys,
        });
        setNotice(`Updated "${manualName.trim()}"`);
      } else {
        await onCreateManualPlaylist({
          name: manualName.trim(),
          icon: manualIcon,
          color: manualColor,
          trackKeys: manualTrackKeys,
        });
        setNotice(`Created "${manualName.trim()}"`);
      }

      setView('library');
      resetManualComposer();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save playlist');
    } finally {
      setManualSaving(false);
    }
  };

  const addSmartRule = () => {
    setSmartRules((prev) => [...prev, { field: 'track_title', operator: 'contains', value: '' }]);
  };

  const removeSmartRule = (index: number) => {
    setSmartRules((prev) => prev.filter((_, ruleIndex) => ruleIndex !== index));
  };

  const changeSmartRule = (index: number, key: keyof SmartPlaylistRule, value: string | number | boolean) => {
    setSmartRules((prev) => {
      const next = [...prev];
      if (key === 'field') {
        const fieldDef = FIELD_OPTIONS.find((field) => field.value === value);
        const operators = getOperatorsForFieldType(fieldDef?.type ?? 'text');
        next[index] = {
          field: value as SmartPlaylistFieldType,
          operator: operators[0].value,
          value: '',
        };
        return next;
      }

      if (key === 'operator') {
        next[index] = {
          ...next[index],
          operator: value as SmartPlaylistOperatorType,
          value: value === 'between' ? { min: '', max: '' } : '',
        };
        return next;
      }

      next[index] = {
        ...next[index],
        [key]: value,
      };
      return next;
    });
  };

  const changeSmartBetweenValue = (index: number, bound: 'min' | 'max', value: string) => {
    setSmartRules((prev) => {
      const next = [...prev];
      const existing = next[index]?.value;
      const between = isBetweenValue(existing) ? existing : { min: '', max: '' };
      next[index] = {
        ...next[index],
        value: {
          ...between,
          [bound]: value,
        },
      };
      return next;
    });
  };

  const saveSmartPlaylist = async () => {
    if (!smartName.trim()) {
      setError('Playlist name is required');
      return;
    }
    if (smartRules.length === 0) {
      setError('Add at least one rule');
      return;
    }

    const hasInvalidRule = smartRules.some((rule) => {
      if (rule.operator === 'between') {
        if (!isBetweenValue(rule.value)) return true;
        return String(rule.value.min).trim() === '' || String(rule.value.max).trim() === '';
      }
      return String(rule.value ?? '').trim() === '';
    });

    if (hasInvalidRule) {
      setError('Each rule needs a value');
      return;
    }

    const normalizedMax = smartMaxTracks.trim();
    const parsedMax = normalizedMax === '' ? null : Number(normalizedMax);
    if (normalizedMax !== '' && (!Number.isFinite(parsedMax) || parsedMax <= 0)) {
      setError('Max tracks must be a positive number');
      return;
    }

    setSmartSaving(true);
    setError(null);

    try {
      if (smartEditingPlaylist) {
        await onUpdatePlaylist({
          ...smartEditingPlaylist,
          name: smartName.trim(),
          icon: '⚡',
          color: smartColor,
          isSmart: true,
          smartRules: {
            rules: smartRules,
            maxTracks: parsedMax,
            selectedBy: smartSelectedBy,
          },
          matchRules: smartMatchRules,
          liveUpdate: smartLiveUpdate,
        });
        setNotice(`Updated smart playlist "${smartName.trim()}"`);
      } else {
        await onCreateSmartPlaylist({
          name: smartName.trim(),
          color: smartColor,
          matchRules: smartMatchRules,
          liveUpdate: smartLiveUpdate,
          smartRules: {
            rules: smartRules,
            maxTracks: parsedMax,
            selectedBy: smartSelectedBy,
          },
        });
        setNotice(`Created smart playlist "${smartName.trim()}"`);
      }

      setView('library');
      resetSmartComposer();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save smart playlist');
    } finally {
      setSmartSaving(false);
    }
  };

  const runSpotifyImport = async (playlist: SpotifyPlaylist, resumeOffset?: number | null) => {
    if (destinationMode === 'existing' && !destinationPlaylistId) {
      setError('Select a destination playlist first');
      return;
    }

    const isResume = typeof resumeOffset === 'number' && resumeOffset >= 0;
    const body: Record<string, unknown> = {
      playlistId: isResume ? resume?.spotifyPlaylistId : playlist.id,
      playlistName:
        destinationMode === 'new'
          ? (spotifyPlaylistNameOverride.trim() || playlist.name)
          : '(append)',
      snapshotId: isResume ? resume?.snapshotId ?? null : playlist.snapshotId ?? null,
      maxPages: resume?.maxPages ?? 3,
    };

    if (destinationMode === 'existing' && destinationPlaylistId) {
      body.existingPlaylistId = destinationPlaylistId;
    }
    if (isResume) {
      body.offset = resumeOffset;
    }

    setSpotifyImportingId(playlist.id);
    setError(null);
    setImportSummary(null);

    try {
      const headers = await getSupabaseAuthHeaders();
      const res = await fetch('/api/spotify/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setRetryAfterSeconds(typeof payload.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : null);
        setResume(payload.resume ?? null);
        throw new Error(payload.error || `Spotify import rate-limited (${res.status})`);
      }
      if (!res.ok) {
        throw new Error(formatApiError(payload, res));
      }

      const fuzzyNote = payload?.fuzzyMatchedCount ? `, ${payload.fuzzyMatchedCount} fuzzy-matched` : '';
      const duplicateNote = payload?.duplicatesSkipped ? `, ${payload.duplicatesSkipped} duplicates skipped` : '';
      const partialNote = payload?.partialImport ? ' (partial import, continue below)' : '';

      setImportSummary(
        `Imported "${playlist.name}": ${payload.matchedCount ?? 0} matched${fuzzyNote}, ${payload.unmatchedCount ?? 0} unmatched${duplicateNote}${partialNote}`
      );

      setLastImportedPlaylistId(
        typeof payload.playlistId === 'number'
          ? payload.playlistId
          : destinationPlaylistId
      );
      setUnmatchedRows(decorateUnmatched(payload.unmatchedSample));
      setResume(payload.resume ?? null);
      setRetryAfterSeconds(null);

      await onImported();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Spotify import failed');
    } finally {
      setSpotifyImportingId(null);
    }
  };

  const runCsvImport = async () => {
    if (!csvFile) {
      setError('Select a CSV file');
      return;
    }
    if (destinationMode === 'existing' && !destinationPlaylistId) {
      setError('Select a destination playlist first');
      return;
    }

    setCsvImporting(true);
    setError(null);
    setImportSummary(null);

    try {
      const csvText = await csvFile.text();
      if (!csvText.trim()) {
        throw new Error('CSV file is empty');
      }

      const headers = await getSupabaseAuthHeaders();
      const playlistName =
        destinationMode === 'new'
          ? (csvPlaylistName.trim() || inferPlaylistNameFromFile(csvFile))
          : '(append)';

      const res = await fetch('/api/playlists/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          playlistName,
          csvText,
          existingPlaylistId: destinationMode === 'existing' ? destinationPlaylistId : undefined,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatApiError(payload, res));
      }

      const fuzzyNote = payload?.fuzzyMatchedCount ? `, ${payload.fuzzyMatchedCount} fuzzy-matched` : '';
      const duplicateNote = payload?.duplicatesSkipped ? `, ${payload.duplicatesSkipped} duplicates skipped` : '';

      setImportSummary(
        `Imported CSV: ${payload?.matchedCount ?? 0} matched${fuzzyNote}, ${payload?.unmatchedCount ?? 0} unmatched${duplicateNote}`
      );

      setLastImportedPlaylistId(
        typeof payload?.playlistId === 'number' ? payload.playlistId : destinationPlaylistId
      );
      setUnmatchedRows(decorateUnmatched(payload?.unmatchedSample));
      await onImported();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'CSV import failed');
    } finally {
      setCsvImporting(false);
    }
  };

  const addUnmatchedCandidate = async (row: UnmatchedTrack, candidate: MatchCandidate) => {
    if (!lastImportedPlaylistId) return;

    setResolvingTrackKey(candidate.track_key);
    setError(null);

    try {
      const headers = await getSupabaseAuthHeaders();
      const res = await fetch('/api/spotify/import/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          playlistId: lastImportedPlaylistId,
          trackKey: candidate.track_key,
          sourceTitle: row.title,
          sourceArtist: row.artist,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatApiError(payload, res));
      }

      setUnmatchedRows((prev) => prev.filter((item) => item.row_id !== row.row_id));
      await onImported();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'Failed to add match');
    } finally {
      setResolvingTrackKey(null);
    }
  };

  const handleClose = () => {
    setError(null);
    setNotice(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[30020] bg-[#04060f]/85 backdrop-blur-sm p-3 sm:p-6"
      onClick={handleClose}
    >
      <div
        className="mx-auto h-full max-h-[920px] w-full max-w-[1240px] overflow-hidden rounded-[28px] border border-[#26324a] bg-[#0d1320] shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid h-full grid-cols-1 md:grid-cols-[270px_1fr]">
          <aside className="border-b border-[#26324a] bg-[radial-gradient(circle_at_top,_#1f2b45,_#10182b_55%,_#0a101c)] p-4 md:border-b-0 md:border-r md:p-5">
            <div className="mb-4 rounded-2xl border border-[#2d3d5f] bg-black/25 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[#7ba6ff]">New System</div>
              <h2 className="mt-2 text-lg font-semibold text-white">Playlist Studio</h2>
              <p className="mt-1 text-xs text-[#a8b9db]">Single workspace for build, smart rules, and imports.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
              {NAV_ITEMS.map((item) => {
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setView(item.id);
                    }}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? 'border-[#3f7cff] bg-[#18315f] text-white shadow-[0_0_0_1px_rgba(91,135,255,0.35)]'
                        : 'border-[#2f3a52] bg-[#101829] text-[#bfd0f3] hover:border-[#4a5f89] hover:bg-[#152039]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span>{item.emoji}</span>
                      <span>{item.label}</span>
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#86a1d5]">{item.detail}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3 md:grid-cols-1">
              <button
                onClick={openManualCreate}
                className="rounded-xl border border-[#2f4f80] bg-[#10315f] px-3 py-2 text-left text-xs font-semibold text-[#dbe9ff] hover:bg-[#14437f]"
              >
                + New Manual Playlist
              </button>
              <button
                onClick={openSmartCreate}
                className="rounded-xl border border-[#3b566d] bg-[#0f2933] px-3 py-2 text-left text-xs font-semibold text-[#ccf1ff] hover:bg-[#13414e]"
              >
                + New Smart Playlist
              </button>
              <button
                onClick={() => {
                  resetImportState();
                  setView('import');
                }}
                className="rounded-xl border border-[#6a5a2f] bg-[#312c15] px-3 py-2 text-left text-xs font-semibold text-[#ffedb8] hover:bg-[#4b421c]"
              >
                + Import Playlist
              </button>
            </div>
          </aside>

          <section className="flex h-full flex-col bg-[linear-gradient(180deg,#11192b_0%,#0f1728_120px,#0c1322_100%)]">
            <header className="flex items-center justify-between border-b border-[#24324a] px-4 py-3 md:px-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#84a4d8]">Playlist Operations</div>
                <h3 className="text-lg font-semibold text-white">
                  {view === 'library' && 'Playlist Library'}
                  {view === 'manual' && (manualEditingPlaylist ? `Edit Manual: ${manualEditingPlaylist.name}` : 'Create Manual Playlist')}
                  {view === 'smart' && (smartEditingPlaylist ? `Edit Smart: ${smartEditingPlaylist.name}` : 'Create Smart Playlist')}
                  {view === 'import' && 'Import Console'}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg border border-[#334661] bg-[#182235] px-3 py-1.5 text-sm font-medium text-[#c8d8f5] hover:bg-[#21304b]"
              >
                Close
              </button>
            </header>

            {(error || notice || importSummary) && (
              <div className="space-y-2 border-b border-[#24324a] bg-[#0b1221] px-4 py-3 md:px-6">
                {error && (
                  <div className="rounded-lg border border-red-500/40 bg-red-900/25 px-3 py-2 text-sm text-red-200">{error}</div>
                )}
                {notice && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-900/25 px-3 py-2 text-sm text-emerald-200">{notice}</div>
                )}
                {importSummary && (
                  <div className="rounded-lg border border-cyan-500/40 bg-cyan-900/25 px-3 py-2 text-sm text-cyan-100">{importSummary}</div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
              {view === 'library' && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#2a3e63] bg-[#0f223f] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#8cb1ff]">Total Playlists</div>
                      <div className="mt-2 text-3xl font-semibold text-white">{localPlaylists.length}</div>
                    </div>
                    <div className="rounded-2xl border border-[#355047] bg-[#102721] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#95e7c7]">Manual</div>
                      <div className="mt-2 text-3xl font-semibold text-white">
                        {localPlaylists.filter((playlist) => !playlist.isSmart).length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#5a4b31] bg-[#2a2416] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#ffe0a0]">Smart</div>
                      <div className="mt-2 text-3xl font-semibold text-white">
                        {localPlaylists.filter((playlist) => playlist.isSmart).length}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={openManualCreate}
                      className="rounded-lg border border-[#2f4f80] bg-[#123867] px-3 py-2 text-xs font-semibold text-[#dceaff] hover:bg-[#185194]"
                    >
                      Create Manual
                    </button>
                    <button
                      onClick={openSmartCreate}
                      className="rounded-lg border border-[#3b566d] bg-[#0f2f3c] px-3 py-2 text-xs font-semibold text-[#d4f3ff] hover:bg-[#144a5b]"
                    >
                      Create Smart
                    </button>
                    <button
                      onClick={() => {
                        setView('import');
                        setImportMode('spotify');
                        resetImportState();
                      }}
                      className="rounded-lg border border-[#5f8f65] bg-[#1b3d1f] px-3 py-2 text-xs font-semibold text-[#d7f5dc] hover:bg-[#27552d]"
                    >
                      Open Imports
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Delete all playlists? This cannot be undone.')) return;
                        try {
                          setLibraryBusy(true);
                          setError(null);
                          await onDeleteAllPlaylists();
                          setLocalPlaylists([]);
                          setNotice('Deleted all playlists');
                        } catch (deleteError) {
                          setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete all playlists');
                        } finally {
                          setLibraryBusy(false);
                        }
                      }}
                      disabled={libraryBusy || deletingId !== null || localPlaylists.length === 0}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                        libraryBusy || deletingId !== null || localPlaylists.length === 0
                          ? 'cursor-not-allowed border-red-900/30 bg-red-900/15 text-red-300/60'
                          : 'border-red-600/50 bg-red-700/20 text-red-100 hover:bg-red-700/35'
                      }`}
                    >
                      Delete All
                    </button>
                  </div>

                  {localPlaylists.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#3a4a66] bg-[#111a2c] px-4 py-8 text-center text-sm text-[#9fb2d8]">
                      No playlists yet. Use Manual Builder, Smart Builder, or Import Console.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {localPlaylists.map((playlist, index) => {
                        const trackLabel = playlist.isSmart
                          ? `${playlist.smartRules?.rules?.length ?? 0} rule${(playlist.smartRules?.rules?.length ?? 0) === 1 ? '' : 's'}`
                          : `${playlist.trackKeys.length} track${playlist.trackKeys.length === 1 ? '' : 's'}`;

                        return (
                          <div
                            key={playlist.id}
                            className="rounded-2xl border border-[#2e3c57] bg-[#121d31] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex min-w-[240px] flex-1 items-start gap-3">
                                <div
                                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-2xl"
                                  style={{ backgroundColor: `${playlist.color}22` }}
                                >
                                  <span style={{ color: playlist.color }}>{playlist.isSmart ? '⚡' : playlist.icon}</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-base font-semibold text-white">{playlist.name}</div>
                                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#89a2ce]">
                                    {playlist.isSmart ? 'Smart Playlist' : 'Manual Playlist'}
                                  </div>
                                  <div className="mt-1 text-xs text-[#b7c8e8]">
                                    {trackLabel}
                                    {playlist.isSmart && (
                                      <>
                                        {' • '}
                                        {playlist.matchRules === 'all' ? 'Match All' : 'Match Any'}
                                        {' • '}
                                        {playlist.liveUpdate ? 'Live' : 'Static'}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => movePlaylist(index, 'up')}
                                    disabled={libraryBusy || index === 0}
                                    className={`rounded-md border px-2 py-1 text-xs ${
                                      libraryBusy || index === 0
                                        ? 'cursor-not-allowed border-[#36445f] bg-[#1b2538] text-[#63779b]'
                                        : 'border-[#46608b] bg-[#1b2f4f] text-[#cae0ff] hover:bg-[#23416d]'
                                    }`}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => movePlaylist(index, 'down')}
                                    disabled={libraryBusy || index === localPlaylists.length - 1}
                                    className={`rounded-md border px-2 py-1 text-xs ${
                                      libraryBusy || index === localPlaylists.length - 1
                                        ? 'cursor-not-allowed border-[#36445f] bg-[#1b2538] text-[#63779b]'
                                        : 'border-[#46608b] bg-[#1b2f4f] text-[#cae0ff] hover:bg-[#23416d]'
                                    }`}
                                  >
                                    ↓
                                  </button>
                                </div>

                                <button
                                  onClick={() => (playlist.isSmart ? openSmartEdit(playlist) : openManualEdit(playlist))}
                                  className="rounded-md border border-[#3e5f8d] bg-[#1d3153] px-3 py-1.5 text-xs font-semibold text-[#dceaff] hover:bg-[#264471]"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      setDeletingId(playlist.id);
                                      setError(null);
                                      await onDeletePlaylist(playlist.id, playlist.name);
                                      setLocalPlaylists((prev) => prev.filter((item) => item.id !== playlist.id));
                                      setNotice(`Deleted "${playlist.name}"`);
                                    } catch (deleteError) {
                                      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete playlist');
                                    } finally {
                                      setDeletingId(null);
                                    }
                                  }}
                                  disabled={deletingId === playlist.id || libraryBusy}
                                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                                    deletingId === playlist.id || libraryBusy
                                      ? 'cursor-not-allowed border-red-900/30 bg-red-900/15 text-red-300/60'
                                      : 'border-red-600/50 bg-red-700/20 text-red-100 hover:bg-red-700/35'
                                  }`}
                                >
                                  {deletingId === playlist.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {view === 'manual' && (
                <div className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
                    <div className="space-y-4 rounded-2xl border border-[#2c3b58] bg-[#121e34] p-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">
                          Playlist Name
                        </label>
                        <input
                          value={manualName}
                          onChange={(event) => setManualName(event.target.value)}
                          placeholder="Ex: Friday Warmup"
                          className="w-full rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white outline-none focus:border-[#5f9bff]"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">
                          Icon
                        </label>
                        <div className="flex gap-2">
                          <input
                            value={manualIconInput}
                            onChange={(event) => {
                              const value = event.target.value;
                              setManualIconInput(value);
                              const parsed = firstIconFromInput(value);
                              if (parsed) setManualIcon(parsed);
                            }}
                            placeholder="Paste emoji"
                            className="w-full rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white outline-none focus:border-[#5f9bff]"
                          />
                          <input
                            value={manualIconSearch}
                            onChange={(event) => setManualIconSearch(event.target.value)}
                            placeholder="Filter"
                            className="w-[110px] rounded-lg border border-[#30466b] bg-[#0f182a] px-2 py-2 text-sm text-white outline-none focus:border-[#5f9bff]"
                          />
                        </div>
                        <div className="mt-2 grid max-h-[170px] grid-cols-6 gap-2 overflow-y-auto pr-1">
                          {filteredManualIcons.map((preset) => (
                            <button
                              key={preset.icon}
                              onClick={() => {
                                setManualIcon(preset.icon);
                                setManualIconInput(preset.icon);
                              }}
                              title={preset.keywords.join(', ')}
                              className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl ${
                                manualIcon === preset.icon
                                  ? 'border-[#68a3ff] bg-[#1d3358]'
                                  : 'border-[#30466b] bg-[#111d34] hover:bg-[#172846]'
                              }`}
                            >
                              {preset.icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">
                          Accent
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {SHARED_COLOR_PRESETS.map((swatch) => (
                            <button
                              key={swatch}
                              onClick={() => setManualColor(swatch)}
                              className={`h-8 w-8 rounded-full border ${
                                manualColor === swatch ? 'border-white ring-2 ring-white/30' : 'border-white/20'
                              }`}
                              style={{ backgroundColor: swatch }}
                            />
                          ))}
                          <input
                            type="color"
                            value={manualColor}
                            onChange={(event) => setManualColor(event.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
                          />
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#33496e] bg-[#101b30] p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 text-2xl"
                            style={{ backgroundColor: `${manualColor}22` }}
                          >
                            <span style={{ color: manualColor }}>{manualIcon}</span>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{manualName || 'Untitled Manual Playlist'}</div>
                            <div className="text-xs text-[#9ab2dd]">{manualTrackKeys.length} tracks selected</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            resetManualComposer();
                            setView('library');
                          }}
                          className="rounded-lg border border-[#3b4e72] bg-[#1a2640] px-3 py-2 text-sm text-[#cad8f2] hover:bg-[#24375c]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => void saveManualPlaylist()}
                          disabled={manualSaving || !manualName.trim()}
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                            manualSaving || !manualName.trim()
                              ? 'cursor-not-allowed border-[#355079] bg-[#203559] text-[#7e9bc7]'
                              : 'border-[#4e9bff] bg-[#1f4f89] text-white hover:bg-[#2866b1]'
                          }`}
                        >
                          {manualSaving ? 'Saving...' : manualEditingPlaylist ? 'Save Manual Playlist' : 'Create Manual Playlist'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-[#2c3b58] bg-[#121e34] p-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">Track Builder</label>
                        <div className="text-xs text-[#a9bedf]">{manualTrackKeys.length} track{manualTrackKeys.length === 1 ? '' : 's'}</div>
                      </div>

                      <div>
                        <input
                          value={manualTrackSearch}
                          onChange={(event) => setManualTrackSearch(event.target.value)}
                          placeholder="Search inventory tracks to add"
                          className="w-full rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white outline-none focus:border-[#5f9bff]"
                        />

                        {manualTrackSearching && <div className="mt-2 text-xs text-[#93a8cf]">Searching...</div>}

                        {!manualTrackSearching && manualTrackSearchResults.length > 0 && (
                          <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-[#324968] bg-[#0e1729]">
                            {manualTrackSearchResults.map((candidate) => {
                              const alreadyAdded = manualTrackKeys.includes(candidate.track_key);
                              const meta: string[] = [];
                              if (candidate.inventory_id) meta.push(`#${candidate.inventory_id}`);
                              if (candidate.position) meta.push(candidate.position);
                              return (
                                <button
                                  key={candidate.track_key}
                                  disabled={alreadyAdded}
                                  onClick={() => {
                                    setManualTracks((prev) => {
                                      if (prev.some((track) => track.track_key === candidate.track_key)) return prev;
                                      return [
                                        ...prev,
                                        {
                                          track_key: candidate.track_key,
                                          sort_order: prev.length,
                                          track_title: candidate.title,
                                          artist_name: candidate.artist,
                                          album_name: null,
                                          side: candidate.side,
                                          position: candidate.position,
                                        },
                                      ];
                                    });
                                  }}
                                  className={`w-full border-b border-[#253652] px-3 py-2 text-left ${
                                    alreadyAdded
                                      ? 'cursor-not-allowed bg-[#162237] text-[#61789f]'
                                      : 'hover:bg-[#1a2843]'
                                  }`}
                                >
                                  <div className="text-sm text-white">
                                    <span className="font-medium">{candidate.title}</span> - {candidate.artist}
                                    {meta.length > 0 ? ` (${meta.join(':')})` : ''}
                                  </div>
                                  <div className="text-xs text-[#90abd8]">Match {Math.round(candidate.score * 100)}%</div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {manualTracksLoading ? (
                        <div className="rounded-lg border border-[#324968] bg-[#101a2f] px-3 py-2 text-sm text-[#9eb4db]">
                          Loading playlist tracks...
                        </div>
                      ) : manualTracks.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[#36527a] bg-[#0e1729] px-4 py-8 text-center text-sm text-[#9eb4db]">
                          No tracks selected yet.
                        </div>
                      ) : (
                        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                          {manualTracks.map((track, index) => {
                            const subtitleParts = [
                              track.artist_name,
                              track.album_name,
                              formatTrackPositionLabel(track.side, track.position),
                            ].filter(Boolean);
                            return (
                              <div
                                key={`${track.track_key}-${index}`}
                                className="flex items-center gap-2 rounded-lg border border-[#314764] bg-[#101a2d] px-3 py-2"
                              >
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => moveManualTrack(index, 'up')}
                                    disabled={index === 0}
                                    className={`h-5 w-6 rounded border text-[10px] ${
                                      index === 0
                                        ? 'cursor-not-allowed border-[#344866] bg-[#16253c] text-[#6882aa]'
                                        : 'border-[#43608b] bg-[#1b3154] text-[#cce1ff] hover:bg-[#234270]'
                                    }`}
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => moveManualTrack(index, 'down')}
                                    disabled={index === manualTracks.length - 1}
                                    className={`h-5 w-6 rounded border text-[10px] ${
                                      index === manualTracks.length - 1
                                        ? 'cursor-not-allowed border-[#344866] bg-[#16253c] text-[#6882aa]'
                                        : 'border-[#43608b] bg-[#1b3154] text-[#cce1ff] hover:bg-[#234270]'
                                    }`}
                                  >
                                    ▼
                                  </button>
                                  <button
                                    onClick={() => removeManualTrack(index)}
                                    className="h-5 w-6 rounded border border-red-600/50 bg-red-800/25 text-[10px] text-red-100 hover:bg-red-800/40"
                                    title="Remove track"
                                  >
                                    ✕
                                  </button>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-white">{track.track_title ?? track.track_key}</div>
                                  {subtitleParts.length > 0 && (
                                    <div className="truncate text-xs text-[#9db5de]">{subtitleParts.join(' • ')}</div>
                                  )}
                                </div>
                                <button
                                  onClick={() => removeManualTrack(index)}
                                  className="shrink-0 rounded-md border border-red-600/40 bg-red-800/20 px-2 py-1 text-xs text-red-100 hover:bg-red-800/35"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {view === 'smart' && (
                <div className="space-y-5">
                  <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                    <div className="space-y-4 rounded-2xl border border-[#2c3b58] bg-[#121e34] p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">
                            Playlist Name
                          </label>
                          <input
                            value={smartName}
                            onChange={(event) => setSmartName(event.target.value)}
                            placeholder="Ex: Last Played This Year"
                            className="w-full rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white outline-none focus:border-[#5f9bff]"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">
                            Rule Logic
                          </label>
                          <select
                            value={smartMatchRules}
                            onChange={(event) => setSmartMatchRules(event.target.value as 'all' | 'any')}
                            className="w-full rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white outline-none"
                          >
                            <option value="all">Match all rules</option>
                            <option value="any">Match any rule</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">
                            Max Tracks
                          </label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={smartMaxTracks}
                            onChange={(event) => setSmartMaxTracks(event.target.value)}
                            placeholder="optional"
                            className="w-full rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">
                            Selected By
                          </label>
                          <select
                            value={smartSelectedBy}
                            onChange={(event) =>
                              setSmartSelectedBy(event.target.value as NonNullable<SmartPlaylistRules['selectedBy']>)
                            }
                            disabled={smartMaxTracks.trim() === ''}
                            className="w-full rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
                          >
                            {LIMIT_SELECTION_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">
                            Live Update
                          </label>
                          <label className="mt-1.5 flex items-center gap-2 text-sm text-[#d6e6ff]">
                            <input
                              type="checkbox"
                              checked={smartLiveUpdate}
                              onChange={(event) => setSmartLiveUpdate(event.target.checked)}
                              className="accent-[#5f9bff]"
                            />
                            Keep playlist dynamic
                          </label>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">Rules</div>
                          <button
                            onClick={addSmartRule}
                            className="rounded-md border border-[#3f618f] bg-[#17345d] px-3 py-1.5 text-xs font-semibold text-[#dceaff] hover:bg-[#235289]"
                          >
                            + Add Rule
                          </button>
                        </div>

                        {smartRules.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-[#355177] bg-[#0f1829] px-4 py-8 text-center text-sm text-[#9db3da]">
                            Add the first rule to define this smart playlist.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {smartRules.map((rule, index) => {
                              const fieldDef = FIELD_OPTIONS.find((field) => field.value === rule.field) ?? FIELD_OPTIONS[0];
                              const operators = getOperatorsForFieldType(fieldDef.type);
                              const dropdownOptions = DROPDOWN_FIELDS.has(rule.field)
                                ? smartValueOptions?.[rule.field] ?? []
                                : [];
                              const usesDropdown = dropdownOptions.length > 0;

                              return (
                                <div
                                  key={`${rule.field}-${index}`}
                                  className="rounded-lg border border-[#2f4465] bg-[#111d31] p-2"
                                >
                                  <div className="grid gap-2 lg:grid-cols-[1.1fr_0.9fr_1fr_auto]">
                                    <select
                                      value={rule.field}
                                      onChange={(event) => changeSmartRule(index, 'field', event.target.value)}
                                      className="rounded-md border border-[#30466b] bg-[#0f182a] px-2 py-2 text-sm text-white"
                                    >
                                      {FIELD_OPTIONS.map((field) => (
                                        <option key={field.value} value={field.value}>
                                          {field.label}
                                        </option>
                                      ))}
                                    </select>

                                    <select
                                      value={rule.operator}
                                      onChange={(event) => changeSmartRule(index, 'operator', event.target.value)}
                                      className="rounded-md border border-[#30466b] bg-[#0f182a] px-2 py-2 text-sm text-white"
                                    >
                                      {operators.map((operator) => (
                                        <option key={operator.value} value={operator.value}>
                                          {operator.label}
                                        </option>
                                      ))}
                                    </select>

                                    {rule.operator === 'between' ? (
                                      <div className="grid grid-cols-2 gap-2">
                                        <input
                                          type={fieldDef.type === 'date' ? 'date' : 'number'}
                                          value={isBetweenValue(rule.value) ? String(rule.value.min) : ''}
                                          onChange={(event) =>
                                            changeSmartBetweenValue(index, 'min', event.target.value)
                                          }
                                          placeholder="min"
                                          className="rounded-md border border-[#30466b] bg-[#0f182a] px-2 py-2 text-sm text-white"
                                        />
                                        <input
                                          type={fieldDef.type === 'date' ? 'date' : 'number'}
                                          value={isBetweenValue(rule.value) ? String(rule.value.max) : ''}
                                          onChange={(event) =>
                                            changeSmartBetweenValue(index, 'max', event.target.value)
                                          }
                                          placeholder="max"
                                          className="rounded-md border border-[#30466b] bg-[#0f182a] px-2 py-2 text-sm text-white"
                                        />
                                      </div>
                                    ) : fieldDef.type === 'boolean' ? (
                                      <select
                                        value={String(rule.value)}
                                        onChange={(event) =>
                                          changeSmartRule(index, 'value', event.target.value === 'true')
                                        }
                                        className="rounded-md border border-[#30466b] bg-[#0f182a] px-2 py-2 text-sm text-white"
                                      >
                                        <option value="true">True</option>
                                        <option value="false">False</option>
                                      </select>
                                    ) : usesDropdown ? (
                                      <>
                                        <input
                                          list={`smart-rule-options-${index}`}
                                          type={fieldDef.type === 'date' ? 'date' : fieldDef.type === 'number' ? 'number' : 'text'}
                                          value={String(rule.value)}
                                          onChange={(event) => {
                                            if (fieldDef.type === 'number') {
                                              changeSmartRule(
                                                index,
                                                'value',
                                                event.target.value === '' ? '' : Number(event.target.value)
                                              );
                                              return;
                                            }
                                            changeSmartRule(index, 'value', event.target.value);
                                          }}
                                          className="rounded-md border border-[#30466b] bg-[#0f182a] px-2 py-2 text-sm text-white"
                                          placeholder="Type or pick"
                                        />
                                        <datalist id={`smart-rule-options-${index}`}>
                                          {dropdownOptions.map((option) => (
                                            <option key={option} value={option} />
                                          ))}
                                        </datalist>
                                      </>
                                    ) : fieldDef.type === 'date' ? (
                                      <input
                                        type="date"
                                        value={String(rule.value)}
                                        onChange={(event) => changeSmartRule(index, 'value', event.target.value)}
                                        className="rounded-md border border-[#30466b] bg-[#0f182a] px-2 py-2 text-sm text-white"
                                      />
                                    ) : fieldDef.type === 'number' ? (
                                      <input
                                        type="number"
                                        value={String(rule.value)}
                                        onChange={(event) =>
                                          changeSmartRule(
                                            index,
                                            'value',
                                            event.target.value === '' ? '' : Number(event.target.value)
                                          )
                                        }
                                        className="rounded-md border border-[#30466b] bg-[#0f182a] px-2 py-2 text-sm text-white"
                                        placeholder="value"
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={String(rule.value)}
                                        onChange={(event) => changeSmartRule(index, 'value', event.target.value)}
                                        className="rounded-md border border-[#30466b] bg-[#0f182a] px-2 py-2 text-sm text-white"
                                        placeholder="value"
                                      />
                                    )}

                                    <button
                                      onClick={() => removeSmartRule(index)}
                                      className="rounded-md border border-red-600/50 bg-red-800/20 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-800/35"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-[#2c3b58] bg-[#121e34] p-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8faddd]">
                          Accent Color
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          {SMART_PLAYLIST_COLORS.map((swatch) => (
                            <button
                              key={swatch}
                              onClick={() => setSmartColor(swatch)}
                              className={`h-9 w-9 rounded-full border ${
                                smartColor === swatch ? 'border-white ring-2 ring-white/30' : 'border-white/20'
                              }`}
                              style={{ backgroundColor: swatch }}
                            />
                          ))}
                        </div>
                        <input
                          type="color"
                          value={smartColor}
                          onChange={(event) => setSmartColor(event.target.value)}
                          className="mt-2 h-8 w-12 cursor-pointer rounded border border-white/20 bg-transparent"
                        />
                      </div>

                      <div className="rounded-xl border border-[#35507a] bg-[#101b30] p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 text-2xl"
                            style={{ backgroundColor: `${smartColor}33` }}
                          >
                            <span style={{ color: smartColor }}>⚡</span>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{smartName || 'Untitled Smart Playlist'}</div>
                            <div className="text-xs text-[#9ab2dd]">
                              {smartRules.length} rule{smartRules.length === 1 ? '' : 's'} • {smartMatchRules === 'all' ? 'All' : 'Any'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            resetSmartComposer();
                            setView('library');
                          }}
                          className="rounded-lg border border-[#3b4e72] bg-[#1a2640] px-3 py-2 text-sm text-[#cad8f2] hover:bg-[#24375c]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => void saveSmartPlaylist()}
                          disabled={smartSaving || !smartName.trim() || smartRules.length === 0}
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                            smartSaving || !smartName.trim() || smartRules.length === 0
                              ? 'cursor-not-allowed border-[#355079] bg-[#203559] text-[#7e9bc7]'
                              : 'border-[#4e9bff] bg-[#1f4f89] text-white hover:bg-[#2866b1]'
                          }`}
                        >
                          {smartSaving ? 'Saving...' : smartEditingPlaylist ? 'Save Smart Playlist' : 'Create Smart Playlist'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === 'import' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#2e3f5f] bg-[#121e34] p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#8faddd]">Import Destination</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setDestinationMode('new')}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                          destinationMode === 'new'
                            ? 'border-[#5f9bff] bg-[#1c3d6c] text-white'
                            : 'border-[#344866] bg-[#162238] text-[#b8cbed] hover:bg-[#203252]'
                        }`}
                      >
                        Create new playlist
                      </button>
                      <button
                        onClick={() => setDestinationMode('existing')}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                          destinationMode === 'existing'
                            ? 'border-[#5f9bff] bg-[#1c3d6c] text-white'
                            : 'border-[#344866] bg-[#162238] text-[#b8cbed] hover:bg-[#203252]'
                        }`}
                      >
                        Append to existing playlist
                      </button>
                    </div>

                    {destinationMode === 'existing' && (
                      <div className="mt-3">
                        <label className="mb-1 block text-xs text-[#9bb0d8]">Destination playlist</label>
                        <select
                          value={destinationPlaylistId ?? ''}
                          onChange={(event) =>
                            setDestinationPlaylistId(event.target.value ? Number(event.target.value) : null)
                          }
                          className="w-full max-w-[420px] rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white"
                        >
                          {appendablePlaylists.length === 0 ? (
                            <option value="">No manual playlists available</option>
                          ) : (
                            appendablePlaylists.map((playlist) => (
                              <option key={playlist.id} value={playlist.id}>
                                {playlist.name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-[#2e3f5f] bg-[#121e34] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.15em] text-[#8faddd]">Spotify Import</div>
                          <div className="text-sm font-semibold text-white">Connect and pull playlists</div>
                        </div>
                        <button
                          onClick={() => {
                            setImportMode('spotify');
                            void loadSpotifyPlaylists();
                          }}
                          className="rounded-md border border-[#3d5783] bg-[#1b3155] px-3 py-1.5 text-xs font-semibold text-[#d8e8ff] hover:bg-[#244577]"
                        >
                          Refresh
                        </button>
                      </div>

                      {destinationMode === 'new' && (
                        <div className="mb-3">
                          <label className="mb-1 block text-xs text-[#9bb0d8]">Optional name override</label>
                          <input
                            value={spotifyPlaylistNameOverride}
                            onChange={(event) => setSpotifyPlaylistNameOverride(event.target.value)}
                            placeholder="Use source playlist name by default"
                            className="w-full rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white"
                          />
                        </div>
                      )}

                      {!spotifyConnected ? (
                        <div className="rounded-xl border border-[#3f5f8a] bg-[#102545] p-3 text-sm text-[#d7e8ff]">
                          Spotify is not connected.
                          <div className="mt-2">
                            <a
                              href="/api/auth/spotify"
                              className="inline-flex rounded-md border border-[#64b674] bg-[#1f6940] px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Connect Spotify
                            </a>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-2 flex items-center gap-2">
                            <input
                              value={spotifyQuery}
                              onChange={(event) => setSpotifyQuery(event.target.value)}
                              placeholder="Search Spotify playlists"
                              className="w-full rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white"
                            />
                            <a
                              href="/api/auth/spotify"
                              className="rounded-md border border-[#49a163] bg-[#227746] px-3 py-2 text-xs font-semibold text-white"
                            >
                              Reconnect
                            </a>
                          </div>
                          {spotifyScope && (
                            <div className="mb-2 text-xs text-[#95add8]">
                              Scope: <code className="rounded bg-black/30 px-1 py-0.5">{spotifyScope}</code>
                            </div>
                          )}

                          {spotifyLoading ? (
                            <div className="rounded-lg border border-[#30466b] bg-[#101a2d] px-3 py-3 text-sm text-[#9db3da]">Loading playlists...</div>
                          ) : filteredSpotifyPlaylists.length === 0 ? (
                            <div className="rounded-lg border border-[#30466b] bg-[#101a2d] px-3 py-3 text-sm text-[#9db3da]">No playlists found.</div>
                          ) : (
                            <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                              {filteredSpotifyPlaylists.map((playlist) => (
                                <div
                                  key={playlist.id}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-[#30466b] bg-[#101a2d] px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-white">{playlist.name}</div>
                                    <div className="text-xs text-[#9db3da]">
                                      {typeof playlist.trackCount === 'number'
                                        ? `${playlist.trackCount} tracks`
                                        : 'Track count unavailable'}
                                    </div>
                                    {playlist.canImport === false && (
                                      <div className="text-xs text-amber-200">{playlist.importReason || 'Import blocked'}</div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setImportMode('spotify');
                                      void runSpotifyImport(playlist);
                                    }}
                                    disabled={spotifyImportingId === playlist.id || playlist.canImport === false}
                                    className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                                      spotifyImportingId === playlist.id || playlist.canImport === false
                                        ? 'cursor-not-allowed border-[#3d4a65] bg-[#1f2a41] text-[#8094b9]'
                                        : 'border-[#4cab73] bg-[#1f6d42] text-white hover:bg-[#298f57]'
                                    }`}
                                  >
                                    {spotifyImportingId === playlist.id ? 'Importing...' : 'Import'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {resume?.spotifyPlaylistId && typeof resume?.nextOffset === 'number' && (
                            <div className="mt-3 rounded-xl border border-[#3e5f8d] bg-[#102241] p-3">
                              <div className="text-xs text-[#cce2ff]">
                                Partial import detected at offset {resume.nextOffset}.
                                {retryAfterSeconds !== null
                                  ? ` Retry after about ${Math.ceil(retryAfterSeconds / 60)} minute(s).`
                                  : ''}
                              </div>
                              <button
                                onClick={() => {
                                  const source = spotifyPlaylists.find((playlist) => playlist.id === resume.spotifyPlaylistId);
                                  if (!source) return;
                                  void runSpotifyImport(source, resume.nextOffset ?? 0);
                                }}
                                disabled={retryAfterSeconds !== null && retryAfterSeconds > 0}
                                className={`mt-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                                  retryAfterSeconds !== null && retryAfterSeconds > 0
                                    ? 'cursor-not-allowed border-[#3d4a65] bg-[#1f2a41] text-[#8094b9]'
                                    : 'border-[#4e9bff] bg-[#1f4f89] text-white hover:bg-[#2866b1]'
                                }`}
                              >
                                Continue Import
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="rounded-2xl border border-[#2e3f5f] bg-[#121e34] p-4">
                      <div className="mb-3">
                        <div className="text-xs uppercase tracking-[0.15em] text-[#8faddd]">CSV Import</div>
                        <div className="text-sm font-semibold text-white">Upload `title,artist` rows</div>
                      </div>

                      {destinationMode === 'new' && (
                        <div className="mb-3">
                          <label className="mb-1 block text-xs text-[#9bb0d8]">Optional playlist name</label>
                          <input
                            value={csvPlaylistName}
                            onChange={(event) => setCsvPlaylistName(event.target.value)}
                            placeholder="Defaults to file name"
                            className="w-full rounded-lg border border-[#30466b] bg-[#0f182a] px-3 py-2 text-sm text-white"
                          />
                        </div>
                      )}

                      <div className="rounded-xl border border-[#334a6f] bg-[#101b30] p-3">
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                          className="w-full text-xs text-[#c3d6fb]"
                        />
                        {csvFile && (
                          <div className="mt-2 text-xs text-[#a5bcdf]">Selected: {csvFile.name}</div>
                        )}
                        <button
                          onClick={() => {
                            setImportMode('csv');
                            void runCsvImport();
                          }}
                          disabled={!csvFile || csvImporting}
                          className={`mt-3 rounded-md border px-3 py-2 text-xs font-semibold ${
                            !csvFile || csvImporting
                              ? 'cursor-not-allowed border-[#3d4a65] bg-[#1f2a41] text-[#8094b9]'
                              : 'border-[#5f9bff] bg-[#1f4f89] text-white hover:bg-[#2866b1]'
                          }`}
                        >
                          {csvImporting ? 'Importing CSV...' : 'Import CSV'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {lastImportedPlaylistId && unmatchedRows.length > 0 && (
                    <div className="rounded-2xl border border-amber-600/40 bg-amber-950/20 p-4">
                      <div className="mb-2 text-sm font-semibold text-amber-100">
                        Unmatched Tracks ({unmatchedRows.length})
                      </div>
                      <div className="mb-3 text-xs text-amber-200/90">
                        Suggestions below use existing fuzzy-match candidates from the import engine.
                      </div>

                      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {unmatchedRows.map((row) => (
                          <div key={row.row_id} className="rounded-lg border border-amber-400/30 bg-black/20 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm text-amber-50">
                                <span className="font-medium">{row.title || '(no title)'}</span>
                                {row.artist ? ` - ${row.artist}` : ''}
                              </div>
                              <button
                                onClick={() =>
                                  setUnmatchedRows((prev) => prev.filter((item) => item.row_id !== row.row_id))
                                }
                                className="rounded-md border border-amber-400/40 bg-amber-900/20 px-2 py-1 text-xs text-amber-50 hover:bg-amber-900/35"
                              >
                                Skip
                              </button>
                            </div>

                            {row.candidates.length === 0 ? (
                              <div className="mt-2 text-xs text-amber-100/80">No candidate suggestions.</div>
                            ) : (
                              <div className="mt-2 space-y-1">
                                {row.candidates.slice(0, 4).map((candidate) => {
                                  const meta: string[] = [];
                                  if (candidate.inventory_id) meta.push(`#${candidate.inventory_id}`);
                                  if (candidate.position) meta.push(candidate.position);
                                  return (
                                    <div
                                      key={`${row.row_id}-${candidate.track_key}`}
                                      className="flex items-center justify-between gap-2 rounded-md border border-amber-400/20 bg-amber-950/20 px-2 py-1.5"
                                    >
                                      <div className="min-w-0 text-xs text-amber-50">
                                        <div className="truncate">
                                          <span className="font-medium">{candidate.title}</span> - {candidate.artist}
                                          {meta.length > 0 ? ` (${meta.join(':')})` : ''}
                                        </div>
                                        <div className="text-[11px] text-amber-100/80">
                                          Match {Math.round(candidate.score * 100)}%
                                        </div>
                                      </div>
                                      <button
                                        disabled={resolvingTrackKey === candidate.track_key}
                                        onClick={() => void addUnmatchedCandidate(row, candidate)}
                                        className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${
                                          resolvingTrackKey === candidate.track_key
                                            ? 'cursor-not-allowed border-[#3d4a65] bg-[#1f2a41] text-[#8094b9]'
                                            : 'border-[#5f9bff] bg-[#1f4f89] text-white hover:bg-[#2866b1]'
                                        }`}
                                      >
                                        {resolvingTrackKey === candidate.track_key ? 'Adding...' : 'Add'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PlaylistStudioModal;

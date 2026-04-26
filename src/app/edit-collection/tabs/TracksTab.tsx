'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { Album } from 'types/album';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PickerModal } from '../pickers/PickerModal';
import { ManageModal } from '../pickers/ManageModal';
import { EditModal } from '../pickers/EditModal';
import {
  fetchStorageDevices,
  fetchTags,
  addTagToRecording,
  removeTagFromRecording,
  type PickerDataItem,
} from '../pickers/pickerDataUtils';
import { UniversalPicker } from '../pickers/UniversalPicker';
import { applyAutoCap, DEFAULT_EXCEPTIONS } from '../settings/AutoCapExceptions';
import {
  importTracksFromDiscogs,
  importTracksFromSpotify,
  getSpotifyAccessToken,
} from './trackImportUtils';
import type { AutoCapMode } from '../settings/AutoCapSettings';

interface Track {
  id: string;
  position: number;
  title: string;
  artist: string;
  duration: string;
  note: string;
  disc_number: number;
  side?: string; // Vinyl side (A, B, C, D, etc.)
  is_header?: boolean;
  lyrics_url?: string;
  is_cover?: boolean | null;
  original_artist?: string;
  original_year?: number | null;
  time_signature?: number | null;
  credits?: Record<string, unknown> | null;
  recording_id?: number | null;
  track_tags?: string[];
}

const inferSideFromPosition = (position: string | null | undefined): string | undefined => {
  if (!position) return undefined;
  const match = position.trim().toUpperCase().match(/^([A-Z])/);
  return match?.[1];
};

const parseTrackPositionNumber = (
  rawPosition: string | number | null | undefined,
  fallback: number
): number => {
  if (typeof rawPosition === 'number' && Number.isFinite(rawPosition) && rawPosition > 0) {
    return rawPosition;
  }

  const text = String(rawPosition ?? '').trim();
  if (!text) return fallback;

  const numericLike = Number(text);
  if (Number.isFinite(numericLike) && numericLike > 0) {
    return numericLike;
  }

  const matches = text.match(/\d+/g);
  if (matches && matches.length > 0) {
    const parsed = Number(matches[matches.length - 1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
};

interface Disc {
  disc_number: number;
  title: string;
  storage_device: string;
  slot: string;
  matrix_side_a: string;
  matrix_side_b: string;
}

interface TracksTabProps {
  album: Album;
  onChange: (field: keyof Album, value: unknown) => void;
}

// Export interface for parent component
export interface TracksTabRef {
  getTracksData: () => TracksData;
}

// Data structure for saving tracks
export interface TracksData {
  tracks: Array<{
    position: string;
    title: string;
    artist: string | null;
    duration: string | null;
    note?: string | null;
    type: 'track' | 'header';
    disc_number: number;
    side?: string;
    lyrics_url?: string | null;
    is_cover?: boolean | null;
    original_artist?: string | null;
    original_year?: number | null;
    time_signature?: number | null;
    credits?: Record<string, unknown> | null;
  }>;
  disc_metadata: Array<{
    disc_number: number;
    title: string;
    storage_device: string | null;
    slot: string | null;
  }>;
  matrix_numbers: {
    [disc_number: string]: {
      side_a: string;
      side_b: string;
    };
  };
}

// Sortable Track Row Component
function SortableTrackRow({
  track,
  isSelected,
  onToggleSelect,
  onUpdate,
  onRemoveTrackTag,
  onAddTrackTag,
  onOpenTrackTagPicker,
  availableTagNames,
}: {
  track: Track;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, field: keyof Track, value: string | number | boolean | null) => void;
  onRemoveTrackTag: (id: string, tagName: string) => void;
  onAddTrackTag: (id: string, tagName: string) => void;
  onOpenTrackTagPicker: (id: string) => void;
  availableTagNames: string[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [tagInputValue, setTagInputValue] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const existingTagSet = new Set(track.track_tags ?? []);
  const filteredSuggestions = tagInputValue.trim()
    ? availableTagNames
        .filter((name) => name.toLowerCase().includes(tagInputValue.toLowerCase()) && !existingTagSet.has(name))
        .slice(0, 8)
    : [];

  const submitTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || existingTagSet.has(trimmed)) return;
    onAddTrackTag(track.id, trimmed);
    setTagInputValue('');
    setShowTagSuggestions(false);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitTag(filteredSuggestions[0] ?? tagInputValue);
    } else if (e.key === 'Escape') {
      setTagInputValue('');
      setShowTagSuggestions(false);
      tagInputRef.current?.blur();
    }
  };

  // Header row styling
  if (track.is_header) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="grid grid-cols-[40px_40px_60px_1fr_200px_220px_80px] py-2 items-center bg-gray-50 border-y border-gray-200 text-gray-500 font-semibold text-sm"
      >
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(track.id)}
            className="cursor-pointer"
          />
        </div>
        <div className="flex justify-center cursor-grab active:cursor-grabbing text-gray-400" {...attributes} {...listeners}>
          <span className="text-base">≡</span>
        </div>
        <div className="text-center text-gray-500">
          <span className="text-lg">▬</span>
        </div>
        <div className="italic text-gray-500 col-span-3 px-2">
          {track.title || 'Add tracks to this header'}
        </div>
        <div></div>
      </div>
    );
  }

  // Regular track row
  const positionLabel = track.side ? `${track.side}${track.position}` : String(track.position);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 bg-white hover:bg-gray-50"
    >
      <div className="grid grid-cols-[40px_40px_60px_1fr_200px_220px_80px] py-2 items-center">
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(track.id)}
            className="cursor-pointer"
          />
        </div>
        <div className="flex justify-center cursor-grab active:cursor-grabbing text-gray-400" {...attributes} {...listeners}>
          <span className="text-base">≡</span>
        </div>
        <div className="text-center text-gray-500 text-sm">
          {positionLabel}
        </div>
        <div className="px-1">
          <input
            type="text"
            value={track.title}
            onChange={(e) => onUpdate(track.id, 'title', e.target.value)}
            placeholder="Track title"
            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="px-1">
          <input
            type="text"
            value={track.artist}
            onChange={(e) => onUpdate(track.id, 'artist', e.target.value)}
            placeholder="Artist"
            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="px-1">
          <input
            type="text"
            value={track.note}
            onChange={(e) => onUpdate(track.id, 'note', e.target.value)}
            placeholder="Track notes"
            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="px-1">
          <input
            type="text"
            value={track.duration}
            onChange={(e) => onUpdate(track.id, 'duration', e.target.value)}
            placeholder="0:00"
            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="pl-[148px] pr-2 pb-2">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            type="text"
            value={track.lyrics_url || ''}
            onChange={(e) => onUpdate(track.id, 'lyrics_url', e.target.value)}
            placeholder="Lyrics URL"
            className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-900 bg-white focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            value={track.original_artist || ''}
            onChange={(e) => onUpdate(track.id, 'original_artist', e.target.value)}
            placeholder="Original artist"
            className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-900 bg-white focus:outline-none focus:border-blue-500"
          />
          <input
            type="number"
            value={track.original_year ?? ''}
            onChange={(e) => onUpdate(track.id, 'original_year', e.target.value ? parseInt(e.target.value, 10) : null)}
            placeholder="Original year"
            className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-900 bg-white focus:outline-none focus:border-blue-500"
          />
          <input
            type="number"
            value={track.time_signature ?? ''}
            onChange={(e) => onUpdate(track.id, 'time_signature', e.target.value ? parseInt(e.target.value, 10) : null)}
            placeholder="Time sig"
            className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-900 bg-white focus:outline-none focus:border-blue-500"
          />
          <label className="flex items-center gap-2 text-xs text-gray-600 px-2 py-1 border border-gray-200 rounded bg-gray-50">
            <input
              type="checkbox"
              checked={!!track.is_cover}
              onChange={(e) => onUpdate(track.id, 'is_cover', e.target.checked)}
              className="cursor-pointer"
            />
            Cover track
          </label>
        </div>

        {/* Track Tags row */}
        <div className="flex items-start mt-2">
          <div className="relative flex-1 min-h-[28px] px-1.5 py-1 border border-gray-200 rounded-l border-r-0 bg-white flex flex-wrap gap-1 items-center focus-within:border-blue-400">
            {(track.track_tags ?? []).map((tag) => (
              <span key={tag} className="bg-gray-200 px-2 py-0.5 rounded text-xs flex items-center gap-1 text-gray-700 shrink-0">
                {tag}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onRemoveTrackTag(track.id, tag); }}
                  className="bg-transparent border-none text-gray-500 cursor-pointer p-0 text-sm leading-none hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={tagInputRef}
              type="text"
              value={tagInputValue}
              onChange={(e) => { setTagInputValue(e.target.value); setShowTagSuggestions(e.target.value.trim().length > 0); }}
              onFocus={() => { if (tagInputValue.trim()) setShowTagSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
              onKeyDown={handleTagKeyDown}
              placeholder={existingTagSet.size === 0 ? 'Add tag...' : ''}
              className="flex-1 min-w-[80px] text-xs outline-none bg-transparent text-gray-700 placeholder-gray-400 py-0.5"
            />
            {showTagSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-0.5 z-50 bg-white border border-gray-200 rounded shadow-md w-full max-h-[180px] overflow-y-auto">
                {filteredSuggestions.map((name) => (
                  <div
                    key={name}
                    onMouseDown={(e) => { e.preventDefault(); submitTag(name); }}
                    className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer"
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenTrackTagPicker(track.id)}
            className="w-8 min-h-[28px] flex items-center justify-center border border-gray-200 rounded-r bg-white text-gray-500 hover:bg-gray-50"
            title="Browse all tags"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <circle cx="1.5" cy="2.5" r="1"/>
              <rect x="4" y="2" width="10" height="1"/>
              <circle cx="1.5" cy="7" r="1"/>
              <rect x="4" y="6.5" width="10" height="1"/>
              <circle cx="1.5" cy="11.5" r="1"/>
              <rect x="4" y="11" width="10" height="1"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export const TracksTab = forwardRef<TracksTabRef, TracksTabProps>(
  function TracksTab({ album, onChange }, ref) {
  // State for discs and tracks
  const [discs, setDiscs] = useState<Disc[]>([
    {
      disc_number: 1,
      title: 'Disc #1',
      storage_device: '',
      slot: '',
      matrix_side_a: '',
      matrix_side_b: '',
    },
  ]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeDisc, setActiveDisc] = useState(1);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());

  // Storage device picker state
  const [showStoragePicker, setShowStoragePicker] = useState(false);
  const [showManageStorage, setShowManageStorage] = useState(false);
  const [showNewStorageModal, setShowNewStorageModal] = useState(false);
  const [storageDevices, setStorageDevices] = useState<PickerDataItem[]>([]);

  // Track import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSource, setImportSource] = useState<'discogs' | 'spotify'>('discogs');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Track tag picker state: holds the track.id whose picker is open, or null
  const [trackTagPickerOpen, setTrackTagPickerOpen] = useState<string | null>(null);
  // All available tag names for autocomplete
  const [availableTagNames, setAvailableTagNames] = useState<string[]>([]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Expose getTracksData method to parent via ref
  useImperativeHandle(ref, () => ({
    getTracksData: (): TracksData => {
      // Format tracks for database
      const formattedTracks = tracks.map((track) => ({
        position: track.side
          ? `${track.side}${track.position}`
          : track.disc_number && track.disc_number > 1
            ? `${track.disc_number}-${track.position}`
            : track.position.toString(),
        title: track.title,
        artist: track.artist || null,
        duration: track.duration || null,
        note: track.note || null,
        type: track.is_header ? ('header' as const) : ('track' as const),
        disc_number: track.disc_number,
        side: track.side,
        lyrics_url: track.lyrics_url || null,
        is_cover: typeof track.is_cover === 'boolean' ? track.is_cover : null,
        original_artist: track.original_artist || null,
        original_year: typeof track.original_year === 'number' ? track.original_year : null,
        time_signature: typeof track.time_signature === 'number' ? track.time_signature : null,
        credits: track.credits ?? null,
      }));

      // Format disc metadata
      const disc_metadata = discs.map((disc) => ({
        disc_number: disc.disc_number,
        title: disc.title,
        storage_device: disc.storage_device || null,
        slot: disc.slot || null,
      }));

      // Format matrix numbers
      const matrix_numbers: TracksData['matrix_numbers'] = {};
      discs.forEach((disc) => {
        if (disc.matrix_side_a || disc.matrix_side_b) {
          matrix_numbers[disc.disc_number.toString()] = {
            side_a: disc.matrix_side_a || '',
            side_b: disc.matrix_side_b || '',
          };
        }
      });

      return {
        tracks: formattedTracks,
        disc_metadata,
        matrix_numbers,
      };
    },
  }));

  // Load data from album on mount
  useEffect(() => {
    // Load existing tracks and disc metadata from album
    if (album.tracks && Array.isArray(album.tracks) && album.tracks.length > 0) {
      console.log('📀 Loading existing tracks from album:', album.tracks);
      
      // Convert database tracks to internal Track format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loadedTracks: Track[] = album.tracks.map((dbTrack: any, index: number) => {
        if (!dbTrack) return null; // Skip null entries
        const inferredSide = inferSideFromPosition(dbTrack.position);
        return {
          id: `track-${index}`,
          position: parseTrackPositionNumber(dbTrack.position, index + 1),
          title: dbTrack.title || '',
          artist: dbTrack.artist || '',
          duration: dbTrack.duration || '',
          note: dbTrack.note || '',
          disc_number: dbTrack.disc_number || 1,
          side: dbTrack.side || inferredSide,
          is_header: dbTrack.type === 'header',
          lyrics_url: dbTrack.lyrics_url || '',
          is_cover: typeof dbTrack.is_cover === 'boolean' ? dbTrack.is_cover : null,
          original_artist: dbTrack.original_artist || '',
          original_year: typeof dbTrack.original_year === 'number'
            ? dbTrack.original_year
            : (Number.isFinite(Number(dbTrack.original_year)) ? Number(dbTrack.original_year) : null),
          time_signature: typeof dbTrack.time_signature === 'number'
            ? dbTrack.time_signature
            : (Number.isFinite(Number(dbTrack.time_signature)) ? Number(dbTrack.time_signature) : null),
          credits: dbTrack.credits ?? null,
          recording_id: typeof dbTrack.recording_id === 'number' ? dbTrack.recording_id : null,
          track_tags: Array.isArray(dbTrack.track_tags) ? dbTrack.track_tags : [],
        };
      }).filter((t) => t !== null) as Track[];
      
      setTracks(loadedTracks);
      
      // Load disc metadata if available
      if (album.disc_metadata && Array.isArray(album.disc_metadata)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loadedDiscs: Disc[] = album.disc_metadata.map((dbDisc: any) => {
          if (!dbDisc) return null; // Skip null entries
          const discNum = dbDisc.disc_number || 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const matrixData = (album.matrix_numbers as any)?.[discNum.toString()];
          
          return {
            disc_number: discNum,
            title: dbDisc.title || `Disc #${discNum}`,
            storage_device: dbDisc.storage_device || '',
            slot: dbDisc.slot || '',
            matrix_side_a: matrixData?.side_a || '',
            matrix_side_b: matrixData?.side_b || '',
          };
        }).filter((d) => d !== null) as Disc[];
        
        if (loadedDiscs.length > 0) setDiscs(loadedDiscs);
      }
    } else if (album.discs && album.discs > 1) {
      // No saved tracks - initialize empty discs based on disc count
      const newDiscs: Disc[] = [];
      for (let i = 1; i <= album.discs; i++) {
        newDiscs.push({
          disc_number: i,
          title: `Disc #${i}`,
          storage_device: '',
          slot: '',
          matrix_side_a: '',
          matrix_side_b: '',
        });
      }
      setDiscs(newDiscs);
    }
  }, [album]);

  // Load storage devices and available tags for autocomplete
  useEffect(() => {
    loadStorageDevices();
    fetchTags().then((items) => setAvailableTagNames(items.map((t) => t.name)));
  }, []);

  const loadStorageDevices = async () => {
    const devices = await fetchStorageDevices();
    setStorageDevices(devices);
  };

  // Get tracks for active disc
  const activeDiscTracks = tracks.filter(t => t.disc_number === activeDisc);

  // Selection handlers
  const handleToggleSelect = (trackId: string) => {
    const newSelection = new Set(selectedTracks);
    if (newSelection.has(trackId)) {
      newSelection.delete(trackId);
    } else {
      newSelection.add(trackId);
    }
    setSelectedTracks(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedTracks.size === activeDiscTracks.length) {
      setSelectedTracks(new Set());
    } else {
      setSelectedTracks(new Set(activeDiscTracks.map(t => t.id)));
    }
  };

  const handleCancelSelection = () => {
    setSelectedTracks(new Set());
  };

  // Track tag handlers
  const handleAddTrackTag = async (trackId: string, tagName: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track?.recording_id || !tagName) return;
    const ok = await addTagToRecording(track.recording_id, tagName);
    if (ok) {
      setTracks(tracks.map((t) =>
        t.id === trackId
          ? { ...t, track_tags: Array.from(new Set([...(t.track_tags ?? []), tagName])) }
          : t
      ));
      // Keep autocomplete list current if a new tag was just created
      setAvailableTagNames((prev) => prev.includes(tagName) ? prev : [...prev, tagName].sort());
    }
  };

  const handleRemoveTrackTag = async (trackId: string, tagName: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track?.recording_id) return;
    const ok = await removeTagFromRecording(track.recording_id, tagName);
    if (ok) {
      setTracks(tracks.map((t) =>
        t.id === trackId
          ? { ...t, track_tags: (t.track_tags ?? []).filter((tag) => tag !== tagName) }
          : t
      ));
    }
  };

  // Track operations
  const handleUpdateTrack = (trackId: string, field: keyof Track, value: string | number | boolean | null) => {
    setTracks(tracks.map(track =>
      track.id === trackId ? { ...track, [field]: value } : track
    ));
  };

  const handleAddTrack = () => {
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      position: activeDiscTracks.length + 1,
      title: '',
      artist: album.artist || '',
      duration: '0:00',
      note: '',
      disc_number: activeDisc,
      lyrics_url: '',
      is_cover: null,
      original_artist: '',
      original_year: null,
      time_signature: null,
      credits: null,
    };
    setTracks([...tracks, newTrack]);
  };

  const handleAddHeader = () => {
    const newHeader: Track = {
      id: `header-${Date.now()}`,
      position: activeDiscTracks.length + 1,
      title: '',
      artist: '',
      duration: '',
      note: '',
      disc_number: activeDisc,
      is_header: true,
      lyrics_url: '',
      is_cover: null,
      original_artist: '',
      original_year: null,
      time_signature: null,
      credits: null,
    };
    setTracks([...tracks, newHeader]);
  };

  const handleDeleteSelected = () => {
    if (confirm(`Delete ${selectedTracks.size} selected track(s)?`)) {
      setTracks(tracks.filter(track => !selectedTracks.has(track.id)));
      setSelectedTracks(new Set());
    }
  };

  // Auto-cap selected tracks
  const handleAutoCapSelected = () => {
    const autoCapMode = (localStorage.getItem('autoCapMode') as AutoCapMode) || 'FirstExceptions';
    const storedExceptions = localStorage.getItem('autoCapExceptions');
    const exceptions = storedExceptions ? JSON.parse(storedExceptions) : DEFAULT_EXCEPTIONS;

    setTracks(tracks.map(track => {
      if (selectedTracks.has(track.id) && !track.is_header) {
        return {
          ...track,
          title: applyAutoCap(track.title, autoCapMode, exceptions),
        };
      }
      return track;
    }));
  };

  // Move selected tracks to another disc
  const handleMoveToOtherDisc = () => {
    if (discs.length < 2) {
      alert('Add another disc first to move tracks between discs.');
      return;
    }

    const targetDisc = prompt(`Move ${selectedTracks.size} track(s) to which disc? (1-${discs.length})`);
    const targetDiscNum = parseInt(targetDisc || '');

    if (targetDiscNum && targetDiscNum >= 1 && targetDiscNum <= discs.length) {
      setTracks(tracks.map(track => {
        if (selectedTracks.has(track.id)) {
          return { ...track, disc_number: targetDiscNum };
        }
        return track;
      }));
      setSelectedTracks(new Set());
    }
  };

  // Drag and drop handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = activeDiscTracks.findIndex(t => t.id === active.id);
      const newIndex = activeDiscTracks.findIndex(t => t.id === over.id);

      const reorderedDiscTracks = arrayMove(activeDiscTracks, oldIndex, newIndex);

      // Calculate starting position based on tracks from previous discs
      const tracksBeforeThisDisc = tracks.filter(t => t.disc_number < activeDisc);
      const startingPosition = tracksBeforeThisDisc.length + 1;

      // Update positions starting from the correct position
      const updatedDiscTracks = reorderedDiscTracks.map((track, index) => ({
        ...track,
        position: startingPosition + index,
      }));

      // Merge with tracks from other discs
      const otherDiscTracks = tracks.filter(t => t.disc_number !== activeDisc);
      setTracks([...otherDiscTracks, ...updatedDiscTracks]);
    }
  };

  // Disc operations
  const handleAddDisc = () => {
    const newDiscNum = discs.length + 1;
    setDiscs([
      ...discs,
      {
        disc_number: newDiscNum,
        title: `Disc #${newDiscNum}`,
        storage_device: '',
        slot: '',
        matrix_side_a: '',
        matrix_side_b: '',
      },
    ]);
    setActiveDisc(newDiscNum);
    
    // Update album discs count
    onChange('discs', newDiscNum);
  };

  const handleRemoveDisc = (discNum: number) => {
    if (discs.length === 1) {
      alert('Cannot remove the last disc.');
      return;
    }

    if (confirm(`Remove Disc #${discNum} and all its tracks?`)) {
      setDiscs(discs.filter(d => d.disc_number !== discNum));
      setTracks(tracks.filter(t => t.disc_number !== discNum));
      setActiveDisc(1);
      
      // Update album discs count
      onChange('discs', discs.length - 1);
    }
  };

  const handleUpdateDisc = (discNum: number, field: keyof Disc, value: string) => {
    setDiscs(discs.map(disc =>
      disc.disc_number === discNum ? { ...disc, [field]: value } : disc
    ));
  };

  // Track import handlers
  const handleImportTracks = async () => {
    setImporting(true);
    setImportError(null);

    try {
      let importedTracks: Track[] = [];

      if (importSource === 'discogs') {
        // Try to get Discogs release ID from album
        const discogsId = album.discogs_release_id || album.discogs_id;
        if (!discogsId) {
          throw new Error('No Discogs release ID found for this album');
        }

        importedTracks = await importTracksFromDiscogs(discogsId);
      } else if (importSource === 'spotify') {
        // Try to get Spotify album ID from album
        const spotifyId = album.spotify_id || album.spotify_album_id;
        if (!spotifyId) {
          throw new Error('No Spotify album ID found for this album');
        }

        const accessToken = await getSpotifyAccessToken();
        importedTracks = await importTracksFromSpotify(spotifyId, accessToken);
      }

      if (importedTracks.length === 0) {
        throw new Error('No tracks found in API response');
      }

      // Replace existing tracks
      setTracks(importedTracks);

      // Update disc count if multi-disc album detected
      const maxDiscNum = Math.max(...importedTracks.map(t => t.disc_number || 1));
      if (maxDiscNum > 1 && maxDiscNum !== discs.length) {
        const newDiscs: Disc[] = [];
        for (let i = 1; i <= maxDiscNum; i++) {
          newDiscs.push({
            disc_number: i,
            title: `Disc #${i}`,
            storage_device: '',
            slot: '',
            matrix_side_a: '',
            matrix_side_b: '',
          });
        }
        setDiscs(newDiscs);
        onChange('discs', maxDiscNum);
      }

      setShowImportModal(false);
      alert(`Successfully imported ${importedTracks.length} tracks from ${importSource === 'discogs' ? 'Discogs' : 'Spotify'}`);
    } catch (error) {
      console.error('Import error:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import tracks');
    } finally {
      setImporting(false);
    }
  };

  // Get current disc
  const currentDisc = discs.find(d => d.disc_number === activeDisc) || discs[0];

  return (
    <div className="flex flex-col gap-4 p-4 bg-white text-gray-900">
      {/* Disc Tabs */}
      <div className="flex gap-1 border-b border-gray-200 bg-white overflow-x-auto items-center">
        {discs.map(disc => (
          <button
            key={disc.disc_number}
            className={`px-4 py-2 text-sm flex items-center gap-2 border-t border-l border-r rounded-t transition-colors whitespace-nowrap cursor-pointer ${
              activeDisc === disc.disc_number
                ? 'bg-white border-gray-200 border-b-white -mb-px font-medium text-gray-900'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setActiveDisc(disc.disc_number)}
          >
            Disc #{disc.disc_number}
            {discs.length > 1 && (
              <span
                className="ml-1 text-gray-400 hover:text-red-500 text-lg leading-none rounded-full p-0.5 hover:bg-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveDisc(disc.disc_number);
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button 
          className="ml-auto px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-t whitespace-nowrap cursor-pointer bg-transparent border-none" 
          onClick={handleAddDisc}
        >
          + Add Disc
        </button>
      </div>

      {/* Disc Metadata */}
      <div className="bg-white p-4 rounded-md flex flex-col gap-3 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Disc Title</label>
            <input
              type="text"
              value={currentDisc.title}
              onChange={(e) => handleUpdateDisc(activeDisc, 'title', e.target.value)}
              placeholder="Disc #1"
              className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Storage Device</label>
            <div className="flex gap-1">
              <select
                value={currentDisc.storage_device}
                onChange={(e) => {
                  if (e.target.value === '__manage__') {
                    setShowManageStorage(true);
                  } else {
                    handleUpdateDisc(activeDisc, 'storage_device', e.target.value);
                  }
                }}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select...</option>
                {storageDevices.map(device => (
                  <option key={device.id} value={device.name}>{device.name}</option>
                ))}
                <option value="__manage__">Manage Storage Devices...</option>
              </select>
              <button
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-gray-700 cursor-pointer"
                onClick={() => setShowStoragePicker(true)}
              >
                ≡
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Slot</label>
            <input
              type="text"
              value={currentDisc.slot}
              onChange={(e) => handleUpdateDisc(activeDisc, 'slot', e.target.value)}
              placeholder="Slot"
              className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Matrix Nr Side A</label>
            <input
              type="text"
              value={currentDisc.matrix_side_a}
              onChange={(e) => handleUpdateDisc(activeDisc, 'matrix_side_a', e.target.value)}
              placeholder="Side A matrix"
              className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Matrix Nr Side B</label>
            <input
              type="text"
              value={currentDisc.matrix_side_b}
              onChange={(e) => handleUpdateDisc(activeDisc, 'matrix_side_b', e.target.value)}
              placeholder="Side B matrix"
              className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Selection Toolbar (appears when tracks selected) */}
      {selectedTracks.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-500 rounded text-white text-sm flex-wrap shadow-md">
          <button className="text-white hover:bg-blue-600 px-2 py-1 rounded font-medium cursor-pointer bg-transparent border-none" onClick={handleCancelSelection}>
            × Cancel
          </button>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedTracks.size === activeDiscTracks.length}
              onChange={handleSelectAll}
              className="cursor-pointer"
            />
            All
          </label>
          <span className="font-medium">
            {selectedTracks.size} of {activeDiscTracks.length}
          </span>
          <div className="flex gap-2 ml-auto">
            <button className="bg-white text-gray-700 px-3 py-1 rounded hover:bg-gray-100 border-none text-xs font-medium cursor-pointer" onClick={handleAutoCapSelected}>
              Aa Autocap
            </button>
            <button className="bg-white text-gray-700 px-3 py-1 rounded hover:bg-gray-100 border-none text-xs font-medium cursor-pointer" onClick={handleMoveToOtherDisc}>
              ↻ Move to other disc
            </button>
            <button className="bg-white text-gray-700 px-3 py-1 rounded hover:bg-red-50 hover:text-red-600 border-none text-xs font-medium cursor-pointer" onClick={handleDeleteSelected}>
              🗑 Remove
            </button>
          </div>
        </div>
      )}

      {/* Tracks Table */}
      <div className="flex flex-col bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="grid grid-cols-[40px_40px_60px_1fr_200px_220px_80px] py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="text-center"></div>
          <div className="text-center"></div>
          <div className="text-center">#</div>
          <div className="px-2">Title</div>
          <div className="px-2">Artist</div>
          <div className="px-2">Notes</div>
          <div className="px-2">Length</div>
        </div>
        <div className="px-3 py-1.5 text-[11px] text-gray-500 bg-gray-50 border-b border-gray-200">
          Per-track enrichment fields (lyrics URL, cover/original metadata, time signature) are shown below each track row.
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeDiscTracks.map(t => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {activeDiscTracks.map(track => (
              <SortableTrackRow
                key={track.id}
                track={track}
                isSelected={selectedTracks.has(track.id)}
                onToggleSelect={handleToggleSelect}
                onUpdate={handleUpdateTrack}
                onRemoveTrackTag={handleRemoveTrackTag}
                onAddTrackTag={handleAddTrackTag}
                onOpenTrackTagPicker={(id) => setTrackTagPickerOpen(id)}
                availableTagNames={availableTagNames}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add Buttons */}
        <div className="flex gap-3 p-4 flex-wrap border-t border-gray-100 bg-gray-50">
          <button className="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 text-sm hover:bg-gray-50 cursor-pointer shadow-sm" onClick={handleAddHeader}>
            ▬ Add Header
          </button>
          <button className="px-4 py-2 bg-blue-500 border border-blue-600 rounded text-white text-sm hover:bg-blue-600 cursor-pointer shadow-sm" onClick={handleAddTrack}>
            + Add Track
          </button>
          <button 
            className="px-4 py-2 bg-emerald-600 border border-emerald-700 rounded text-white text-sm hover:bg-emerald-700 ml-auto font-medium cursor-pointer shadow-sm flex items-center gap-2" 
            onClick={() => setShowImportModal(true)}
          >
            <span>📥</span> Import Tracks
          </button>
        </div>
      </div>

      {/* Storage Device Picker Modal */}
      {showStoragePicker && (
        <PickerModal
          isOpen={true}
          onClose={() => setShowStoragePicker(false)}
          title="Select Storage Device"
          mode="single"
          items={storageDevices}
          selectedIds={currentDisc.storage_device ? [currentDisc.storage_device] : []}
          onSave={(selectedIds) => {
            if (selectedIds.length > 0) {
              handleUpdateDisc(activeDisc, 'storage_device', selectedIds[0]);
            }
            setShowStoragePicker(false);
          }}
          onManage={() => {
            setShowStoragePicker(false);
            setShowManageStorage(true);
          }}
          onNew={() => {
            setShowNewStorageModal(true);
          }}
          searchPlaceholder="Search storage devices..."
          itemLabel="Storage Device"
          showSortName={false}
        />
      )}

      {/* Manage Storage Devices Modal */}
      {showManageStorage && (
        <ManageModal
          isOpen={true}
          onClose={() => setShowManageStorage(false)}
          title="Manage Storage Devices"
          items={storageDevices}
          onEdit={() => {
            alert('Edit storage device will be implemented with database integration');
          }}
          onDelete={async () => {
            await loadStorageDevices();
          }}
          onMerge={() => {
            alert('Merge storage devices will be implemented with database integration');
          }}
          itemLabel="Storage Device"
          allowMerge={true}
        />
      )}

      {/* New Storage Device Modal */}
      {showNewStorageModal && (
        <EditModal
          isOpen={true}
          onClose={() => setShowNewStorageModal(false)}
          title="New Storage Device"
          itemName=""
          onSave={async (deviceName) => {
            // Add to local state immediately
            const newDevice: PickerDataItem = {
              id: deviceName,
              name: deviceName,
              count: 0,
            };
            setStorageDevices([...storageDevices, newDevice].sort((a, b) => a.name.localeCompare(b.name)));
            
            // Set it as the current storage device
            handleUpdateDisc(activeDisc, 'storage_device', deviceName);
            
            setShowNewStorageModal(false);
          }}
          itemLabel="Storage Device"
        />
      )}

      {/* Import Tracks Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30000]">
          <div className="bg-white rounded-lg p-6 max-w-[550px] w-[90%] shadow-2xl">
            <h3 className="m-0 mb-4 text-gray-900 text-lg font-semibold">
              Import Tracks
            </h3>

            {importError && (
              <div className="p-3 bg-red-100 border border-red-300 rounded mb-4 text-red-800 text-sm">
                {importError}
              </div>
            )}

            {/* Preview Links */}
            <div className="mb-5 p-3 bg-gray-50 rounded-md border border-gray-200">
              <div className="text-xs font-semibold text-gray-700 mb-2">
                Preview track listings:
              </div>
              <div className="flex gap-3">
                {(album.discogs_release_id || album.discogs_id) && (
                  <a
                    href={`https://www.discogs.com/release/${album.discogs_release_id || album.discogs_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 bg-white border border-gray-300 rounded text-center text-blue-600 text-xs font-medium hover:bg-gray-50 decoration-none"
                  >
                    🎵 View on Discogs
                  </a>
                )}
                {(album.spotify_id || album.spotify_album_id) && (
                  <a
                    href={`https://open.spotify.com/album/${album.spotify_id || album.spotify_album_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 bg-white border border-gray-300 rounded text-center text-emerald-600 text-xs font-medium hover:bg-gray-50 decoration-none"
                  >
                    🎧 View on Spotify
                  </a>
                )}
              </div>
            </div>

            <div className="mb-5">
              <p className="m-0 mb-3 text-gray-600 text-sm">
                Choose a source to import track listings:
              </p>

              <div className="flex flex-col gap-3">
                <label className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                  importSource === 'discogs' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="importSource"
                    value="discogs"
                    checked={importSource === 'discogs'}
                    onChange={(e) => setImportSource(e.target.value as 'discogs')}
                    className="mr-3 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">
                      Discogs (Recommended)
                    </div>
                    <div className="text-xs text-gray-500">
                      Most accurate for vinyl - exact pressing-specific track listings
                    </div>
                  </div>
                </label>

                <label className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                  importSource === 'spotify' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="importSource"
                    value="spotify"
                    checked={importSource === 'spotify'}
                    onChange={(e) => setImportSource(e.target.value as 'spotify')}
                    className="mr-3 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">
                      Spotify (Fallback)
                    </div>
                    <div className="text-xs text-gray-500">
                      Generic CD/streaming version - may differ from vinyl
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded mb-5 text-xs text-amber-800 flex items-center gap-2">
              <span>⚠️</span> This will replace all existing tracks for this album
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportError(null);
                }}
                disabled={importing}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm text-gray-700 cursor-pointer hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleImportTracks}
                disabled={importing}
                className="px-4 py-2 bg-blue-600 border-none rounded text-sm text-white font-medium cursor-pointer hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import Tracks'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track tag picker */}
      {trackTagPickerOpen && (() => {
        const openTrack = tracks.find((t) => t.id === trackTagPickerOpen);
        if (!openTrack) return null;
        return (
          <UniversalPicker
            title="Track Tags"
            isOpen={true}
            onClose={() => setTrackTagPickerOpen(null)}
            fetchItems={fetchTags}
            selectedItems={openTrack.track_tags ?? []}
            onSelect={(items) => {
              const current = new Set(openTrack.track_tags ?? []);
              const next = new Set(items);
              const toAdd = items.filter((tag) => !current.has(tag));
              const toRemove = [...current].filter((tag) => !next.has(tag));
              for (const tag of toAdd) handleAddTrackTag(trackTagPickerOpen, tag);
              for (const tag of toRemove) handleRemoveTrackTag(trackTagPickerOpen, tag);
              setTrackTagPickerOpen(null);
            }}
            multiSelect={true}
            canManage={true}
            newItemLabel="Tag"
            manageItemsLabel="Manage Tags"
          />
        );
      })()}
    </div>
  );
});
// AUDIT: updated for UI parity with CLZ reference.

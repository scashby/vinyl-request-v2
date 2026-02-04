'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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
import {
  importTracksFromDiscogs,
  importTracksFromSpotify,
  getSpotifyAccessToken,
} from './trackImportUtils';

interface Track {
  id: string;
  position: number;
  title: string;
  artist: string;
  duration: string;
  side?: string;
  is_header?: boolean;
}

interface TracksTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

export interface TracksTabRef {
  getTracksData: () => TracksData;
}

export interface TracksData {
  tracks: Array<{
    position: string;
    title: string;
    artist: string | null;
    duration: string | null;
    type: 'track' | 'header';
    side?: string;
  }>;
}

type AlbumTrack = NonNullable<Album['tracks']>[number];
type ImportedTrack = {
  title?: string | null;
  artist?: string | null;
  duration?: string | null;
  side?: string | null;
  position?: string | number | null;
};

function SortableTrackRow({
  track,
  isSelected,
  onToggleSelect,
  onUpdate,
}: {
  track: Track;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, field: keyof Track, value: string) => void;
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

  if (track.is_header) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="grid grid-cols-[40px_40px_60px_1fr_200px_80px] py-2 items-center bg-gray-50 border-y border-gray-200 text-gray-500 font-semibold text-sm"
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
        <div className="italic text-gray-500 col-span-2 px-2">
          {track.title || 'Add tracks to this header'}
        </div>
        <div></div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[40px_40px_60px_1fr_200px_80px] py-2 border-b border-gray-100 items-center bg-white hover:bg-gray-50"
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
      <div className="text-center text-gray-500 text-sm">
        {track.side ? `${track.side}${track.position}` : track.position}
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
          value={track.duration}
          onChange={(e) => onUpdate(track.id, 'duration', e.target.value)}
          placeholder="0:00"
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}

export const TracksTab = forwardRef<TracksTabRef, TracksTabProps>(
  function TracksTab({ album }, ref) {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
    const [showImportModal, setShowImportModal] = useState(false);
    const [importSource, setImportSource] = useState<'discogs' | 'spotify'>('discogs');
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);

    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

    useImperativeHandle(ref, () => ({
      getTracksData: (): TracksData => {
        const formattedTracks = tracks.map((track) => ({
          position: track.position.toString(),
          title: track.title,
          artist: track.artist || null,
          duration: track.duration || null,
          type: track.is_header ? ('header' as const) : ('track' as const),
          side: track.side,
        }));

        return { tracks: formattedTracks };
      },
    }));

    useEffect(() => {
      if (album.tracks && Array.isArray(album.tracks) && album.tracks.length > 0) {
        const loadedTracks: Track[] = album.tracks.map((dbTrack: AlbumTrack, index: number) => ({
          id: `track-${index}`,
          position: parseInt(dbTrack.position || '0', 10),
          title: dbTrack.title || '',
          artist: dbTrack.artist || '',
          duration: dbTrack.duration || '',
          side: dbTrack.side || 'A',
          is_header: dbTrack.type === 'header',
        }));
        setTracks(loadedTracks);
      } else {
        setTracks([]);
      }
    }, [album]);

    const handleToggleSelect = (trackId: string) => {
      const newSelection = new Set(selectedTracks);
      if (newSelection.has(trackId)) {
        newSelection.delete(trackId);
      } else {
        newSelection.add(trackId);
      }
      setSelectedTracks(newSelection);
    };

    const handleUpdateTrack = (trackId: string, field: keyof Track, value: string) => {
      setTracks((prev) =>
        prev.map((track) => (track.id === trackId ? { ...track, [field]: value } : track))
      );
    };

    const handleAddTrack = () => {
      const nextPosition = tracks.filter(t => !t.is_header).length + 1;
      setTracks((prev) => [
        ...prev,
        {
          id: `track-${Date.now()}`,
          position: nextPosition,
          title: '',
          artist: '',
          duration: '',
          side: 'A',
        }
      ]);
    };

    const handleDeleteSelected = () => {
      if (selectedTracks.size === 0) return;
      setTracks((prev) => prev.filter(t => !selectedTracks.has(t.id)));
      setSelectedTracks(new Set());
    };

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setTracks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    };

    const handleImport = async () => {
      try {
        setImporting(true);
        setImportError(null);

        let imported: ImportedTrack[] = [];
        if (importSource === 'discogs') {
          if (!album.discogs_release_id) {
            setImportError('Discogs Release ID is required for Discogs import.');
            return;
          }
          imported = await importTracksFromDiscogs(album.discogs_release_id);
        } else {
          if (!album.spotify_album_id) {
            setImportError('Spotify Album ID is required for Spotify import.');
            return;
          }
          const token = await getSpotifyAccessToken();
          imported = await importTracksFromSpotify(album.spotify_album_id, token);
        }

        const formatted = imported.map((track, idx) => ({
          id: `track-${Date.now()}-${idx}`,
          position: idx + 1,
          title: track.title || '',
          artist: track.artist || '',
          duration: track.duration || '',
          side: track.side || 'A',
        }));

        setTracks(formatted);
        setShowImportModal(false);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'Failed to import tracks');
      } finally {
        setImporting(false);
      }
    };

    return (
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-gray-600">
            Tracklist
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 text-xs bg-gray-800 text-white rounded hover:bg-black"
            >
              Import
            </button>
            <button
              onClick={handleAddTrack}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Add Track
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedTracks.size === 0}
              className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              Delete Selected
            </button>
          </div>
        </div>

        <div className="border border-gray-200 rounded">
          <div className="grid grid-cols-[40px_40px_60px_1fr_200px_80px] py-2 bg-gray-100 text-gray-600 text-xs font-semibold">
            <div className="text-center">Sel</div>
            <div className="text-center">Drag</div>
            <div className="text-center">#</div>
            <div className="px-2">Title</div>
            <div className="px-2">Artist</div>
            <div className="px-2">Dur</div>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tracks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tracks.map((track) => (
                <SortableTrackRow
                  key={track.id}
                  track={track}
                  isSelected={selectedTracks.has(track.id)}
                  onToggleSelect={handleToggleSelect}
                  onUpdate={handleUpdateTrack}
                />
              ))}
            </SortableContext>
          </DndContext>
          {tracks.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">No tracks yet.</div>
          )}
        </div>

        {showImportModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[30001]">
            <div className="bg-white rounded-lg w-[420px] p-4 shadow-xl">
              <div className="text-sm font-semibold text-gray-800 mb-3">Import Tracks</div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setImportSource('discogs')}
                  className={`flex-1 px-3 py-2 text-xs rounded border ${importSource === 'discogs' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  Discogs
                </button>
                <button
                  onClick={() => setImportSource('spotify')}
                  className={`flex-1 px-3 py-2 text-xs rounded border ${importSource === 'spotify' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  Spotify
                </button>
              </div>

              {importError && (
                <div className="text-xs text-red-600 mb-2">{importError}</div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-3 py-1.5 text-xs bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

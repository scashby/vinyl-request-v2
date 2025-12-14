// src/app/edit-collection/tabs/TracksTab.tsx
'use client';

import { useState, useEffect } from 'react';
import type { Album } from 'types/album';
import 'styles/tracks-tab.css';
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
import {
  fetchStorageDevices,
  type PickerDataItem,
} from '../pickers/pickerDataUtils';
import { applyAutoCap, DEFAULT_EXCEPTIONS } from '../settings/AutoCapExceptions';
import type { AutoCapMode } from '../settings/AutoCapSettings';

interface Track {
  id: string;
  position: number;
  title: string;
  artist: string;
  duration: string;
  disc_number: number;
  is_header?: boolean;
}

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
  onChange: (field: keyof Album, value: string | number | string[] | null | boolean | Track[]) => void;
}

// Sortable Track Row Component
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

  // Header row styling
  if (track.is_header) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="track-row header-row"
      >
        <div className="track-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(track.id)}
          />
        </div>
        <div className="track-drag" {...attributes} {...listeners}>
          <span className="drag-handle">≡</span>
        </div>
        <div className="track-position">
          <span style={{ fontSize: '18px' }}>▬</span>
        </div>
        <div className="track-title" style={{ fontStyle: 'italic', color: '#6b7280' }}>
          {track.title || 'Add tracks to this header'}
        </div>
        <div className="track-artist"></div>
        <div className="track-length"></div>
      </div>
    );
  }

  // Regular track row
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="track-row"
    >
      <div className="track-checkbox">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(track.id)}
        />
      </div>
      <div className="track-drag" {...attributes} {...listeners}>
        <span className="drag-handle">≡</span>
      </div>
      <div className="track-position">{track.position}</div>
      <div className="track-title">
        <input
          type="text"
          value={track.title}
          onChange={(e) => onUpdate(track.id, 'title', e.target.value)}
          placeholder="Track title"
        />
      </div>
      <div className="track-artist">
        <input
          type="text"
          value={track.artist}
          onChange={(e) => onUpdate(track.id, 'artist', e.target.value)}
          placeholder="Artist"
        />
      </div>
      <div className="track-length">
        <input
          type="text"
          value={track.duration}
          onChange={(e) => onUpdate(track.id, 'duration', e.target.value)}
          placeholder="0:00"
        />
      </div>
    </div>
  );
}

export function TracksTab({ album, onChange }: TracksTabProps) {
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
  const [storageDevices, setStorageDevices] = useState<PickerDataItem[]>([]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load data from album on mount
  useEffect(() => {
    // Load discs from album
    if (album.discs && album.discs > 1) {
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

    // Load tracks from album (assuming tracks field is JSON array)
    // TODO: Parse actual track data from album when database structure is known
    if (album.spotify_total_tracks || album.apple_music_track_count) {
      // Placeholder - will be replaced with actual track data
    }
  }, [album]);

  // Load storage devices
  useEffect(() => {
    loadStorageDevices();
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

  // Track operations
  const handleUpdateTrack = (trackId: string, field: keyof Track, value: string) => {
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
      disc_number: activeDisc,
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
      disc_number: activeDisc,
      is_header: true,
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

      // Update positions
      const updatedDiscTracks = reorderedDiscTracks.map((track, index) => ({
        ...track,
        position: index + 1,
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

  // Get current disc
  const currentDisc = discs.find(d => d.disc_number === activeDisc) || discs[0];

  return (
    <div className="tracks-tab">
      {/* Disc Tabs */}
      <div className="disc-tabs">
        {discs.map(disc => (
          <button
            key={disc.disc_number}
            className={`disc-tab ${activeDisc === disc.disc_number ? 'active' : ''}`}
            onClick={() => setActiveDisc(disc.disc_number)}
          >
            Disc #{disc.disc_number}
            {discs.length > 1 && (
              <span
                className="disc-tab-close"
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
        <button className="disc-tab add-disc" onClick={handleAddDisc}>
          + Add Disc
        </button>
      </div>

      {/* Disc Metadata */}
      <div className="disc-metadata">
        <div className="disc-metadata-row">
          <div className="disc-metadata-field">
            <label>Disc Title</label>
            <input
              type="text"
              value={currentDisc.title}
              onChange={(e) => handleUpdateDisc(activeDisc, 'title', e.target.value)}
              placeholder="Disc #1"
            />
          </div>
          <div className="disc-metadata-field">
            <label>Storage Device</label>
            <div className="picker-input">
              <select
                value={currentDisc.storage_device}
                onChange={(e) => {
                  if (e.target.value === '__manage__') {
                    setShowManageStorage(true);
                  } else {
                    handleUpdateDisc(activeDisc, 'storage_device', e.target.value);
                  }
                }}
              >
                <option value="">Select...</option>
                {storageDevices.map(device => (
                  <option key={device.id} value={device.name}>{device.name}</option>
                ))}
                <option value="__manage__">Manage Storage Devices...</option>
              </select>
              <button
                className="picker-button"
                onClick={() => setShowStoragePicker(true)}
              >
                ≡
              </button>
            </div>
          </div>
          <div className="disc-metadata-field">
            <label>Slot</label>
            <input
              type="text"
              value={currentDisc.slot}
              onChange={(e) => handleUpdateDisc(activeDisc, 'slot', e.target.value)}
              placeholder="Slot"
            />
          </div>
        </div>
        <div className="disc-metadata-row">
          <div className="disc-metadata-field">
            <label>Matrix Nr Side A</label>
            <input
              type="text"
              value={currentDisc.matrix_side_a}
              onChange={(e) => handleUpdateDisc(activeDisc, 'matrix_side_a', e.target.value)}
              placeholder="Side A matrix"
            />
          </div>
          <div className="disc-metadata-field">
            <label>Matrix Nr Side B</label>
            <input
              type="text"
              value={currentDisc.matrix_side_b}
              onChange={(e) => handleUpdateDisc(activeDisc, 'matrix_side_b', e.target.value)}
              placeholder="Side B matrix"
            />
          </div>
        </div>
      </div>

      {/* Selection Toolbar (appears when tracks selected) */}
      {selectedTracks.size > 0 && (
        <div className="selection-toolbar">
          <button className="selection-cancel" onClick={handleCancelSelection}>
            × Cancel
          </button>
          <label className="selection-all">
            <input
              type="checkbox"
              checked={selectedTracks.size === activeDiscTracks.length}
              onChange={handleSelectAll}
            />
            All
          </label>
          <span className="selection-count">
            {selectedTracks.size} of {activeDiscTracks.length}
          </span>
          <button className="selection-action" onClick={handleAutoCapSelected}>
            Aa Autocap
          </button>
          <button className="selection-action" onClick={handleMoveToOtherDisc}>
            ↻ Move to other disc
          </button>
          <button className="selection-action delete" onClick={handleDeleteSelected}>
            🗑 Remove
          </button>
        </div>
      )}

      {/* Tracks Table */}
      <div className="tracks-section">
        <div className="tracks-header-row">
          <div className="track-checkbox"></div>
          <div className="track-drag"></div>
          <div className="track-position"></div>
          <div className="track-title">Title</div>
          <div className="track-artist">Artist</div>
          <div className="track-length">Length</div>
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
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add Buttons */}
        <div className="tracks-add-buttons">
          <button className="add-header-button" onClick={handleAddHeader}>
            ▬ Add Header
          </button>
          <button className="add-track-button" onClick={handleAddTrack}>
            + Add Track
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
            const deviceName = prompt('Enter new storage device name:');
            if (deviceName) {
              // TODO: Add new storage device to database
              alert('Storage device creation will be implemented with database integration');
            }
          }}
          searchPlaceholder="Search storage devices..."
          itemLabel="Storage Device"
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
            // TODO: Edit storage device
            alert('Edit storage device will be implemented with database integration');
          }}
          onDelete={async () => {
            // TODO: Delete storage device from database
            await loadStorageDevices();
          }}
          onMerge={() => {
            // TODO: Merge storage devices
            alert('Merge storage devices will be implemented with database integration');
          }}
          itemLabel="Storage Device"
          allowMerge={true}
        />
      )}
    </div>
  );
}
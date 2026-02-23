'use client';

import { useEffect, useState } from 'react';
import type { CollectionPlaylist } from '../../../types/collectionPlaylist';
import { SHARED_COLOR_PRESETS, SHARED_ICON_PRESETS } from '../iconPresets';

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

interface NewPlaylistModalProps {
  isOpen: boolean;
  editingPlaylist: CollectionPlaylist | null;
  onClose: () => void;
  onCreate: (playlist: { name: string; icon: string; color: string }) => Promise<void>;
  onUpdate: (playlist: CollectionPlaylist) => Promise<void>;
}

export function NewPlaylistModal({ isOpen, editingPlaylist, onClose, onCreate, onUpdate }: NewPlaylistModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎵');
  const [color, setColor] = useState('#3578b3');
  const [iconSearch, setIconSearch] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  const [tracks, setTracks] = useState<PlaylistTrackItem[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [trackSearchQuery, setTrackSearchQuery] = useState('');
  const [trackSearching, setTrackSearching] = useState(false);
  const [trackSearchResults, setTrackSearchResults] = useState<InventorySearchCandidate[]>([]);
  const isEditing = !!editingPlaylist;

  useEffect(() => {
    if (!isOpen) return;
    if (editingPlaylist) {
      setName(editingPlaylist.name);
      setIcon(editingPlaylist.icon);
      setColor(editingPlaylist.color);
      setCustomIcon(editingPlaylist.icon);
      setTracks([]);
      setTracksError(null);
      setTrackSearchQuery('');
      setTrackSearchResults([]);
      return;
    }
    setName('');
    setIcon('🎵');
    setColor('#3578b3');
    setIconSearch('');
    setCustomIcon('');
    setTracks([]);
    setTracksError(null);
    setTrackSearchQuery('');
    setTrackSearchResults([]);
  }, [editingPlaylist, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!editingPlaylist) return;
    if (editingPlaylist.isSmart) return;

    let active = true;
    const load = async () => {
      setTracksLoading(true);
      setTracksError(null);
      try {
        const res = await fetch(`/api/playlists/${editingPlaylist.id}/tracks`, { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || `Failed to load playlist tracks (${res.status})`);
        const items = Array.isArray(payload?.items) ? (payload.items as PlaylistTrackItem[]) : [];
        if (!active) return;
        setTracks(items);
      } catch (err) {
        if (!active) return;
        setTracksError(err instanceof Error ? err.message : 'Failed to load playlist tracks');
        // Fall back to showing track keys if the resolver route fails.
        setTracks(
          (editingPlaylist.trackKeys ?? []).map((trackKey, index) => ({
            track_key: trackKey,
            sort_order: index,
            track_title: null,
            artist_name: null,
            album_name: null,
            side: null,
            position: null,
          }))
        );
      } finally {
        if (active) setTracksLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [editingPlaylist, isOpen]);

  useEffect(() => {
    const q = trackSearchQuery.trim();
    if (!isOpen) return;
    if (!editingPlaylist) return;
    if (editingPlaylist.isSmart) return;

    if (q.length < 2) {
      setTrackSearching(false);
      setTrackSearchResults([]);
      return;
    }

    const controller = new AbortController();
    setTrackSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const url = new URL('/api/inventory/tracks/search', window.location.origin);
        url.searchParams.set('q', q);
        url.searchParams.set('limit', '8');
        const res = await fetch(url.toString(), { signal: controller.signal });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || `Search failed (${res.status})`);
        setTrackSearchResults(Array.isArray(payload?.results) ? payload.results : []);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setTracksError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setTrackSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [editingPlaylist, isOpen, trackSearchQuery]);

  const firstIconFromInput = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return Array.from(trimmed)[0] ?? '';
  };

  const filteredIcons = SHARED_ICON_PRESETS.filter((preset) => {
    const q = iconSearch.trim().toLowerCase();
    if (!q) return true;
    return preset.icon.includes(q) || preset.keywords.some((keyword) => keyword.includes(q));
  });

  const handleClose = () => {
    setName('');
    setIcon('🎵');
    setColor('#3578b3');
    setIconSearch('');
    setCustomIcon('');
    setTracks([]);
    setTracksError(null);
    setTrackSearchQuery('');
    setTrackSearchResults([]);
    onClose();
  };

  if (!isOpen) return null;

  const isManualEditing = Boolean(editingPlaylist && !editingPlaylist.isSmart);
  const dedupedTrackKeys = Array.from(new Set(tracks.map((t) => t.track_key).filter(Boolean)));

  const moveTrack = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= tracks.length) return;
    const next = [...tracks];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    const normalized = next.map((row, idx) => ({ ...row, sort_order: idx }));
    setTracks(normalized);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30002]" onClick={handleClose}>
      <div className="bg-white rounded-lg w-[760px] max-h-[86vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">{isEditing ? 'Edit Playlist' : 'New Playlist'}</h2>
          <button onClick={handleClose} className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 p-0 leading-none hover:text-gray-700">×</button>
        </div>
        <div className="p-6 overflow-y-auto">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Playlist Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Bingo Round 1"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-5"
          />
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Icon</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={customIcon}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomIcon(value);
                  const parsed = firstIconFromInput(value);
                  if (parsed) setIcon(parsed);
                }}
                placeholder="Paste any emoji"
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
              <input
                type="text"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder="Filter"
                className="w-[110px] px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="flex gap-2 flex-wrap max-h-[280px] overflow-y-auto pr-1">
              {filteredIcons.map((preset) => (
                <button
                  key={preset.icon}
                  onClick={() => {
                    setIcon(preset.icon);
                    setCustomIcon(preset.icon);
                  }}
                  className={`w-12 h-12 border rounded-md cursor-pointer text-2xl flex items-center justify-center ${icon === preset.icon ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
                  title={preset.keywords.join(', ')}
                >
                  {preset.icon}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {SHARED_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setColor(preset)}
                  className={`w-12 h-12 rounded-md cursor-pointer ${color === preset ? 'border-[3px] border-gray-900' : 'border border-gray-300'}`}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-2 w-14 h-8 border border-gray-300 rounded cursor-pointer" />
          </div>

          <div className="p-4 bg-gray-50 rounded-md flex items-center gap-3 border border-gray-200">
            <div className="text-4xl leading-none" style={{ color }}>
              {icon}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{name || 'Untitled Playlist'}</div>
              <div className="text-xs text-gray-500">Track Playlist</div>
            </div>
          </div>

          {isManualEditing && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-900">Tracks</div>
                <div className="text-xs text-gray-500">{dedupedTrackKeys.length} track{dedupedTrackKeys.length !== 1 ? 's' : ''}</div>
              </div>

              {tracksError && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {tracksError}
                </div>
              )}

              <div className="mb-2">
                <input
                  value={trackSearchQuery}
                  onChange={(e) => setTrackSearchQuery(e.target.value)}
                  placeholder="Search your inventory to add tracks..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                />
                {trackSearching ? (
                  <div className="mt-1 text-xs text-gray-500">Searching…</div>
                ) : trackSearchResults.length > 0 ? (
                  <div className="mt-2 border border-gray-200 rounded bg-white max-h-52 overflow-y-auto">
                    {trackSearchResults.map((candidate) => {
                      const already = dedupedTrackKeys.includes(candidate.track_key);
                      const metaParts: string[] = [];
                      if (candidate.inventory_id) metaParts.push(`#${candidate.inventory_id}`);
                      if (candidate.position) metaParts.push(String(candidate.position));
                      const meta = metaParts.length ? ` (${metaParts.join(':')})` : '';
                      return (
                        <button
                          key={candidate.track_key}
                          disabled={already}
                          onClick={() => {
                            setTracksError(null);
                            setTracks((prev) => {
                              const exists = prev.some((t) => t.track_key === candidate.track_key);
                              if (exists) return prev;
                              const next = [
                                ...prev,
                                {
                                  track_key: candidate.track_key,
                                  sort_order: prev.length,
                                  track_title: candidate.title,
                                  artist_name: candidate.artist,
                                  album_name: null,
                                  side: candidate.side ?? null,
                                  position: candidate.position ?? null,
                                },
                              ];
                              return next;
                            });
                            setTrackSearchQuery('');
                            setTrackSearchResults([]);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm border-b border-gray-100 ${already ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                        >
                          <div className="text-[13px] text-gray-900">
                            <span className="font-medium">{candidate.title}</span> - {candidate.artist}{meta}
                          </div>
                          <div className="text-xs text-gray-500">
                            Match {Math.round(candidate.score * 100)}%
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {tracksLoading ? (
                <div className="text-sm text-gray-500">Loading playlist tracks…</div>
              ) : tracks.length === 0 ? (
                <div className="text-sm text-gray-500">No tracks yet. Add some above.</div>
              ) : (
                <div className="border border-gray-200 rounded">
                  <div className="max-h-[320px] overflow-y-auto">
                    {tracks.map((row, idx) => {
                      const title = row.track_title ?? row.track_key;
                      const subtitleParts = [
                        row.artist_name,
                        row.album_name,
                        row.side && row.position ? `${row.side}${row.position}` : row.position,
                      ].filter(Boolean);
                      return (
                        <div key={`${row.track_key}-${idx}`} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveTrack(idx, 'up')}
                              disabled={idx === 0}
                              className={`w-6 h-5 border border-gray-300 rounded text-xs flex items-center justify-center ${idx === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-50'}`}
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => moveTrack(idx, 'down')}
                              disabled={idx === tracks.length - 1}
                              className={`w-6 h-5 border border-gray-300 rounded text-xs flex items-center justify-center ${idx === tracks.length - 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-50'}`}
                            >
                              ▼
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-gray-900 truncate">{title}</div>
                            {subtitleParts.length > 0 && (
                              <div className="text-xs text-gray-500 truncate">{subtitleParts.join(' • ')}</div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setTracks((prev) => {
                                const next = prev.filter((_, i) => i !== idx);
                                return next.map((item, i) => ({ ...item, sort_order: i }));
                              });
                            }}
                            className="px-2 py-1 rounded text-xs bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={handleClose} className="px-4 py-2 bg-gray-100 text-gray-700 border-none rounded text-sm font-medium cursor-pointer hover:bg-gray-200">Cancel</button>
          <button
            onClick={async () => {
              if (!name.trim()) return;
              if (editingPlaylist) {
                await onUpdate({
                  ...editingPlaylist,
                  name: name.trim(),
                  icon,
                  color,
                  trackKeys: editingPlaylist.isSmart ? editingPlaylist.trackKeys : dedupedTrackKeys,
                });
              } else {
                await onCreate({ name: name.trim(), icon, color });
              }
              handleClose();
            }}
            disabled={!name.trim()}
            className={`px-4 py-2 text-white border-none rounded text-sm font-medium cursor-pointer ${name.trim() ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}
          >
            {isEditing ? 'Save Changes' : 'Create Playlist'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewPlaylistModal;

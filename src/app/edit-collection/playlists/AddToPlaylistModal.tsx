'use client';

import { useEffect, useState } from 'react';
import type { CollectionPlaylist } from '../../../types/collectionPlaylist';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: CollectionPlaylist[];
  selectedTrackCount: number;
  onAdd: (playlistIds: number[]) => void;
  onOpenNewPlaylist: () => void;
}

export function AddToPlaylistModal({
  isOpen,
  onClose,
  playlists,
  selectedTrackCount,
  onAdd,
  onOpenNewPlaylist
}: AddToPlaylistModalProps) {
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedPlaylistIds(new Set());
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const manualPlaylists = playlists.filter((playlist) => !playlist.isSmart);
  const filteredPlaylists = manualPlaylists.filter((playlist) => playlist.name.toLowerCase().includes(query.toLowerCase()));

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
              {manualPlaylists.length === 0 ? 'No manual playlists available. Smart playlists auto-populate from rules.' : 'No playlists match your search.'}
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

export default AddToPlaylistModal;

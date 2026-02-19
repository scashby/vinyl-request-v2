'use client';

import { useEffect, useState } from 'react';
import type { CollectionPlaylist } from '../../../types/collectionPlaylist';

interface ManagePlaylistsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: CollectionPlaylist[];
  onReorder: (playlists: CollectionPlaylist[]) => Promise<void>;
  onDelete: (playlistId: number, playlistName: string) => Promise<void>;
  onEdit: (playlist: CollectionPlaylist) => void;
  onEditSmart: (playlist: CollectionPlaylist) => void;
  onOpenNewPlaylist: () => void;
  onOpenNewSmartPlaylist: () => void;
}

export function ManagePlaylistsModal({
  isOpen,
  onClose,
  playlists,
  onReorder,
  onDelete,
  onEdit,
  onEditSmart,
  onOpenNewPlaylist,
  onOpenNewSmartPlaylist
}: ManagePlaylistsModalProps) {
  const [localPlaylists, setLocalPlaylists] = useState<CollectionPlaylist[]>(playlists);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalPlaylists(playlists);
    }
  }, [isOpen, playlists]);

  if (!isOpen) return null;

  const movePlaylist = async (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= localPlaylists.length) return;
    const next = [...localPlaylists];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setLocalPlaylists(next);
    setError(null);

    try {
      setReordering(true);
      await onReorder(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder playlists');
      setLocalPlaylists(playlists);
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30002]" onClick={onClose}>
      <div className="bg-white rounded-lg w-[860px] max-h-[86vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">Manage Playlists</h2>
          <div className="flex items-center gap-2">
            <button onClick={onOpenNewPlaylist} className="px-3 py-1.5 bg-blue-500 text-white border-none rounded text-xs font-medium cursor-pointer flex items-center gap-1 hover:bg-blue-600">
              <span>🎵</span>
              <span>New Playlist</span>
            </button>
            <button onClick={onOpenNewSmartPlaylist} className="px-3 py-1.5 bg-violet-500 text-white border-none rounded text-xs font-medium cursor-pointer flex items-center gap-1 hover:bg-violet-600">
              <span>⚡</span>
              <span>New Smart</span>
            </button>
            <button onClick={onClose} className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 p-0 leading-none hover:text-gray-700">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-md text-red-800 text-sm">
              {error}
            </div>
          )}
          {localPlaylists.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">No playlists yet. Create your first playlist!</div>
          ) : (
            <div className="flex flex-col gap-2">
              {localPlaylists.map((playlist, index) => (
                <div key={playlist.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => movePlaylist(index, 'up')}
                      disabled={reordering || index === 0}
                      className={`w-6 h-5 border border-gray-300 rounded text-xs flex items-center justify-center ${index === 0 || reordering ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-50'}`}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => movePlaylist(index, 'down')}
                      disabled={reordering || index === localPlaylists.length - 1}
                      className={`w-6 h-5 border border-gray-300 rounded text-xs flex items-center justify-center ${index === localPlaylists.length - 1 || reordering ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-50'}`}
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="text-3xl leading-none flex items-center justify-center">
                      {playlist.isSmart ? <span style={{ color: playlist.color }}>⚡</span> : <span style={{ color: playlist.color }}>{playlist.icon}</span>}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 mb-0.5">{playlist.name}</div>
                      <div className="text-xs text-gray-500">
                        {playlist.isSmart
                          ? `Smart Playlist • ${playlist.smartRules?.rules?.length || 0} rule(s) • ${playlist.matchRules === 'all' ? 'Match All' : 'Match Any'}${playlist.smartRules?.maxTracks ? ` • Max ${playlist.smartRules.maxTracks}` : ''}${playlist.liveUpdate ? ' • Live Update' : ''}`
                          : `Manual Playlist • ${playlist.trackKeys.length} track${playlist.trackKeys.length !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => (playlist.isSmart ? onEditSmart(playlist) : onEdit(playlist))} className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 rounded text-xs cursor-pointer font-medium hover:bg-gray-50">
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        setDeletingId(playlist.id);
                        setError(null);
                        try {
                          await onDelete(playlist.id, playlist.name);
                          setLocalPlaylists((prev) => prev.filter((item) => item.id !== playlist.id));
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to delete playlist');
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                      disabled={deletingId === playlist.id || reordering}
                      className={`px-3 py-1.5 bg-red-500 text-white border-none rounded text-xs cursor-pointer ${deletingId === playlist.id || reordering ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'}`}
                    >
                      {deletingId === playlist.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-blue-500 text-white border-none rounded text-sm font-medium cursor-pointer hover:bg-blue-600">Done</button>
        </div>
      </div>
    </div>
  );
}

export default ManagePlaylistsModal;

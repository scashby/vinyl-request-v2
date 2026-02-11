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
  onOpenNewPlaylist: () => void;
}

export function ManagePlaylistsModal({
  isOpen,
  onClose,
  playlists,
  onReorder,
  onDelete,
  onEdit,
  onOpenNewPlaylist
}: ManagePlaylistsModalProps) {
  const [localPlaylists, setLocalPlaylists] = useState<CollectionPlaylist[]>(playlists);
  const [savingOrder, setSavingOrder] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalPlaylists(playlists);
    }
  }, [isOpen, playlists]);

  if (!isOpen) return null;

  const movePlaylist = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= localPlaylists.length) return;
    const next = [...localPlaylists];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setLocalPlaylists(next);
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    setError(null);
    try {
      await onReorder(localPlaylists);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save playlist order');
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30002]" onClick={onClose}>
      <div className="bg-white rounded-lg w-[620px] max-h-[80vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">Manage Playlists</h2>
          <div className="flex items-center gap-2">
            <button onClick={onOpenNewPlaylist} className="px-3 py-1.5 bg-blue-500 text-white border-none rounded text-xs font-medium cursor-pointer hover:bg-blue-600">New Playlist</button>
            <button onClick={onClose} className="bg-transparent border-none text-2xl cursor-pointer text-gray-500">×</button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-md text-red-800 text-sm">
              {error}
            </div>
          )}
          {localPlaylists.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">No playlists yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {localPlaylists.map((playlist, index) => (
                <div key={playlist.id} className="flex items-center gap-3 p-3 border border-gray-200 bg-gray-50 rounded">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => movePlaylist(index, 'up')} disabled={index === 0} className={`w-6 h-5 rounded border text-[10px] ${index === 0 ? 'border-gray-200 text-gray-300' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-100'}`}>▲</button>
                    <button onClick={() => movePlaylist(index, 'down')} disabled={index === localPlaylists.length - 1} className={`w-6 h-5 rounded border text-[10px] ${index === localPlaylists.length - 1 ? 'border-gray-200 text-gray-300' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-100'}`}>▼</button>
                  </div>
                  <div className="text-2xl" style={{ color: playlist.color }}>{playlist.icon}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">{playlist.name}</div>
                    <div className="text-xs text-gray-500">{playlist.trackKeys.length} tracks</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(playlist)}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs cursor-pointer hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        setDeletingId(playlist.id);
                        try {
                          await onDelete(playlist.id, playlist.name);
                          setLocalPlaylists((prev) => prev.filter((item) => item.id !== playlist.id));
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                      disabled={deletingId === playlist.id}
                      className={`px-3 py-1.5 bg-red-500 text-white border-none rounded text-xs cursor-pointer hover:bg-red-600 ${deletingId === playlist.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {deletingId === playlist.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} disabled={savingOrder} className="px-4 py-2 bg-gray-100 text-gray-700 border-none rounded text-sm cursor-pointer hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
          <button
            onClick={handleSaveOrder}
            disabled={savingOrder}
            className="px-4 py-2 bg-blue-500 text-white border-none rounded text-sm cursor-pointer hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingOrder ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManagePlaylistsModal;

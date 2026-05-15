'use client';

import { useEffect, useMemo, useState } from 'react';

export type TrackContextMenuPlaylist = {
  id: number;
  name: string;
  icon: string;
  containsTrack: boolean;
  disabled?: boolean;
};

interface TrackContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  playlists: TrackContextMenuPlaylist[];
  busy?: boolean;
  onClose: () => void;
  onTogglePlaylist: (playlistId: number, containsTrack: boolean) => void | Promise<void>;
  onCreatePlaylist: () => void | Promise<void>;
  onRemoveFromCurrent?: () => void | Promise<void>;
  currentPlaylistName?: string;
}

const MENU_WIDTH = 272;
const SUBMENU_WIDTH = 300;
const VIEWPORT_PADDING = 8;

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export default function TrackContextMenu({
  isOpen,
  x,
  y,
  playlists,
  busy = false,
  onClose,
  onTogglePlaylist,
  onCreatePlaylist,
  onRemoveFromCurrent,
  currentPlaylistName,
}: TrackContextMenuProps) {
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowPlaylistSubmenu(false);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const menuPosition = useMemo(() => {
    if (typeof window === 'undefined') {
      return { left: x, top: y };
    }
    return {
      left: clamp(x, VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING),
      top: clamp(y, VIEWPORT_PADDING, window.innerHeight - 240 - VIEWPORT_PADDING),
    };
  }, [x, y]);

  const submenuPosition = useMemo(() => {
    if (typeof window === 'undefined') {
      return { left: menuPosition.left + MENU_WIDTH + 4, top: menuPosition.top };
    }

    const preferredRightLeft = menuPosition.left + MENU_WIDTH + 4;
    const canOpenRight = preferredRightLeft + SUBMENU_WIDTH <= window.innerWidth - VIEWPORT_PADDING;
    const left = canOpenRight
      ? preferredRightLeft
      : clamp(menuPosition.left - SUBMENU_WIDTH - 4, VIEWPORT_PADDING, window.innerWidth - SUBMENU_WIDTH - VIEWPORT_PADDING);

    const estimatedHeight = Math.min(340, playlists.length * 34 + 80);
    const top = clamp(menuPosition.top, VIEWPORT_PADDING, window.innerHeight - estimatedHeight - VIEWPORT_PADDING);
    return { left, top };
  }, [menuPosition.left, menuPosition.top, playlists.length]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[21050]" onClick={onClose}>
      <div
        className="fixed w-[272px] rounded-md border border-[#2d3748] bg-[#181a1f] py-1 text-[#e5e7eb] shadow-2xl"
        style={{ left: menuPosition.left, top: menuPosition.top }}
        onClick={(event) => event.stopPropagation()}
        onMouseLeave={() => setShowPlaylistSubmenu(false)}
      >
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#232733]"
          onMouseEnter={() => setShowPlaylistSubmenu(true)}
          onFocus={() => setShowPlaylistSubmenu(true)}
          disabled={busy}
        >
          <span>Add / Remove In Playlist</span>
          <span className="text-xs text-[#9ca3af]">▶</span>
        </button>

        {onRemoveFromCurrent && (
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#232733]"
            onClick={() => void onRemoveFromCurrent()}
            disabled={busy}
          >
            <span>
              Remove From {currentPlaylistName ? `"${currentPlaylistName}"` : 'Current Playlist'}
            </span>
          </button>
        )}

        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#232733]"
          onClick={() => void onCreatePlaylist()}
          disabled={busy}
        >
          <span>Create Playlist And Add Track</span>
        </button>
      </div>

      {showPlaylistSubmenu && (
        <div
          className="fixed w-[300px] rounded-md border border-[#2d3748] bg-[#181a1f] py-1 text-[#e5e7eb] shadow-2xl"
          style={{ left: submenuPosition.left, top: submenuPosition.top }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-[#9ca3af]">Playlists</div>
          <div className="max-h-[320px] overflow-y-auto">
            {playlists.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[#9ca3af]">No editable playlists yet.</div>
            ) : (
              playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#232733] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void onTogglePlaylist(playlist.id, playlist.containsTrack)}
                  disabled={busy || playlist.disabled}
                >
                  <span className="min-w-0 truncate">
                    <span className="mr-2">{playlist.icon}</span>
                    {playlist.name}
                  </span>
                  <span className={`text-xs ${playlist.containsTrack ? 'text-emerald-300' : 'text-[#9ca3af]'}`}>
                    {playlist.containsTrack ? 'Remove' : 'Add'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

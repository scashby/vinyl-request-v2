'use client';

import { useEffect, useState } from 'react';

type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number | null;
  canImport?: boolean;
  importReason?: string | null;
};

interface SpotifyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
}

type PlaylistsPayload = {
  playlists?: SpotifyPlaylist[];
  scope?: string;
  retryAfterSeconds?: number;
  error?: string;
};

let playlistsCache: { expiresAt: number; payload: PlaylistsPayload } | null = null;
const PLAYLISTS_CACHE_TTL_MS = 5 * 60 * 1000;

export function SpotifyImportModal({ isOpen, onClose, onImported }: SpotifyImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [scope, setScope] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const loadPlaylists = async (force = false) => {
      if (!force && playlistsCache && playlistsCache.expiresAt > Date.now()) {
        if (!active) return;
        setIsConnected(true);
        setPlaylists(playlistsCache.payload.playlists ?? []);
        setScope(playlistsCache.payload.scope ?? '');
        setLastLoadedAt(Date.now());
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setLastResult(null);
      try {
        const res = await fetch('/api/spotify/playlists', { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (res.status === 401) {
          if (!active) return;
          setIsConnected(false);
          setPlaylists([]);
          return;
        }
        if (res.status === 429) {
          const wait = typeof payload?.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : null;
          const waitMsg = wait !== null ? ` Retry after about ${Math.ceil(wait / 60)} minute(s).` : '';
          throw new Error((payload?.error || 'Spotify rate limit reached.') + waitMsg);
        }
        if (!res.ok) {
          throw new Error(payload?.error || `Failed to load playlists (${res.status})`);
        }
        if (!active) return;
        const typedPayload = payload as PlaylistsPayload;
        playlistsCache = {
          expiresAt: Date.now() + PLAYLISTS_CACHE_TTL_MS,
          payload: typedPayload,
        };
        setIsConnected(true);
        setPlaylists(typedPayload.playlists ?? []);
        setScope(typedPayload.scope ?? '');
        setLastLoadedAt(Date.now());
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load Spotify playlists');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadPlaylists(false);
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = playlists.filter((playlist) => playlist.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30003]" onClick={onClose}>
      <div className="bg-white rounded-lg w-[760px] max-h-[86vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">Import Spotify Playlist</h2>
          <button onClick={onClose} className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 p-0 leading-none hover:text-gray-700">×</button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto">
          {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}
          {lastResult && <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-sm">{lastResult}</div>}
          {!isConnected ? (
            <div className="text-sm text-gray-700">
              <p className="mb-3">Spotify is not connected.</p>
              <a href="/api/auth/spotify" className="inline-flex items-center px-3 py-2 rounded bg-[#1db954] text-white text-sm font-medium">
                Connect Spotify
              </a>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <a
                  href="/api/auth/spotify"
                  className="inline-flex items-center px-3 py-2 rounded bg-[#1db954] text-white text-xs font-medium"
                >
                  Reconnect Spotify
                </a>
              </div>
              {scope && (
                <div className="mb-3 text-xs text-gray-600">
                  Granted scopes: <code>{scope}</code>
                </div>
              )}
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={async () => {
                    playlistsCache = null;
                    setLoading(true);
                    setError(null);
                    try {
                      const res = await fetch('/api/spotify/playlists', { cache: 'no-store' });
                      const payload = await res.json().catch(() => ({}));
                      if (res.status === 429) {
                        const wait = typeof payload?.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : null;
                        const waitMsg = wait !== null ? ` Retry after about ${Math.ceil(wait / 60)} minute(s).` : '';
                        throw new Error((payload?.error || 'Spotify rate limit reached.') + waitMsg);
                      }
                      if (!res.ok) {
                        throw new Error(payload?.error || `Failed to load playlists (${res.status})`);
                      }
                      const typedPayload = payload as PlaylistsPayload;
                      playlistsCache = {
                        expiresAt: Date.now() + PLAYLISTS_CACHE_TTL_MS,
                        payload: typedPayload,
                      };
                      setIsConnected(true);
                      setPlaylists(typedPayload.playlists ?? []);
                      setScope(typedPayload.scope ?? '');
                      setLastLoadedAt(Date.now());
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to refresh playlists');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="inline-flex items-center px-3 py-2 rounded bg-gray-700 text-white text-xs font-medium"
                >
                  Refresh Playlists
                </button>
                {lastLoadedAt && (
                  <span className="text-xs text-gray-500">
                    Last loaded {new Date(lastLoadedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="mb-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Spotify playlists..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                />
              </div>
              {loading ? (
                <div className="text-sm text-gray-500">Loading Spotify playlists...</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-gray-500">No playlists found.</div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((playlist) => (
                    <div key={playlist.id} className="flex items-center justify-between border border-gray-200 rounded px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{playlist.name}</div>
                        <div className="text-xs text-gray-500">
                          {typeof playlist.trackCount === 'number' ? `${playlist.trackCount} tracks` : 'Track count unavailable'}
                        </div>
                        {!playlist.canImport && (
                          <div className="text-xs text-amber-700">{playlist.importReason || 'Not importable'}</div>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          setImportingId(playlist.id);
                          setError(null);
                          setLastResult(null);
                          try {
                            const res = await fetch('/api/spotify/import', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                playlistId: playlist.id,
                                playlistName: playlist.name,
                              }),
                            });
                            const payload = await res.json().catch(() => ({}));
                            if (!res.ok) {
                              const detail = payload?.details ? ` (${payload.details})` : '';
                              const granted = payload?.scope ? ` [scope: ${payload.scope}]` : '';
                              throw new Error((payload?.error || `Import failed (${res.status})`) + detail + granted);
                            }
                            const partialNote = payload?.partialImport
                              ? ' (partial import: Spotify blocked full track paging, used first-page fallback)'
                              : '';
                            setLastResult(
                              `Imported "${playlist.name}": ${payload.matchedCount} matched, ${payload.unmatchedCount} unmatched${partialNote}`
                            );
                            await onImported();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Import failed');
                          } finally {
                            setImportingId(null);
                          }
                        }}
                        disabled={importingId === playlist.id || playlist.canImport === false}
                        className={`px-3 py-1.5 rounded text-xs font-medium text-white ${importingId === playlist.id || playlist.canImport === false ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                      >
                        {playlist.canImport === false ? 'Blocked' : importingId === playlist.id ? 'Importing...' : 'Import'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-blue-500 text-white border-none rounded text-sm font-medium cursor-pointer hover:bg-blue-600">Done</button>
        </div>
      </div>
    </div>
  );
}

export default SpotifyImportModal;

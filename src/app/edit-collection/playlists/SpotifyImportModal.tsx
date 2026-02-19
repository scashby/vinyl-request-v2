'use client';

import { useEffect, useState } from 'react';

type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number;
};

interface SpotifyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
}

export function SpotifyImportModal({ isOpen, onClose, onImported }: SpotifyImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      setLastResult(null);
      try {
        const res = await fetch('/api/spotify/playlists', { cache: 'no-store' });
        if (res.status === 401) {
          if (!active) return;
          setIsConnected(false);
          setPlaylists([]);
          return;
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || `Failed to load playlists (${res.status})`);
        }
        const payload = await res.json();
        if (!active) return;
        setIsConnected(true);
        setPlaylists(payload.playlists ?? []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load Spotify playlists');
      } finally {
        if (active) setLoading(false);
      }
    })();
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
                        <div className="text-xs text-gray-500">{playlist.trackCount} tracks</div>
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
                              throw new Error(payload?.error || `Import failed (${res.status})`);
                            }
                            setLastResult(
                              `Imported "${playlist.name}": ${payload.matchedCount} matched, ${payload.unmatchedCount} unmatched`
                            );
                            await onImported();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Import failed');
                          } finally {
                            setImportingId(null);
                          }
                        }}
                        disabled={importingId === playlist.id}
                        className={`px-3 py-1.5 rounded text-xs font-medium text-white ${importingId === playlist.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                      >
                        {importingId === playlist.id ? 'Importing...' : 'Import'}
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

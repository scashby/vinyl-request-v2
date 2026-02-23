'use client';

import { useEffect, useState } from 'react';

type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number | null;
  canImport?: boolean;
  importReason?: string | null;
  snapshotId?: string | null;
};

type MatchCandidate = {
  track_key: string;
  inventory_id?: number | null;
  title: string;
  artist: string;
  side?: string | null;
  position?: string | null;
  score: number;
};

type UnmatchedTrack = {
  row_id: string;
  title?: string;
  artist?: string;
  candidates?: MatchCandidate[];
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

type ImportResume = {
  spotifyPlaylistId?: string;
  snapshotId?: string | null;
  nextOffset?: number | null;
  maxPages?: number;
  existingPlaylistId?: number | null;
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
  const [unmatched, setUnmatched] = useState<UnmatchedTrack[]>([]);
  const [lastImportedPlaylistId, setLastImportedPlaylistId] = useState<number | null>(null);
  const [resume, setResume] = useState<ImportResume | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);

  const decorateUnmatched = (rows: unknown): UnmatchedTrack[] => {
    const list = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
    const base = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return list.map((row, i) => ({
      row_id: `${base}-${i}`,
      title: typeof row?.title === 'string' ? row.title : undefined,
      artist: typeof row?.artist === 'string' ? row.artist : undefined,
      candidates: Array.isArray((row as { candidates?: unknown })?.candidates)
        ? ((row as { candidates?: unknown }).candidates as MatchCandidate[])
        : undefined,
    }));
  };

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
      setUnmatched([]);
      setLastImportedPlaylistId(null);
      setResume(null);
      setRetryAfterSeconds(null);
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

  const CandidateLabel = ({ candidate }: { candidate: MatchCandidate }) => {
    const parts: string[] = [];
    if (candidate.inventory_id) parts.push(`#${candidate.inventory_id}`);
    if (candidate.position) parts.push(String(candidate.position));
    const meta = parts.length > 0 ? ` (${parts.join(':')})` : '';
    return (
      <span className="text-xs text-gray-700">
        <span className="font-medium">{candidate.title}</span> - {candidate.artist} ({Math.round(candidate.score * 100)}%){meta}
      </span>
    );
  };

  const UnmatchedTrackRow = ({ row }: { row: UnmatchedTrack }) => {
    const [addingKey, setAddingKey] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<MatchCandidate[]>([]);

    useEffect(() => {
      const q = searchQuery.trim();
      if (q.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      const controller = new AbortController();
      setSearching(true);
      const timer = window.setTimeout(async () => {
        try {
          const url = new URL('/api/library/tracks/search', window.location.origin);
          url.searchParams.set('q', q);
          if (row.artist) url.searchParams.set('artist', row.artist);
          url.searchParams.set('limit', '8');
          const res = await fetch(url.toString(), { signal: controller.signal });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload?.error || `Search failed (${res.status})`);
          const mapped = Array.isArray(payload?.results)
            ? (payload.results as Array<Record<string, unknown>>).map((item) => ({
                track_key: String(item.track_key ?? '').trim(),
                inventory_id: typeof item.inventory_id === 'number' ? item.inventory_id : null,
                title: String(item.track_title ?? item.title ?? '').trim(),
                artist: String(item.track_artist ?? item.artist ?? '').trim(),
                side: typeof item.side === 'string' ? item.side : null,
                position: typeof item.position === 'string' ? item.position : null,
                score: typeof item.score === 'number' ? item.score : 0,
              }))
            : [];
          setSearchResults(mapped.filter((c) => !!c.track_key));
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
          setSearching(false);
        }
      }, 250);

      return () => {
        controller.abort();
        window.clearTimeout(timer);
      };
    }, [searchQuery, row.artist]);

    const addCandidate = async (candidate: MatchCandidate) => {
      if (!lastImportedPlaylistId) return;
      setAddingKey(candidate.track_key);
      try {
        const res = await fetch('/api/spotify/import/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playlistId: lastImportedPlaylistId,
            trackKey: candidate.track_key,
            sourceTitle: row.title,
            sourceArtist: row.artist,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || `Add failed (${res.status})`);
        setUnmatched((prev) => prev.filter((r) => r.row_id !== row.row_id));
        await onImported();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Add failed');
      } finally {
        setAddingKey(null);
      }
    };

    const best = row.candidates?.[0];
    const otherCandidates = (row.candidates ?? []).slice(0, 5);

    return (
      <div className="bg-white border border-amber-200 rounded p-2">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs text-gray-800">
            <span className="font-medium">{row.title || '(no title)'}</span>
            {row.artist ? ` - ${row.artist}` : ''}
          </div>
          <button
            onClick={() => setUnmatched((prev) => prev.filter((r) => r.row_id !== row.row_id))}
            className="px-2 py-1 rounded text-xs border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Skip
          </button>
        </div>

        {best ? (
          <div className="mt-2">
            <div className="text-xs text-gray-500 mb-1">Suggested match</div>
            <div className="flex items-center justify-between gap-2">
              <CandidateLabel candidate={best} />
              <button
                disabled={addingKey === best.track_key}
                onClick={() => addCandidate(best)}
                className={`px-2 py-1 rounded text-xs text-white ${addingKey === best.track_key ? 'bg-gray-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                {addingKey === best.track_key ? 'Adding...' : 'Add to playlist'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-xs text-gray-500">No suggestion yet</div>
        )}

        {otherCandidates.length > 1 && (
          <div className="mt-2">
            <div className="text-xs text-gray-500 mb-1">Other close matches</div>
            <div className="space-y-1">
              {otherCandidates.slice(1).map((candidate) => (
                <div key={candidate.track_key} className="flex items-center justify-between gap-2">
                  <CandidateLabel candidate={candidate} />
                  <button
                    disabled={addingKey === candidate.track_key}
                    onClick={() => addCandidate(candidate)}
                    className={`px-2 py-1 rounded text-xs text-white ${addingKey === candidate.track_key ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {addingKey === candidate.track_key ? 'Adding...' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2">
          <div className="text-xs text-gray-500 mb-1">Search your inventory</div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type to search…"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-900"
          />
          {searching ? (
            <div className="mt-1 text-xs text-gray-500">Searching…</div>
          ) : searchResults.length > 0 ? (
            <div className="mt-2 space-y-1">
              {searchResults.map((candidate) => (
                <div key={`search-${candidate.track_key}`} className="flex items-center justify-between gap-2">
                  <CandidateLabel candidate={candidate} />
                  <button
                    disabled={addingKey === candidate.track_key}
                    onClick={() => addCandidate(candidate)}
                    className={`px-2 py-1 rounded text-xs text-white ${addingKey === candidate.track_key ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'}`}
                  >
                    {addingKey === candidate.track_key ? 'Adding...' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          ) : searchQuery.trim().length >= 2 ? (
            <div className="mt-1 text-xs text-gray-500">No matches found</div>
          ) : null}
        </div>
      </div>
    );
  };

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
                          setUnmatched([]);
                          setLastImportedPlaylistId(null);
                          setResume(null);
                          setRetryAfterSeconds(null);
                          try {
                            const res = await fetch('/api/spotify/import', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                playlistId: playlist.id,
                                playlistName: playlist.name,
                                snapshotId: playlist.snapshotId ?? null,
                                maxPages: 2,
                              }),
                            });
                            const payload = await res.json().catch(() => ({}));
                            if (res.status === 429) {
                              setRetryAfterSeconds(
                                typeof payload?.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : null
                              );
                              setResume(payload?.resume ?? null);
                              throw new Error(payload?.error || `Import rate-limited (${res.status})`);
                            }
                            if (!res.ok) {
                              const detail = payload?.details ? ` (${payload.details})` : '';
                              const granted = payload?.scope ? ` [scope: ${payload.scope}]` : '';
                              throw new Error((payload?.error || `Import failed (${res.status})`) + detail + granted);
                            }
                            const partialNote = payload?.partialImport
                              ? ' (partial import: Spotify blocked full track paging, used first-page fallback)'
                              : '';
                            const fuzzyNote = payload?.fuzzyMatchedCount
                              ? `, ${payload.fuzzyMatchedCount} fuzzy-matched`
                              : '';
                            setLastResult(
                              `Imported "${playlist.name}": ${payload.matchedCount} matched${fuzzyNote}, ${payload.unmatchedCount} unmatched${partialNote}`
                            );
                            setLastImportedPlaylistId(
                              typeof payload?.playlistId === 'number' ? payload.playlistId : null
                            );
                            setUnmatched(decorateUnmatched(payload?.unmatchedSample));
                            setResume(payload?.resume ?? null);
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
              {resume?.nextOffset !== null && typeof resume?.nextOffset === 'number' && lastImportedPlaylistId && (
                <div className="mt-3 flex items-center justify-between border border-blue-200 bg-blue-50 rounded p-3">
                  <div className="text-xs text-blue-900">
                    Import paused at offset {resume.nextOffset}. Continue to import more tracks.
                    {retryAfterSeconds !== null ? ` Retry after about ${Math.ceil(retryAfterSeconds / 60)} minute(s).` : ''}
                  </div>
                  <button
                    disabled={retryAfterSeconds !== null && retryAfterSeconds > 0}
                    onClick={async () => {
                      setError(null);
                      setLastResult(null);
                      try {
                        const res = await fetch('/api/spotify/import', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            playlistId: resume.spotifyPlaylistId,
                            playlistName: '(resume)',
                            existingPlaylistId: lastImportedPlaylistId,
                            offset: resume.nextOffset,
                            snapshotId: resume.snapshotId ?? null,
                            maxPages: 2,
                          }),
                        });
                        const payload = await res.json().catch(() => ({}));
                        if (res.status === 429) {
                          setRetryAfterSeconds(
                            typeof payload?.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : null
                          );
                          setResume(payload?.resume ?? null);
                          throw new Error(payload?.error || `Import rate-limited (${res.status})`);
                        }
                        if (!res.ok) {
                          throw new Error(payload?.error || `Continue failed (${res.status})`);
                        }
                        const fuzzyNote = payload?.fuzzyMatchedCount ? `, ${payload.fuzzyMatchedCount} fuzzy-matched` : '';
                        setLastResult(
                          `Continued import: ${payload.matchedCount} matched${fuzzyNote}, ${payload.unmatchedCount} unmatched`
                        );
                        setUnmatched(decorateUnmatched(payload?.unmatchedSample));
                        setResume(payload?.resume ?? null);
                        setRetryAfterSeconds(null);
                        await onImported();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Continue import failed');
                      }
                    }}
                    className="px-3 py-2 rounded bg-blue-700 text-white text-xs font-medium disabled:bg-gray-400"
                  >
                    Continue Import
                  </button>
                </div>
              )}
              {lastImportedPlaylistId && unmatched.length > 0 && (
                <div className="mt-4 border border-amber-200 bg-amber-50 rounded p-3">
                  <div className="text-sm font-semibold text-amber-900 mb-2">
                    Unmatched Tracks ({unmatched.length})
                  </div>
                  <div className="text-xs text-amber-800 mb-2">
                    Adding a match only adds that inventory track to this playlist. It does not “train” future Spotify imports.
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {unmatched.map((row) => (
                      <UnmatchedTrackRow key={row.row_id} row={row} />
                    ))}
                  </div>
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

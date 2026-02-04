// src/app/edit-collection/components/ImportEnrichModal.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface ImportEnrichModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type MissingField =
  | 'discogs_release_id'
  | 'discogs_master_id'
  | 'spotify_album_id'
  | 'musicbrainz_release_group_id'
  | 'cover_image'
  | 'genres'
  | 'styles'
  | 'label'
  | 'catalog_number'
  | 'country'
  | 'release_year'
  | 'tracks'
  | 'tags';

type EnrichCandidate = {
  inventory_id: number;
  artist: string;
  title: string;
  missing: MissingField[];
};

type StatsResponse = {
  success: boolean;
  stats?: {
    total: number;
    missing: Record<string, number>;
  };
  error?: string;
};

type CandidatesResponse = {
  success: boolean;
  items?: EnrichCandidate[];
  error?: string;
};

const CATEGORY_FIELDS: Record<string, MissingField[]> = {
  metadata: [
    'discogs_release_id',
    'discogs_master_id',
    'cover_image',
    'genres',
    'styles',
    'label',
    'catalog_number',
    'country',
    'release_year',
  ],
  tracklist: ['tracks'],
  tags: ['tags'],
  links: ['spotify_album_id', 'musicbrainz_release_group_id'],
};

export default function ImportEnrichModal({ isOpen, onClose, onImportComplete }: ImportEnrichModalProps) {
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [limit, setLimit] = useState(100);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState<StatsResponse['stats'] | null>(null);

  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeTracklist, setIncludeTracklist] = useState(true);
  const [includeTags, setIncludeTags] = useState(false);
  const [includeLinks, setIncludeLinks] = useState(true);

  const [useDiscogs, setUseDiscogs] = useState(true);
  const [useSpotify, setUseSpotify] = useState(true);
  const [useMusicBrainz, setUseMusicBrainz] = useState(true);

  const canRun = useMemo(() => {
    const hasCategory = includeMetadata || includeTracklist || includeTags || includeLinks;
    const hasSource = useDiscogs || useSpotify || useMusicBrainz;
    return limit > 0 && !running && hasCategory && hasSource;
  }, [
    includeMetadata,
    includeTracklist,
    includeTags,
    includeLinks,
    useDiscogs,
    useSpotify,
    useMusicBrainz,
    limit,
    running,
  ]);

  const selectedMissingFields = useMemo(() => {
    const fields: MissingField[] = [];
    if (includeMetadata) fields.push(...CATEGORY_FIELDS.metadata);
    if (includeTracklist) fields.push(...CATEGORY_FIELDS.tracklist);
    if (includeTags) fields.push(...CATEGORY_FIELDS.tags);
    if (includeLinks) fields.push(...CATEGORY_FIELDS.links);
    return Array.from(new Set(fields));
  }, [includeMetadata, includeTracklist, includeTags, includeLinks]);

  useEffect(() => {
    if (!isOpen) return;
    const loadStats = async () => {
      try {
        const res = await fetch('/api/enrich-sources/stats');
        const data = (await res.json()) as StatsResponse;
        if (res.ok && data.success) setStats(data.stats ?? null);
      } catch {
        // Non-blocking.
      }
    };
    void loadStats();
  }, [isOpen]);

  if (!isOpen) return null;

  const addLog = (message: string) => {
    setLog((prev) => [...prev, message]);
  };

  const loadCandidates = async () => {
    const body: Record<string, unknown> = { limit };
    if (onlyMissing && selectedMissingFields.length > 0) body.missing = selectedMissingFields;

    const res = await fetch('/api/enrich-sources/fetch-candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as CandidatesResponse;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch enrichment candidates.');
    }
    return data.items ?? [];
  };

  const runForAlbum = async (album: EnrichCandidate) => {
    const shouldRunDiscogsMetadata =
      useDiscogs &&
      includeMetadata &&
      album.missing.some((f) => CATEGORY_FIELDS.metadata.includes(f));
    const shouldRunDiscogsTracklist =
      useDiscogs && includeTracklist && album.missing.includes('tracks');
    const shouldRunSpotify = useSpotify && includeLinks && album.missing.includes('spotify_album_id');
    const shouldRunMusicBrainz =
      useMusicBrainz && includeLinks && album.missing.includes('musicbrainz_release_group_id');

    let changed = false;

    if (shouldRunDiscogsMetadata) {
      const res = await fetch('/api/enrich-sources/discogs-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: album.inventory_id }),
      });
      if (res.ok) changed = true;
    }

    if (shouldRunDiscogsTracklist) {
      const res = await fetch('/api/enrich-sources/discogs-tracklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: album.inventory_id }),
      });
      if (res.ok) changed = true;
    }

    if (shouldRunSpotify) {
      const res = await fetch('/api/enrich-sources/spotify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: album.inventory_id }),
      });
      if (res.ok) changed = true;
    }

    if (shouldRunMusicBrainz) {
      const res = await fetch('/api/enrich-sources/musicbrainz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: album.inventory_id }),
      });
      if (res.ok) changed = true;
    }

    if (includeTags && useDiscogs) {
      // Tags are generally populated through metadata/master enrichment path in V3.
      // Keep this run marker for visibility in logs.
      changed = changed || shouldRunDiscogsMetadata;
    }

    return changed;
  };

  const runEnrichment = async () => {
    setRunning(true);
    setLog([]);
    setProgress({ current: 0, total: 0 });

    try {
      const candidates = await loadCandidates();
      setProgress({ current: 0, total: candidates.length });

      addLog(`Loaded ${candidates.length} candidates.`);

      let updated = 0;
      let failed = 0;

      for (let i = 0; i < candidates.length; i++) {
        const album = candidates[i];
        setProgress({ current: i + 1, total: candidates.length });

        try {
          const changed = await runForAlbum(album);
          if (changed) {
            updated += 1;
            addLog(`Updated: ${album.artist} — ${album.title}`);
          } else {
            addLog(`No changes: ${album.artist} — ${album.title}`);
          }
        } catch (error) {
          failed += 1;
          addLog(
            `Failed: ${album.artist} — ${album.title} (${error instanceof Error ? error.message : 'Unknown error'})`
          );
        }
      }

      addLog(`Done. Updated ${updated}, failed ${failed}.`);
      onImportComplete?.();
    } catch (error) {
      addLog(error instanceof Error ? error.message : 'Enrichment failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[30000] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[820px] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-semibold text-gray-900 mb-2">Enrich Existing Albums (V3)</div>
        <div className="text-sm text-gray-600 mb-4">
          Bulk enrichment for metadata, tracklists, tags, and external links with Discogs, Spotify, and MusicBrainz.
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
            <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">Total: {stats.total}</div>
            <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
              Missing Tracks: {stats.missing.tracks ?? 0}
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
              Missing Spotify: {stats.missing.spotify_album_id ?? 0}
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
              Missing MB: {stats.missing.musicbrainz_release_group_id ?? 0}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="border border-gray-200 rounded p-3">
            <div className="text-xs font-semibold uppercase text-gray-600 mb-2">Data Categories</div>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="checkbox" checked={includeMetadata} onChange={(e) => setIncludeMetadata(e.target.checked)} />
              Metadata
            </label>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="checkbox" checked={includeTracklist} onChange={(e) => setIncludeTracklist(e.target.checked)} />
              Tracklists
            </label>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="checkbox" checked={includeLinks} onChange={(e) => setIncludeLinks(e.target.checked)} />
              External Links (Spotify / MusicBrainz)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeTags} onChange={(e) => setIncludeTags(e.target.checked)} />
              Tags
            </label>
          </div>

          <div className="border border-gray-200 rounded p-3">
            <div className="text-xs font-semibold uppercase text-gray-600 mb-2">Sources</div>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="checkbox" checked={useDiscogs} onChange={(e) => setUseDiscogs(e.target.checked)} />
              Discogs
            </label>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="checkbox" checked={useSpotify} onChange={(e) => setUseSpotify(e.target.checked)} />
              Spotify
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useMusicBrainz}
                onChange={(e) => setUseMusicBrainz(e.target.checked)}
              />
              MusicBrainz
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            Only target missing data
          </label>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Limit</label>
            <input
              type="number"
              value={limit}
              min={1}
              max={2000}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
        </div>

        {running && (
          <div className="text-xs text-gray-600 mb-3">
            Processing {progress.current} / {progress.total}
            <div className="h-2 bg-gray-200 rounded mt-2">
              <div
                className="h-2 bg-blue-600 rounded"
                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {log.length > 0 && (
          <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3 max-h-48 overflow-y-auto space-y-1">
            {log.map((entry, idx) => (
              <div key={`${entry}-${idx}`}>{entry}</div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300"
            disabled={running}
          >
            Close
          </button>
          <button
            onClick={runEnrichment}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            disabled={!canRun}
          >
            {running ? 'Running…' : 'Run Enrichment'}
          </button>
        </div>
      </div>
    </div>
  );
}

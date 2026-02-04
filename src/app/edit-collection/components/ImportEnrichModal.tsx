'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Candidate = {
  inventory_id: number;
  artist: string;
  title: string;
  missing: string[];
};

type StatsResponse = {
  success: boolean;
  stats?: {
    total: number;
    missing: Record<string, number>;
  };
  error?: string;
};

interface ImportEnrichModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type FieldDef = {
  id: string;
  label: string;
  missingKey: string;
  sources: string[];
};

type CategoryDef = {
  id: 'artwork' | 'credits' | 'tracklist';
  label: string;
  fields: FieldDef[];
};

const CATEGORIES: CategoryDef[] = [
  {
    id: 'artwork',
    label: 'Album Artwork',
    fields: [
      { id: 'image_url', label: 'Image Url', missingKey: 'cover_image', sources: ['coverArtArchive', 'musicbrainz', 'discogs', 'spotify', 'appleMusic', 'lastfm'] },
      { id: 'back_image_url', label: 'Back Image Url', missingKey: 'cover_image', sources: ['coverArtArchive', 'musicbrainz', 'discogs'] },
      { id: 'inner_sleeve_images', label: 'Inner Sleeve Images', missingKey: 'cover_image', sources: ['coverArtArchive', 'musicbrainz', 'discogs'] },
    ],
  },
  {
    id: 'credits',
    label: 'Album Credits',
    fields: [
      { id: 'musicians', label: 'Musicians', missingKey: 'tags', sources: ['musicbrainz', 'discogs', 'allmusic'] },
      { id: 'producers', label: 'Producers', missingKey: 'tags', sources: ['musicbrainz', 'discogs', 'allmusic'] },
      { id: 'engineers', label: 'Engineers', missingKey: 'tags', sources: ['musicbrainz', 'discogs'] },
      { id: 'songwriters', label: 'Songwriters', missingKey: 'tags', sources: ['musicbrainz', 'discogs', 'allmusic'] },
    ],
  },
  {
    id: 'tracklist',
    label: 'Track Listings',
    fields: [
      { id: 'tracks', label: 'Tracks', missingKey: 'tracks', sources: ['discogs', 'spotify', 'appleMusic', 'lastfm'] },
      { id: 'tracklists', label: 'Tracklists', missingKey: 'tracks', sources: ['discogs', 'spotify', 'appleMusic'] },
      { id: 'disc_metadata', label: 'Disc Metadata', missingKey: 'tracks', sources: ['discogs'] },
    ],
  },
];

const SOURCE_COLORS: Record<string, string> = {
  discogs: 'bg-blue-50 border-blue-300 text-blue-700',
  musicbrainz: 'bg-slate-50 border-slate-300 text-slate-700',
  spotify: 'bg-green-50 border-green-300 text-green-700',
  appleMusic: 'bg-rose-50 border-rose-300 text-rose-700',
  lastfm: 'bg-orange-50 border-orange-300 text-orange-700',
  coverArtArchive: 'bg-indigo-50 border-indigo-300 text-indigo-700',
  allmusic: 'bg-yellow-50 border-yellow-300 text-yellow-700',
};

const sourceClass = (source: string) => SOURCE_COLORS[source] ?? 'bg-gray-50 border-gray-300 text-gray-700';

export default function ImportEnrichModal({ isOpen, onClose, onImportComplete }: ImportEnrichModalProps) {
  const [running, setRunning] = useState(false);
  const [limit, setLimit] = useState(100);
  const [stats, setStats] = useState<StatsResponse['stats'] | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(() => {
    const defaults = new Set<string>();
    CATEGORIES.forEach((cat) => cat.fields.forEach((field) => defaults.add(field.id)));
    return defaults;
  });
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [autoSnooze] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      const res = await fetch('/api/enrich-sources/stats');
      const data = (await res.json()) as StatsResponse;
      if (res.ok && data.success) setStats(data.stats ?? null);
    };
    void load();
  }, [isOpen]);

  const selectedMissingKeys = useMemo(() => {
    const keys = new Set<string>();
    CATEGORIES.forEach((cat) => {
      cat.fields.forEach((field) => {
        if (selectedFields.has(field.id)) keys.add(field.missingKey);
      });
    });
    return Array.from(keys);
  }, [selectedFields]);

  const overview = useMemo(() => {
    const total = stats?.total ?? 0;
    if (!stats) return { total, needs: 0, full: 0 };
    const needs = Object.values(stats.missing).reduce((max, value) => Math.max(max, value ?? 0), 0);
    return { total, needs, full: Math.max(total - needs, 0) };
  }, [stats]);

  if (!isOpen) return null;

  const toggleField = (id: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (cat: CategoryDef) => {
    const allSelected = cat.fields.every((f) => selectedFields.has(f.id));
    setSelectedFields((prev) => {
      const next = new Set(prev);
      cat.fields.forEach((f) => {
        if (allSelected) next.delete(f.id);
        else next.add(f.id);
      });
      return next;
    });
  };

  const runEnrichment = async () => {
    if (selectedFields.size === 0) return;

    setRunning(true);
    setStatus('Loading candidates...');
    setProgress({ current: 0, total: 0 });

    try {
      const candidateRes = await fetch('/api/enrich-sources/fetch-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit,
          missing: onlyMissing ? selectedMissingKeys : undefined,
        }),
      });

      const candidateJson = await candidateRes.json();
      if (!candidateRes.ok || !candidateJson.success) {
        throw new Error(candidateJson.error || 'Failed loading candidates');
      }

      const items = (candidateJson.items ?? []) as Candidate[];
      setProgress({ current: 0, total: items.length });

      const metadataSelected = selectedMissingKeys.some((k) =>
        ['cover_image', 'genres', 'styles', 'discogs_release_id', 'discogs_master_id', 'label', 'catalog_number', 'country', 'release_year', 'tags'].includes(k)
      );
      const tracksSelected = selectedMissingKeys.includes('tracks');
      const spotifySelected = selectedMissingKeys.includes('spotify_album_id');
      const musicbrainzSelected = selectedMissingKeys.includes('musicbrainz_release_group_id');

      let updated = 0;
      let failed = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setProgress({ current: i + 1, total: items.length });
        setStatus(`Enriching ${item.artist} — ${item.title}`);

        try {
          let changed = false;

          if (metadataSelected) {
            const res = await fetch('/api/enrich-sources/discogs-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ albumId: item.inventory_id }),
            });
            if (res.ok) changed = true;
          }

          if (tracksSelected) {
            const res = await fetch('/api/enrich-sources/discogs-tracklist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ albumId: item.inventory_id }),
            });
            if (res.ok) changed = true;
          }

          if (spotifySelected) {
            const res = await fetch('/api/enrich-sources/spotify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ albumId: item.inventory_id }),
            });
            if (res.ok) changed = true;
          }

          if (musicbrainzSelected) {
            const res = await fetch('/api/enrich-sources/musicbrainz', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ albumId: item.inventory_id }),
            });
            if (res.ok) changed = true;
          }

          if (changed) updated += 1;
        } catch {
          failed += 1;
        }
      }

      setStatus(`Done. Updated ${updated} albums, ${failed} failed.`);
      onImportComplete?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Enrichment failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[30000] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[1140px] max-w-[95vw] max-h-[92vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 bg-gradient-to-r from-[#1f2937] to-[#2a2a2a] border-b border-black/20 flex items-center justify-between">
          <h2 className="m-0 text-3 font-semibold text-white">⚡ Collection Data Enrichment</h2>
          <button onClick={onClose} disabled={running} className="bg-transparent border-0 text-white text-3xl leading-none hover:text-gray-300">×</button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(92vh-76px)]">
          <h3 className="text-[34] font-semibold text-gray-900 mb-3">Collection Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <OverviewCard label="TOTAL ALBUMS" value={overview.total} color="blue" />
            <OverviewCard label="FULLY ENRICHED" value={overview.full} color="emerald" />
            <OverviewCard label="NEEDS ENRICHMENT" value={overview.needs} color="amber" badge={autoSnooze ? '🛌 Snooze Active' : undefined} />
          </div>

          <div className="border border-gray-300 rounded-lg p-4">
            <h3 className="text-[24] font-semibold text-green-700 mb-3">Select Data to Enrich</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {CATEGORIES.map((category) => {
                const categoryCount = category.fields.reduce((sum, field) => sum + (stats?.missing[field.missingKey] ?? 0), 0);
                const categoryChecked = category.fields.every((field) => selectedFields.has(field.id));
                return (
                  <div key={category.id} className="border border-gray-300 rounded-md p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 text-[30] font-semibold text-gray-800 cursor-pointer">
                        <input type="checkbox" checked={categoryChecked} onChange={() => toggleCategory(category)} disabled={running} />
                        {category.label}
                      </label>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold">{categoryCount}</span>
                    </div>

                    <div className="space-y-2">
                      {category.fields.map((field) => {
                        const missingCount = stats?.missing[field.missingKey] ?? 0;
                        return (
                          <div key={field.id} className="border border-blue-200 rounded p-2 bg-blue-50">
                            <div className="flex items-center justify-between mb-1">
                              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedFields.has(field.id)}
                                  onChange={() => toggleField(field.id)}
                                  disabled={running}
                                />
                                {field.label}
                              </label>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold">{missingCount}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {field.sources.map((source) => (
                                <span key={source} className={`text-[11px] px-2 py-0.5 rounded border ${sourceClass(source)}`}>
                                  {source}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
              Only enrich missing data
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Limit</label>
              <input
                type="number"
                value={limit}
                min={1}
                max={5000}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
          </div>

          {running && (
            <div className="text-xs text-gray-600 mb-3">
              Processing {progress.current} / {progress.total}
              <div className="h-2 bg-gray-200 rounded mt-2">
                <div className="h-2 bg-sky-500 rounded" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {status && <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3">{status}</div>}

          <div className="flex justify-center gap-3 pt-2">
            <button onClick={onClose} disabled={running} className="px-10 py-2.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-200">Close</button>
            <button
              onClick={runEnrichment}
              disabled={running || selectedFields.size === 0}
              className="px-10 py-2.5 bg-sky-500 text-white rounded font-medium hover:bg-sky-600 disabled:opacity-60"
            >
              {running ? 'Running…' : '⚡ Start Scan & Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  color,
  badge,
}: {
  label: string;
  value: number;
  color: 'blue' | 'emerald' | 'amber';
  badge?: string;
}) {
  const styles = {
    blue: 'border-blue-500 text-blue-500',
    emerald: 'border-emerald-500 text-emerald-500',
    amber: 'border-amber-500 text-amber-500',
  } as const;

  return (
    <div className={`relative border-2 rounded-lg p-4 text-center ${styles[color]}`}>
      {badge ? <span className="absolute top-[-10px] right-2 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">{badge}</span> : null}
      <div className="text-5xl font-bold leading-tight">{value.toLocaleString()}</div>
      <div className="text-sm font-semibold text-gray-500">{label}</div>
    </div>
  );
}

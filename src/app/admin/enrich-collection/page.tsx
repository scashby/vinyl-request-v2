'use client';

import { useCallback, useEffect, useState } from 'react';
import ImportEnrichModal from 'src/app/edit-collection/components/ImportEnrichModal';

type StatsResponse = {
  success: boolean;
  stats?: {
    total: number;
    withDiscogsReleaseId: number;
    withDiscogsMasterId: number;
    withCoverImage: number;
    withGenres: number;
    withStyles: number;
    withLabel: number;
    withCatalogNumber: number;
    withCountry: number;
    withReleaseYear: number;
    withTracks: number;
    withTags: number;
    missing: Record<string, number>;
  };
  error?: string;
};

export default function EnrichCollectionPage() {
  const [stats, setStats] = useState<StatsResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/enrich-sources/stats', { method: 'GET' });
      const data = (await res.json()) as StatsResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load enrichment stats.');
      }
      setStats(data.stats ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrichment stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="p-6 text-gray-800">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Enrichment Console (V3)</h1>
          <p className="text-sm text-gray-600">
            Run bulk Discogs enrichment and monitor missing metadata across V3 tables.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            Run Enrichment
          </button>
          <button
            onClick={loadStats}
            className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-600">Loading stats…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Total Inventory</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Missing Discogs Release IDs</div>
            <div className="text-2xl font-bold">{stats.missing.discogs_release_id}</div>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Missing Discogs Master IDs</div>
            <div className="text-2xl font-bold">{stats.missing.discogs_master_id}</div>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Missing Cover Images</div>
            <div className="text-2xl font-bold">{stats.missing.cover_image}</div>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Missing Genres</div>
            <div className="text-2xl font-bold">{stats.missing.genres}</div>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Missing Styles</div>
            <div className="text-2xl font-bold">{stats.missing.styles}</div>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Missing Labels</div>
            <div className="text-2xl font-bold">{stats.missing.label}</div>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Missing Catalog Numbers</div>
            <div className="text-2xl font-bold">{stats.missing.catalog_number}</div>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Missing Tracks</div>
            <div className="text-2xl font-bold">{stats.missing.tracks}</div>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Missing Tags</div>
            <div className="text-2xl font-bold">{stats.missing.tags}</div>
          </div>
        </div>
      )}

      <ImportEnrichModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={loadStats}
      />
    </div>
  );
}

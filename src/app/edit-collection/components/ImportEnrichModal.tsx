// src/app/edit-collection/components/ImportEnrichModal.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface ImportEnrichModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type EnrichScope = 'metadata' | 'tracklist' | 'both';

export default function ImportEnrichModal({ isOpen, onClose, onImportComplete }: ImportEnrichModalProps) {
  const [scope, setScope] = useState<EnrichScope>('both');
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [limit, setLimit] = useState(100);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState<string | null>(null);

  const canRun = useMemo(() => limit > 0 && !running, [limit, running]);

  if (!isOpen) return null;

  const loadCandidates = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        id,
        release:releases (
          id,
          discogs_release_id,
          master:masters (
            id,
            cover_image_url,
            genres,
            styles,
            discogs_master_id
          )
        )
      `)
      .order('id', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const rows = (data ?? []).map((row) => {
      const release = Array.isArray(row.release) ? row.release[0] : row.release;
      const master = Array.isArray(release?.master) ? release?.master[0] : release?.master;
      const missingMetadata =
        !release?.discogs_release_id ||
        !master?.discogs_master_id ||
        !master?.cover_image_url ||
        !master?.genres ||
        master.genres.length === 0 ||
        !master?.styles ||
        master.styles.length === 0;

      return {
        id: row.id as number,
        releaseId: release?.id ?? null,
        discogsReleaseId: release?.discogs_release_id ?? null,
        missingMetadata
      };
    });

    return onlyMissing ? rows.filter((row) => row.missingMetadata) : rows;
  };

  const runEnrichment = async () => {
    setRunning(true);
    setLog(null);
    try {
      const candidates = await loadCandidates();
      setProgress({ current: 0, total: candidates.length });

      let updated = 0;
      let failed = 0;

      for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        setProgress({ current: i + 1, total: candidates.length });

        try {
          if (scope === 'metadata' || scope === 'both') {
            const res = await fetch('/api/enrich-sources/discogs-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ albumId: item.id })
            });
            if (!res.ok) {
              failed += 1;
              continue;
            }
          }

          if (scope === 'tracklist' || scope === 'both') {
            const res = await fetch('/api/enrich-sources/discogs-tracklist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ albumId: item.id })
            });
            if (!res.ok) {
              failed += 1;
              continue;
            }
          }

          updated += 1;
        } catch {
          failed += 1;
        }
      }

      setLog(`Done. Updated ${updated} items, ${failed} failed.`);
      onImportComplete?.();
    } catch (err) {
      setLog(err instanceof Error ? err.message : 'Enrichment failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[30000] flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-[620px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold text-gray-900 mb-2">Enrich Existing Albums (V3)</div>
        <div className="text-sm text-gray-600 mb-4">
          This uses Discogs to fill missing V3 fields: cover image, Discogs IDs, genres, styles, and tracklists.
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase">Scope</label>
            <div className="flex gap-2 mt-2">
              {(['metadata', 'tracklist', 'both'] as EnrichScope[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setScope(opt)}
                  className={`px-3 py-1.5 rounded text-xs border ${scope === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  {opt === 'metadata' ? 'Metadata' : opt === 'tracklist' ? 'Tracklist' : 'Metadata + Tracklist'}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            Only enrich items missing metadata
          </label>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Limit</label>
            <input
              type="number"
              value={limit}
              min={1}
              max={1000}
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

        {log && (
          <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3">
            {log}
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

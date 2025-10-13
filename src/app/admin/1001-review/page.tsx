// src/app/admin/1001-review/page.tsx
'use client';

import React from 'react';

type Candidate = {
  collection_id: number;
  coll_artist: string;
  coll_title: string;
  coll_year: string | number | null;
  coll_year_raw?: string | number | null;
  list_artist: string;
  list_album: string;
  list_year: number | null;
  album_1001_id: number;
  artist_similarity: number | null;
  year_diff: number | null;
};

type CandidatesResponse = {
  items: Candidate[];
  limit: number;
  offset: number;
};

type ApiErr = { error: string };

function isApiErr(x: unknown): x is ApiErr {
  return typeof x === 'object' && x !== null && 'error' in x && typeof (x as Record<string, unknown>).error === 'string';
}

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  return Number.isFinite(num) ? num.toFixed(digits) : String(n);
}

export default function Page() {
  const [items, setItems] = React.useState<Candidate[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/1001-review/candidates?limit=250', { cache: 'no-store' });
      const json: unknown = await res.json();
      if (!res.ok) {
        if (isApiErr(json)) throw new Error(json.error);
        throw new Error('Failed to load');
      }
      const data = json as CandidatesResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(); // correct way to acknowledge the promise without disabling ESLint
  }, [load]);

  async function approve(c: Candidate): Promise<void> {
    try {
      const res = await fetch('/api/1001-review/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_id: c.collection_id,
          album_1001_id: c.album_1001_id,
          confidence: c.artist_similarity,
          notes: 'approved via admin',
        }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = isApiErr(json) ? json.error : res.statusText;
        throw new Error(msg || 'Approve failed');
      }
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Approve failed';
      alert(`Approve failed: ${msg}`);
    }
  }

  async function reject(c: Candidate): Promise<void> {
    try {
      const res = await fetch('/api/1001-review/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_id: c.collection_id,
          album_1001_id: c.album_1001_id,
          confidence: c.artist_similarity,
          notes: 'rejected via admin',
        }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = isApiErr(json) ? json.error : res.statusText;
        throw new Error(msg || 'Reject failed');
      }
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Reject failed';
      alert(`Reject failed: ${msg}`);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">1001 Review</h1>
        <button
          onClick={() => void load()}
          className="rounded-lg border px-3 py-1 text-sm hover:bg-black/5"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {items.map((c) => (
          <div key={c.collection_id} className="border rounded-xl p-4 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-semibold truncate">{c.coll_artist} — {c.coll_title}</div>
              <div className="text-xs opacity-70">
                Coll. Year: {c.coll_year ?? c.coll_year_raw ?? '—'} · List: {c.list_artist} — {c.list_album} ({c.list_year ?? '—'})
              </div>
              <div className="text-xs opacity-70">
                sim: {fmt(c.artist_similarity)} · Δyear: {c.year_diff ?? '—'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void approve(c)}
                className="rounded-lg bg-green-600 text-white text-sm px-3 py-1 hover:opacity-90"
                title="Approve and mark as 1001"
              >
                Approve
              </button>
              <button
                onClick={() => void reject(c)}
                className="rounded-lg bg-red-600 text-white text-sm px-3 py-1 hover:opacity-90"
                title="Reject this candidate"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

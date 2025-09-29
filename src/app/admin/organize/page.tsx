'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../../../lib/supabaseClient';

type Row = {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  format: string;
  image_url: string | null;
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  decade: number | null;
};

type Mode = 'genre' | 'style' | 'decade' | 'artist';
type Bucket = { key: string; count: number };

export default function AdminOrganizePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('genre');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('collection')
      .select('id,artist,title,year,format,image_url,discogs_genres,discogs_styles,decade')
      .order('artist', { ascending: true })
      .limit(4000);
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const buckets: Bucket[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (mode === 'genre') {
        const arr = r.discogs_genres ?? [];
        if (!arr.length) map.set('(unknown)', (map.get('(unknown)') || 0) + 1);
        for (const g of arr) map.set(g, (map.get(g) || 0) + 1);
      } else if (mode === 'style') {
        const arr = r.discogs_styles ?? [];
        if (!arr.length) map.set('(unknown)', (map.get('(unknown)') || 0) + 1);
        for (const s of arr) map.set(s, (map.get(s) || 0) + 1);
      } else if (mode === 'decade') {
        const k = r.decade ? String(r.decade) : '(unknown)';
        map.set(k, (map.get(k) || 0) + 1);
      } else {
        const k = r.artist || '(unknown)';
        map.set(k, (map.get(k) || 0) + 1);
      }
    }
    let arr = Array.from(map.entries()).map(([key, count]) => ({ key, count }));
    if (query) {
      const q = query.toLowerCase();
      arr = arr.filter(b => b.key.toLowerCase().includes(q));
    }
    return arr.sort((a, b) => b.count - a.count);
  }, [rows, mode, query]);

  const filteredRows: Row[] = useMemo(() => {
    if (!selected) return [];
    return rows.filter(r => {
      if (mode === 'genre') return (r.discogs_genres ?? []).includes(selected);
      if (mode === 'style') return (r.discogs_styles ?? []).includes(selected);
      if (mode === 'decade') return String(r.decade || '(unknown)') === selected;
      if (mode === 'artist') return r.artist === selected;
      return false;
    });
  }, [rows, mode, selected]);

  async function handleEnrich() {
    setStatus('Enriching…');
    try {
      const res = await fetch('/api/enrich', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setStatus(`Enriched: updated ${json.updated} of ${json.scanned} scanned`);
      await load();
    } catch (e: unknown) {
      setStatus(String(e));
    }
  }

  return (
    <div className="p-6 space-y-6 bg-white text-black">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin · Organize Collection</h1>
        <button
          onClick={handleEnrich}
          className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Run Discogs Enrichment
        </button>
      </div>
      {status && <div className="text-sm text-gray-600">{status}</div>}

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-md overflow-hidden border border-gray-300">
          {(['genre','style','decade','artist'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelected(null); }}
              className={`px-3 py-1 text-sm ${mode === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <input
          className="border border-gray-300 rounded px-3 py-1 bg-white text-black"
          placeholder="Filter buckets…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : buckets.length === 0 ? (
          <div className="text-gray-500">No buckets to show.</div>
        ) : (
          buckets.map(b => (
            <button
              key={b.key}
              className={`border border-gray-300 rounded p-3 text-left bg-white hover:bg-gray-50 shadow-sm ${
                selected === b.key ? 'ring-2 ring-indigo-400' : ''
              }`}
              onClick={() => setSelected(b.key === selected ? null : b.key)}
            >
              <div className="font-semibold">{b.key}</div>
              <div className="text-sm text-gray-500">{b.count} items</div>
            </button>
          ))
        )}
      </div>

      {/* Items */}
      {selected && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{selected}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRows.map(r => (
              <div key={r.id} className="border border-gray-300 rounded p-3 flex gap-3 items-center bg-white shadow-sm">
                {r.image_url ? (
                  <Image
                    src={r.image_url}
                    alt={r.title}
                    width={80}
                    height={80}
                    className="object-cover rounded"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-200 rounded" />
                )}
                <div>
                  <div className="font-semibold">{r.artist} — {r.title}</div>
                  <div className="text-sm text-gray-500">{r.year} • {r.format}</div>
                  <div className="text-xs text-gray-500">
                    {(r.discogs_genres || []).join('; ')}
                    {r.discogs_styles?.length ? ' • ' + r.discogs_styles.join('; ') : ''}
                  </div>
                </div>
              </div>
            ))}
            {filteredRows.length === 0 && (
              <div className="text-gray-500">No items in this bucket yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

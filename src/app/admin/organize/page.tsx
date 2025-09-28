'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { supabase } from 'lib/supabaseClient';

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
  media_condition: string | null;
};

type BucketMode = 'genre' | 'style' | 'decade' | 'artist' | 'fun';
type Bucket = { key: string; count: number };

export default function AdminOrganizePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [mode, setMode] = useState<BucketMode>('genre');
  const [query, setQuery] = useState<string>('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('collection')
        .select('id,artist,title,year,format,image_url,discogs_genres,discogs_styles,decade,media_condition')
        .order('artist', { ascending: true })
        .limit(4000);

      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, []);

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
      } else if (mode === 'artist') {
        const k = r.artist || '(unknown)';
        map.set(k, (map.get(k) || 0) + 1);
      } else {
        // Fun buckets (simple heuristics)
        if (/\b2xLP\b/i.test(r.format)) map.set('Double LPs', (map.get('Double LPs') || 0) + 1);
        if (/\bComp\b/i.test(r.format)) map.set('Compilations', (map.get('Compilations') || 0) + 1);
        if ((r.media_condition || '').toLowerCase().startsWith('near mint')) map.set('Near Mint Media', (map.get('Near Mint Media') || 0) + 1);
        if (/\bblue\b/i.test(r.title)) map.set('Blue Album Titles', (map.get('Blue Album Titles') || 0) + 1);
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
      if (mode === 'fun') {
        if (selected === 'Double LPs') return /\b2xLP\b/i.test(r.format);
        if (selected === 'Compilations') return /\bComp\b/i.test(r.format);
        if (selected === 'Near Mint Media') return (r.media_condition || '').toLowerCase().startsWith('near mint');
        if (selected === 'Blue Album Titles') return /\bblue\b/i.test(r.title);
      }
      return false;
    });
  }, [rows, mode, selected]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin · Organize Collection</h1>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={mode}
          onChange={e => { setMode(e.target.value as BucketMode); setSelected(null); }}
          className="border rounded px-2 py-1"
        >
          <option value="genre">By Genre</option>
          <option value="style">By Style</option>
          <option value="decade">By Decade</option>
          <option value="artist">By Artist</option>
          <option value="fun">Fun Buckets</option>
        </select>

        <input
          className="border rounded px-2 py-1"
          placeholder="Filter buckets…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {loading ? (
          <div>Loading…</div>
        ) : (
          buckets.map(b => (
            <button
              key={b.key}
              className={`border rounded p-3 text-left ${selected === b.key ? 'bg-gray-100' : ''}`}
              onClick={() => setSelected(b.key === selected ? null : b.key)}
            >
              <div className="font-semibold">{b.key}</div>
              <div className="text-sm opacity-70">{b.count} items</div>
            </button>
          ))
        )}
      </div>

      {selected && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{selected}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRows.map(r => (
              <div key={r.id} className="border rounded p-3 flex gap-3 items-center">
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
                  <div className="text-sm opacity-70">{r.year} • {r.format}</div>
                  <div className="text-xs opacity-70">
                    {(r.discogs_genres || []).join('; ')}
                    {r.discogs_styles?.length ? ' • ' + r.discogs_styles.join('; ') : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

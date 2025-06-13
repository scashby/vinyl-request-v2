// Admin Edit Collection page ("/admin/edit-collection")
// Allows admin to edit metadata for collection entries.

"use client"; // Required for useState/useEffect

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';

interface CollectionRow {
  id: number;
  image_url?: string | null;
  artist?: string;
  title?: string;
  year?: string;
  folder?: string;
  format?: string;
  media_condition?: string;
  tracklists?: string | { position?: string; title?: string }[];
  blocked?: boolean;
}

export default function Page() {
  const [data, setData] = useState<CollectionRow[]>([]);
  const [query, setQuery] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    fetchAllRows();
  }, []);

  async function fetchAllRows() {
    setStatus('Loading...');
    let allRows: CollectionRow[] = [];
    let from = 0;
    const batchSize = 1000;
    let keepGoing = true;
    while (keepGoing) {
      const { data: batch, error } = await supabase
        .from('collection')
        .select('*')
        .range(from, from + batchSize - 1);
      if (error) {
        setStatus('Error loading collection');
        setData([]);
        return;
      }
      if (!batch || batch.length === 0) break;
      allRows = allRows.concat(batch as CollectionRow[]);
      keepGoing = batch.length === batchSize;
      from += batchSize;
    }
    setStatus('');
    setData(allRows);
  }

  const filtered = query
    ? data.filter(row =>
        (row.title || '').toLowerCase().includes(query.toLowerCase()) ||
        (row.artist || '').toLowerCase().includes(query.toLowerCase())
      )
    : data;

  function parseTracklistShort(tracklists: string | { position?: string; title?: string }[] | undefined): string {
    if (!tracklists) return '';
    try {
      const arr =
        typeof tracklists === 'string'
          ? (JSON.parse(tracklists) as { position?: string; title?: string }[])
          : tracklists;
      if (!Array.isArray(arr) || arr.length === 0) return '';
      return arr
        .slice(0, 5)
        .map((t) => [t.position, t.title].filter(Boolean).join(': '))
        .join(' | ') + (arr.length > 5 ? ` (+${arr.length - 5} more)` : '');
    } catch {
      return 'Invalid';
    }
  }

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <h2 style={{ color: "#222" }}>Edit Collection</h2>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Search title/artist"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ marginRight: 8, minWidth: 200 }}
        />
        <button onClick={fetchAllRows} style={{ marginRight: 8 }}>Reload</button>
        <span style={{ color: "#222" }}>{status}</span>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 700 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ color: "#222" }}>
              <th>ID</th>
              <th>Image</th>
              <th>Artist</th>
              <th>Title</th>
              <th>Year</th>
              <th>Folder</th>
              <th>Format</th>
              <th>Media Condition</th>
              <th>Tracklists</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row: CollectionRow) => (
              <tr key={row.id} style={{
                background: row.blocked ? '#fee2e2' : '',
                color: "#222",
                fontSize: 13,
                height: 36
              }}>
                <td>{row.id}</td>
                <td>
                  {row.image_url && row.image_url !== "null" && row.image_url !== ""
                    ? <Image src={row.image_url} alt="cover" width={36} height={36} style={{ objectFit: 'cover', borderRadius: 3 }} unoptimized />
                    : <div style={{ width: 36, height: 36, background: "#e0e0e0", borderRadius: 3 }} />}
                </td>
                <td>{row.artist}</td>
                <td>{row.title}</td>
                <td>{row.year}</td>
                <td>{row.folder}</td>
                <td>{row.format}</td>
                <td>{row.media_condition}</td>
                <td>{parseTracklistShort(row.tracklists)}</td>
                <td>
                  <Link
                    href={`/admin/edit-entry/${row.id}`}
                    style={{ color: '#2563eb', fontWeight: 500, cursor: 'pointer', border: 0, background: 'none' }}
                  >Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ color: "#222", marginTop: 16 }}>
          Showing {filtered.length} / {data.length} rows.
        </div>
      </div>
    </div>
  );
}

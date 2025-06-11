// Admin Edit Collection page ("/admin/edit-collection")
// Allows admins to view/search the entire collection and access edit screens.

"use client"; // Required for useState/useEffect

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient.ts';

function parseTracklistShort(tracklists) {
  if (!tracklists) return '';
  try {
    const arr = typeof tracklists === 'string' ? JSON.parse(tracklists) : tracklists;
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.slice(0, 5).map(t =>
      [t.position, t.title].filter(Boolean).join(': ')
    ).join(' | ') + (arr.length > 5 ? ` (+${arr.length - 5} more)` : '');
  } catch {
    return 'Invalid';
  }
}

export default function Page() {
  const [data, setData] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchAllRows();
  }, []);

  async function fetchAllRows() {
    setStatus('Loading...');
    let allRows = [];
    let from = 0;
    let batchSize = 1000;
    let keepGoing = true;

    while (keepGoing) {
      let { data: batch, error } = await supabase
        .from('collection')
        .select('*')
        .range(from, from + batchSize - 1);
      if (error) {
        setStatus('Error loading collection');
        setData([]);
        return;
      }
      if (!batch || batch.length === 0) break;
      allRows = allRows.concat(batch);
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

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: "#fff" }}>Edit Collection</h2>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Search title/artist"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ marginRight: 8, minWidth: 200 }}
        />
        <button onClick={fetchAllRows} style={{ marginRight: 8 }}>Reload</button>
        <span style={{ color: "#fff" }}>{status}</span>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 700 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ color: "#fff" }}>
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
            {filtered.map(row => (
              <tr key={row.id} style={{
                background: row.blocked ? '#fee2e2' : '',
                color: "#fff",
                fontSize: 13,
                height: 36
              }}>
                <td>{row.id}</td>
                <td>
                  {row.image_url
                    ? <img src={row.image_url} alt="cover" style={{ height: 36, maxWidth: 36, objectFit: 'cover', borderRadius: 3 }} />
                    : ''}
                </td>
                <td>{row.artist}</td>
                <td>{row.title}</td>
                <td>{row.year}</td>
                <td>{row.folder}</td>
                <td>{row.format}</td>
                <td>{row.media_condition}</td>
                <td>{parseTracklistShort(row.tracklists)}</td>
                <td>
                  <button
                    onClick={() => router.push(`/admin/edit-entry/${row.id}`)}
                    style={{ color: '#2563eb', fontWeight: 500, cursor: 'pointer', border: 0, background: 'none' }}
                  >Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ color: '#fff', marginTop: 16 }}>
          Showing {filtered.length} / {data.length} rows.
        </div>
      </div>
    </div>
  );
}

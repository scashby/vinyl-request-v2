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

type SortColumn = 'id' | 'artist' | 'title' | 'year' | 'folder' | 'format' | 'media_condition';
type SortDirection = 'asc' | 'desc';

export default function Page() {
  const [data, setData] = useState<CollectionRow[]>([]);
  const [query, setQuery] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showMissingImages, setShowMissingImages] = useState<boolean>(false);
  const [showMissingTracklists, setShowMissingTracklists] = useState<boolean>(false);

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

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function sortData(data: CollectionRow[]): CollectionRow[] {
    return [...data].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortColumn) {
        case 'id':
          aVal = a.id;
          bVal = b.id;
          break;
        case 'artist':
          aVal = (a.artist || '').toLowerCase();
          bVal = (b.artist || '').toLowerCase();
          break;
        case 'title':
          aVal = (a.title || '').toLowerCase();
          bVal = (b.title || '').toLowerCase();
          break;
        case 'year':
          aVal = (a.year || '').toLowerCase();
          bVal = (b.year || '').toLowerCase();
          break;
        case 'folder':
          aVal = (a.folder || '').toLowerCase();
          bVal = (b.folder || '').toLowerCase();
          break;
        case 'format':
          aVal = (a.format || '').toLowerCase();
          bVal = (b.format || '').toLowerCase();
          break;
        case 'media_condition':
          aVal = (a.media_condition || '').toLowerCase();
          bVal = (b.media_condition || '').toLowerCase();
          break;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function hasValidImage(row: CollectionRow): boolean {
    return !!(row.image_url && row.image_url !== "null" && row.image_url !== "");
  }

  function hasValidTracklist(row: CollectionRow): boolean {
    if (!row.tracklists) return false;
    try {
      const arr = typeof row.tracklists === 'string' 
        ? (JSON.parse(row.tracklists) as { position?: string; title?: string }[])
        : row.tracklists;
      return Array.isArray(arr) && arr.length > 0;
    } catch {
      return false;
    }
  }

  const filtered = data.filter(row => {
    // Text search filter
    const matchesQuery = !query || 
      (row.title || '').toLowerCase().includes(query.toLowerCase()) ||
      (row.artist || '').toLowerCase().includes(query.toLowerCase());

    // Missing image filter
    const matchesImageFilter = !showMissingImages || !hasValidImage(row);

    // Missing tracklist filter
    const matchesTracklistFilter = !showMissingTracklists || !hasValidTracklist(row);

    return matchesQuery && matchesImageFilter && matchesTracklistFilter;
  });

  const sortedAndFiltered = sortData(filtered);

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

  function getSortIcon(column: SortColumn): string {
    if (sortColumn !== column) return ' ↕️';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <h2 style={{ color: "#222" }}>Edit Collection</h2>
      
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            placeholder="Search title/artist"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ minWidth: 200 }}
          />
          <button onClick={fetchAllRows}>Reload</button>
          <span style={{ color: "#222" }}>{status}</span>
        </div>
        
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222" }}>
            <input
              type="checkbox"
              checked={showMissingImages}
              onChange={e => setShowMissingImages(e.target.checked)}
            />
            Missing images only
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222" }}>
            <input
              type="checkbox"
              checked={showMissingTracklists}
              onChange={e => setShowMissingTracklists(e.target.checked)}
            />
            Missing tracklists only
          </label>
        </div>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 700 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ color: "#222" }}>
              <th 
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('id')}
              >
                ID{getSortIcon('id')}
              </th>
              <th>Image</th>
              <th 
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('artist')}
              >
                Artist{getSortIcon('artist')}
              </th>
              <th 
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('title')}
              >
                Title{getSortIcon('title')}
              </th>
              <th 
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('year')}
              >
                Year{getSortIcon('year')}
              </th>
              <th 
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('folder')}
              >
                Folder{getSortIcon('folder')}
              </th>
              <th 
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('format')}
              >
                Format{getSortIcon('format')}
              </th>
              <th 
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('media_condition')}
              >
                Media Condition{getSortIcon('media_condition')}
              </th>
              <th>Tracklists</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFiltered.map((row: CollectionRow) => (
              <tr key={row.id} style={{
                background: row.blocked ? '#fee2e2' : '',
                color: "#222",
                fontSize: 13,
                height: 36
              }}>
                <td>{row.id}</td>
                <td>
                  {hasValidImage(row)
                    ? <Image src={row.image_url!} alt="cover" width={36} height={36} style={{ objectFit: 'cover', borderRadius: 3 }} unoptimized />
                    : <div style={{ width: 36, height: 36, background: "#e0e0e0", borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#999' }}>
                        NO IMG
                      </div>}
                </td>
                <td>{row.artist}</td>
                <td>{row.title}</td>
                <td>{row.year}</td>
                <td>{row.folder}</td>
                <td>{row.format}</td>
                <td>{row.media_condition}</td>
                <td style={{ color: hasValidTracklist(row) ? '#222' : '#999', fontStyle: hasValidTracklist(row) ? 'normal' : 'italic' }}>
                  {hasValidTracklist(row) ? parseTracklistShort(row.tracklists) : 'No tracklist'}
                </td>
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
          Showing {sortedAndFiltered.length} / {data.length} rows.
          {showMissingImages && ` (${data.filter(row => !hasValidImage(row)).length} missing images)`}
          {showMissingTracklists && ` (${data.filter(row => !hasValidTracklist(row)).length} missing tracklists)`}
        </div>
      </div>
    </div>
  );
}
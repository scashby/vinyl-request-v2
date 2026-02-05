// src/app/admin/diagnostics/page.tsx - Redesigned to match existing admin style
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Link from 'next/link';

type DataIssue = {
  id: number;
  artist: string;
  title: string;
  issues: string[];
};

export default function DataDiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<DataIssue[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    missingArtist: 0,
    missingTitle: 0,
    missingYear: 0,
    missingReleaseDate: 0,
    missingGenres: 0,
    missingStyles: 0,
    missingDecade: 0,
    missingImage: 0,
    missingTracklist: 0,
    missingDiscogsId: 0,
    emptyRows: 0,
  });
  const [status, setStatus] = useState('');

  useEffect(() => {
    runDiagnostics();
  }, []);

  async function runDiagnostics() {
    setLoading(true);
    setStatus('Loading all rows...');
    
    // Fetch ALL rows in batches
    type InventoryRow = {
      id: number;
      location: string | null;
      personal_notes: string | null;
      release_id: number | null;
      release: {
        discogs_release_id: string | null;
        release_date: string | null;
        release_year: number | null;
        master: {
          title: string | null;
          original_release_year: number | null;
          cover_image_url: string | null;
          genres: string[] | null;
          styles: string[] | null;
          artist: {
            name: string | null;
          } | null;
        } | null;
        release_tracks: { id: number }[] | null;
      } | null;
    };
    
    let allRows: InventoryRow[] = [];
    let from = 0;
    const batchSize = 1000;
    let keepGoing = true;
    
    while (keepGoing) {
      const { data: batch, error } = await supabase
        .from('inventory')
        .select(`
          id,
          location,
          personal_notes,
          release_id,
          release:releases (
            discogs_release_id,
            release_date,
            release_year,
            master:masters (
              title,
              original_release_year,
              cover_image_url,
              genres,
              styles,
              artist:artists (
                name
              )
            ),
            release_tracks (
              id
            )
          )
        `)
        .range(from, from + batchSize - 1)
        .order('id');

      if (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
        return;
      }
      
      if (!batch || batch.length === 0) break;
      
      const batchRows = batch as unknown as InventoryRow[];
      allRows = allRows.concat(batchRows);
      setStatus(`Loaded ${allRows.length} rows...`);
      
      keepGoing = batch.length === batchSize;
      from += batchSize;
    }

    const foundIssues: DataIssue[] = [];
    const newStats = {
      total: allRows.length,
      missingArtist: 0,
      missingTitle: 0,
      missingYear: 0,
      missingReleaseDate: 0,
      missingGenres: 0,
      missingStyles: 0,
      missingDecade: 0,
      missingImage: 0,
      missingTracklist: 0,
      missingDiscogsId: 0,
      emptyRows: 0,
    };

    allRows.forEach(row => {
      const rowIssues: string[] = [];
      const release = row.release;
      const master = release?.master;
      const artist = master?.artist;

      // Check for completely empty rows
      const hasNoData = !row.release_id && !row.location && !row.personal_notes;
      if (hasNoData) {
        rowIssues.push('EMPTY ROW');
        newStats.emptyRows++;
      }

      if (!artist?.name || artist.name.trim() === '') {
        rowIssues.push('No artist');
        newStats.missingArtist++;
      }
      if (!master?.title || master.title.trim() === '') {
        rowIssues.push('No title');
        newStats.missingTitle++;
      }
      if (!release?.discogs_release_id) {
        rowIssues.push('No Discogs ID');
        newStats.missingDiscogsId++;
      }
      if (!master?.original_release_year && !release?.release_year) {
        rowIssues.push('No year');
        newStats.missingYear++;
      }
      if (!release?.release_date) {
        rowIssues.push('No release date');
        newStats.missingReleaseDate++;
      }
      if (!master?.genres || master.genres.length === 0) {
        rowIssues.push('No genres');
        newStats.missingGenres++;
      }
      if (!master?.styles || master.styles.length === 0) {
        rowIssues.push('No styles');
        newStats.missingStyles++;
      }
      if (!master?.original_release_year && !release?.release_year) {
        rowIssues.push('No decade');
        newStats.missingDecade++;
      }
      if (!master?.cover_image_url) {
        rowIssues.push('No image');
        newStats.missingImage++;
      }
      if (!release?.release_tracks || release.release_tracks.length === 0) {
        rowIssues.push('No tracklist');
        newStats.missingTracklist++;
      }

      if (rowIssues.length > 0) {
        foundIssues.push({
          id: row.id,
          artist: artist?.name || '(no artist)',
          title: master?.title || '(no title)',
          issues: rowIssues
        });
      }
    });

    setIssues(foundIssues);
    setStats(newStats);
    setStatus('');
    setLoading(false);
  }

  async function deleteEmptyRows() {
    if (!confirm('Delete all empty rows? This cannot be undone.')) return;

    setLoading(true);
    const emptyRowIds = issues
      .filter(issue => issue.issues.includes('EMPTY ROW'))
      .map(issue => issue.id);

    if (emptyRowIds.length === 0) {
      alert('No empty rows to delete');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('inventory')
      .delete()
      .in('id', emptyRowIds);

    if (error) {
      alert(`Error deleting: ${error.message}`);
    } else {
      alert(`Deleted ${emptyRowIds.length} empty rows`);
      runDiagnostics();
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: "#222", margin: 0 }}>Data Diagnostics</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          {stats.emptyRows > 0 && (
            <button
              onClick={deleteEmptyRows}
              disabled={loading}
              style={{
                padding: '4px 12px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              🗑️ Delete {stats.emptyRows} Empty Rows
            </button>
          )}
          <button 
            onClick={runDiagnostics}
            disabled={loading}
            style={{
              padding: '4px 8px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            Reload
          </button>
        </div>
      </div>

      {status && (
        <div style={{ padding: 8, background: '#dbeafe', border: '1px solid #3b82f6', borderRadius: 4, marginBottom: 16, fontSize: 14 }}>
          {status}
        </div>
      )}

      {/* Stats Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 12,
        marginBottom: 24
      }}>
        <StatBox label="Total" value={stats.total} color="#3b82f6" />
        <StatBox label="Empty" value={stats.emptyRows} color="#dc2626" />
        <StatBox label="No Artist" value={stats.missingArtist} color="#dc2626" />
        <StatBox label="No Title" value={stats.missingTitle} color="#dc2626" />
        <StatBox label="No Discogs ID" value={stats.missingDiscogsId} color="#f59e0b" />
        <StatBox label="No Genres" value={stats.missingGenres} color="#f59e0b" />
        <StatBox label="No Styles" value={stats.missingStyles} color="#f59e0b" />
        <StatBox label="No Release Date" value={stats.missingReleaseDate} color="#f59e0b" />
        <StatBox label="No Decade" value={stats.missingDecade} color="#f59e0b" />
        <StatBox label="No Image" value={stats.missingImage} color="#8b5cf6" />
        <StatBox label="No Tracklist" value={stats.missingTracklist} color="#8b5cf6" />
      </div>

      {/* Issues Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
      ) : issues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#dcfce7', border: '1px solid #16a34a', borderRadius: 4 }}>
          ✅ All clear! No data issues found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #ddd' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead style={{ background: '#f5f5f5' }}>
              <tr style={{ color: "#222" }}>
                <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Artist</th>
                <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Title</th>
                <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Issues</th>
                <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} style={{
                  color: "#222",
                  borderBottom: '1px solid #f0f0f0',
                  background: issue.issues.includes('EMPTY ROW') ? '#fee2e2' : ''
                }}>
                  <td style={{ padding: '4px', fontWeight: 'bold' }}>{issue.id}</td>
                  <td style={{ padding: '4px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {issue.artist}
                  </td>
                  <td style={{ padding: '4px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {issue.title}
                  </td>
                  <td style={{ padding: '4px', fontSize: 12 }}>
                    {issue.issues.join(', ')}
                  </td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <Link
                      href={`/admin/edit-entry/${issue.id}`}
                      style={{ color: '#2563eb', fontWeight: 500, textDecoration: 'none', fontSize: 12 }}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ color: "#222", marginTop: 16, fontSize: 12 }}>
        Showing {issues.length} items with issues out of {stats.total} total albums
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'white',
      border: `2px solid ${color}`,
      borderRadius: 4,
      padding: 12,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 24, fontWeight: 'bold', color }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
// AUDIT: inspected, no changes.

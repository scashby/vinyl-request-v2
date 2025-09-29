// Fixed organize page with proper user-friendly filters
// src/app/admin/organize/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  folder: string;
};

type Mode = 'genre' | 'style' | 'decade' | 'artist';
type Bucket = { key: string; count: number };

export default function AdminOrganizePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('genre');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  // Simple user-friendly filters
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [artistSearch, setArtistSearch] = useState<string>('');
  const [titleSearch, setTitleSearch] = useState<string>('');

  // Available folders from data
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);

  // status
  const [status, setStatus] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    
    // Load all albums
    const { data, error } = await supabase
      .from('collection')
      .select('id,artist,title,year,format,image_url,discogs_genres,discogs_styles,decade,folder')
      .order('artist', { ascending: true })
      .limit(5000);

    if (!error && data) {
      setRows(data as Row[]);
      
      // Extract unique folders for dropdown
      const folders = Array.from(new Set(data.map(r => r.folder).filter(Boolean)));
      setAvailableFolders(folders.sort());
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Apply filters to rows
  const filteredByScope = useMemo(() => {
    return rows.filter(r => {
      // Folder filter
      if (folderFilter !== 'all' && r.folder !== folderFilter) return false;
      
      // Artist search
      if (artistSearch && !r.artist.toLowerCase().includes(artistSearch.toLowerCase())) return false;
      
      // Title search
      if (titleSearch && !r.title.toLowerCase().includes(titleSearch.toLowerCase())) return false;
      
      return true;
    });
  }, [rows, folderFilter, artistSearch, titleSearch]);

  const buckets: Bucket[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredByScope) {
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
  }, [filteredByScope, mode, query]);

  const filteredRows: Row[] = useMemo(() => {
    if (!selected) return [];
    return filteredByScope.filter(r => {
      if (mode === 'genre') return (r.discogs_genres ?? []).includes(selected) || (selected === '(unknown)' && !(r.discogs_genres?.length));
      if (mode === 'style') return (r.discogs_styles ?? []).includes(selected) || (selected === '(unknown)' && !(r.discogs_styles?.length));
      if (mode === 'decade') return String(r.decade || '(unknown)') === selected;
      if (mode === 'artist') return r.artist === selected;
      return false;
    });
  }, [filteredByScope, mode, selected]);

  async function runEnrichAll() {
    setStatus('Enriching missing genres/styles from Discogs...');
    let cursor: number | null = 0;
    let updated = 0, scanned = 0;

    // Build filter parameters for API
    interface EnrichFilters {
      cursor: number | null;
      limit: number;
      folderExact?: string;
      artistSearch?: string;
      titleSearch?: string;
    }
    
    const filters: EnrichFilters = { cursor, limit: 80 };
    if (folderFilter !== 'all') filters.folderExact = folderFilter;
    if (artistSearch) filters.artistSearch = artistSearch;
    if (titleSearch) filters.titleSearch = titleSearch;

    while (cursor !== null) {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filters, cursor })
      });
      const json = await res.json();
      if (!res.ok) { setStatus(`Error: ${json?.error || res.status}`); return; }
      updated += json.updated || 0;
      scanned += json.scanned || 0;
      cursor = json.nextCursor;
      setStatus(`Updated ${updated} / scanned ${scanned}...`);
      await new Promise(r => setTimeout(r, 400));
    }
    setStatus(`✅ Done! Updated ${updated} of ${scanned} albums.`);
    await load();
  }

  async function applyGenreFolders(dryRun = false) {
    setStatus(dryRun ? 'Previewing genre folder moves...' : 'Moving to genre folders...');
    let cursor: number | null = 0;
    let mk = 0, mu = 0, scanned = 0;

    // Build filter parameters
    interface OrganizeScope {
      folderExact?: string;
      artistSearch?: string;
      titleSearch?: string;
    }
    
    const scope: OrganizeScope = {};
    if (folderFilter !== 'all') scope.folderExact = folderFilter;
    if (artistSearch) scope.artistSearch = artistSearch;
    if (titleSearch) scope.titleSearch = titleSearch;

    // Determine base folder from current filter
    const base = folderFilter !== 'all' ? folderFilter : 'vinyl';

    while (cursor !== null) {
      const res = await fetch('/api/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cursor, limit: 800,
          scope,
          base,
          unknownLabel: '(unknown)',
          dryRun: dryRun
        })
      });
      const json = await res.json();
      if (!res.ok) { setStatus(`Error: ${json?.error || res.status}`); return; }
      mk += json.moved_known || 0;
      mu += json.moved_unknown || 0;
      scanned += json.scanned || 0;
      cursor = json.nextCursor;
      setStatus(`${dryRun ? 'Preview' : 'Moved'} — known: ${mk}, unknown: ${mu}, scanned: ${scanned}...`);
      await new Promise(r => setTimeout(r, 200));
    }
    setStatus(`${dryRun ? '👁️ Preview complete' : '✅ Move complete'} — ${mk} with genres, ${mu} without genres.`);
    await load();
  }

  const clearFilters = () => {
    setFolderFilter('all');
    setArtistSearch('');
    setTitleSearch('');
  };

  const hasActiveFilters = folderFilter !== 'all' || artistSearch || titleSearch;

  return (
    <div style={{
      padding: 24,
      background: '#f8fafc',
      minHeight: '100vh',
      maxWidth: 1400,
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 'bold',
            color: '#1f2937',
            margin: '0 0 8px 0'
          }}>
            Organize Collection
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: 16,
            margin: 0
          }}>
            Browse and organize by genre, style, decade, or artist
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => runEnrichAll()}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(99, 102, 241, 0.2)'
            }}
          >
            🔄 Enrich Missing Metadata
          </button>
          
          <button
            onClick={() => applyGenreFolders(true)}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(245, 158, 11, 0.2)'
            }}
          >
            👁️ Preview Genre Folders
          </button>
          
          <button
            onClick={() => applyGenreFolders(false)}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'
            }}
          >
            📁 Apply Genre Folders
          </button>
        </div>
      </div>

      {/* Status Message */}
      {status && (
        <div style={{
          background: status.includes('✅') ? '#dcfce7' : status.includes('Error') ? '#fee2e2' : '#dbeafe',
          border: `1px solid ${status.includes('✅') ? '#16a34a' : status.includes('Error') ? '#dc2626' : '#3b82f6'}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          color: status.includes('✅') ? '#15803d' : status.includes('Error') ? '#991b1b' : '#1e40af',
          fontSize: 14
        }}>
          {status}
        </div>
      )}

      {/* Filters - NOW USER FRIENDLY */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}>
          <h3 style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#1f2937',
            margin: 0
          }}>
            🔍 Filter Collection
          </h3>
          
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#6b7280',
                cursor: 'pointer'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
        
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 6
            }}>
              Folder
            </label>
            <select
              value={folderFilter}
              onChange={e => setFolderFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                background: 'white',
                color: '#1f2937',
                cursor: 'pointer'
              }}
            >
              <option value="all" style={{ color: '#1f2937', background: 'white' }}>All Folders</option>
              {availableFolders.map(folder => (
                <option key={folder} value={folder} style={{ color: '#1f2937', background: 'white' }}>{folder}</option>
              ))}
            </select>
          </div>
          
          <div style={{ flex: '1 1 200px' }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 6
            }}>
              Artist
            </label>
            <input
              type="text"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
              value={artistSearch}
              onChange={e => setArtistSearch(e.target.value)}
              placeholder="Search by artist..."
            />
          </div>
          
          <div style={{ flex: '1 1 200px' }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 6
            }}>
              Title
            </label>
            <input
              type="text"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
              value={titleSearch}
              onChange={e => setTitleSearch(e.target.value)}
              placeholder="Search by title..."
            />
          </div>
        </div>
        
        {hasActiveFilters && (
          <div style={{
            marginTop: 12,
            padding: 8,
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 6,
            fontSize: 12,
            color: '#0c4a6e'
          }}>
            Showing {filteredByScope.length} of {rows.length} albums
          </div>
        )}
      </div>

      {/* View Mode Selector */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 8
            }}>
              Group By
            </label>
            <div style={{
              display: 'inline-flex',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid #d1d5db'
            }}>
              {(['genre', 'style', 'decade', 'artist'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setSelected(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    border: 'none',
                    background: mode === m ? '#3b82f6' : '#f9fafb',
                    color: mode === m ? 'white' : '#374151',
                    cursor: 'pointer',
                    borderRight: m !== 'artist' ? '1px solid #d1d5db' : 'none'
                  }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ flex: '1 1 300px' }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 8
            }}>
              Search {mode.charAt(0).toUpperCase() + mode.slice(1)}s
            </label>
            <input
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14
              }}
              placeholder={`Search ${mode}s...`}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Buckets Grid */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 16
        }}>
          {mode.charAt(0).toUpperCase() + mode.slice(1)}s ({buckets.length})
        </h3>
        
        {loading ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
            Loading...
          </div>
        ) : buckets.length === 0 ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
            No {mode}s found
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12
          }}>
            {buckets.map(b => (
              <button
                key={b.key}
                onClick={() => setSelected(b.key === selected ? null : b.key)}
                style={{
                  background: selected === b.key ? '#eff6ff' : 'white',
                  border: `2px solid ${selected === b.key ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: 8,
                  padding: 16,
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: selected === b.key ? '0 4px 6px rgba(59, 130, 246, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#1f2937',
                  marginBottom: 4
                }}>
                  {b.key}
                </div>
                <div style={{
                  fontSize: 14,
                  color: '#6b7280'
                }}>
                  {b.count} album{b.count !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Albums */}
      {selected && (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 16
          }}>
            Albums in &quot;{selected}&quot; ({filteredRows.length})
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 16
          }}>
            {filteredRows.map(r => (
              <div
                key={r.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  background: '#f9fafb'
                }}
              >
                <Image
                  src={r.image_url || '/images/placeholder.png'}
                  alt={r.title}
                  width={80}
                  height={80}
                  style={{
                    objectFit: 'cover',
                    borderRadius: 6,
                    flexShrink: 0
                  }}
                  unoptimized
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1f2937',
                    marginBottom: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {r.title}
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: '#6b7280',
                    marginBottom: 4
                  }}>
                    {r.artist}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#9ca3af'
                  }}>
                    {r.year} • {r.format} • {r.folder}
                  </div>
                  {(r.discogs_genres || r.discogs_styles) && (
                    <div style={{
                      fontSize: 10,
                      color: '#6b7280',
                      marginTop: 6
                    }}>
                      {r.discogs_genres?.join(', ')}
                      {r.discogs_styles && r.discogs_genres && ' • '}
                      {r.discogs_styles?.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {filteredRows.length === 0 && (
            <div style={{
              textAlign: 'center',
              color: '#6b7280',
              padding: 40
            }}>
              No albums found in this category
            </div>
          )}
        </div>
      )}
    </div>
  );
}
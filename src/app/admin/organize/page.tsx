// Flexible multi-filter collection browser
// src/app/admin/organize/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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

export default function AdminOrganizePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('');

  // All possible filter options
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [styleFilter, setStyleFilter] = useState<string>('all');
  const [decadeFilter, setDecadeFilter] = useState<string>('all');
  const [letterFilter, setLetterFilter] = useState<string>('all');
  const [artistSearch, setArtistSearch] = useState<string>('');
  const [titleSearch, setTitleSearch] = useState<string>('');

  // Available options
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [availableStyles, setAvailableStyles] = useState<string[]>([]);
  const [availableDecades, setAvailableDecades] = useState<number[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    
    let allRows: Row[] = [];
    let from = 0;
    const batchSize = 1000;
    let keepGoing = true;
    
    while (keepGoing) {
      const { data: batch, error } = await supabase
        .from('collection')
        .select('id,artist,title,year,format,image_url,discogs_genres,discogs_styles,decade,folder')
        .order('artist', { ascending: true })
        .range(from, from + batchSize - 1);
      
      if (error) {
        console.error('Error loading albums:', error);
        break;
      }
      
      if (!batch || batch.length === 0) break;
      
      allRows = allRows.concat(batch as Row[]);
      keepGoing = batch.length === batchSize;
      from += batchSize;
    }
    
    setRows(allRows);
    
    // Extract all unique filter options
    const folders = Array.from(new Set(allRows.map(r => r.folder).filter(Boolean)));
    setAvailableFolders(folders.sort());
    
    const genres = new Set<string>();
    allRows.forEach(r => r.discogs_genres?.forEach(g => genres.add(g)));
    setAvailableGenres(Array.from(genres).sort());
    
    const styles = new Set<string>();
    allRows.forEach(r => r.discogs_styles?.forEach(s => styles.add(s)));
    setAvailableStyles(Array.from(styles).sort());
    
    const decades = Array.from(new Set(allRows.map(r => r.decade).filter(Boolean))).sort() as number[];
    setAvailableDecades(decades);
    
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Apply ALL filters with AND logic
  const filteredAlbums = useMemo(() => {
    return rows.filter(row => {
      // Folder filter
      if (folderFilter !== 'all' && row.folder !== folderFilter) return false;
      
      // Genre filter
      if (genreFilter !== 'all') {
        if (!row.discogs_genres?.includes(genreFilter)) return false;
      }
      
      // Style filter
      if (styleFilter !== 'all') {
        if (!row.discogs_styles?.includes(styleFilter)) return false;
      }
      
      // Decade filter
      if (decadeFilter !== 'all') {
        if (String(row.decade) !== decadeFilter) return false;
      }
      
      // Letter filter (artist starts with)
      if (letterFilter !== 'all') {
        const firstLetter = row.artist?.charAt(0).toUpperCase();
        if (firstLetter !== letterFilter) return false;
      }
      
      // Artist search
      if (artistSearch && !row.artist.toLowerCase().includes(artistSearch.toLowerCase())) return false;
      
      // Title search
      if (titleSearch && !row.title.toLowerCase().includes(titleSearch.toLowerCase())) return false;
      
      return true;
    });
  }, [rows, folderFilter, genreFilter, styleFilter, decadeFilter, letterFilter, artistSearch, titleSearch]);

  async function runEnrichAll() {
    setStatus('Enriching missing genres/styles from Discogs...');
    let cursor: number | null = 0;
    let updated = 0, scanned = 0;

    while (cursor !== null) {
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

      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });
      
      const json = await res.json();
      if (!res.ok) { 
        setStatus(`Error: ${json?.error || res.status}`); 
        return; 
      }
      
      updated += json.updated || 0;
      scanned += json.scanned || 0;
      cursor = json.nextCursor;
      
      setStatus(`Updated ${updated} / scanned ${scanned}...`);
      
      if (cursor !== null) {
        await new Promise(r => setTimeout(r, 400));
      }
    }
    
    setStatus(`✅ Done! Updated ${updated} of ${scanned} albums.`);
    await load();
  }

  const clearFilters = () => {
    setFolderFilter('all');
    setGenreFilter('all');
    setStyleFilter('all');
    setDecadeFilter('all');
    setLetterFilter('all');
    setArtistSearch('');
    setTitleSearch('');
  };

  const hasActiveFilters = folderFilter !== 'all' || genreFilter !== 'all' || styleFilter !== 'all' || 
                          decadeFilter !== 'all' || letterFilter !== 'all' || artistSearch || titleSearch;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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
            Combine any filters to find exactly what you&apos;re looking for
          </p>
        </div>
        
        <button
          onClick={() => runEnrichAll()}
          disabled={loading}
          style={{
            background: loading ? '#9ca3af' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 6px rgba(99, 102, 241, 0.2)'
          }}
        >
          🔄 Enrich Missing Metadata
        </button>
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

      {/* Flexible Filters */}
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
            🔍 Combine Filters (All work together)
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
              Clear All Filters
            </button>
          )}
        </div>
        
        {/* Dropdown Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 16
        }}>
          <div>
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
          
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 6
            }}>
              Genre
            </label>
            <select
              value={genreFilter}
              onChange={e => setGenreFilter(e.target.value)}
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
              <option value="all" style={{ color: '#1f2937', background: 'white' }}>All Genres</option>
              {availableGenres.map(genre => (
                <option key={genre} value={genre} style={{ color: '#1f2937', background: 'white' }}>{genre}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 6
            }}>
              Style
            </label>
            <select
              value={styleFilter}
              onChange={e => setStyleFilter(e.target.value)}
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
              <option value="all" style={{ color: '#1f2937', background: 'white' }}>All Styles</option>
              {availableStyles.map(style => (
                <option key={style} value={style} style={{ color: '#1f2937', background: 'white' }}>{style}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 6
            }}>
              Decade
            </label>
            <select
              value={decadeFilter}
              onChange={e => setDecadeFilter(e.target.value)}
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
              <option value="all" style={{ color: '#1f2937', background: 'white' }}>All Decades</option>
              {availableDecades.map(decade => (
                <option key={decade} value={String(decade)} style={{ color: '#1f2937', background: 'white' }}>{decade}s</option>
              ))}
            </select>
          </div>
        </div>

        {/* Letter Filter */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: '#6b7280',
            marginBottom: 6
          }}>
            Artist Starts With
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4
          }}>
            <button
              onClick={() => setLetterFilter('all')}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: letterFilter === 'all' ? '#3b82f6' : 'white',
                color: letterFilter === 'all' ? 'white' : '#374151',
                cursor: 'pointer'
              }}
            >
              All
            </button>
            {alphabet.map(letter => (
              <button
                key={letter}
                onClick={() => setLetterFilter(letter)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: letterFilter === letter ? '#3b82f6' : 'white',
                  color: letterFilter === letter ? 'white' : '#374151',
                  cursor: 'pointer'
                }}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>

        {/* Text Search Filters */}
        <div style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 6
            }}>
              Artist Contains
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
              Title Contains
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
        
        {/* Results Count */}
        <div style={{
          marginTop: 16,
          padding: 12,
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 6,
          fontSize: 14,
          color: '#0c4a6e',
          fontWeight: 600
        }}>
          📊 Showing {filteredAlbums.length} of {rows.length} albums
          {hasActiveFilters && (
            <span style={{ fontWeight: 400, marginLeft: 8 }}>
              (with active filters)
            </span>
          )}
        </div>
      </div>

      {/* Results Grid */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {loading ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
            Loading albums...
          </div>
        ) : filteredAlbums.length === 0 ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              No albums match your filters
            </div>
            <div style={{ fontSize: 14 }}>
              Try adjusting your filter criteria
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 16
          }}>
            {filteredAlbums.map(album => (
              <Link
                key={album.id}
                href={`/admin/edit-entry/${album.id}`}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  background: '#f9fafb',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Image
                  src={album.image_url || '/images/placeholder.png'}
                  alt={album.title}
                  width={180}
                  height={180}
                  style={{
                    width: '100%',
                    height: 'auto',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    borderRadius: 6
                  }}
                  unoptimized
                />
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1f2937',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {album.title}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#6b7280',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {album.artist}
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  display: 'flex',
                  gap: 4,
                  flexWrap: 'wrap'
                }}>
                  {album.year && <span>{album.year}</span>}
                  {album.folder && <span>• {album.folder}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// Completely flexible collection organization with multi-select AND logic
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

export default function FlexibleOrganizePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Multi-select filter states
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedDecades, setSelectedDecades] = useState<number[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [yearRangeStart, setYearRangeStart] = useState<string>('');
  const [yearRangeEnd, setYearRangeEnd] = useState<string>('');
  const [artistSearch, setArtistSearch] = useState<string>('');
  const [titleSearch, setTitleSearch] = useState<string>('');

  // Available options
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [availableStyles, setAvailableStyles] = useState<string[]>([]);
  const [availableDecades, setAvailableDecades] = useState<number[]>([]);
  const [availableFormats, setAvailableFormats] = useState<string[]>([]);

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
    
    const formats = Array.from(new Set(allRows.map(r => r.format).filter(Boolean)));
    setAvailableFormats(formats.sort());
    
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

  // Apply ALL filters with AND logic - COMPLETELY FLEXIBLE
  const filteredAlbums = useMemo(() => {
    return rows.filter(row => {
      // Multi-select folder filter (OR within selected folders)
      if (selectedFolders.length > 0 && !selectedFolders.includes(row.folder)) return false;
      
      // Multi-select format filter (OR within selected formats)  
      if (selectedFormats.length > 0 && !selectedFormats.includes(row.format)) return false;
      
      // Multi-select genre filter (OR within selected genres)
      if (selectedGenres.length > 0) {
        if (!row.discogs_genres || !row.discogs_genres.some(g => selectedGenres.includes(g))) return false;
      }
      
      // Multi-select style filter (OR within selected styles)
      if (selectedStyles.length > 0) {
        if (!row.discogs_styles || !row.discogs_styles.some(s => selectedStyles.includes(s))) return false;
      }
      
      // Multi-select decade filter (OR within selected decades)
      if (selectedDecades.length > 0 && (!row.decade || !selectedDecades.includes(row.decade))) return false;
      
      // Year range filter
      if (yearRangeStart || yearRangeEnd) {
        const albumYear = parseInt(row.year || '0');
        if (isNaN(albumYear)) return false;
        if (yearRangeStart && albumYear < parseInt(yearRangeStart)) return false;
        if (yearRangeEnd && albumYear > parseInt(yearRangeEnd)) return false;
      }
      
      // Artist search
      if (artistSearch && !row.artist.toLowerCase().includes(artistSearch.toLowerCase())) return false;
      
      // Title search
      if (titleSearch && !row.title.toLowerCase().includes(titleSearch.toLowerCase())) return false;
      
      return true;
    });
  }, [rows, selectedFolders, selectedFormats, selectedGenres, selectedStyles, selectedDecades, yearRangeStart, yearRangeEnd, artistSearch, titleSearch]);

  const clearAllFilters = () => {
    setSelectedFolders([]);
    setSelectedGenres([]);
    setSelectedStyles([]);
    setSelectedDecades([]);
    setSelectedFormats([]);
    setYearRangeStart('');
    setYearRangeEnd('');
    setArtistSearch('');
    setTitleSearch('');
  };

  const hasActiveFilters = selectedFolders.length > 0 || selectedGenres.length > 0 || selectedStyles.length > 0 || 
                          selectedDecades.length > 0 || selectedFormats.length > 0 || yearRangeStart || yearRangeEnd || 
                          artistSearch || titleSearch;

  // Multi-select toggle helpers
  const toggleArraySelection = <T,>(array: T[], setArray: (arr: T[]) => void, item: T) => {
    if (array.includes(item)) {
      setArray(array.filter(i => i !== item));
    } else {
      setArray([...array, item]);
    }
  };

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
            Completely Flexible Collection Organization
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: 16,
            margin: 0
          }}>
            Select multiple options from any category - all filters work together with AND logic
          </p>
        </div>
      </div>

      {/* Completely Flexible Filters */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20
        }}>
          <h3 style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#1f2937',
            margin: 0
          }}>
            🎯 Multi-Select Filters (Pick Any Combination)
          </h3>
          
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              style={{
                background: '#ef4444',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* Search Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 20
        }}>
          <div>
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
              value={artistSearch}
              onChange={e => setArtistSearch(e.target.value)}
              placeholder="Search artist..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>
          
          <div>
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
              value={titleSearch}
              onChange={e => setTitleSearch(e.target.value)}
              placeholder="Search title..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 6
            }}>
              Year From
            </label>
            <input
              type="number"
              value={yearRangeStart}
              onChange={e => setYearRangeStart(e.target.value)}
              placeholder="1960"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 6
            }}>
              Year To
            </label>
            <input
              type="number"
              value={yearRangeEnd}
              onChange={e => setYearRangeEnd(e.target.value)}
              placeholder="1980"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>
        </div>

        {/* Multi-Select Format Filter */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 8
          }}>
            📀 Formats (Select Multiple)
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8
          }}>
            {availableFormats.map(format => (
              <button
                key={format}
                onClick={() => toggleArraySelection(selectedFormats, setSelectedFormats, format)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '2px solid #3b82f6',
                  borderRadius: 6,
                  background: selectedFormats.includes(format) ? '#3b82f6' : 'white',
                  color: selectedFormats.includes(format) ? 'white' : '#3b82f6',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {format}
              </button>
            ))}
          </div>
          {selectedFormats.length > 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Selected: {selectedFormats.join(', ')}
            </div>
          )}
        </div>

        {/* Multi-Select Folder Filter */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 8
          }}>
            📁 Folders (Select Multiple)
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8
          }}>
            {availableFolders.map(folder => (
              <button
                key={folder}
                onClick={() => toggleArraySelection(selectedFolders, setSelectedFolders, folder)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '2px solid #059669',
                  borderRadius: 6,
                  background: selectedFolders.includes(folder) ? '#059669' : 'white',
                  color: selectedFolders.includes(folder) ? 'white' : '#059669',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {folder}
              </button>
            ))}
          </div>
          {selectedFolders.length > 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Selected: {selectedFolders.join(', ')}
            </div>
          )}
        </div>

        {/* Multi-Select Genre Filter */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 8
          }}>
            🎵 Genres (Select Multiple)
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            maxHeight: 200,
            overflowY: 'auto',
            padding: 8,
            border: '1px solid #e5e7eb',
            borderRadius: 6
          }}>
            {availableGenres.map(genre => (
              <button
                key={genre}
                onClick={() => toggleArraySelection(selectedGenres, setSelectedGenres, genre)}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: '2px solid #7c3aed',
                  borderRadius: 4,
                  background: selectedGenres.includes(genre) ? '#7c3aed' : 'white',
                  color: selectedGenres.includes(genre) ? 'white' : '#7c3aed',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {genre}
              </button>
            ))}
          </div>
          {selectedGenres.length > 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Selected: {selectedGenres.join(', ')}
            </div>
          )}
        </div>

        {/* Multi-Select Style Filter */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 8
          }}>
            🎨 Styles (Select Multiple)
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            maxHeight: 200,
            overflowY: 'auto',
            padding: 8,
            border: '1px solid #e5e7eb',
            borderRadius: 6
          }}>
            {availableStyles.map(style => (
              <button
                key={style}
                onClick={() => toggleArraySelection(selectedStyles, setSelectedStyles, style)}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: '2px solid #f59e0b',
                  borderRadius: 4,
                  background: selectedStyles.includes(style) ? '#f59e0b' : 'white',
                  color: selectedStyles.includes(style) ? 'white' : '#f59e0b',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {style}
              </button>
            ))}
          </div>
          {selectedStyles.length > 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Selected: {selectedStyles.join(', ')}
            </div>
          )}
        </div>

        {/* Multi-Select Decade Filter */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 8
          }}>
            📅 Decades (Select Multiple)
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8
          }}>
            {availableDecades.map(decade => (
              <button
                key={decade}
                onClick={() => toggleArraySelection(selectedDecades, setSelectedDecades, decade)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '2px solid #dc2626',
                  borderRadius: 6,
                  background: selectedDecades.includes(decade) ? '#dc2626' : 'white',
                  color: selectedDecades.includes(decade) ? 'white' : '#dc2626',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {decade}s
              </button>
            ))}
          </div>
          {selectedDecades.length > 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Selected: {selectedDecades.map(d => `${d}s`).join(', ')}
            </div>
          )}
        </div>
        
        {/* Results Count */}
        <div style={{
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
              No albums match your filter combination
            </div>
            <div style={{ fontSize: 14 }}>
              Try adjusting your filter selection
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
                  {album.format && <span>• {album.format}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// Clean, usable flexible collection organization with proper UX
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
  const [yearRangeStart, setYearRangeStart] = useState<string>('');
  const [yearRangeEnd, setYearRangeEnd] = useState<string>('');
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
    
    // Extract unique options
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

  // Apply filters with complete flexibility and AND logic
  const filteredAlbums = useMemo(() => {
    return rows.filter(row => {
      // Folder filter (OR within selected)
      if (selectedFolders.length > 0 && !selectedFolders.includes(row.folder)) return false;
      
      // Genre filter (OR within selected)
      if (selectedGenres.length > 0) {
        if (!row.discogs_genres || !row.discogs_genres.some(g => selectedGenres.includes(g))) return false;
      }
      
      // Style filter (OR within selected)
      if (selectedStyles.length > 0) {
        if (!row.discogs_styles || !row.discogs_styles.some(s => selectedStyles.includes(s))) return false;
      }
      
      // Decade filter (OR within selected)
      if (selectedDecades.length > 0 && (!row.decade || !selectedDecades.includes(row.decade))) return false;
      
      // Year range filter
      if (yearRangeStart || yearRangeEnd) {
        const albumYear = parseInt(row.year || '0');
        if (isNaN(albumYear)) return false;
        if (yearRangeStart && albumYear < parseInt(yearRangeStart)) return false;
        if (yearRangeEnd && albumYear > parseInt(yearRangeEnd)) return false;
      }
      
      // Text searches
      if (artistSearch && !row.artist.toLowerCase().includes(artistSearch.toLowerCase())) return false;
      if (titleSearch && !row.title.toLowerCase().includes(titleSearch.toLowerCase())) return false;
      
      return true;
    });
  }, [rows, selectedFolders, selectedGenres, selectedStyles, selectedDecades, yearRangeStart, yearRangeEnd, artistSearch, titleSearch]);

  const clearAllFilters = () => {
    setSelectedFolders([]);
    setSelectedGenres([]);
    setSelectedStyles([]);
    setSelectedDecades([]);
    setYearRangeStart('');
    setYearRangeEnd('');
    setArtistSearch('');
    setTitleSearch('');
  };

  const hasActiveFilters = selectedFolders.length > 0 || selectedGenres.length > 0 || selectedStyles.length > 0 || 
                          selectedDecades.length > 0 || yearRangeStart || yearRangeEnd || artistSearch || titleSearch;

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
            Flexible Collection Organization
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: 16,
            margin: 0
          }}>
            Combine any filters - select vinyl + 45s from 1960s-1980s that are prog rock
          </p>
        </div>
        
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            style={{
              background: '#ef4444',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Clean Filter Interface */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#1f2937',
          margin: '0 0 20px 0'
        }}>
          🎯 Multi-Select Filters (All Work Together)
        </h3>

        {/* Search Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
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
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>
          
          <div>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
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
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
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
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
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
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>
        </div>

        {/* Multi-select dropdowns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 16,
          marginBottom: 20
        }}>
          {/* Folders Multi-Select */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 6
            }}>
              📁 Folders (Hold Ctrl/Cmd to select multiple)
            </label>
            <select
              multiple
              value={selectedFolders}
              onChange={e => setSelectedFolders(Array.from(e.target.selectedOptions, option => option.value))}
              style={{
                width: '100%',
                height: 120,
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13
              }}
            >
              {availableFolders.map(folder => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
            {selectedFolders.length > 0 && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Selected: {selectedFolders.join(', ')}
              </div>
            )}
          </div>

          {/* Genres Multi-Select */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 6
            }}>
              🎵 Genres (Hold Ctrl/Cmd to select multiple)
            </label>
            <select
              multiple
              value={selectedGenres}
              onChange={e => setSelectedGenres(Array.from(e.target.selectedOptions, option => option.value))}
              style={{
                width: '100%',
                height: 120,
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13
              }}
            >
              {availableGenres.map(genre => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
            {selectedGenres.length > 0 && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Selected: {selectedGenres.join(', ')}
              </div>
            )}
          </div>

          {/* Styles Multi-Select */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 6
            }}>
              🎨 Styles (Hold Ctrl/Cmd to select multiple)
            </label>
            <select
              multiple
              value={selectedStyles}
              onChange={e => setSelectedStyles(Array.from(e.target.selectedOptions, option => option.value))}
              style={{
                width: '100%',
                height: 120,
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13
              }}
            >
              {availableStyles.map(style => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
            {selectedStyles.length > 0 && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Selected: {selectedStyles.join(', ')}
              </div>
            )}
          </div>

          {/* Decades Multi-Select */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 6
            }}>
              📅 Decades (Hold Ctrl/Cmd to select multiple)
            </label>
            <select
              multiple
              value={selectedDecades.map(String)}
              onChange={e => setSelectedDecades(Array.from(e.target.selectedOptions, option => parseInt(option.value)))}
              style={{
                width: '100%',
                height: 120,
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13
              }}
            >
              {availableDecades.map(decade => (
                <option key={decade} value={decade}>
                  {decade}s
                </option>
              ))}
            </select>
            {selectedDecades.length > 0 && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Selected: {selectedDecades.map(d => `${d}s`).join(', ')}
              </div>
            )}
          </div>
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
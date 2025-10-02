// src/app/admin/organize/page.tsx - Clean version without duplicates
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
  master_release_date: string | null;
  format: string;
  image_url: string | null;
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  decade: number | null;
  folder: string;
};

type LyricSearchResult = {
  collection_id: number;
  artist: string;
  album_title: string;
  track_title: string;
  track_position: string | null;
  genius_url: string | null;
  image_url: string | null;
};

export default function FlexibleOrganizePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrichStatus, setEnrichStatus] = useState<string>('');

  // Lyric search state
  const [lyricSearchTerm, setLyricSearchTerm] = useState('');
  const [lyricSearchFolder, setLyricSearchFolder] = useState('');
  const [lyricSearching, setLyricSearching] = useState(false);
  const [lyricResults, setLyricResults] = useState<LyricSearchResult[]>([]);
  const [lyricSearchMessage, setLyricSearchMessage] = useState('');

  // Multi-select filters
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
        .select('id,artist,title,year,master_release_date,format,image_url,discogs_genres,discogs_styles,decade,folder')
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

  // Lyric search handler
  const handleLyricSearch = async () => {
    if (!lyricSearchTerm.trim()) {
      setLyricSearchMessage('Please enter a search term');
      return;
    }

    setLyricSearching(true);
    setLyricSearchMessage('Searching lyrics...');
    setLyricResults([]);

    try {
      const body: { term: string; folder?: string } = {
        term: lyricSearchTerm.trim()
      };
      
      if (lyricSearchFolder) {
        body.folder = lyricSearchFolder;
      }

      const res = await fetch('/api/search-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();

      if (result.success) {
        setLyricResults(result.results || []);
        if (result.cached) {
          setLyricSearchMessage(`✅ Found ${result.count} tracks (from cache)`);
        } else {
          setLyricSearchMessage(result.message || `✅ Found ${result.count} tracks`);
        }
      } else {
        setLyricSearchMessage(`❌ Search failed: ${result.error}`);
      }
    } catch (error) {
      setLyricSearchMessage(`❌ Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLyricSearching(false);
    }
  };

  // Apply filters
  const filteredAlbums = useMemo(() => {
    return rows.filter(row => {
      if (selectedFolders.length > 0 && !selectedFolders.includes(row.folder)) return false;
      
      if (selectedGenres.length > 0) {
        if (!row.discogs_genres || !row.discogs_genres.some(g => selectedGenres.includes(g))) return false;
      }
      
      if (selectedStyles.length > 0) {
        if (!row.discogs_styles || !row.discogs_styles.some(s => selectedStyles.includes(s))) return false;
      }
      
      if (selectedDecades.length > 0) {
        const originalYear = row.master_release_date || row.year;
        if (!originalYear) return false;
        
        const yearNum = parseInt(originalYear);
        if (isNaN(yearNum)) return false;
        
        const originalDecade = Math.floor(yearNum / 10) * 10;
        if (!selectedDecades.includes(originalDecade)) return false;
      }
      
      if (yearRangeStart || yearRangeEnd) {
        const originalYear = row.master_release_date || row.year;
        const albumYear = parseInt(originalYear || '0');
        if (isNaN(albumYear)) return false;
        if (yearRangeStart && albumYear < parseInt(yearRangeStart)) return false;
        if (yearRangeEnd && albumYear > parseInt(yearRangeEnd)) return false;
      }
      
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

  const toggleFolder = (folder: string) => {
    setSelectedFolders(prev => 
      prev.includes(folder) 
        ? prev.filter(f => f !== folder)
        : [...prev, folder]
    );
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const toggleStyle = (style: string) => {
    setSelectedStyles(prev => 
      prev.includes(style) 
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
  };

  const toggleDecade = (decade: number) => {
    setSelectedDecades(prev => 
      prev.includes(decade) 
        ? prev.filter(d => d !== decade)
        : [...prev, decade]
    );
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
            Collection Organization & Search
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: 16,
            margin: 0
          }}>
            Organize by metadata or search lyrics content
          </p>
        </div>
        
        <button
          onClick={async () => {
            setLoading(true);
            setEnrichStatus('Starting enrichment...');
            
            let totalUpdated = 0;
            let totalScanned = 0;
            let cursor: number | null = 0;
            
            try {
              while (cursor !== null) {
                setEnrichStatus(`Enriching batch... (${totalUpdated} updated / ${totalScanned} scanned so far)`);
                
                const res = await fetch('/api/enrich', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ cursor, limit: 80 })
                });
                
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}`);
                }
                
                const result = await res.json();
                totalUpdated += result.updated || 0;
                totalScanned += result.scanned || 0;
                cursor = result.nextCursor;
                
                setEnrichStatus(`Processed batch: ${result.updated} updated, ${result.scanned} scanned. Total: ${totalUpdated} updated / ${totalScanned} scanned`);
                
                if (cursor !== null) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
              
              setEnrichStatus(`✅ Enrichment complete! Updated ${totalUpdated} items out of ${totalScanned} scanned`);
              await load();
              
              setTimeout(() => setEnrichStatus(''), 5000);
              
            } catch (err) {
              setEnrichStatus(`❌ Enrichment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
              setTimeout(() => setEnrichStatus(''), 10000);
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          style={{
            background: loading ? '#9ca3af' : '#059669',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Enriching...' : 'Enrich Missing Metadata'}
        </button>

        {enrichStatus && (
          <div style={{
            marginTop: 12,
            padding: 12,
            background: enrichStatus.includes('❌') ? '#fee2e2' : 
                       enrichStatus.includes('✅') ? '#dcfce7' : '#dbeafe',
            border: `1px solid ${enrichStatus.includes('❌') ? '#dc2626' : 
                                 enrichStatus.includes('✅') ? '#16a34a' : '#3b82f6'}`,
            borderRadius: 6,
            fontSize: 14,
            color: enrichStatus.includes('❌') ? '#991b1b' : 
                   enrichStatus.includes('✅') ? '#15803d' : '#1e40af',
            fontWeight: 500
          }}>
            {enrichStatus}
          </div>
        )}
        
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

      {/* LYRIC SEARCH SECTION */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        border: '2px solid #7c3aed',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        color: 'white'
      }}>
        <h2 style={{
          fontSize: 24,
          fontWeight: 'bold',
          margin: '0 0 8px 0'
        }}>
          🎵 Lyric Content Search
        </h2>
        <p style={{
          fontSize: 14,
          margin: '0 0 20px 0',
          opacity: 0.9
        }}>
          Search for tracks that mention specific words or phrases in their lyrics
        </p>

        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16
        }}>
          <input
            type="text"
            value={lyricSearchTerm}
            onChange={e => setLyricSearchTerm(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !lyricSearching) {
                handleLyricSearch();
              }
            }}
            placeholder="Search lyrics... (e.g., artificial intelligence, Memphis)"
            style={{
              flex: '1 1 300px',
              padding: '12px 16px',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              backgroundColor: 'white',
              color: '#1f2937'
            }}
            disabled={lyricSearching}
          />

          <select
            value={lyricSearchFolder}
            onChange={e => setLyricSearchFolder(e.target.value)}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              backgroundColor: 'white',
              color: '#1f2937',
              minWidth: 150
            }}
            disabled={lyricSearching}
          >
            <option value="">All Folders</option>
            {availableFolders.map(folder => (
              <option key={folder} value={folder}>{folder}</option>
            ))}
          </select>

          <button
            onClick={handleLyricSearch}
            disabled={lyricSearching || !lyricSearchTerm.trim()}
            style={{
              padding: '12px 24px',
              background: lyricSearching || !lyricSearchTerm.trim() ? '#9ca3af' : 'white',
              color: lyricSearching || !lyricSearchTerm.trim() ? 'white' : '#7c3aed',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: lyricSearching || !lyricSearchTerm.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {lyricSearching ? '🔍 Searching...' : '🔍 Search Lyrics'}
          </button>
        </div>

        {lyricSearchMessage && (
          <div style={{
            padding: 12,
            background: lyricSearchMessage.includes('❌') ? '#fee2e2' :
                       lyricSearchMessage.includes('✅') ? '#dcfce7' : '#dbeafe',
            border: `1px solid ${lyricSearchMessage.includes('❌') ? '#dc2626' :
                                 lyricSearchMessage.includes('✅') ? '#16a34a' : '#3b82f6'}`,
            borderRadius: 6,
            fontSize: 13,
            color: lyricSearchMessage.includes('❌') ? '#991b1b' :
                   lyricSearchMessage.includes('✅') ? '#15803d' : '#1e40af',
            fontWeight: 500
          }}>
            {lyricSearchMessage}
          </div>
        )}

        {lyricResults.length > 0 && (
          <div style={{
            marginTop: 20,
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 8,
            padding: 16,
            maxHeight: 500,
            overflowY: 'auto'
          }}>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#7c3aed',
              marginBottom: 12
            }}>
              Found {lyricResults.length} tracks mentioning &quot;{lyricSearchTerm}&quot;
            </div>

            <div style={{
              display: 'grid',
              gap: 12
            }}>
              {lyricResults.map((result, idx) => (
                <Link
                  key={`${result.collection_id}-${result.track_title}-${idx}`}
                  href={`/admin/edit-entry/${result.collection_id}`}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: 12,
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    textDecoration: 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.2)';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <Image
                    src={result.image_url || '/images/placeholder.png'}
                    alt={result.album_title}
                    width={60}
                    height={60}
                    style={{
                      borderRadius: 4,
                      objectFit: 'cover'
                    }}
                    unoptimized
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1f2937',
                      marginBottom: 2
                    }}>
                      {result.track_title}
                      {result.track_position && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 12,
                          color: '#6b7280',
                          fontWeight: 400
                        }}>
                          ({result.track_position})
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: '#6b7280',
                      marginBottom: 4
                    }}>
                      {result.artist} - {result.album_title}
                    </div>
                    {result.genius_url && (
                      <a
                        href={result.genius_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontSize: 12,
                          color: '#7c3aed',
                          textDecoration: 'none'
                        }}
                      >
                        View lyrics on Genius →
                      </a>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Select Filters */}
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
          ✅ Metadata Filters - Complete Flexibility
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
                fontSize: 14,
                backgroundColor: 'white',
                color: '#1f2937'
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
                fontSize: 14,
                backgroundColor: 'white',
                color: '#1f2937'
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
              Original Release Year From
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
                fontSize: 14,
                backgroundColor: 'white',
                color: '#1f2937'
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
              Original Release Year To
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
                fontSize: 14,
                backgroundColor: 'white',
                color: '#1f2937'
              }}
            />
          </div>
        </div>

        {/* Checkbox Multi-Select Sections */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
          marginBottom: 20
        }}>
          
          {/* Folders */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            background: '#f9fafb'
          }}>
            <h4 style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: 12,
              margin: 0
            }}>
              📁 Folders ({selectedFolders.length} selected)
            </h4>
            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {availableFolders.map(folder => (
                <label key={folder} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '4px 0',
                  fontSize: 14,
                  color: '#374151'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedFolders.includes(folder)}
                    onChange={() => toggleFolder(folder)}
                    style={{
                      transform: 'scale(1.2)',
                      accentColor: '#3b82f6'
                    }}
                  />
                  {folder}
                </label>
              ))}
            </div>
          </div>

          {/* Genres */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            background: '#f9fafb'
          }}>
            <h4 style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: 12,
              margin: 0
            }}>
              🎵 Genres ({selectedGenres.length} selected)
            </h4>
            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {availableGenres.map(genre => (
                <label key={genre} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '4px 0',
                  fontSize: 14,
                  color: '#374151'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedGenres.includes(genre)}
                    onChange={() => toggleGenre(genre)}
                    style={{
                      transform: 'scale(1.2)',
                      accentColor: '#7c3aed'
                    }}
                  />
                  {genre}
                </label>
              ))}
            </div>
          </div>

          {/* Styles */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            background: '#f9fafb'
          }}>
            <h4 style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: 12,
              margin: 0
            }}>
              🎨 Styles ({selectedStyles.length} selected)
            </h4>
            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {availableStyles.map(style => (
                <label key={style} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '4px 0',
                  fontSize: 14,
                  color: '#374151'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedStyles.includes(style)}
                    onChange={() => toggleStyle(style)}
                    style={{
                      transform: 'scale(1.2)',
                      accentColor: '#f59e0b'
                    }}
                  />
                  {style}
                </label>
              ))}
            </div>
          </div>

          {/* Decades */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            background: '#f9fafb'
          }}>
            <h4 style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: 12,
              margin: 0
            }}>
              📅 Decades ({selectedDecades.length} selected)
            </h4>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {availableDecades.map(decade => (
                <label key={decade} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '4px 0',
                  fontSize: 14,
                  color: '#374151'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedDecades.includes(decade)}
                    onChange={() => toggleDecade(decade)}
                    style={{
                      transform: 'scale(1.2)',
                      accentColor: '#dc2626'
                    }}
                  />
                  {decade}s
                </label>
              ))}
            </div>
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
              Try adjusting your checkbox selections
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
                  {album.master_release_date && album.master_release_date !== album.year ? (
                    <span title="Original release / This pressing">{album.master_release_date} ({album.year})</span>
                  ) : (
                    album.year && <span>{album.year}</span>
                  )}
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
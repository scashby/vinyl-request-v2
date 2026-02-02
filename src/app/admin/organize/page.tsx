// src/app/admin/organize/page.tsx - COMPLETE FILE with Tag Filtering
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
  discogs_genres: string | string[] | null;
  discogs_styles: string | string[] | null;
  spotify_genres: string | string[] | null;
  apple_music_genres: string | string[] | null;
  decade: number | null;
  folder: string;
  custom_tags: string[] | null;
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

type TagDefinition = {
  id: string;
  name: string;
  category: string;
  color: string;
};

function parseGenres(value: string | string[] | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

export default function FlexibleOrganizePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrichStatus, setEnrichStatus] = useState<string>('');

  const [lyricSearchTerm, setLyricSearchTerm] = useState('');
  const [lyricSearchFolder, setLyricSearchFolder] = useState('');
  const [lyricSearching, setLyricSearching] = useState(false);
  const [lyricResults, setLyricResults] = useState<LyricSearchResult[]>([]);
  const [lyricSearchMessage, setLyricSearchMessage] = useState('');

  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedGenresStyles, setSelectedGenresStyles] = useState<string[]>([]);
  const [selectedDecades, setSelectedDecades] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [yearRangeStart, setYearRangeStart] = useState<string>('');
  const [yearRangeEnd, setYearRangeEnd] = useState<string>('');
  const [artistSearch, setArtistSearch] = useState<string>('');
  const [titleSearch, setTitleSearch] = useState<string>('');

  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [availableGenresStyles, setAvailableGenresStyles] = useState<string[]>([]);
  const [availableDecades, setAvailableDecades] = useState<number[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    
    // Load tag definitions
    const { data: tagDefs } = await supabase
      .from('tag_definitions')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    
    if (tagDefs) {
      setTagDefinitions(tagDefs as TagDefinition[]);
    }
    
    // Load albums with tags
    let allRows: Row[] = [];
    let from = 0;
    const batchSize = 1000;
    let keepGoing = true;
    
    while (keepGoing) {
      const { data: batch, error } = await supabase
        .from('v2_legacy_archive')
        .select('id,artist,title,year,master_release_date,format,image_url,discogs_genres,discogs_styles,spotify_genres,apple_music_genres,decade,folder,custom_tags')
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
    
    const folders = Array.from(new Set(allRows.map(r => r.folder).filter(Boolean)));
    setAvailableFolders(folders.sort());
    
    const genresStyles = new Set<string>();
    
    allRows.forEach(r => {
      parseGenres(r.discogs_genres).forEach(g => genresStyles.add(g));
      parseGenres(r.discogs_styles).forEach(s => genresStyles.add(s));
      parseGenres(r.spotify_genres).forEach(g => genresStyles.add(g));
      parseGenres(r.apple_music_genres).forEach(g => genresStyles.add(g));
    });
    
    setAvailableGenresStyles(Array.from(genresStyles).sort());
    
    const decades = Array.from(new Set(allRows.map(r => r.decade).filter(Boolean))).sort() as number[];
    setAvailableDecades(decades);
    
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const filteredAlbums = useMemo(() => {
    return rows.filter(row => {
      if (selectedFolders.length > 0 && !selectedFolders.includes(row.folder)) return false;
      
      if (selectedGenresStyles.length > 0) {
        const albumGenresStyles = [
          ...parseGenres(row.discogs_genres),
          ...parseGenres(row.discogs_styles),
          ...parseGenres(row.spotify_genres),
          ...parseGenres(row.apple_music_genres)
        ];
        if (!albumGenresStyles.some(gs => selectedGenresStyles.includes(gs))) return false;
      }
      
      if (selectedDecades.length > 0) {
        const originalYear = row.master_release_date || row.year;
        if (!originalYear) return false;
        
        const yearNum = parseInt(originalYear);
        if (isNaN(yearNum)) return false;
        
        const originalDecade = Math.floor(yearNum / 10) * 10;
        if (!selectedDecades.includes(originalDecade)) return false;
      }
      
      // Tag filtering - album must have ALL selected tags
      if (selectedTags.length > 0) {
        if (!row.custom_tags || row.custom_tags.length === 0) return false;
        if (!selectedTags.every(tag => row.custom_tags?.includes(tag))) return false;
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
  }, [rows, selectedFolders, selectedGenresStyles, selectedDecades, selectedTags, yearRangeStart, yearRangeEnd, artistSearch, titleSearch]);

  const clearAllFilters = () => {
    setSelectedFolders([]);
    setSelectedGenresStyles([]);
    setSelectedDecades([]);
    setSelectedTags([]);
    setYearRangeStart('');
    setYearRangeEnd('');
    setArtistSearch('');
    setTitleSearch('');
  };

  const hasActiveFilters = selectedFolders.length > 0 || selectedGenresStyles.length > 0 || 
                          selectedDecades.length > 0 || selectedTags.length > 0 || 
                          yearRangeStart || yearRangeEnd || artistSearch || titleSearch;

  const toggleFolder = (folder: string) => {
    setSelectedFolders(prev => 
      prev.includes(folder) 
        ? prev.filter(f => f !== folder)
        : [...prev, folder]
    );
  };

  const toggleGenreStyle = (genreStyle: string) => {
    setSelectedGenresStyles(prev => 
      prev.includes(genreStyle) 
        ? prev.filter(gs => gs !== genreStyle)
        : [...prev, genreStyle]
    );
  };

  const toggleDecade = (decade: number) => {
    setSelectedDecades(prev => 
      prev.includes(decade) 
        ? prev.filter(d => d !== decade)
        : [...prev, decade]
    );
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  // Group tags by category for better UI
  const tagsByCategory = useMemo(() => {
    const grouped: Record<string, TagDefinition[]> = {};
    tagDefinitions.forEach(tag => {
      if (!grouped[tag.category]) {
        grouped[tag.category] = [];
      }
      grouped[tag.category].push(tag);
    });
    return grouped;
  }, [tagDefinitions]);

  return (
    <div style={{
      padding: 24,
      background: '#f8fafc',
      minHeight: '100vh',
      maxWidth: 1400,
      margin: '0 auto'
    }}>
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
            Organize by metadata, tags, or search lyrics content
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/admin/manage-tags"
            style={{
              background: '#8b5cf6',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: 'white',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            🏷️ Manage Tags
          </Link>

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
      </div>

      {enrichStatus && (
        <div style={{
          marginBottom: 24,
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

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
          marginBottom: 20
        }}>
          
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
              🎵 All Genres & Styles ({selectedGenresStyles.length} selected)
            </h4>
            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {availableGenresStyles.map(genreStyle => (
                <label key={genreStyle} style={{
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
                    checked={selectedGenresStyles.includes(genreStyle)}
                    onChange={() => toggleGenreStyle(genreStyle)}
                    style={{
                      transform: 'scale(1.2)',
                      accentColor: '#7c3aed'
                    }}
                  />
                  {genreStyle}
                </label>
              ))}
            </div>
          </div>

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

          {/* NEW: TAG FILTERING SECTION */}
          <div style={{
            border: '2px solid #8b5cf6',
            borderRadius: 8,
            padding: 16,
            background: 'linear-gradient(to bottom, #faf5ff, #f9fafb)',
            gridColumn: 'span 3'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12
            }}>
              <h4 style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#7c3aed',
                margin: 0
              }}>
                🏷️ Custom Tags ({selectedTags.length} selected)
              </h4>
              <span style={{
                fontSize: 12,
                color: '#6b7280',
                fontStyle: 'italic'
              }}>
                Albums must have ALL selected tags
              </span>
            </div>
            
            {Object.keys(tagsByCategory).length === 0 ? (
              <div style={{
                padding: 20,
                textAlign: 'center',
                color: '#6b7280',
                fontSize: 14
              }}>
                No tags defined yet. <Link href="/admin/manage-tags" style={{ color: '#8b5cf6' }}>Create tags →</Link>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16
              }}>
                {Object.entries(tagsByCategory).map(([category, tags]) => (
                  <div key={category}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                      letterSpacing: '0.5px'
                    }}>
                      {category}
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}>
                      {tags.map(tag => (
                        <label key={tag.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 13,
                          color: '#374151',
                          transition: 'all 0.2s',
                          background: selectedTags.includes(tag.name) ? `${tag.color}20` : 'transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag.name)}
                            onChange={() => toggleTag(tag.name)}
                            style={{
                              transform: 'scale(1.1)',
                              accentColor: tag.color
                            }}
                          />
                          <span style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: tag.color,
                            flexShrink: 0
                          }} />
                          {tag.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
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
                
                {/* Show tags on album cards */}
                {album.custom_tags && album.custom_tags.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    marginTop: 4
                  }}>
                    {album.custom_tags.slice(0, 3).map(tagName => {
                      const tagDef = tagDefinitions.find(t => t.name === tagName);
                      return (
                        <span
                          key={tagName}
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: tagDef?.color || '#6b7280',
                            color: 'white',
                            fontWeight: 500
                          }}
                        >
                          {tagName}
                        </span>
                      );
                    })}
                    {album.custom_tags.length > 3 && (
                      <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        color: '#6b7280'
                      }}>
                        +{album.custom_tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
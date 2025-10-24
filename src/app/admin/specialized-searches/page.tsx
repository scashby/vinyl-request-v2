// src/app/admin/specialized-searches/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type TabType = 'cd-only' | '1001-albums';

export default function SpecializedSearchesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('cd-only');

  return (
    <div style={{
      padding: 24,
      background: '#f8fafc',
      minHeight: '100vh',
      maxWidth: 1400,
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 'bold',
          color: '#1f2937',
          margin: '0 0 8px 0'
        }}>
          🔎 Specialized Searches
        </h1>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          margin: 0
        }}>
          Find specific subsets of your collection with specialized search tools
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        marginBottom: 24
      }}>
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <button
            onClick={() => setActiveTab('cd-only')}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === 'cd-only' ? '#8b5cf6' : 'white',
              color: activeTab === 'cd-only' ? 'white' : '#6b7280',
              border: 'none',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              borderBottom: activeTab === 'cd-only' ? '3px solid #7c3aed' : 'none'
            }}
          >
            💿 CD-Only Releases
          </button>
          <button
            onClick={() => setActiveTab('1001-albums')}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === '1001-albums' ? '#8b5cf6' : 'white',
              color: activeTab === '1001-albums' ? 'white' : '#6b7280',
              border: 'none',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              borderBottom: activeTab === '1001-albums' ? '3px solid #7c3aed' : 'none'
            }}
          >
            📖 1001 Albums
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: 32 }}>
          {activeTab === 'cd-only' && <CDOnlyTab />}
          {activeTab === '1001-albums' && <Thousand1AlbumsTab />}
        </div>
      </div>

      {/* Back Link */}
      <div style={{ textAlign: 'center' }}>
        <Link
          href="/admin/admin-dashboard"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: '#6b7280',
            color: 'white',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// CD-ONLY TAB - COMPLETE WITH ALL FEATURES
// ============================================================================

type CDOnlyAlbum = {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  image_url: string | null;
  discogs_release_id: string | null;
  discogs_genres: string[] | null;
  folder: string | null;
  has_vinyl: boolean | null;
  cd_only_tagged?: boolean;
};

function CDOnlyTab() {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<CDOnlyAlbum[]>([]);
  const [filteredResults, setFilteredResults] = useState<CDOnlyAlbum[]>([]);
  const [stats, setStats] = useState({ total: 0, scanned: 0, cdOnly: 0 });
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [artistFilter, setArtistFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, artistFilter, yearFilter, genreFilter]);

  const applyFilters = () => {
    let filtered = [...results];

    if (artistFilter) {
      filtered = filtered.filter(album => 
        album.artist.toLowerCase().includes(artistFilter.toLowerCase())
      );
    }

    if (yearFilter) {
      filtered = filtered.filter(album => 
        album.year && album.year.includes(yearFilter)
      );
    }

    if (genreFilter) {
      filtered = filtered.filter(album => 
        album.discogs_genres && album.discogs_genres.some(g => 
          g.toLowerCase().includes(genreFilter.toLowerCase())
        )
      );
    }

    setFilteredResults(filtered);
  };

  const startScan = async () => {
    setScanning(true);
    setLoading(true);
    setError(null);
    setResults([]);
    setStats({ total: 0, scanned: 0, cdOnly: 0 });

    try {
      const response = await fetch('/api/cd-only-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan' })
      });

      if (!response.ok) {
        throw new Error('Failed to scan collection');
      }

      const data = await response.json();
      setResults(data.results || []);
      setStats(data.stats || { total: 0, scanned: 0, cdOnly: 0 });
      
      // Extract unique genres
      const genres = new Set<string>();
      (data.results || []).forEach((album: CDOnlyAlbum) => {
        if (album.discogs_genres) {
          album.discogs_genres.forEach(g => genres.add(g));
        }
      });
      setAvailableGenres(Array.from(genres).sort());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Artist', 'Title', 'Year', 'Genres', 'Folder'];
    const rows = filteredResults.map(album => [
      album.artist,
      album.title,
      album.year || '',
      (album.discogs_genres || []).join('; '),
      album.folder || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cd-only-releases-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredResults.map(a => a.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const tagSelected = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const response = await fetch('/api/cd-only-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'tag',
          albumIds: Array.from(selectedIds)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to tag albums');
      }

      // Update local state
      setResults(results.map(album => 
        selectedIds.has(album.id) 
          ? { ...album, cd_only_tagged: true }
          : album
      ));
      clearSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to tag albums');
    }
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>💿</div>
        <h2 style={{
          fontSize: 24,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 12
        }}>
          CD-Only Release Finder
        </h2>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          maxWidth: 600,
          margin: '0 auto 24px'
        }}>
          Find albums in your collection that were never released on vinyl
        </p>
      </div>

      {/* Info Box */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #3b82f6',
        borderRadius: 8,
        padding: 20,
        marginBottom: 24
      }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#1e40af',
          marginBottom: 8
        }}>
          ℹ️ About This Tool
        </h3>
        <p style={{
          color: '#1e40af',
          fontSize: 14,
          lineHeight: 1.6,
          margin: 0
        }}>
          This tool searches Discogs to identify albums in your collection that were
          only released on CD and never pressed to vinyl. Filter by artist, year, or genre,
          export results to CSV, and tag albums for easy reference.
        </p>
      </div>

      {/* Scan Button */}
      {!scanning && results.length === 0 && (
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <button
            onClick={startScan}
            disabled={loading}
            style={{
              padding: '16px 32px',
              background: loading ? '#9ca3af' : '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {loading ? '🔍 Scanning Collection...' : '🚀 Start CD-Only Scan'}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          background: '#fee',
          border: '1px solid #f87171',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          color: '#991b1b'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Scanning Progress */}
      {scanning && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>
            Scanning Collection...
          </div>
          <p style={{ color: '#78350f', fontSize: 14, margin: 0 }}>
            Scanned: {stats.scanned} albums | CD-Only Found: {stats.cdOnly}
          </p>
        </div>
      )}

      {/* Results */}
      {!scanning && results.length > 0 && (
        <>
          {/* Summary */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #10b981',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#065f46', marginBottom: 8 }}>
              ✅ Scan Complete
            </h3>
            <p style={{ color: '#065f46', fontSize: 14, margin: 0 }}>
              Found <strong>{stats.cdOnly}</strong> CD-only releases out of {stats.scanned} albums scanned
              {filteredResults.length < results.length && (
                <> • Showing <strong>{filteredResults.length}</strong> filtered results</>
              )}
            </p>
          </div>

          {/* Filters & Actions */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24
          }}>
            {/* Filters */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>
                🔍 Filters
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12
              }}>
                <input
                  type="text"
                  placeholder="Filter by artist..."
                  value={artistFilter}
                  onChange={(e) => setArtistFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
                <input
                  type="text"
                  placeholder="Filter by year..."
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
                <select
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                >
                  <option value="">All Genres</option>
                  {availableGenres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setArtistFilter('');
                    setYearFilter('');
                    setGenreFilter('');
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Bulk Actions */}
            <div style={{
              borderTop: '1px solid #e5e7eb',
              paddingTop: 16
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>
                ⚡ Quick Actions
              </h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={selectAll}
                  style={{
                    padding: '8px 16px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  Select All ({filteredResults.length})
                </button>
                <button
                  onClick={clearSelection}
                  style={{
                    padding: '8px 16px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  Clear Selection
                </button>
                <button
                  onClick={tagSelected}
                  disabled={selectedIds.size === 0}
                  style={{
                    padding: '8px 16px',
                    background: selectedIds.size === 0 ? '#f3f4f6' : '#8b5cf6',
                    color: selectedIds.size === 0 ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  🏷️ Tag Selected ({selectedIds.size})
                </button>
                <button
                  onClick={exportToCSV}
                  style={{
                    padding: '8px 16px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  📥 Export to CSV
                </button>
              </div>
            </div>
          </div>

          {/* Album Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 16
          }}>
            {filteredResults.map((album) => (
              <div
                key={album.id}
                onClick={() => toggleSelection(album.id)}
                style={{
                  background: 'white',
                  border: selectedIds.has(album.id) ? '2px solid #8b5cf6' : '1px solid #e5e7eb',
                  borderRadius: 8,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {selectedIds.has(album.id) && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: '#8b5cf6',
                    color: 'white',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 'bold',
                    zIndex: 10
                  }}>
                    ✓
                  </div>
                )}
                {album.cd_only_tagged && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: '#10b981',
                    color: 'white',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 10,
                    fontWeight: 'bold',
                    zIndex: 10
                  }}>
                    🏷️ TAGGED
                  </div>
                )}
                {album.image_url && (
                  <Image
                    src={album.image_url}
                    alt={`${album.artist} - ${album.title}`}
                    width={180}
                    height={180}
                    style={{ objectFit: 'cover', width: '100%', height: 180 }}
                    unoptimized
                  />
                )}
                <div style={{ padding: 12 }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#1f2937',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {album.artist}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: '#6b7280',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 4
                  }}>
                    {album.title}
                  </div>
                  {album.year && (
                    <div style={{
                      fontSize: 11,
                      color: '#9ca3af',
                      marginBottom: 4
                    }}>
                      {album.year}
                    </div>
                  )}
                  {album.discogs_genres && album.discogs_genres.length > 0 && (
                    <div style={{
                      fontSize: 10,
                      color: '#9ca3af',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {album.discogs_genres.slice(0, 2).join(', ')}
                    </div>
                  )}
                  <div style={{
                    marginTop: 8,
                    padding: '4px 8px',
                    background: '#fef3c7',
                    color: '#92400e',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    textAlign: 'center'
                  }}>
                    💿 CD Only
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button
              onClick={() => {
                setResults([]);
                setFilteredResults([]);
                setStats({ total: 0, scanned: 0, cdOnly: 0 });
                setSelectedIds(new Set());
                setArtistFilter('');
                setYearFilter('');
                setGenreFilter('');
              }}
              style={{
                padding: '12px 24px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🔄 New Scan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// 1001 ALBUMS TAB - COMPLETE WITH ALL FEATURES
// ============================================================================

type CollectionMatch = {
  collection_id: number;
  album_1001_id: number;
  artist: string;
  title: string;
  year: string | null;
  image_url: string | null;
  owned: boolean;
  listened: boolean;
};

type ProgressStats = {
  total1001: number;
  owned: number;
  listened: number;
  missing: number;
  completionPercent: number;
};

function Thousand1AlbumsTab() {
  const [view, setView] = useState<'overview' | 'review' | 'collection' | 'wishlist'>('overview');
  const [stats, setStats] = useState<ProgressStats>({
    total1001: 0,
    owned: 0,
    listened: 0,
    missing: 0,
    completionPercent: 0
  });
  
  // Filter states
  const [decadeFilter, setDecadeFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [artistFilter, setArtistFilter] = useState('');
  
  const [albums, setAlbums] = useState<CollectionMatch[]>([]);
  const [filteredAlbums, setFilteredAlbums] = useState<CollectionMatch[]>([]);
  const [availableDecades, setAvailableDecades] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albums, decadeFilter, genreFilter, artistFilter, view]);

  const applyFilters = () => {
    let filtered = [...albums];

    // View-based filtering
    if (view === 'collection') {
      filtered = filtered.filter(a => a.owned);
    } else if (view === 'wishlist') {
      filtered = filtered.filter(a => !a.owned);
    }

    // Additional filters
    if (artistFilter) {
      filtered = filtered.filter(album => 
        album.artist.toLowerCase().includes(artistFilter.toLowerCase())
      );
    }

    if (decadeFilter) {
      const decade = parseInt(decadeFilter);
      filtered = filtered.filter(album => {
        if (!album.year) return false;
        const albumYear = parseInt(album.year);
        return Math.floor(albumYear / 10) * 10 === decade;
      });
    }

    // Genre filter would need to be implemented with proper data structure
    
    setFilteredAlbums(filtered);
  };

  const loadData = async () => {
    try {
      const response = await fetch('/api/1001-review/overview');
      if (!response.ok) throw new Error('Failed to load data');
      
      const data = await response.json();
      setStats(data.stats);
      setAlbums(data.albums || []);
      
      // Extract unique decades for filters
      const decades = new Set<number>();
      
      (data.albums || []).forEach((album: CollectionMatch) => {
        if (album.year) {
          const decade = Math.floor(parseInt(album.year) / 10) * 10;
          decades.add(decade);
        }
      });
      
      setAvailableDecades(Array.from(decades).sort());
    } catch (err) {
      console.error('Failed to load 1001 albums data:', err);
    }
  };

  const toggleListened = async (collectionId: number, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/1001-review/toggle-listened', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          collection_id: collectionId,
          listened: !currentStatus
        })
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      setAlbums(albums.map(album => 
        album.collection_id === collectionId 
          ? { ...album, listened: !currentStatus }
          : album
      ));
      
      // Update stats
      setStats(prev => ({
        ...prev,
        listened: currentStatus ? prev.listened - 1 : prev.listened + 1
      }));
    } catch (err) {
      console.error('Failed to toggle listened status:', err);
    }
  };

  const exportWishlist = () => {
    const wishlistAlbums = albums.filter(a => !a.owned);
    const headers = ['Artist', 'Title', 'Year'];
    const rows = wishlistAlbums.map(album => [
      album.artist,
      album.title,
      album.year || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `1001-albums-wishlist-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📖</div>
        <h2 style={{
          fontSize: 24,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 12
        }}>
          1001 Albums You Must Hear Before You Die
        </h2>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          maxWidth: 600,
          margin: '0 auto'
        }}>
          Track your progress through the essential albums list
        </p>
      </div>

      {/* Progress Overview */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 24,
        marginBottom: 24
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 16,
          marginBottom: 20
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#8b5cf6' }}>
              {stats.total1001}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Total Albums</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#10b981' }}>
              {stats.owned}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Owned</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#3b82f6' }}>
              {stats.listened}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Listened</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ef4444' }}>
              {stats.missing}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Missing</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{
          background: '#f3f4f6',
          borderRadius: 8,
          height: 32,
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            background: 'linear-gradient(90deg, #8b5cf6, #10b981)',
            height: '100%',
            width: `${stats.completionPercent}%`,
            transition: 'width 0.5s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 14,
            fontWeight: 600
          }}>
            {stats.completionPercent}% Complete
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        flexWrap: 'wrap'
      }}>
        {(['overview', 'collection', 'wishlist'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '8px 16px',
              background: view === v ? '#8b5cf6' : 'white',
              color: view === v ? 'white' : '#6b7280',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {v === 'overview' && '📊 Overview'}
            {v === 'collection' && `✅ My Collection (${stats.owned})`}
            {v === 'wishlist' && `🎯 Wishlist (${stats.missing})`}
          </button>
        ))}
      </div>

      {/* Filters */}
      {(view === 'collection' || view === 'wishlist') && (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>
            🔍 Filters
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12
          }}>
            <input
              type="text"
              placeholder="Filter by artist..."
              value={artistFilter}
              onChange={(e) => setArtistFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            />
            <select
              value={decadeFilter}
              onChange={(e) => setDecadeFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="">All Decades</option>
              {availableDecades.map(decade => (
                <option key={decade} value={decade}>{decade}s</option>
              ))}
            </select>
            <button
              onClick={() => {
                setArtistFilter('');
                setDecadeFilter('');
                setGenreFilter('');
              }}
              style={{
                padding: '8px 12px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              Clear Filters
            </button>
            {view === 'wishlist' && (
              <button
                onClick={exportWishlist}
                style={{
                  padding: '8px 12px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                📥 Export Wishlist
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content based on view */}
      {view === 'overview' && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #10b981',
          borderRadius: 8,
          padding: 32,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h3 style={{ fontSize: 20, fontWeight: 600, color: '#065f46', marginBottom: 12 }}>
            Your Progress
          </h3>
          <p style={{ color: '#065f46', fontSize: 14, marginBottom: 24 }}>
            You own {stats.owned} out of {stats.total1001} albums from the 1001 list
            ({stats.completionPercent}% complete).
            {stats.listened > 0 && ` You've listened to ${stats.listened} of them.`}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => setView('collection')}
              style={{
                padding: '12px 24px',
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              View My Collection
            </button>
            <button
              onClick={() => setView('wishlist')}
              style={{
                padding: '12px 24px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              View Wishlist
            </button>
          </div>
        </div>
      )}

      {(view === 'collection' || view === 'wishlist') && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16
        }}>
          {filteredAlbums.map((album) => (
            <div
              key={album.collection_id}
              style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {album.listened && (
                <div style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  zIndex: 10
                }}>
                  🎧
                </div>
              )}
              {album.image_url && (
                <Image
                  src={album.image_url}
                  alt={`${album.artist} - ${album.title}`}
                  width={180}
                  height={180}
                  style={{ objectFit: 'cover', width: '100%', height: 180 }}
                  unoptimized
                />
              )}
              <div style={{ padding: 12 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#1f2937',
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {album.artist}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#6b7280',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 4
                }}>
                  {album.title}
                </div>
                {album.year && (
                  <div style={{
                    fontSize: 11,
                    color: '#9ca3af',
                    marginBottom: 8
                  }}>
                    {album.year}
                  </div>
                )}
                {album.owned && (
                  <button
                    onClick={() => toggleListened(album.collection_id, album.listened)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      background: album.listened ? '#10b981' : '#f3f4f6',
                      color: album.listened ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {album.listened ? '✓ Listened' : 'Mark as Listened'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
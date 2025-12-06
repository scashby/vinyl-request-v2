// src/app/edit-collection/page.tsx

'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { toSafeSearchString, toSafeStringArray } from '../../types/album';
import ColumnSelector from '../../components/ColumnSelector';
import { ColumnId, COLUMN_DEFINITIONS, DEFAULT_VISIBLE_COLUMNS, getColumnById } from '../../lib/collection-columns';

type Album = {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  format: string;
  image_url: string | null;
  folder: string;
  for_sale: boolean;
  sale_price: number | null;
  sale_platform: string | null;
  sale_quantity: number | null;
  sale_notes: string | null;
  custom_tags: string[] | null;
  media_condition: string;
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  spotify_genres: string[] | null;
  apple_music_genres: string[] | null;
  spotify_label: string | null;
  apple_music_label: string | null;
  apple_music_genre: string | null;
  decade: number | null;
  tracklists: string | null;
  discogs_source: string | null;
  discogs_notes: string | null;
  pricing_notes: string | null;
  notes: string | null;
  is_1001: boolean;
  steves_top_200: boolean;
  this_weeks_top_10: boolean;
  inner_circle_preferred: boolean;
  discogs_master_id: string | null;
  discogs_release_id: string | null;
  master_release_id: string | null;
  spotify_id: string | null;
  apple_music_id: string | null;
  sides: any | null;
  is_box_set: boolean;
  parent_id: string | null;
  blocked: boolean;
  blocked_sides: string[] | null;
  blocked_tracks: any | null;
  child_album_ids: number[] | null;
  sell_price: string | null;
  date_added: string | null;
  master_release_date: string | null;
  spotify_url: string | null;
  spotify_popularity: number | null;
  spotify_release_date: string | null;
  spotify_total_tracks: number | null;
  spotify_image_url: string | null;
  apple_music_url: string | null;
  apple_music_release_date: string | null;
  apple_music_track_count: number | null;
  apple_music_artwork_url: string | null;
  last_enriched_at: string | null;
  enrichment_sources: string[] | null;
  artist_norm: string | null;
  album_norm: string | null;
  artist_album_norm: string | null;
  title_norm: string | null;
  year_int: number | null;
  wholesale_cost: number | null;
  discogs_price_min: number | null;
  discogs_price_median: number | null;
  discogs_price_max: number | null;
  discogs_price_updated_at: string | null;
  purchase_date: string | null;
  purchase_store: string | null;
  purchase_price: number | null;
  current_value: number | null;
  owner: string | null;
  last_cleaned_date: string | null;
  signed_by: string[] | null;
  play_count: number | null;
  sort_title: string | null;
  subtitle: string | null;
  barcode: string | null;
  cat_no: string | null;
  index_number: number | null;
  discs: number | null;
  length_seconds: number | null;
  package_sleeve_condition: string | null;
  vinyl_color: string | null;
  vinyl_weight: string | null;
  rpm: string | null;
  sound: string | null;
  spars_code: string | null;
  packaging: string | null;
  original_release_date: string | null;
  original_release_year: number | null;
  recording_date: string | null;
  recording_year: number | null;
  country: string | null;
  studio: string | null;
  collection_status: string | null;
  is_live: boolean | null;
  extra: string | null;
  location: string | null;
  storage_device_slot: string | null;
  my_rating: number | null;
  last_played_date: string | null;
  modified_date: string | null;
  engineers: string[] | null;
  musicians: string[] | null;
  producers: string[] | null;
  songwriters: string[] | null;
  chorus: string | null;
  composer: string | null;
  composition: string | null;
  conductor: string | null;
  orchestra: string | null;
  due_date: string | null;
  loan_date: string | null;
  loaned_to: string | null;
};

function CollectionBrowserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'both' | 'albums' | 'tracks'>('albums');
  const [showSearchTypeDropdown, setShowSearchTypeDropdown] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<string>('All');
  const [folderMode, setFolderMode] = useState<string>('format');
  const [selectedFolderValue, setSelectedFolderValue] = useState<string | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<string>('All');
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [folderSortByCount, setFolderSortByCount] = useState(false);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<number>>(new Set());
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [activeCollection, setActiveCollection] = useState('music');
  
  // Column selector state
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLUMNS);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Load column preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dwd-visible-columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setVisibleColumns(parsed);
      } catch (e) {
        console.error('Failed to parse saved columns:', e);
      }
    }
  }, []);

  // Save column preferences to localStorage whenever they change
  const handleColumnsChange = useCallback((columns: ColumnId[]) => {
    setVisibleColumns(columns);
    localStorage.setItem('dwd-visible-columns', JSON.stringify(columns));
  }, []);

  // Load albums from Supabase
  const loadAlbums = useCallback(async () => {
    setLoading(true);
    
    let allRows: Album[] = [];
    let from = 0;
    const batchSize = 1000;
    let keepGoing = true;
    
    while (keepGoing) {
      const { data: batch, error } = await supabase
        .from('collection')
        .select('*')
        .order('artist', { ascending: true })
        .range(from, from + batchSize - 1);
      
      if (error) {
        console.error('Error loading albums:', error);
        break;
      }
      
      if (!batch || batch.length === 0) break;
      
      allRows = allRows.concat(batch as Album[]);
      keepGoing = batch.length === batchSize;
      from += batchSize;
    }
    
    setAlbums(allRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  // Filter albums
  const filteredAlbums = albums.filter(album => {
    // Collection filter
    if (collectionFilter === 'For Sale' && !album.for_sale) return false;
    
    // Letter filter
    if (selectedLetter !== 'All') {
      const firstChar = (album.artist || '').charAt(0).toUpperCase();
      if (selectedLetter === '0-9') {
        if (!/[0-9]/.test(firstChar)) return false;
      } else {
        if (firstChar !== selectedLetter) return false;
      }
    }

    // Folder filter (format)
    if (selectedFolderValue) {
      if (folderMode === 'format' && album.format !== selectedFolderValue) return false;
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchable = [
        album.artist,
        album.title,
        album.format,
        album.year,
        toSafeSearchString(album.custom_tags),
        toSafeSearchString(album.discogs_genres),
        toSafeSearchString(album.spotify_label),
        toSafeSearchString(album.apple_music_label)
      ].join(' ').toLowerCase();
      
      if (!searchable.includes(q)) return false;
    }

    return true;
  });

  // Folder counts
  const folderCounts = albums.reduce((acc, album) => {
    const itemKey = album.format || 'Unknown';
    acc[itemKey] = (acc[itemKey] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedFolderItems = Object.entries(folderCounts)
    .sort((a, b) => {
      if (folderSortByCount) {
        return b[1] - a[1];
      } else {
        return a[0].localeCompare(b[0]);
      }
    })
    .filter(([item]) => 
      !folderSearch || item.toLowerCase().includes(folderSearch.toLowerCase())
    );

  const selectedAlbum = albums.find(a => a.id === selectedAlbumId);

  // Get visible column definitions
  const visibleColumnDefs = visibleColumns
    .map(id => getColumnById(id))
    .filter(col => col !== undefined);

  // Helper function to render cell content
  const renderCell = (album: Album, columnId: ColumnId) => {
    switch (columnId) {
      case 'image_url':
        return album.image_url ? (
          <img src={album.image_url} alt="" style={{ width: 60, height: 60, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 60, height: 60, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            🎵
          </div>
        );
      
      case 'master_release_date':
      case 'original_release_date':
      case 'recording_date':
      case 'spotify_release_date':
      case 'apple_music_release_date':
      case 'date_added':
      case 'modified_date':
      case 'purchase_date':
      case 'last_played_date':
      case 'last_cleaned_date':
      case 'loan_date':
      case 'due_date':
      case 'discogs_price_updated_at':
      case 'last_enriched_at':
        const dateValue = album[columnId];
        return dateValue 
          ? new Date(dateValue).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '-';

      case 'discogs_genres':
      case 'discogs_styles':
      case 'spotify_genres':
      case 'apple_music_genres':
      case 'custom_tags':
      case 'enrichment_sources':
      case 'signed_by':
      case 'blocked_sides':
      case 'child_album_ids':
      case 'engineers':
      case 'musicians':
      case 'producers':
      case 'songwriters':
        const arrayValue = album[columnId];
        return Array.isArray(arrayValue) ? arrayValue.join(', ') || '-' : '-';

      case 'for_sale':
      case 'is_box_set':
      case 'is_live':
      case 'is_1001':
      case 'steves_top_200':
      case 'this_weeks_top_10':
      case 'inner_circle_preferred':
      case 'blocked':
        return album[columnId] ? '✓' : '';

      case 'sale_price':
      case 'sell_price':
      case 'wholesale_cost':
      case 'purchase_price':
      case 'current_value':
      case 'discogs_price_min':
      case 'discogs_price_median':
      case 'discogs_price_max':
        const priceValue = album[columnId];
        return priceValue ? `$${Number(priceValue).toFixed(2)}` : '-';

      case 'my_rating':
        const rating = album.my_rating;
        return rating ? '⭐'.repeat(rating) : '-';

      case 'length_seconds':
        const seconds = album.length_seconds;
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;

      case 'spotify_url':
      case 'apple_music_url':
        const url = album[columnId];
        return url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2196F3' }}>
            🔗
          </a>
        ) : '-';

      case 'spotify_image_url':
      case 'apple_music_artwork_url':
        const imgUrl = album[columnId];
        return imgUrl ? (
          <img src={imgUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover' }} />
        ) : '-';

      default:
        const value = album[columnId];
        if (value === null || value === undefined) return '-';
        if (Array.isArray(value)) return value.join(', ') || '-';
        if (typeof value === 'boolean') return value ? '✓' : '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }
  };

  return (
    <>
      <style jsx global>{`
        body > div:first-child > nav,
        body > div:first-child > header:not(.clz-header),
        body > nav,
        body > header:not(.clz-header),
        [class*="navigation"],
        [class*="Navigation"],
        [class*="navbar"],
        [class*="NavBar"],
        [class*="sidebar"]:not(.clz-sidebar),
        [class*="Sidebar"]:not(.clz-sidebar) {
          display: none !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
      `}</style>

      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        zIndex: 9999
      }}>
        {/* HAMBURGER SIDEBAR */}
        {sidebarOpen && (
          <>
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 19999
              }}
            />
            <div className="clz-sidebar" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '280px',
              background: '#2C2C2C',
              color: 'white',
              zIndex: 20000,
              overflowY: 'auto',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>DWD COLLECTION</div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  title="Close menu"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#999', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Collection</div>
                <button 
                  title="Add albums from main system"
                  style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', borderRadius: '4px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>➕</span> Add Albums from Core
                </button>
                <button 
                  title="Create and manage pick lists"
                  style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>📋</span> Manage Pick Lists
                </button>
                <button 
                  title="Manage collections"
                  style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>⚙️</span> Manage Collections
                </button>
              </div>

              <hr style={{ borderColor: '#444', margin: '20px 0' }} />

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#999', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tools</div>
                <button 
                  title="Export collection to PDF"
                  style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>🖨️</span> Print to PDF
                </button>
                <button 
                  title="View collection statistics"
                  style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>📊</span> Statistics
                </button>
                <button 
                  title="Find duplicate albums"
                  style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>🔍</span> Find Duplicates
                </button>
                <button 
                  title="Track loaned albums"
                  style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>📚</span> Loan Manager
                </button>
              </div>
            </div>
          </>
        )}

        {/* ROW 1: PURPLE GRADIENT HEADER */}
        <div className="clz-header" style={{
          background: 'linear-gradient(to right, #8809AC, #A855F7)',
          color: 'white',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '50px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              title="Open menu"
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '4px'
              }}
            >
              ☰
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>♪</span>
              <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.5px' }}>DWD Collection Management System</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              title="Grid view"
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>⊞</button>
            <button 
              title="User account"
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>👤</button>
          </div>
        </div>

        {/* ROW 3: MAIN TOOLBAR */}
        <div style={{
          background: '#3A3A3A',
          color: 'white',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          height: '48px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '0 0 auto' }}>
            <button 
              title="Add new albums to collection"
              style={{
              background: '#368CF8',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '16px' }}>+</span>
              <span>Add Albums</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowCollectionDropdown(!showCollectionDropdown)}
                title="Filter by collection status"
                style={{
                  background: '#2a2a2a',
                  color: 'white',
                  border: '1px solid #555',
                  padding: '6px 12px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>📚</span>
                <span>{collectionFilter}</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flex: '1 1 auto', justifyContent: 'center' }}>
            <button
              onClick={() => setSelectedLetter('All')}
              title="Show all albums"
              style={{
                background: selectedLetter === 'All' ? '#5A9BD5' : 'transparent',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                borderRadius: '2px'
              }}
            >
              All
            </button>
            <button
              onClick={() => setSelectedLetter('0-9')}
              title="Filter by numbers"
              style={{
                background: selectedLetter === '0-9' ? '#5A9BD5' : 'transparent',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                borderRadius: '2px'
              }}
            >
              0-9
            </button>
            {alphabet.map(letter => (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter)}
                title={`Filter by letter ${letter}`}
                style={{
                  background: selectedLetter === letter ? '#5A9BD5' : 'transparent',
                  color: 'white',
                  border: 'none',
                  padding: '4px 7px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  borderRadius: '2px',
                  minWidth: '20px'
                }}
              >
                {letter}
              </button>
            ))}
            <button 
              title="Settings"
              style={{
              background: 'transparent',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '14px',
              marginLeft: '4px'
            }}>⚙️</button>
          </div>

          <div style={{ display: 'flex', gap: '0', alignItems: 'center', flex: '0 0 auto' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSearchTypeDropdown(!showSearchTypeDropdown)}
                title="Search type"
                style={{
                  background: '#2a2a2a',
                  color: 'white',
                  border: '1px solid #555',
                  borderRight: 'none',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  borderRadius: '3px 0 0 3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '32px'
                }}
              >
                <span>🔍</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
            </div>
            <input
              type="text"
              placeholder="Search albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              title="Search your collection"
              style={{
                background: '#2a2a2a',
                color: 'white',
                border: '1px solid #555',
                borderLeft: 'none',
                padding: '6px 12px',
                borderRadius: '0 3px 3px 0',
                fontSize: '13px',
                width: '220px',
                height: '32px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* SELECTION TOOLBAR */}
        {selectedAlbumIds.size > 0 && (
          <div style={{
            background: '#5BA3D0',
            color: 'white',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '40px',
            flexShrink: 0
          }}>
            <button
              onClick={() => setSelectedAlbumIds(new Set())}
              title="Clear selection"
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ✕ Cancel
            </button>
            <button 
              title="Select all albums"
              style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>☑ All</button>
            <button 
              title="Edit selected albums"
              style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>✏️ Edit</button>
            <button 
              title="Remove selected albums"
              style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>🗑 Remove</button>
            <button 
              title="Export selected to PDF"
              style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>🖨 Print to PDF</button>
            <button 
              title="More actions"
              style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>⋮</button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '12px', fontWeight: 500 }}>
              {selectedAlbumIds.size} of {filteredAlbums.length} selected
            </span>
          </div>
        )}

        {/* THREE-COLUMN BODY */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0
        }}>
          {/* LEFT COLUMN: Format/Folder Panel */}
          <div style={{
            width: '220px',
            background: '#2C2C2C',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: '1px solid #1a1a1a',
            flexShrink: 0
          }}>
            <div style={{
              padding: '10px',
              borderBottom: '1px solid #1a1a1a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <button 
                title="Change view mode (Format, Artist, Genre, etc.)"
                style={{
                background: '#3a3a3a',
                color: 'white',
                border: '1px solid #555',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>📁</span>
                <span>Format</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
              <button 
                title="View options"
                style={{
                background: 'transparent',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px'
              }}>☰</button>
            </div>

            <div style={{ padding: '10px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Search format..."
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                title="Filter formats"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: '#3a3a3a',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '3px',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                <button 
                  onClick={() => setFolderSortByCount(!folderSortByCount)}
                  title={folderSortByCount ? "Sort alphabetically" : "Sort by count"}
                  style={{
                  background: '#3a3a3a',
                  color: 'white',
                  border: '1px solid #555',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}>
                  {folderSortByCount ? '🔢' : '🔤'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '6px', minHeight: 0 }}>
              <button 
                onClick={() => setSelectedFolderValue(null)}
                title="Show all albums"
                style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                background: !selectedFolderValue ? '#5A9BD5' : 'transparent',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                marginBottom: '3px',
                fontSize: '12px',
                color: 'white',
                textAlign: 'left'
              }}>
                <span>[All Albums]</span>
                <span style={{
                  background: !selectedFolderValue ? '#3578b3' : '#555',
                  color: 'white',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  {albums.length}
                </span>
              </button>

              {sortedFolderItems.map(([format, count]) => (
                <button
                  key={format}
                  onClick={() => setSelectedFolderValue(format)}
                  title={`Filter by ${format}`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    background: selectedFolderValue === format ? '#5A9BD5' : 'transparent',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    marginBottom: '3px',
                    fontSize: '12px',
                    color: 'white',
                    textAlign: 'left'
                  }}
                >
                  <span>{format}</span>
                  <span style={{
                    background: selectedFolderValue === format ? '#3578b3' : '#555',
                    color: 'white',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* CENTER COLUMN: Table */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#fff',
            minWidth: 0
          }}>
            <div style={{
              padding: '6px 12px',
              borderBottom: '1px solid #555',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#4a4a4a',
              height: '40px',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button 
                  title="Change view mode"
                  style={{
                  background: '#3a3a3a',
                  border: '1px solid #555',
                  padding: '4px 9px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span>☰</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
                
                <button 
                  title="Change sort order"
                  style={{
                  background: '#3a3a3a',
                  border: '1px solid #555',
                  padding: '4px 9px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span>↕️</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
                
                <button 
                  onClick={() => setShowColumnSelector(true)}
                  title="Select visible columns"
                  style={{
                  background: '#3a3a3a',
                  border: '1px solid #555',
                  padding: '4px 9px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span>⊞</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#ddd', fontWeight: 600 }}>
                {loading ? 'Loading...' : `${filteredAlbums.length} albums`}
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', background: '#fff', minHeight: 0 }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                  Loading albums...
                </div>
              ) : (
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px'
                }}>
                  <thead>
                    <tr style={{
                      background: '#f5f5f5',
                      borderBottom: '2px solid #ddd',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10
                    }}>
                      {visibleColumnDefs.map(col => (
                        <th
                          key={col.id}
                          style={{
                            width: col.width,
                            padding: '8px',
                            textAlign: 'left',
                            fontWeight: 600,
                            borderRight: '1px solid #e0e0e0',
                            color: '#333',
                            cursor: col.sortable ? 'pointer' : 'default'
                          }}
                          title={col.sortable ? `Sort by ${col.label}` : col.label}
                        >
                          {col.label}
                          {col.sortable && col.id === 'artist' && (
                            <span style={{ fontSize: '10px', marginLeft: '4px' }}>▲</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlbums.map((album, idx) => (
                      <tr 
                        key={album.id}
                        onClick={() => setSelectedAlbumId(album.id)}
                        style={{
                          background: selectedAlbumId === album.id ? '#d4e9f7' : idx % 2 === 0 ? '#fff' : '#fafafa',
                          borderBottom: '1px solid #e8e8e8',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedAlbumId !== album.id) {
                            e.currentTarget.style.background = '#f5f5f5';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedAlbumId !== album.id) {
                            e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa';
                          }
                        }}
                      >
                        {visibleColumnDefs.map(col => (
                          <td
                            key={col.id}
                            style={{
                              padding: '8px',
                              textAlign: 'left',
                              borderRight: '1px solid #e8e8e8',
                              color: col.id === 'title' ? '#2196F3' : '#333'
                            }}
                          >
                            {renderCell(album, col.id)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Detail Panel */}
          {selectedAlbum && (
            <div style={{
              width: '380px',
              background: '#fff',
              borderLeft: '1px solid #ddd',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0
            }}>
              <div style={{
                padding: '6px 12px',
                borderBottom: '1px solid #555',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#4a4a4a',
                height: '40px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button 
                    title="Edit album details"
                    style={{
                    background: '#3a3a3a',
                    border: '1px solid #555',
                    padding: '6px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'white'
                  }}>✏️</button>

                  <button 
                    title="Share album"
                    style={{
                    background: '#3a3a3a',
                    border: '1px solid #555',
                    padding: '6px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'white'
                  }}>↗️</button>

                  <button 
                    title="Search on eBay"
                    style={{
                    background: '#3a3a3a',
                    border: '1px solid #555',
                    padding: '6px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'white',
                    fontWeight: 600
                  }}>eBay</button>

                  <button 
                    title="More actions"
                    style={{
                    background: '#3a3a3a',
                    border: '1px solid #555',
                    padding: '6px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'white'
                  }}>⋮</button>
                </div>
                
                <button 
                  title="Select visible fields"
                  style={{
                  background: '#3a3a3a',
                  border: '1px solid #555',
                  padding: '4px 9px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span>⊞</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
              </div>

              <div style={{ padding: '16px', flex: 1, overflowY: 'auto', background: '#F8DE77' }}>
                <div style={{ fontSize: '14px', color: '#333', marginBottom: '4px' }}>
                  {selectedAlbum.artist}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <h4 style={{ color: '#2196F3', margin: 0, fontSize: '18px', fontWeight: 600 }}>
                    {selectedAlbum.title}
                  </h4>
                  <div style={{
                    background: '#2196F3',
                    color: 'white',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }} title="Album owned">✓</div>
                </div>

                {selectedAlbum.image_url ? (
                  <img 
                    src={selectedAlbum.image_url} 
                    alt={`${selectedAlbum.artist} - ${selectedAlbum.title}`}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      marginBottom: '12px',
                      border: '1px solid #ddd'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: '#fff',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                    fontSize: '48px',
                    border: '1px solid #ddd'
                  }}>🎵</div>
                )}

                <div style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: '8px'
                }}>
                  {selectedAlbum.spotify_label || selectedAlbum.apple_music_label || 'Unknown Label'} 
                  {selectedAlbum.year && ` (${selectedAlbum.year})`}
                </div>

                {(selectedAlbum.discogs_genres || selectedAlbum.spotify_genres) && (
                  <div style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '16px'
                  }}>
                    {toSafeStringArray(selectedAlbum.discogs_genres || selectedAlbum.spotify_genres).join(' | ')}
                  </div>
                )}

                <div style={{
                  fontSize: '14px',
                  color: '#333',
                  marginBottom: '16px',
                  fontWeight: 600
                }}>
                  {selectedAlbum.format}
                  {selectedAlbum.spotify_total_tracks && ` | ${selectedAlbum.spotify_total_tracks} Tracks`}
                  {selectedAlbum.apple_music_track_count && ` | ${selectedAlbum.apple_music_track_count} Tracks`}
                </div>

                {selectedAlbum.media_condition && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                    <strong>Condition:</strong> {selectedAlbum.media_condition}
                  </div>
                )}

                {selectedAlbum.custom_tags && selectedAlbum.custom_tags.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>Tags:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {toSafeStringArray(selectedAlbum.custom_tags).map(tag => (
                        <span key={tag} style={{
                          padding: '4px 10px',
                          background: '#8809AC',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ROW: Collection Tabs */}
        <div style={{
          background: '#1a1a1a',
          borderTop: '1px solid #000',
          padding: 0,
          display: 'flex',
          alignItems: 'stretch',
          height: '40px',
          flexShrink: 0
        }}>
          <button 
            title="Collection menu"
            style={{
            background: 'transparent',
            color: 'white',
            border: 'none',
            padding: '0 14px',
            cursor: 'pointer',
            fontSize: '14px',
            borderRight: '1px solid #333'
          }}>☰</button>
          {['music', 'Vinyl', 'Singles (45s and 12")', 'Sale'].map(collection => (
            <button
              key={collection}
              onClick={() => setActiveCollection(collection)}
              title={`Switch to ${collection} collection`}
              style={{
                background: activeCollection === collection ? '#8809AC' : 'transparent',
                color: 'white',
                border: 'none',
                borderBottom: activeCollection === collection ? '3px solid #8809AC' : 'none',
                padding: '0 18px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeCollection === collection ? 600 : 400
              }}
            >
              {collection}
            </button>
          ))}
        </div>
      </div>

      {/* Column Selector Modal */}
      {showColumnSelector && (
        <ColumnSelector
          visibleColumns={visibleColumns}
          onColumnsChange={handleColumnsChange}
          onClose={() => setShowColumnSelector(false)}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '16px',
        color: '#666'
      }}>
        Loading...
      </div>
    }>
      <CollectionBrowserPage />
    </Suspense>
  );
}
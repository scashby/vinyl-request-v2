// src/app/edit-collection/page.tsx - COMPLETE FILE WITH SETTINGS INTEGRATION
'use client';

import { useCallback, useEffect, useState, useMemo, Suspense, memo } from 'react';
import Image from 'next/image';
import { supabase } from '../../lib/supabaseClient';
import CollectionTable from '../../components/CollectionTable';
import ColumnSelector from '../../components/ColumnSelector';
import { ColumnId, DEFAULT_VISIBLE_COLUMNS, DEFAULT_LOCKED_COLUMNS, SortState } from './columnDefinitions';
import { Album, toSafeStringArray, toSafeSearchString } from '../../types/album';
import EditAlbumModal from './EditAlbumModal';
import { SettingsModal } from './settings/SettingsModal';

type SortOption = 
  | 'artist-asc' | 'artist-desc' 
  | 'title-asc' | 'title-desc' 
  | 'year-desc' | 'year-asc' 
  | 'added-desc' | 'added-asc' 
  | 'format-asc' | 'format-desc' 
  | 'tags-count-desc' | 'tags-count-asc' 
  | 'sale-price-desc' | 'sale-price-asc' 
  | 'condition-asc' | 'condition-desc'
  | 'folder-asc' | 'folder-desc'
  | 'popularity-desc' | 'popularity-asc'
  | 'sides-desc' | 'sides-asc'
  | 'decade-desc' | 'decade-asc';

const SORT_OPTIONS: { value: SortOption; label: string; category: string }[] = [
  { value: 'artist-asc', label: 'Artist (A→Z)', category: 'Basic' },
  { value: 'artist-desc', label: 'Artist (Z→A)', category: 'Basic' },
  { value: 'title-asc', label: 'Title (A→Z)', category: 'Basic' },
  { value: 'title-desc', label: 'Title (Z→A)', category: 'Basic' },
  { value: 'year-desc', label: 'Year (Newest First)', category: 'Time' },
  { value: 'year-asc', label: 'Year (Oldest First)', category: 'Time' },
  { value: 'decade-desc', label: 'Decade (Newest)', category: 'Time' },
  { value: 'decade-asc', label: 'Decade (Oldest)', category: 'Time' },
  { value: 'added-desc', label: 'Date Added (Newest)', category: 'Time' },
  { value: 'added-asc', label: 'Date Added (Oldest)', category: 'Time' },
  { value: 'format-asc', label: 'Format (A→Z)', category: 'Physical' },
  { value: 'format-desc', label: 'Format (Z→A)', category: 'Physical' },
  { value: 'folder-asc', label: 'Folder (A→Z)', category: 'Physical' },
  { value: 'folder-desc', label: 'Folder (Z→A)', category: 'Physical' },
  { value: 'condition-asc', label: 'Condition (A→Z)', category: 'Physical' },
  { value: 'condition-desc', label: 'Condition (Z→A)', category: 'Physical' },
  { value: 'sides-desc', label: 'Most Sides First)', category: 'Physical' },
  { value: 'sides-asc', label: 'Fewest Sides First', category: 'Physical' },
  { value: 'tags-count-desc', label: 'Most Tags', category: 'Metadata' },
  { value: 'tags-count-asc', label: 'Fewest Tags', category: 'Metadata' },
  { value: 'popularity-desc', label: 'Most Popular (Spotify)', category: 'Metadata' },
  { value: 'popularity-asc', label: 'Least Popular (Spotify)', category: 'Metadata' },
  { value: 'sale-price-desc', label: 'Highest Price', category: 'Sales' },
  { value: 'sale-price-asc', label: 'Lowest Price', category: 'Sales' }
];

const AlbumInfoPanel = memo(function AlbumInfoPanel({ album }: { album: Album | null }) {
  const [imageIndex, setImageIndex] = useState(0);

  if (!album) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: '#999',
        fontSize: '14px'
      }}>
        Select an album to view details
      </div>
    );
  }

  // Calculate disc runtimes
  const getDiscRuntime = (discNumber: number): string => {
    if (!album.tracks) return '';
    const discTracks = album.tracks.filter(t => t.disc_number === discNumber && t.type !== 'header');
    let totalSeconds = 0;
    discTracks.forEach(track => {
      if (track.duration) {
        const parts = track.duration.split(':');
        if (parts.length === 2) {
          totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }
    });
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate TOTAL runtime from all tracks
  const getTotalRuntime = (): string => {
    if (!album.tracks || album.tracks.length === 0) {
      // Fallback to album.length_seconds if no tracks
      if (album.length_seconds) {
        const minutes = Math.floor(album.length_seconds / 60);
        const seconds = album.length_seconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      return '—';
    }
    
    const allTracks = album.tracks.filter(t => t.type === 'track');
    let totalSeconds = 0;
    allTracks.forEach(track => {
      if (track.duration) {
        const parts = track.duration.split(':');
        if (parts.length === 2) {
          totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }
    });
    
    if (totalSeconds === 0) return '—';
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format date as "Feb 26, 2002"
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Format datetime as "Jan 29, 2025 19:00:00"
  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
             date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      return dateStr;
    }
  };

  // Generate eBay search URL for sold listings
  const getEbayUrl = (): string => {
    const query = `${album.artist} ${album.title}`.replace(/\s+/g, '+');
    return `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1`;
  };

  // Count total tracks
  const totalTracks = album.tracks?.filter(t => t.type === 'track').length || album.spotify_total_tracks || album.apple_music_track_count || 0;

  // Format total runtime
  const totalRuntime = getTotalRuntime();

  return (
    <div style={{ 
      padding: '16px', 
      flex: 1, 
      overflowY: 'auto', 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' 
    }}>
      {/* Artist */}
      <div style={{ fontSize: '14px', color: '#333', marginBottom: '4px', fontWeight: 400 }}>
        {album.artist}
      </div>

      {/* Title with checkmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <h4 style={{ color: '#2196F3', margin: 0, fontSize: '18px', fontWeight: 400 }}>
          {album.title}
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

      {/* Image Carousel */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        {(imageIndex === 0 ? album.image_url : album.back_image_url) ? (
          <Image 
            src={(imageIndex === 0 ? album.image_url : album.back_image_url) || ''} 
            alt={`${album.artist} - ${album.title} ${imageIndex === 0 ? 'front' : 'back'}`}
            width={400}
            height={400}
            style={{
              width: '100%',
              height: 'auto',
              aspectRatio: '1',
              objectFit: 'cover',
              border: '1px solid #ddd'
            }}
            unoptimized
          />
        ) : (
          <div style={{
            width: '100%',
            aspectRatio: '1',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontSize: '48px',
            border: '1px solid #ddd'
          }}>🎵</div>
        )}
        
        {/* Carousel dots - only show second dot if back image exists */}
        {album.back_image_url && (
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '6px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: imageIndex === 0 ? '#333' : '#999',
              cursor: 'pointer'
            }} onClick={() => setImageIndex(0)} />
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: imageIndex === 1 ? '#333' : '#999',
              cursor: 'pointer'
            }} onClick={() => setImageIndex(1)} />
          </div>
        )}
      </div>

      {/* Label (Year) */}
      <div style={{
        fontSize: '14px',
        fontWeight: 400,
        color: '#333',
        marginBottom: '8px'
      }}>
        {album.spotify_label || album.apple_music_label || 'Unknown Label'} 
        {album.year && ` (${album.year})`}
      </div>

      {/* Genres */}
      {(album.discogs_genres || album.spotify_genres) && (
        <div style={{
          fontSize: '13px',
          color: '#666',
          marginBottom: '12px',
          fontWeight: 400
        }}>
          {toSafeStringArray(album.discogs_genres || album.spotify_genres).join(' | ')}
        </div>
      )}

      {/* Barcode - ALWAYS SHOW */}
      <div style={{
        fontSize: '12px',
        color: '#333',
        marginBottom: '8px',
        fontFamily: 'monospace',
        fontWeight: 400
      }}>
        ||||| {album.barcode || '—'}
      </div>

      {/* Country - ALWAYS SHOW */}
      <div style={{
        fontSize: '13px',
        color: '#333',
        marginBottom: '8px',
        fontWeight: 400
      }}>
        {album.country || '—'}
      </div>

      {/* Format | Discs | Tracks | Time - ALWAYS SHOW ALL */}
      <div style={{
        fontSize: '13px',
        color: '#333',
        marginBottom: '12px',
        fontWeight: 400
      }}>
        {album.format || '—'}
        {' | '}{album.discs ? `${album.discs} Disc${album.discs > 1 ? 's' : ''}` : '—'}
        {' | '}{totalTracks > 0 ? `${totalTracks} Tracks` : '—'}
        {' | '}{totalRuntime}
      </div>

      {/* Cat No - ALWAYS SHOW */}
      <div style={{
        fontSize: '13px',
        color: '#666',
        marginBottom: '12px',
        fontWeight: 400
      }}>
        <span style={{ fontWeight: 600 }}>CAT NO</span> {album.cat_no || '—'}
      </div>

      {/* eBay Link */}
      <a 
        href={getEbayUrl()}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: '13px',
          color: '#2196F3',
          marginBottom: '16px',
          display: 'block',
          textDecoration: 'none',
          fontWeight: 400
        }}
      >
        Find solid listings on eBay
      </a>

      {/* Track Listings */}
      {(() => {
        if (!album.tracks || album.tracks.length === 0) return null;

        // Group tracks by disc
        const discMap = new Map<number, typeof album.tracks>();
        album.tracks.forEach(track => {
          if (!discMap.has(track.disc_number)) {
            discMap.set(track.disc_number, []);
          }
          discMap.get(track.disc_number)!.push(track);
        });

        // Sort each disc's tracks by position
        discMap.forEach(tracks => {
          tracks.sort((a, b) => parseInt(a.position) - parseInt(b.position));
        });

        const sortedDiscs = Array.from(discMap.entries()).sort(([a], [b]) => a - b);

        return (
          <div style={{ marginBottom: '16px' }}>
            {sortedDiscs.map(([discNumber, tracks]) => {
              const discMeta = album.disc_metadata?.find(d => d.disc_number === discNumber);
              const discTitle = discMeta?.title || `Disc #${discNumber}`;
              const runtime = getDiscRuntime(discNumber);

              return (
                <div key={discNumber} style={{ marginBottom: '16px' }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 700, 
                    color: 'white', 
                    marginBottom: '8px',
                    padding: '8px 12px',
                    background: '#2196F3',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>{discTitle}</span>
                    {runtime && <span>{runtime}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {tracks.map((track, idx) => {
                      if (track.type === 'header') {
                        return (
                          <div 
                            key={idx}
                            style={{ 
                              fontSize: '11px', 
                              fontWeight: 600, 
                              color: '#6b7280',
                              padding: '6px 8px',
                              background: '#f3f4f6',
                              marginTop: idx > 0 ? 4 : 0
                            }}
                          >
                            {track.title}
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={idx}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            padding: '6px 8px',
                            fontSize: '13px',
                            background: idx % 2 === 0 ? 'white' : '#f9fafb',
                            fontWeight: 400
                          }}
                        >
                          <div style={{ 
                            minWidth: 28, 
                            color: '#6b7280',
                            fontSize: '13px'
                          }}>
                            {track.position}
                          </div>
                          <div style={{ 
                            flex: 1, 
                            color: '#1f2937',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            paddingRight: '8px'
                          }}>
                            {track.title}
                          </div>
                          {track.duration && (
                            <div style={{ 
                              color: '#6b7280',
                              fontSize: '13px',
                              minWidth: '40px',
                              textAlign: 'right'
                            }}>
                              {track.duration}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Details Section */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          fontSize: '16px', 
          fontWeight: 700, 
          color: '#2196F3',
          marginBottom: '12px'
        }}>
          Details
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '4px' }}>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '180px' }}>Release Date</span>
            <span>{album.year || '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '180px' }}>Original Release Date</span>
            <span>{album.original_release_date ? formatDate(album.original_release_date) : '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '180px' }}>Package/Sleeve Condition</span>
            <span>{album.package_sleeve_condition || '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '180px' }}>Media Condition</span>
            <span>{album.media_condition || '—'}</span>
          </div>
        </div>
      </div>

      {/* Personal Section */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          fontSize: '16px', 
          fontWeight: 700, 
          color: '#2196F3',
          marginBottom: '12px'
        }}>
          Personal
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '4px' }}>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Quantity</span>
            <span>1</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Index</span>
            <span>{album.index_number || '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Purchase Date</span>
            <span>{album.purchase_date ? formatDate(album.purchase_date) : '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Purchase Store</span>
            <span>{album.purchase_store || '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Purchase Price</span>
            <span>{album.purchase_price ? `$${album.purchase_price.toFixed(2)}` : '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Current Value</span>
            <span>{album.current_value ? `$${album.current_value.toFixed(2)}` : '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Owner</span>
            <span>{album.owner || '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>My Rating</span>
            <span>
              {album.my_rating ? (
                <span style={{ display: 'flex', gap: '2px' }}>
                  {Array.from({ length: album.my_rating }).map((_, i) => (
                    <span key={i} style={{ color: '#fbbf24', fontSize: '14px' }}>★</span>
                  ))}
                  {Array.from({ length: 10 - album.my_rating }).map((_, i) => (
                    <span key={i} style={{ color: '#d1d5db', fontSize: '14px' }}>★</span>
                  ))}
                </span>
              ) : '—'}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Last Cleaned</span>
            <span>{album.last_cleaned_date ? formatDate(album.last_cleaned_date) : '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Signed By</span>
            <span>
              {album.signed_by && Array.isArray(album.signed_by) && album.signed_by.length > 0 
                ? album.signed_by.join(', ') 
                : '—'}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '8px', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Added Date</span>
            <span>{album.date_added ? formatDateTime(album.date_added) : '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1f2937', display: 'flex', fontWeight: 400 }}>
            <span style={{ fontWeight: 600, minWidth: '140px' }}>Modified Date</span>
            <span>{album.modified_date ? formatDateTime(album.modified_date) : '—'}</span>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          fontSize: '16px', 
          fontWeight: 700, 
          color: '#2196F3',
          marginBottom: '12px'
        }}>
          Notes
        </div>
        <div style={{ 
          fontSize: '13px', 
          color: '#1f2937', 
          lineHeight: '1.6',
          background: 'white',
          padding: '12px',
          borderRadius: '4px',
          fontWeight: 400,
          minHeight: '40px'
        }}>
          {album.notes || '—'}
        </div>
      </div>

      {/* Tags Section */}
      <div>
        <div style={{ 
          fontSize: '16px', 
          fontWeight: 700, 
          color: '#2196F3',
          marginBottom: '12px'
        }}>
          Tags
        </div>
        {album.custom_tags && album.custom_tags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {toSafeStringArray(album.custom_tags).map(tag => (
              <span key={tag} style={{
                padding: '6px 12px',
                background: '#e5e7eb',
                color: '#374151',
                borderRadius: '16px',
                fontSize: '13px',
                fontWeight: 400
              }}>
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <div style={{
            fontSize: '13px',
            color: '#9ca3af',
            fontWeight: 400
          }}>
            No tags
          </div>
        )}
      </div>
    </div>
  );
});

function CollectionBrowserPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchTypeDropdown, setShowSearchTypeDropdown] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<string>('All');
  const [folderMode] = useState<string>('format');
  const [selectedFolderValue, setSelectedFolderValue] = useState<string | null>(null);
  const [collectionFilter] = useState<string>('All');
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [folderSortByCount, setFolderSortByCount] = useState(false);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<number>>(new Set());
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [activeCollection, setActiveCollection] = useState('music');
  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [sortBy, setSortBy] = useState<SortOption>('artist-asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [tableSortState, setTableSortState] = useState<SortState>({
    column: null,
    direction: null
  });

  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [lockedColumns, setLockedColumns] = useState<ColumnId[]>(DEFAULT_LOCKED_COLUMNS);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  useEffect(() => {
    const stored = localStorage.getItem('collection-visible-columns');
    if (stored) {
      try {
        setVisibleColumns(JSON.parse(stored));
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('collection-locked-columns');
    if (stored) {
      try {
        setLockedColumns(JSON.parse(stored));
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  const handleColumnsChange = useCallback((columns: ColumnId[]) => {
    setVisibleColumns(columns);
    localStorage.setItem('collection-visible-columns', JSON.stringify(columns));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('collection-sort-preference');
    if (stored && SORT_OPTIONS.some(opt => opt.value === stored)) {
      setSortBy(stored as SortOption);
    }
  }, []);

  const handleSortChange = useCallback((newSort: SortOption) => {
    setSortBy(newSort);
    localStorage.setItem('collection-sort-preference', newSort);
    setShowSortDropdown(false);
    setTableSortState({ column: null, direction: null });
  }, []);

  const handleTableSortChange = useCallback((column: ColumnId) => {
    setTableSortState(prev => {
      if (prev.column === column) {
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { column: null, direction: null };
        }
      }
      return { column, direction: 'asc' };
    });
  }, []);

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

  const filteredAndSortedAlbums = useMemo(() => {
    let filtered = albums.filter(album => {
      if (collectionFilter === 'For Sale' && !album.for_sale) return false;
      
      if (selectedLetter !== 'All') {
        const firstChar = (album.artist || '').charAt(0).toUpperCase();
        if (selectedLetter === '0-9') {
          if (!/[0-9]/.test(firstChar)) return false;
        } else {
          if (firstChar !== selectedLetter) return false;
        }
      }

      if (selectedFolderValue) {
        if (folderMode === 'format' && album.format !== selectedFolderValue) return false;
      }

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

    if (tableSortState.column && tableSortState.direction) {
      const { column, direction } = tableSortState;
      const multiplier = direction === 'asc' ? 1 : -1;
      
      filtered = [...filtered].sort((a, b) => {
        if (column === 'artist') {
          return multiplier * (a.artist || '').localeCompare(b.artist || '');
        } else if (column === 'title') {
          return multiplier * (a.title || '').localeCompare(b.title || '');
        }
        return 0;
      });
    } else {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case 'artist-asc': return (a.artist || '').localeCompare(b.artist || '');
          case 'artist-desc': return (b.artist || '').localeCompare(a.artist || '');
          case 'title-asc': return (a.title || '').localeCompare(b.title || '');
          case 'title-desc': return (b.title || '').localeCompare(a.title || '');
          case 'year-desc': return (b.year_int || 0) - (a.year_int || 0);
          case 'year-asc': return (a.year_int || 0) - (b.year_int || 0);
          case 'decade-desc': return (b.decade || 0) - (a.decade || 0);
          case 'decade-asc': return (a.decade || 0) - (b.decade || 0);
          case 'added-desc': return (b.date_added || '').localeCompare(a.date_added || '');
          case 'added-asc': return (a.date_added || '').localeCompare(b.date_added || '');
          case 'format-asc': return (a.format || '').localeCompare(b.format || '');
          case 'format-desc': return (b.format || '').localeCompare(a.format || '');
          case 'folder-asc': return (a.folder || '').localeCompare(b.folder || '');
          case 'folder-desc': return (b.folder || '').localeCompare(a.folder || '');
          case 'condition-asc': return (a.media_condition || '').localeCompare(b.media_condition || '');
          case 'condition-desc': return (b.media_condition || '').localeCompare(a.media_condition || '');
          case 'tags-count-desc': return toSafeStringArray(b.custom_tags).length - toSafeStringArray(a.custom_tags).length;
          case 'tags-count-asc': return toSafeStringArray(a.custom_tags).length - toSafeStringArray(b.custom_tags).length;
          case 'sale-price-desc': return (b.sale_price || 0) - (a.sale_price || 0);
          case 'sale-price-asc': return (a.sale_price || 0) - (b.sale_price || 0);
          case 'popularity-desc': return (b.spotify_popularity || 0) - (a.spotify_popularity || 0);
          case 'popularity-asc': return (a.spotify_popularity || 0) - (b.spotify_popularity || 0);
          case 'sides-desc':
            const bSides = typeof b.sides === 'number' ? b.sides : 0;
            const aSides = typeof a.sides === 'number' ? a.sides : 0;
            return bSides - aSides;
          case 'sides-asc':
            const aSidesAsc = typeof a.sides === 'number' ? a.sides : 0;
            const bSidesAsc = typeof b.sides === 'number' ? b.sides : 0;
            return aSidesAsc - bSidesAsc;
          default: return 0;
        }
      });
    }

    return filtered;
  }, [albums, collectionFilter, selectedLetter, selectedFolderValue, folderMode, searchQuery, sortBy, tableSortState]);

  // Auto-select first album when filtered list changes
  useEffect(() => {
    if (filteredAndSortedAlbums.length > 0 && !selectedAlbumId) {
      setSelectedAlbumId(filteredAndSortedAlbums[0].id);
    }
  }, [filteredAndSortedAlbums, selectedAlbumId]);

  const folderCounts = useMemo(() => {
    return albums.reduce((acc, album) => {
      const itemKey = album.format || 'Unknown';
      acc[itemKey] = (acc[itemKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [albums]);

  const sortedFolderItems = useMemo(() => {
    return Object.entries(folderCounts)
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
  }, [folderCounts, folderSortByCount, folderSearch]);

  const selectedAlbum = useMemo(() => {
    return albums.find(a => a.id === selectedAlbumId) || null;
  }, [albums, selectedAlbumId]);

  const sortOptionsByCategory = useMemo(() => {
    return SORT_OPTIONS.reduce((acc, opt) => {
      if (!acc[opt.category]) acc[opt.category] = [];
      acc[opt.category].push(opt);
      return acc;
    }, {} as Record<string, typeof SORT_OPTIONS>);
  }, []);

  const handleAlbumClick = useCallback((album: Album) => {
    setSelectedAlbumId(album.id);
  }, []);

  const handleSelectionChange = useCallback((albumIds: Set<string>) => {
    setSelectedAlbumIds(new Set(Array.from(albumIds).map(id => Number(id))));
  }, []);

  const handleEditAlbum = useCallback((albumId: number) => {
    setEditingAlbumId(albumId);
  }, []);

  const selectedAlbumsAsStrings = useMemo(() => {
    return new Set(Array.from(selectedAlbumIds).map(id => String(id)));
  }, [selectedAlbumIds]);

  return (
    <>
      <style>{`
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
                <button 
                  onClick={() => {
                    setSidebarOpen(false);
                    setShowSettings(true);
                  }}
                  title="Application settings"
                  style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>⚙️</span> Settings
                </button>
              </div>
            </div>
          </>
        )}

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
              onClick={() => setShowSettings(true)}
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
              {selectedAlbumIds.size} of {filteredAndSortedAlbums.length} selected
            </span>
          </div>
        )}

        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0
        }}>
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
                
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
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
                  
                  {showSortDropdown && (
                    <>
                      <div
                        onClick={() => setShowSortDropdown(false)}
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 99
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 100,
                        minWidth: '240px',
                        maxHeight: '400px',
                        overflowY: 'auto'
                      }}>
                        {Object.entries(sortOptionsByCategory).map(([category, options]) => (
                          <div key={category}>
                            <div style={{
                              padding: '8px 12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#999',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              background: '#f8f8f8',
                              borderBottom: '1px solid #e8e8e8'
                            }}>
                              {category}
                            </div>
                            {options.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => handleSortChange(opt.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  background: sortBy === opt.value ? '#e3f2fd' : 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  color: '#333',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}
                                onMouseEnter={(e) => {
                                  if (sortBy !== opt.value) {
                                    e.currentTarget.style.background = '#f5f5f5';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (sortBy !== opt.value) {
                                    e.currentTarget.style.background = 'transparent';
                                  }
                                }}
                              >
                                <span>{opt.label}</span>
                                {sortBy === opt.value && <span style={{ color: '#2196F3' }}>✓</span>}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                
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
                {loading ? 'Loading...' : `${filteredAndSortedAlbums.length} albums`}
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', background: '#fff', minHeight: 0 }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                  Loading albums...
                </div>
              ) : (
                <CollectionTable
                  albums={filteredAndSortedAlbums}
                  visibleColumns={visibleColumns}
                  lockedColumns={lockedColumns}
                  onAlbumClick={handleAlbumClick}
                  selectedAlbums={selectedAlbumsAsStrings}
                  onSelectionChange={handleSelectionChange}
                  sortState={tableSortState}
                  onSortChange={handleTableSortChange}
                  onEditAlbum={handleEditAlbum}
                />
              )}
            </div>
          </div>

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
                  onClick={() => selectedAlbumId && handleEditAlbum(selectedAlbumId)}
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

            <AlbumInfoPanel album={selectedAlbum} />
          </div>
        </div>

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

      {showColumnSelector && (
        <ColumnSelector
          visibleColumns={visibleColumns}
          onColumnsChange={handleColumnsChange}
          onClose={() => setShowColumnSelector(false)}
        />
      )}

      {editingAlbumId && (
        <EditAlbumModal
          albumId={editingAlbumId}
          onClose={() => setEditingAlbumId(null)}
          onRefresh={loadAlbums}
          onNavigate={(newAlbumId) => setEditingAlbumId(newAlbumId)}
          allAlbumIds={filteredAndSortedAlbums.map(a => a.id)}
        />
      )}

      {showSettings && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
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
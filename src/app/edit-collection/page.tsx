// src/app/edit-collection/page.tsx - REFACTORED WITH CSS MODULE
'use client';

import { useCallback, useEffect, useState, useMemo, memo } from 'react';
import Image from 'next/image';
import { supabase } from '../../lib/supabaseClient';
import CollectionTable from '../../components/CollectionTable';
import ColumnSelector from '../../components/ColumnSelector';
import { ColumnId, DEFAULT_VISIBLE_COLUMNS, DEFAULT_LOCKED_COLUMNS, SortState } from './columnDefinitions';
import { Album, toSafeStringArray, toSafeSearchString } from '../../types/album';
import EditAlbumModal from './EditAlbumModal';
import { SettingsModal } from './settings/SettingsModal';
import NewCrateModal from './crates/NewCrateModal';
import NewSmartCrateModal from './crates/NewSmartCrateModal';
import ManageCratesModal from './crates/ManageCratesModal';
import { AddToCrateModal } from './crates/AddToCrateModal';
import ManagePickListsModal from './ManagePickListsModal';
import { PrintToPDFModal } from './PrintToPDFModal';
import { StatisticsModal } from './StatisticsModal';
import ImportSelectionModal from './components/ImportSelectionModal';
import ImportDiscogsModal from './components/ImportDiscogsModal';
import type { Crate } from '../../types/crate';
import { albumMatchesSmartCrate } from '../../lib/crateUtils';
import { BoxIcon } from '../../components/BoxIcon';
import styles from './EditCollection.module.css';

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
    return <div className={styles.albumInfoEmpty}>Select an album to view details</div>;
  }

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

  const getTotalRuntime = (): string => {
    if (!album.tracks || album.tracks.length === 0) {
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

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

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

  const getEbayUrl = (): string => {
    const query = `${album.artist} ${album.title}`.replace(/\s+/g, '+');
    return `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1`;
  };

  const totalTracks = album.tracks?.filter(t => t.type === 'track').length || album.spotify_total_tracks || album.apple_music_track_count || 0;
  const totalRuntime = getTotalRuntime();

  return (
    <div className={styles.albumInfoPanel}>
      <div className={styles.albumInfoArtist}>{album.artist}</div>
      <div className={styles.albumInfoTitle}>
        <h4 className={styles.albumInfoTitleText}>{album.title}</h4>
        <div className={styles.albumInfoCheckmark}>✓</div>
      </div>
      <div className={styles.albumInfoImage}>
        {(imageIndex === 0 ? album.image_url : album.back_image_url) ? (
          <Image 
            src={(imageIndex === 0 ? album.image_url : album.back_image_url) || ''} 
            alt={`${album.artist} - ${album.title}`}
            width={400} height={400}
            style={{ width: '100%', height: 'auto', aspectRatio: '1', objectFit: 'cover', border: '1px solid #ddd' }}
            unoptimized
          />
        ) : (
          <div className={styles.albumInfoImagePlaceholder}>🎵</div>
        )}
        {album.back_image_url && (
          <div className={styles.albumInfoCarousel}>
            <div className={`${styles.albumInfoCarouselDot} ${imageIndex === 0 ? styles.albumInfoCarouselDotActive : ''}`} onClick={() => setImageIndex(0)} />
            <div className={`${styles.albumInfoCarouselDot} ${imageIndex === 1 ? styles.albumInfoCarouselDotActive : ''}`} onClick={() => setImageIndex(1)} />
          </div>
        )}
      </div>
      <div className={styles.albumInfoLabel}>
        {(album.labels && album.labels.length > 0 ? album.labels.join(', ') : (album.spotify_label || album.apple_music_label)) || 'Unknown Label'} 
        {album.year && ` (${album.year})`}
      </div>
      {(album.discogs_genres || album.spotify_genres) && (
        <div className={styles.albumInfoGenres}>
          {toSafeStringArray(album.discogs_genres || album.spotify_genres).join(' | ')}
        </div>
      )}
      <div className={styles.albumInfoBarcode}>||||| {album.barcode || '—'}</div>
      <div className={styles.albumInfoCountry}>{album.country || '—'}</div>
      <div className={styles.albumInfoFormat}>
        {album.format || '—'} | {album.discs ? `${album.discs} Disc${album.discs > 1 ? 's' : ''}` : '—'} | {totalTracks > 0 ? `${totalTracks} Tracks` : '—'} | {totalRuntime}
      </div>
      <div className={styles.albumInfoCatNo}><span style={{ fontWeight: 600 }}>CAT NO</span> {album.cat_no || '—'}</div>
      <a href={getEbayUrl()} target="_blank" rel="noopener noreferrer" className={styles.albumInfoLink}>Find solid listings on eBay</a>

      {album.tracks && album.tracks.length > 0 && (() => {
        const discMap = new Map<number, typeof album.tracks>();
        album.tracks.forEach(track => {
          if (!discMap.has(track.disc_number)) discMap.set(track.disc_number, []);
          discMap.get(track.disc_number)!.push(track);
        });
        discMap.forEach(tracks => tracks.sort((a, b) => parseInt(a.position) - parseInt(b.position)));
        const sortedDiscs = Array.from(discMap.entries()).sort(([a], [b]) => a - b);

        return (
          <div className={styles.albumInfoSection}>
            {sortedDiscs.map(([discNumber, tracks]) => {
              const discMeta = album.disc_metadata?.find(d => d.disc_number === discNumber);
              const discTitle = discMeta?.title || `Disc #${discNumber}`;
              const runtime = getDiscRuntime(discNumber);
              return (
                <div key={discNumber} className={styles.trackDisc}>
                  <div className={styles.trackDiscHeader}><span>{discTitle}</span>{runtime && <span>{runtime}</span>}</div>
                  <div className={styles.trackList}>
                    {tracks.map((track, idx) => track.type === 'header' ? (
                      <div key={idx} className={styles.trackHeader}>{track.title}</div>
                    ) : (
                      <div key={idx} className={styles.trackRow} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                        <div className={styles.trackPosition}>{track.position}</div>
                        <div className={styles.trackTitle}>{track.title}</div>
                        {track.duration && <div className={styles.trackDuration}>{track.duration}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <div className={styles.albumInfoSection}>
        <div className={styles.albumInfoSectionTitle}>Details</div>
        <div className={styles.albumInfoSectionContent}>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabelWide}>Release Date</span><span>{album.year || '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabelWide}>Original Release Date</span><span>{album.original_release_date ? formatDate(album.original_release_date) : '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabelWide}>Package/Sleeve Condition</span><span>{album.package_sleeve_condition || '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabelWide}>Media Condition</span><span>{album.media_condition || '—'}</span></div>
        </div>
      </div>

      <div className={styles.albumInfoSection}>
        <div className={styles.albumInfoSectionTitle}>Personal</div>
        <div className={styles.albumInfoSectionContent}>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Quantity</span><span>1</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Index</span><span>{album.index_number || '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Purchase Date</span><span>{album.purchase_date ? formatDate(album.purchase_date) : '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Purchase Store</span><span>{album.purchase_store || '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Purchase Price</span><span>{album.purchase_price ? `$${album.purchase_price.toFixed(2)}` : '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Current Value</span><span>{album.current_value ? `$${album.current_value.toFixed(2)}` : '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Owner</span><span>{album.owner || '—'}</span></div>
          <div className={styles.albumInfoField}>
            <span className={styles.albumInfoFieldLabel}>My Rating</span>
            <span>{album.my_rating ? (
              <span style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: album.my_rating }).map((_, i) => <span key={i} style={{ color: '#fbbf24', fontSize: '14px' }}>★</span>)}
                {Array.from({ length: 10 - album.my_rating }).map((_, i) => <span key={i} style={{ color: '#d1d5db', fontSize: '14px' }}>★</span>)}
              </span>
            ) : '—'}</span>
          </div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Last Cleaned</span><span>{album.last_cleaned_date ? formatDate(album.last_cleaned_date) : '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Signed By</span><span>{album.signed_by && Array.isArray(album.signed_by) && album.signed_by.length > 0 ? album.signed_by.join(', ') : '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Added Date</span><span>{album.date_added ? formatDateTime(album.date_added) : '—'}</span></div>
          <div className={styles.albumInfoField}><span className={styles.albumInfoFieldLabel}>Modified Date</span><span>{album.modified_date ? formatDateTime(album.modified_date) : '—'}</span></div>
        </div>
      </div>

      <div className={styles.albumInfoSection}>
        <div className={styles.albumInfoSectionTitle}>Notes</div>
        <div className={styles.albumInfoNotes}>{album.notes || '—'}</div>
      </div>

      <div>
        <div className={styles.albumInfoSectionTitle}>Tags</div>
        {album.custom_tags && album.custom_tags.length > 0 ? (
          <div className={styles.albumInfoTags}>
            {toSafeStringArray(album.custom_tags).map(tag => <span key={tag} className={styles.albumInfoTag}>{tag}</span>)}
          </div>
        ) : (
          <div className={styles.albumInfoNoTags}>No tags</div>
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
  const [folderMode, setFolderMode] = useState<string>('format');
  const [selectedFolderValue, setSelectedFolderValue] = useState<string | null>(null);
  const [selectedCrateId, setSelectedCrateId] = useState<number | null>(null);
  const [crates, setCrates] = useState<Crate[]>([]);
  const [collectionFilter] = useState<string>('All');
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [folderSortByCount, setFolderSortByCount] = useState(false);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<number>>(new Set());
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showFolderModeDropdown, setShowFolderModeDropdown] = useState(false);
  const [showManageCratesModal, setShowManageCratesModal] = useState(false);
  const [showManagePickListsModal, setShowManagePickListsModal] = useState(false);
  const [showNewCrateModal, setShowNewCrateModal] = useState(false);
  const [showNewSmartCrateModal, setShowNewSmartCrateModal] = useState(false);
  const [showAddToCrateModal, setShowAddToCrateModal] = useState(false);
  const [showPrintToPDF, setShowPrintToPDF] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportDiscogsModal, setShowImportDiscogsModal] = useState(false);
  const [editingCrate, setEditingCrate] = useState<Crate | null>(null);
  const [returnToAddToCrate, setReturnToAddToCrate] = useState(false);
  const [newlyCreatedCrateId, setNewlyCreatedCrateId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('artist-asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [tableSortState, setTableSortState] = useState<SortState>({ column: null, direction: null });
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [lockedColumns, setLockedColumns] = useState<ColumnId[]>(DEFAULT_LOCKED_COLUMNS);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  useEffect(() => {
    const stored = localStorage.getItem('collection-visible-columns');
    if (stored) {
      try { setVisibleColumns(JSON.parse(stored)); } catch {}
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('collection-locked-columns');
    if (stored) {
      try { setLockedColumns(JSON.parse(stored)); } catch {}
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
        if (prev.direction === 'asc') return { column, direction: 'desc' };
        else if (prev.direction === 'desc') return { column: null, direction: null };
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
      const { data: batch, error } = await supabase.from('collection').select('*').order('artist', { ascending: true }).range(from, from + batchSize - 1);
      if (error) { console.error('Error loading albums:', error); break; }
      if (!batch || batch.length === 0) break;
      allRows = allRows.concat(batch as Album[]);
      keepGoing = batch.length === batchSize;
      from += batchSize;
    }
    setAlbums(allRows);
    setLoading(false);
  }, []);

  const loadCrates = useCallback(async () => {
    const { data, error } = await supabase.from('crates').select('*').order('sort_order', { ascending: true });
    if (error) { console.error('Error loading crates:', error); return; }
    if (data) setCrates(data as Crate[]);
  }, []);

  useEffect(() => {
    loadAlbums();
    loadCrates();
  }, [loadAlbums, loadCrates]);

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
      if (folderMode === 'crates' && selectedCrateId !== null) {
        const selectedCrate = crates.find(c => c.id === selectedCrateId);
        if (selectedCrate && selectedCrate.is_smart && !albumMatchesSmartCrate(album, selectedCrate)) return false;
      }
      if (folderMode === 'format' && selectedFolderValue && album.format !== selectedFolderValue) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [album.artist, album.title, album.format, album.year, toSafeSearchString(album.custom_tags), toSafeSearchString(album.discogs_genres), toSafeSearchString(album.spotify_label), toSafeSearchString(album.apple_music_label)].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });

    if (tableSortState.column && tableSortState.direction) {
      const { column, direction } = tableSortState;
      const multiplier = direction === 'asc' ? 1 : -1;
      filtered = [...filtered].sort((a, b) => {
        if (column === 'artist') return multiplier * (a.artist || '').localeCompare(b.artist || '');
        else if (column === 'title') return multiplier * (a.title || '').localeCompare(b.title || '');
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
          case 'sides-desc': return (typeof b.sides === 'number' ? b.sides : 0) - (typeof a.sides === 'number' ? a.sides : 0);
          case 'sides-asc': return (typeof a.sides === 'number' ? a.sides : 0) - (typeof b.sides === 'number' ? b.sides : 0);
          default: return 0;
        }
      });
    }
    return filtered;
  }, [albums, collectionFilter, selectedLetter, selectedFolderValue, selectedCrateId, folderMode, crates, searchQuery, sortBy, tableSortState]);

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

  const cratesWithCounts = useMemo(() => {
    return crates.map(crate => ({
      ...crate,
      album_count: crate.is_smart ? albums.filter(album => albumMatchesSmartCrate(album, crate)).length : 0
    }));
  }, [crates, albums]);

  const sortedFolderItems = useMemo(() => {
    return Object.entries(folderCounts)
      .sort((a, b) => folderSortByCount ? b[1] - a[1] : a[0].localeCompare(b[0]))
      .filter(([item]) => !folderSearch || item.toLowerCase().includes(folderSearch.toLowerCase()));
  }, [folderCounts, folderSortByCount, folderSearch]);

  const selectedAlbum = useMemo(() => albums.find(a => a.id === selectedAlbumId) || null, [albums, selectedAlbumId]);
  const sortOptionsByCategory = useMemo(() => {
    return SORT_OPTIONS.reduce((acc, opt) => {
      if (!acc[opt.category]) acc[opt.category] = [];
      acc[opt.category].push(opt);
      return acc;
    }, {} as Record<string, typeof SORT_OPTIONS>);
  }, []);

  const handleAlbumClick = useCallback((album: Album) => setSelectedAlbumId(album.id), []);
  const handleSelectionChange = useCallback((albumIds: Set<string>) => {
    setSelectedAlbumIds(new Set(Array.from(albumIds).map(id => Number(id))));
  }, []);
  const handleEditAlbum = useCallback((albumId: number) => setEditingAlbumId(albumId), []);
  const selectedAlbumsAsStrings = useMemo(() => new Set(Array.from(selectedAlbumIds).map(id => String(id))), [selectedAlbumIds]);
  const handleFolderModeChange = useCallback((mode: string) => {
    setFolderMode(mode);
    setShowFolderModeDropdown(false);
    setSelectedFolderValue(null);
    setSelectedCrateId(null);
  }, []);

  const handleAddToCrates = useCallback(async (crateIds: number[]) => {
    if (selectedAlbumIds.size === 0 || crateIds.length === 0) return;
    try {
      const albumIds = Array.from(selectedAlbumIds);
      const records = [];
      for (const crateId of crateIds) {
        for (const albumId of albumIds) {
          records.push({ crate_id: crateId, album_id: albumId });
        }
      }
      const { error } = await supabase.from('crate_albums').insert(records);
      if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) throw error;
      await loadCrates();
      setSelectedAlbumIds(new Set());
      const crateNames = crates.filter(c => crateIds.includes(c.id)).map(c => c.name).join(', ');
      console.log(`✅ Added ${albumIds.length} album(s) to: ${crateNames}`);
    } catch (err) {
      console.error('Failed to add albums to crates:', err);
      throw err;
    }
  }, [selectedAlbumIds, crates, loadCrates]);

  return (
    <>
      <style>{`
        body > div:first-child > nav, body > div:first-child > header:not(.clz-header), body > nav, body > header:not(.clz-header),
        [class*="navigation"], [class*="Navigation"], [class*="navbar"], [class*="NavBar"],
        [class*="sidebar"]:not(.clz-sidebar), [class*="Sidebar"]:not(.clz-sidebar) { display: none !important; }
        body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      `}</style>

      <div className={styles.container}>
        {sidebarOpen && (
          <>
            <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
            <div className={`clz-sidebar ${styles.sidebar}`}>
              <div className={styles.sidebarHeader}>
                <div>DWD COLLECTION</div>
                <button onClick={() => setSidebarOpen(false)} className={styles.button}>×</button>
              </div>
              <div className={styles.sidebarSection}>
                <div className={styles.sidebarSectionTitle}>Collection</div>
                <button onClick={() => { setSidebarOpen(false); setShowManagePickListsModal(true); }} className={styles.sidebarButton}><span>📋</span> Manage Pick Lists</button>
                <button onClick={() => { setSidebarOpen(false); setShowManageCratesModal(true); }} className={styles.sidebarButton}><span>📦</span> Manage Crates</button>
              </div>
              <hr style={{ borderColor: '#444', margin: '20px 0' }} />
              <div className={styles.sidebarSection}>
                <div className={styles.sidebarSectionTitle}>Tools</div>
                <button onClick={() => { setSidebarOpen(false); setShowPrintToPDF(true); }} className={styles.sidebarButton}><span>🖨️</span> Print to PDF</button>
                <button onClick={() => { setSidebarOpen(false); setShowStatistics(true); }} className={styles.sidebarButton}><span>📊</span> Statistics</button>
                <button onClick={() => { setSidebarOpen(false); setShowImportModal(true); }} className={styles.sidebarButton}><span>📥</span> Import Data</button>
                <button className={styles.sidebarButton}><span>🔍</span> Find Duplicates</button>
                <button className={styles.sidebarButton}><span>📚</span> Loan Manager</button>
                <button onClick={() => { setSidebarOpen(false); setShowSettings(true); }} className={styles.sidebarButton}><span>⚙️</span> Settings</button>
              </div>
            </div>
          </>
        )}

        <div className={`clz-header ${styles.header}`}>
          <div className={styles.headerLeft}>
            <button onClick={() => setSidebarOpen(true)} className={styles.button}>☰</button>
            <div className={styles.headerTitle}>
              <span style={{ fontSize: '18px' }}>♪</span>
              <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.5px' }}>DWD Collection Management System</span>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.button}>⊞</button>
            <button className={styles.button}>👤</button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <button className={styles.buttonPrimary}><span style={{ fontSize: '16px' }}>+</span><span>Add Albums</span></button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowCollectionDropdown(!showCollectionDropdown)} className={styles.buttonSecondary}>
                <span>📚</span><span>{collectionFilter}</span><span style={{ fontSize: '10px' }}>▼</span>
              </button>
            </div>
          </div>

          <div className={styles.toolbarCenter}>
            <button onClick={() => setSelectedLetter('All')} className={`${styles.letterButton} ${selectedLetter === 'All' ? styles.letterButtonActive : ''}`}>All</button>
            <button onClick={() => setSelectedLetter('0-9')} className={`${styles.letterButton} ${selectedLetter === '0-9' ? styles.letterButtonActive : ''}`}>0-9</button>
            {alphabet.map(letter => (
              <button key={letter} onClick={() => setSelectedLetter(letter)} className={`${styles.letterButton} ${selectedLetter === letter ? styles.letterButtonActive : ''}`}>{letter}</button>
            ))}
            <button onClick={() => setShowSettings(true)} className={styles.button} style={{ marginLeft: '4px' }}>⚙️</button>
          </div>

          <div className={styles.toolbarRight}>
            <div className={styles.searchContainer}>
              <button onClick={() => setShowSearchTypeDropdown(!showSearchTypeDropdown)} className={styles.searchButton}>
                <span>🔍</span><span style={{ fontSize: '10px' }}>▼</span>
              </button>
              <input type="text" placeholder="Search albums..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={styles.searchInput} />
            </div>
          </div>
        </div>

        {selectedAlbumIds.size > 0 && (
          <div className={styles.selectionBar}>
            <button onClick={() => setSelectedAlbumIds(new Set())} className={styles.selectionButton}>✕ Cancel</button>
            <button className={styles.selectionButton}>☑ All</button>
            <button className={styles.selectionButton}>✏️ Edit</button>
            <button className={styles.selectionButton}>🗑 Remove</button>
            <button onClick={() => setShowAddToCrateModal(true)} className={styles.selectionButton}>📦 Add to Crate</button>
            <button className={styles.selectionButton}>🖨 Print to PDF</button>
            <button className={styles.selectionButton}>⋮</button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '12px', fontWeight: 500 }}>{selectedAlbumIds.size} of {filteredAndSortedAlbums.length} selected</span>
          </div>
        )}

        <div className={styles.mainContent}>
          <div className={styles.leftPanel}>
            <div className={styles.leftPanelHeader}>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowFolderModeDropdown(!showFolderModeDropdown)} className={styles.buttonSecondary} style={{ fontSize: '12px', padding: '5px 10px' }}>
                  <span>{folderMode === 'crates' ? '📦' : '📁'}</span>
                  <span>{folderMode === 'crates' ? 'Crates' : 'Format'}</span>
                  <span style={{ fontSize: '10px' }}>▼</span>
                </button>
                {showFolderModeDropdown && (
                  <>
                    <div className={styles.dropdownOverlay} onClick={() => setShowFolderModeDropdown(false)} />
                    <div className={`${styles.dropdown} ${styles.dropdownDark}`}>
                      <div className={styles.dropdownCategoryDark}>Favorites</div>
                      <button onClick={() => handleFolderModeChange('format')} className={`${styles.dropdownItem} ${styles.dropdownItemDark} ${folderMode === 'format' ? styles.dropdownItemActive : ''}`}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span>📁</span><span>Format</span></span>
                      </button>
                      <div className={styles.dropdownCategoryDark}>Crates</div>
                      <button onClick={() => handleFolderModeChange('crates')} className={`${styles.dropdownItem} ${styles.dropdownItemDark} ${folderMode === 'crates' ? styles.dropdownItemActive : ''}`}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span>📦</span><span>Crates</span></span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button className={styles.button}>☰</button>
            </div>

            <div className={styles.leftPanelSearch}>
              <input type="text" placeholder={folderMode === 'crates' ? 'Search crates...' : 'Search format...'} value={folderSearch} onChange={(e) => setFolderSearch(e.target.value)} className={styles.leftPanelSearchInput} />
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                <button onClick={() => setFolderSortByCount(!folderSortByCount)} className={styles.buttonIcon}>{folderSortByCount ? '🔢' : '🔤'}</button>
              </div>
            </div>

            <div className={styles.leftPanelList}>
              {folderMode === 'format' ? (
                <>
                  <button onClick={() => setSelectedFolderValue(null)} className={`${styles.folderButton} ${!selectedFolderValue ? styles.folderButtonActive : ''}`}>
                    <span>[All Albums]</span>
                    <span className={`${styles.folderCount} ${!selectedFolderValue ? styles.folderCountActive : ''}`}>{albums.length}</span>
                  </button>
                  {sortedFolderItems.map(([format, count]) => (
                    <button key={format} onClick={() => setSelectedFolderValue(format)} className={`${styles.folderButton} ${selectedFolderValue === format ? styles.folderButtonActive : ''}`}>
                      <span>{format}</span>
                      <span className={`${styles.folderCount} ${selectedFolderValue === format ? styles.folderCountActive : ''}`}>{count}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button onClick={() => setSelectedCrateId(null)} className={`${styles.folderButton} ${selectedCrateId === null ? styles.folderButtonActive : ''}`}>
                    <span>📚 [All Albums]</span>
                    <span className={`${styles.folderCount} ${selectedCrateId === null ? styles.folderCountActive : ''}`}>{albums.length}</span>
                  </button>
                  {cratesWithCounts.filter(crate => !folderSearch || crate.name.toLowerCase().includes(folderSearch.toLowerCase())).map(crate => (
                    <button key={crate.id} onClick={() => setSelectedCrateId(crate.id)} className={`${styles.folderButton} ${selectedCrateId === crate.id ? styles.folderButtonActive : ''}`}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {crate.is_smart ? <BoxIcon color={crate.icon} size={16} /> : <span>{crate.icon}</span>}
                        <span>{crate.name}</span>
                      </span>
                      <span className={`${styles.folderCount} ${selectedCrateId === crate.id ? styles.folderCountActive : ''}`}>{crate.album_count || 0}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className={styles.centerPanel}>
            <div className={styles.centerPanelToolbar}>
              <div className={styles.centerPanelToolbarLeft}>
                <button className={styles.buttonIcon}><span>☰</span><span style={{ fontSize: '9px' }}>▼</span></button>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowSortDropdown(!showSortDropdown)} className={styles.buttonIcon}><span>↕️</span><span style={{ fontSize: '9px' }}>▼</span></button>
                  {showSortDropdown && (
                    <>
                      <div className={styles.dropdownOverlay} onClick={() => setShowSortDropdown(false)} />
                      <div className={styles.dropdown}>
                        {Object.entries(sortOptionsByCategory).map(([category, options]) => (
                          <div key={category}>
                            <div className={styles.dropdownCategory}>{category}</div>
                            {options.map(opt => (
                              <button key={opt.value} onClick={() => handleSortChange(opt.value)} className={`${styles.dropdownItem} ${sortBy === opt.value ? styles.dropdownItemActive : ''}`}>
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
                <button onClick={() => setShowColumnSelector(true)} className={styles.buttonIcon}><span>⊞</span><span style={{ fontSize: '9px' }}>▼</span></button>
              </div>
              <div style={{ fontSize: '12px', color: '#ddd', fontWeight: 600 }}>{loading ? 'Loading...' : `${filteredAndSortedAlbums.length} albums`}</div>
            </div>

            <div className={styles.centerPanelContent}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading albums...</div>
              ) : (
                <CollectionTable albums={filteredAndSortedAlbums} visibleColumns={visibleColumns} lockedColumns={lockedColumns} onAlbumClick={handleAlbumClick} selectedAlbums={selectedAlbumsAsStrings} onSelectionChange={handleSelectionChange} sortState={tableSortState} onSortChange={handleTableSortChange} onEditAlbum={handleEditAlbum} />
              )}
            </div>
          </div>

          <div className={styles.rightPanel}>
            <div className={styles.rightPanelToolbar}>
              <div className={styles.rightPanelToolbarLeft}>
                <button onClick={() => selectedAlbumId && handleEditAlbum(selectedAlbumId)} className={styles.rightPanelToolbarButton}>✏️</button>
                <button className={styles.rightPanelToolbarButton}>↗️</button>
                <button className={styles.rightPanelToolbarButton} style={{ fontSize: '12px', fontWeight: 600 }}>eBay</button>
                <button className={styles.rightPanelToolbarButton}>⋮</button>
              </div>
              <button className={styles.buttonIcon}><span>⊞</span><span style={{ fontSize: '9px' }}>▼</span></button>
            </div>
            <AlbumInfoPanel album={selectedAlbum} />
          </div>
        </div>
      </div>

      {showColumnSelector && <ColumnSelector visibleColumns={visibleColumns} onColumnsChange={handleColumnsChange} onClose={() => setShowColumnSelector(false)} />}
      {editingAlbumId && <EditAlbumModal albumId={editingAlbumId} onClose={() => setEditingAlbumId(null)} onRefresh={loadAlbums} onNavigate={(newAlbumId) => setEditingAlbumId(newAlbumId)} allAlbumIds={filteredAndSortedAlbums.map(a => a.id)} />}
      {showSettings && <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />}
      {showManagePickListsModal && <ManagePickListsModal isOpen={showManagePickListsModal} onClose={() => setShowManagePickListsModal(false)} />}
      {showNewCrateModal && <NewCrateModal isOpen={showNewCrateModal} onClose={() => { setShowNewCrateModal(false); setEditingCrate(null); if (returnToAddToCrate) { setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }}} onCrateCreated={async (newCrateId) => { await loadCrates(); setEditingCrate(null); if (returnToAddToCrate) { setNewlyCreatedCrateId(newCrateId); setShowNewCrateModal(false); setShowAddToCrateModal(true); } else { setShowNewCrateModal(false); setShowManageCratesModal(true); }}} editingCrate={editingCrate} />}
      {showNewSmartCrateModal && <NewSmartCrateModal isOpen={showNewSmartCrateModal} onClose={() => { setShowNewSmartCrateModal(false); setEditingCrate(null); }} onCrateCreated={() => { loadCrates(); setShowNewSmartCrateModal(false); setShowManageCratesModal(true); setEditingCrate(null); }} editingCrate={editingCrate} />}
      {showManageCratesModal && <ManageCratesModal isOpen={showManageCratesModal} onClose={() => setShowManageCratesModal(false)} onCratesChanged={() => { loadCrates(); }} onOpenNewCrate={() => { setShowManageCratesModal(false); setEditingCrate(null); setShowNewCrateModal(true); }} onOpenNewSmartCrate={() => { setShowManageCratesModal(false); setEditingCrate(null); setShowNewSmartCrateModal(true); }} onOpenEditCrate={(crate) => { setShowManageCratesModal(false); setEditingCrate(crate); setShowNewCrateModal(true); }} onOpenEditSmartCrate={(crate) => { setShowManageCratesModal(false); setEditingCrate(crate); setShowNewSmartCrateModal(true); }} />}
      {showAddToCrateModal && <AddToCrateModal isOpen={showAddToCrateModal} onClose={() => { setShowAddToCrateModal(false); setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }} crates={cratesWithCounts} onAddToCrates={handleAddToCrates} selectedCount={selectedAlbumIds.size} onOpenNewCrate={() => { setReturnToAddToCrate(true); setShowAddToCrateModal(false); setEditingCrate(null); setShowNewCrateModal(true); }} autoSelectCrateId={newlyCreatedCrateId} />}
      {showPrintToPDF && <PrintToPDFModal isOpen={showPrintToPDF} onClose={() => setShowPrintToPDF(false)} allAlbums={albums} currentListAlbums={filteredAndSortedAlbums} checkedAlbumIds={selectedAlbumIds} />}
      {showStatistics && <StatisticsModal isOpen={showStatistics} onClose={() => setShowStatistics(false)} albums={albums} />}
      {showImportModal && <ImportSelectionModal onSelectImportType={(type) => { setShowImportModal(false); if (type === 'discogs') { setShowImportDiscogsModal(true); } else if (type === 'csv') { window.location.href = '/admin/import-csv'; } else if (type === 'clz') { window.location.href = '/admin/import-clz'; } else if (type === 'enrich') { window.location.href = '/admin/enrich-sources'; }}} onCancel={() => setShowImportModal(false)} />}
      {showImportDiscogsModal && <ImportDiscogsModal isOpen={showImportDiscogsModal} onClose={() => setShowImportDiscogsModal(false)} onImportComplete={() => { setShowImportDiscogsModal(false); loadAlbums(); loadCrates(); }} />}
    </>
  );
}

export default CollectionBrowserPage;
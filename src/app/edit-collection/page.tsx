// src/app/edit-collection/page.tsx - WITH CRATES FUNCTIONALITY AND PRINT TO PDF
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
import NewCrateModal from './crates/NewCrateModal';
import NewSmartCrateModal from './crates/NewSmartCrateModal';
import ManageCratesModal from './crates/ManageCratesModal';
import { AddToCrateModal } from './crates/AddToCrateModal';
import ManagePickListsModal from './ManagePickListsModal';
import { PrintToPDFModal } from './PrintToPDFModal';
import { StatisticsModal } from './StatisticsModal';
import ImportSelectionModal from './components/ImportSelectionModal';
import ImportDiscogsModal from './components/ImportDiscogsModal';
import ImportCLZModal from './components/ImportCLZModal';
import ImportCSVModal from './components/ImportCSVModal';
import ImportEnrichModal from './components/ImportEnrichModal';
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
    return <div className={styles.infoEmpty}>Select an album to view details</div>;
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
    <div className={styles.infoPanel}>
      <div className={styles.infoArtist}>{album.artist}</div>
      <div className={styles.infoTitleRow}>
        <h4 className={styles.infoTitle}>{album.title}</h4>
        <div className={styles.infoCheck} title="Album owned">✓</div>
      </div>

      <div className={styles.infoImage}>
        {(imageIndex === 0 ? album.image_url : album.back_image_url) ? (
          <Image 
            src={(imageIndex === 0 ? album.image_url : album.back_image_url) || ''} 
            alt={`${album.artist} - ${album.title} ${imageIndex === 0 ? 'front' : 'back'}`}
            width={400}
            height={400}
            style={{ width: '100%', height: 'auto', aspectRatio: '1', objectFit: 'cover', border: '1px solid #ddd' }}
            unoptimized
          />
        ) : (
          <div className={styles.infoImagePlaceholder}>🎵</div>
        )}
        
        {album.back_image_url && (
          <div className={styles.infoDots}>
            <div className={imageIndex === 0 ? styles.infoDotActive : styles.infoDot} onClick={() => setImageIndex(0)} />
            <div className={imageIndex === 1 ? styles.infoDotActive : styles.infoDot} onClick={() => setImageIndex(1)} />
          </div>
        )}
      </div>

      <div className={styles.infoLabel}>
        {(album.labels && album.labels.length > 0 ? album.labels.join(', ') : (album.spotify_label || album.apple_music_label)) || 'Unknown Label'} 
        {album.year && ` (${album.year})`}
      </div>

      {(album.discogs_genres || album.spotify_genres) && (
        <div className={styles.infoGenres}>
          {toSafeStringArray(album.discogs_genres || album.spotify_genres).join(' | ')}
        </div>
      )}

      <div className={styles.infoBarcode}>||||| {album.barcode || '—'}</div>
      <div className={styles.infoCountry}>{album.country || '—'}</div>
      <div className={styles.infoFormat}>
        {album.format || '—'}
        {' | '}{album.discs ? `${album.discs} Disc${album.discs > 1 ? 's' : ''}` : '—'}
        {' | '}{totalTracks > 0 ? `${totalTracks} Tracks` : '—'}
        {' | '}{totalRuntime}
      </div>

      <div className={styles.infoCatNo}>
        <span style={{ fontWeight: 600 }}>CAT NO</span> {album.cat_no || '—'}
      </div>

      <a href={getEbayUrl()} target="_blank" rel="noopener noreferrer" className={styles.infoLink}>
        Find solid listings on eBay
      </a>

      {(() => {
        if (!album.tracks || album.tracks.length === 0) return null;

        const discMap = new Map<number, typeof album.tracks>();
        album.tracks.forEach(track => {
          if (!discMap.has(track.disc_number)) {
            discMap.set(track.disc_number, []);
          }
          discMap.get(track.disc_number)!.push(track);
        });

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
                <div key={discNumber} className={styles.trackDisc}>
                  <div className={styles.trackDiscHeader}>
                    <span>{discTitle}</span>
                    {runtime && <span>{runtime}</span>}
                  </div>
                  <div className={styles.trackList}>
                    {tracks.map((track, idx) => {
                      if (track.type === 'header') {
                        return (
                          <div key={idx} className={idx > 0 ? styles.trackHeader : styles.trackHeaderFirst}>
                            {track.title}
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className={idx % 2 === 0 ? styles.trackRow : styles.trackRowAlt}>
                          <div className={styles.trackPos}>{track.position}</div>
                          <div className={styles.trackTitle}>{track.title}</div>
                          {track.duration && <div className={styles.trackDuration}>{track.duration}</div>}
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

      <div className={styles.infoSection}>
        <div className={styles.infoSectionTitle}>Details</div>
        <div className={styles.infoSectionContent}>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabelWide}>Release Date</span>
            <span>{album.year || '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabelWide}>Original Release Date</span>
            <span>{album.original_release_date ? formatDate(album.original_release_date) : '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabelWide}>Package/Sleeve Condition</span>
            <span>{album.package_sleeve_condition || '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabelWide}>Media Condition</span>
            <span>{album.media_condition || '—'}</span>
          </div>
        </div>
      </div>

      <div className={styles.infoSection}>
        <div className={styles.infoSectionTitle}>Personal</div>
        <div className={styles.infoSectionContent}>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Quantity</span>
            <span>1</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Index</span>
            <span>{album.index_number || '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Purchase Date</span>
            <span>{album.purchase_date ? formatDate(album.purchase_date) : '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Purchase Store</span>
            <span>{album.purchase_store || '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Purchase Price</span>
            <span>{album.purchase_price ? `$${album.purchase_price.toFixed(2)}` : '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Current Value</span>
            <span>{album.current_value ? `$${album.current_value.toFixed(2)}` : '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Owner</span>
            <span>{album.owner || '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>My Rating</span>
            <span>
              {album.my_rating ? (
                <span className={styles.infoStars}>
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
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Last Cleaned</span>
            <span>{album.last_cleaned_date ? formatDate(album.last_cleaned_date) : '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Signed By</span>
            <span>
              {album.signed_by && Array.isArray(album.signed_by) && album.signed_by.length > 0 
                ? album.signed_by.join(', ') 
                : '—'}
            </span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Added Date</span>
            <span>{album.date_added ? formatDateTime(album.date_added) : '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoFieldLabel}>Modified Date</span>
            <span>{album.modified_date ? formatDateTime(album.modified_date) : '—'}</span>
          </div>
        </div>
      </div>

      <div className={styles.infoSection}>
        <div className={styles.infoSectionTitle}>Notes</div>
        <div className={styles.infoNotes}>{album.notes || '—'}</div>
      </div>

      <div>
        <div className={styles.infoSectionTitle}>Tags</div>
        {album.custom_tags && album.custom_tags.length > 0 ? (
          <div className={styles.infoTags}>
            {toSafeStringArray(album.custom_tags).map(tag => (
              <span key={tag} className={styles.infoTag}>{tag}</span>
            ))}
          </div>
        ) : (
          <div className={styles.infoNoTags}>No tags</div>
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
  const [showImportCLZModal, setShowImportCLZModal] = useState(false);
  const [showImportCSVModal, setShowImportCSVModal] = useState(false);
  const [showImportEnrichModal, setShowImportEnrichModal] = useState(false);
  const [editingCrate, setEditingCrate] = useState<Crate | null>(null);
  const [returnToAddToCrate, setReturnToAddToCrate] = useState(false);
  const [newlyCreatedCrateId, setNewlyCreatedCrateId] = useState<number | null>(null);
  
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

  const loadCrates = useCallback(async () => {
    const { data, error } = await supabase
      .from('crates')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading crates:', error);
      return;
    }

    if (data) {
      setCrates(data as Crate[]);
    }
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
        if (selectedCrate) {
          if (selectedCrate.is_smart) {
            if (!albumMatchesSmartCrate(album, selectedCrate)) {
              return false;
            }
          } else {
            // Manual crate - will be implemented in Phase 2
          }
        }
      }

      if (folderMode === 'format' && selectedFolderValue) {
        if (album.format !== selectedFolderValue) return false;
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
    return crates.map(crate => {
      let count = 0;
      if (crate.is_smart) {
        count = albums.filter(album => albumMatchesSmartCrate(album, crate)).length;
      } else {
        count = 0;
      }
      return { ...crate, album_count: count };
    });
  }, [crates, albums]);

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
          records.push({
            crate_id: crateId,
            album_id: albumId,
          });
        }
      }

      const { error } = await supabase
        .from('crate_albums')
        .insert(records);

      if (error) {
        if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
          throw error;
        }
      }

      await loadCrates();
      setSelectedAlbumIds(new Set());
      
      const crateNames = crates
        .filter(c => crateIds.includes(c.id))
        .map(c => c.name)
        .join(', ');
      
      console.log(`✅ Added ${albumIds.length} album(s) to: ${crateNames}`);
    } catch (err) {
      console.error('Failed to add albums to crates:', err);
      throw err;
    }
  }, [selectedAlbumIds, crates, loadCrates]);

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
        body > [class*="sidebar"]:not(.clz-sidebar),
        body > [class*="Sidebar"]:not(.clz-sidebar) {
          display: none !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
      `}</style>

      <div className={styles.container}>
        {sidebarOpen && (
          <>
            <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
            <div className={`clz-sidebar ${styles.sidebar}`}>
              <div className={styles.sidebarHeader}>
                <div>DWD COLLECTION</div>
                <button onClick={() => setSidebarOpen(false)} title="Close menu" className={styles.sidebarCloseButton}>×</button>
              </div>

              <div className={styles.sidebarSection}>
                <div className={styles.sidebarSectionTitle}>Collection</div>
                <button onClick={() => { setSidebarOpen(false); setShowManagePickListsModal(true); }} title="Create and manage pick lists" className={styles.sidebarButton}>
                  <span style={{ marginRight: '10px' }}>📋</span> Manage Pick Lists
                </button>
                <button onClick={() => { setSidebarOpen(false); setShowManageCratesModal(true); }} title="Manage crates (DJ workflow organization)" className={styles.sidebarButton}>
                  <span style={{ marginRight: '10px' }}>📦</span> Manage Crates
                </button>
              </div>

              <hr className={styles.sidebarHr} />

              <div className={styles.sidebarSection}>
                <div className={styles.sidebarSectionTitle}>Tools</div>
                <button onClick={() => { setSidebarOpen(false); setShowPrintToPDF(true); }} title="Export collection to PDF" className={styles.sidebarButton}>
                  <span style={{ marginRight: '10px' }}>🖨️</span> Print to PDF
                </button>
                <button onClick={() => { setSidebarOpen(false); setShowStatistics(true); }} title="View collection statistics" className={styles.sidebarButton}>
                  <span style={{ marginRight: '10px' }}>📊</span> Statistics
                </button>
                <button onClick={() => { setSidebarOpen(false); setShowImportModal(true); }} title="Import album data from various sources" className={styles.sidebarButton}>
                  <span style={{ marginRight: '10px' }}>📥</span> Import Data
                </button>
                <button title="Find duplicate albums" className={styles.sidebarButton}>
                  <span style={{ marginRight: '10px' }}>🔍</span> Find Duplicates
                </button>
                <button title="Track loaned albums" className={styles.sidebarButton}>
                  <span style={{ marginRight: '10px' }}>📚</span> Loan Manager
                </button>
                <button onClick={() => { setSidebarOpen(false); setShowSettings(true); }} title="Application settings" className={styles.sidebarButton}>
                  <span style={{ marginRight: '10px' }}>⚙️</span> Settings
                </button>
              </div>
            </div>
          </>
        )}

        <div className={`clz-header ${styles.header}`}>
          <div className={styles.headerLeft}>
            <button onClick={() => setSidebarOpen(true)} title="Open menu" className={styles.headerMenuButton}>☰</button>
            <div className={styles.headerTitle}>
              <span style={{ fontSize: '18px' }}>♪</span>
              <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.5px' }}>DWD Collection Management System</span>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button title="Grid view" className={styles.headerButton}>⊞</button>
            <button title="User account" className={styles.headerButton}>👤</button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <button title="Add new albums to collection" className={styles.addButton}>
              <span style={{ fontSize: '16px' }}>+</span>
              <span>Add Albums</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowCollectionDropdown(!showCollectionDropdown)} title="Filter by collection status" className={styles.collectionButton}>
                <span>📚</span>
                <span>{collectionFilter}</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
            </div>
          </div>

          <div className={styles.toolbarCenter}>
            <button onClick={() => setSelectedLetter('All')} title="Show all albums" className={selectedLetter === 'All' ? styles.letterButtonActive : styles.letterButton}>All</button>
            <button onClick={() => setSelectedLetter('0-9')} title="Filter by numbers" className={selectedLetter === '0-9' ? styles.letterButtonActive : styles.letterButton}>0-9</button>
            {alphabet.map(letter => (
              <button key={letter} onClick={() => setSelectedLetter(letter)} title={`Filter by letter ${letter}`} className={selectedLetter === letter ? styles.letterButtonActive : styles.letterButton}>{letter}</button>
            ))}
            <button onClick={() => setShowSettings(true)} title="Settings" className={styles.settingsButton}>⚙️</button>
          </div>

          <div className={styles.toolbarRight}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowSearchTypeDropdown(!showSearchTypeDropdown)} title="Search type" className={styles.searchButton}>
                <span>🔍</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
            </div>
            <input type="text" placeholder="Search albums..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} title="Search your collection" className={styles.searchInput} />
          </div>
        </div>

        {selectedAlbumIds.size > 0 && (
          <div className={styles.selectionBar}>
            <button onClick={() => setSelectedAlbumIds(new Set())} title="Clear selection" className={styles.selectionButton}>✕ Cancel</button>
            <button title="Select all albums" className={styles.selectionButton}>☑ All</button>
            <button title="Edit selected albums" className={styles.selectionButton}>✏️ Edit</button>
            <button title="Remove selected albums" className={styles.selectionButton}>🗑 Remove</button>
            <button onClick={() => setShowAddToCrateModal(true)} title="Add selected albums to a crate" className={styles.selectionButton}>📦 Add to Crate</button>
            <button title="Export selected to PDF" className={styles.selectionButton}>🖨 Print to PDF</button>
            <button title="More actions" className={styles.selectionButton}>⋮</button>
            <div style={{ flex: 1 }} />
            <span className={styles.selectionCount}>{selectedAlbumIds.size} of {filteredAndSortedAlbums.length} selected</span>
          </div>
        )}

        <div className={styles.mainContent}>
          <div className={styles.leftPanel}>
            <div className={styles.leftPanelHeader}>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowFolderModeDropdown(!showFolderModeDropdown)} title="Change view mode" className={styles.folderButton}>
                  <span>{folderMode === 'crates' ? '📦' : '📁'}</span>
                  <span>{folderMode === 'crates' ? 'Crates' : 'Format'}</span>
                  <span style={{ fontSize: '10px' }}>▼</span>
                </button>

                {showFolderModeDropdown && (
                  <>
                    <div onClick={() => setShowFolderModeDropdown(false)} className={styles.dropdownOverlay} />
                    <div className={styles.folderDropdown}>
                      <div className={styles.dropdownCategory}>Favorites</div>
                      <button onClick={() => handleFolderModeChange('format')} className={folderMode === 'format' ? styles.dropdownItemActive : styles.dropdownItem} onMouseEnter={(e) => { if (folderMode !== 'format') { e.currentTarget.style.background = '#3a3a3a'; }}} onMouseLeave={(e) => { if (folderMode !== 'format') { e.currentTarget.style.background = 'transparent'; }}}>
                        <span>📁</span>
                        <span>Format</span>
                      </button>

                      <div className={styles.dropdownCategoryBorder}>Crates</div>
                      <button onClick={() => handleFolderModeChange('crates')} className={folderMode === 'crates' ? styles.dropdownItemActive : styles.dropdownItem} onMouseEnter={(e) => { if (folderMode !== 'crates') { e.currentTarget.style.background = '#3a3a3a'; }}} onMouseLeave={(e) => { if (folderMode !== 'crates') { e.currentTarget.style.background = 'transparent'; }}}>
                        <span>📦</span>
                        <span>Crates</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button title="View options" className={styles.menuButton}>☰</button>
            </div>

            <div className={styles.leftPanelSearch}>
              <input type="text" placeholder={folderMode === 'crates' ? 'Search crates...' : 'Search format...'} value={folderSearch} onChange={(e) => setFolderSearch(e.target.value)} title={folderMode === 'crates' ? 'Filter crates' : 'Filter formats'} className={styles.searchInput2} />
              <div className={styles.searchControls}>
                <button onClick={() => setFolderSortByCount(!folderSortByCount)} title={folderSortByCount ? "Sort alphabetically" : "Sort by count"} className={styles.sortButton}>{folderSortByCount ? '🔢' : '🔤'}</button>
              </div>
            </div>

            <div className={styles.leftPanelList}>
              {folderMode === 'format' ? (
                <>
                  <button onClick={() => setSelectedFolderValue(null)} title="Show all albums" className={!selectedFolderValue ? styles.allAlbumsButtonActive : styles.allAlbumsButton}>
                    <span>[All Albums]</span>
                    <span className={!selectedFolderValue ? styles.folderCountActive : styles.folderCount}>{albums.length}</span>
                  </button>

                  {sortedFolderItems.map(([format, count]) => (
                    <button key={format} onClick={() => setSelectedFolderValue(format)} title={`Filter by ${format}`} className={selectedFolderValue === format ? styles.allAlbumsButtonActive : styles.allAlbumsButton}>
                      <span>{format}</span>
                      <span className={selectedFolderValue === format ? styles.folderCountActive : styles.folderCount}>{count}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button onClick={() => setSelectedCrateId(null)} title="Show all albums" className={selectedCrateId === null ? styles.allAlbumsButtonActive : styles.allAlbumsButton}>
                    <span>📚 [All Albums]</span>
                    <span className={selectedCrateId === null ? styles.folderCountActive : styles.folderCount}>{albums.length}</span>
                  </button>

                  {cratesWithCounts
                    .filter(crate => !folderSearch || crate.name.toLowerCase().includes(folderSearch.toLowerCase()))
                    .map(crate => (
                    <button key={crate.id} onClick={() => setSelectedCrateId(crate.id)} title={`Filter by ${crate.name}`} className={selectedCrateId === crate.id ? styles.allAlbumsButtonActive : styles.allAlbumsButton}>
                      <span className={styles.crateIcon}>
                        {crate.is_smart ? (
                          <BoxIcon color={crate.icon} size={16} />
                        ) : (
                          <span>{crate.icon}</span>
                        )}
                        <span>{crate.name}</span>
                      </span>
                      <span className={selectedCrateId === crate.id ? styles.folderCountActive : styles.folderCount}>{crate.album_count || 0}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className={styles.centerPanel}>
            <div className={styles.centerToolbar}>
              <div className={styles.centerToolbarLeft}>
                <button title="Change view mode" className={styles.iconButton}>
                  <span>☰</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
                
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowSortDropdown(!showSortDropdown)} title="Change sort order" className={styles.iconButton}>
                    <span>↕️</span>
                    <span style={{ fontSize: '9px' }}>▼</span>
                  </button>
                  
                  {showSortDropdown && (
                    <>
                      <div onClick={() => setShowSortDropdown(false)} className={styles.dropdownOverlay} />
                      <div className={styles.sortDropdown}>
                        {Object.entries(sortOptionsByCategory).map(([category, options]) => (
                          <div key={category}>
                            <div className={styles.sortCategory}>{category}</div>
                            {options.map(opt => (
                              <button key={opt.value} onClick={() => handleSortChange(opt.value)} className={sortBy === opt.value ? styles.sortItemActive : styles.sortItem} onMouseEnter={(e) => { if (sortBy !== opt.value) { e.currentTarget.style.background = '#f5f5f5'; }}} onMouseLeave={(e) => { if (sortBy !== opt.value) { e.currentTarget.style.background = 'transparent'; }}}>
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
                
                <button onClick={() => setShowColumnSelector(true)} title="Select visible columns" className={styles.iconButton}>
                  <span>⊞</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
              </div>
              <div className={styles.albumCount}>{loading ? 'Loading...' : `${filteredAndSortedAlbums.length} albums`}</div>
            </div>

            <div className={styles.centerContent}>
              {loading ? (
                <div className={styles.loading}>Loading albums...</div>
              ) : (
                <CollectionTable albums={filteredAndSortedAlbums} visibleColumns={visibleColumns} lockedColumns={lockedColumns} onAlbumClick={handleAlbumClick} selectedAlbums={selectedAlbumsAsStrings} onSelectionChange={handleSelectionChange} sortState={tableSortState} onSortChange={handleTableSortChange} onEditAlbum={handleEditAlbum} />
              )}
            </div>
          </div>

          <div className={styles.rightPanel}>
            <div className={styles.rightToolbar}>
              <div className={styles.rightToolbarLeft}>
                <button onClick={() => selectedAlbumId && handleEditAlbum(selectedAlbumId)} title="Edit album details" className={styles.rightButton}>✏️</button>
                <button title="Share album" className={styles.rightButton}>↗️</button>
                <button title="Search on eBay" className={styles.rightButtonText}>eBay</button>
                <button title="More actions" className={styles.rightButton}>⋮</button>
              </div>
              
              <button title="Select visible fields" className={styles.iconButton}>
                <span>⊞</span>
                <span style={{ fontSize: '9px' }}>▼</span>
              </button>
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
      {showImportModal && <ImportSelectionModal onSelectImportType={(type) => { 
        setShowImportModal(false); 
        if (type === 'discogs') {
          setShowImportDiscogsModal(true);
        } else if (type === 'csv') { 
          setShowImportCSVModal(true);
        } else if (type === 'clz') { 
          setShowImportCLZModal(true);
        } else if (type === 'enrich') { 
          setShowImportEnrichModal(true);
        }
      }} onCancel={() => setShowImportModal(false)} />}
      {showImportDiscogsModal && <ImportDiscogsModal 
        isOpen={showImportDiscogsModal} 
        onClose={() => setShowImportDiscogsModal(false)} 
        onImportComplete={loadAlbums} 
      />}
      {showImportCLZModal && <ImportCLZModal 
        isOpen={showImportCLZModal} 
        onClose={() => setShowImportCLZModal(false)} 
        onImportComplete={loadAlbums} 
      />}
      {showImportCSVModal && <ImportCSVModal 
        isOpen={showImportCSVModal} 
        onClose={() => setShowImportCSVModal(false)} 
        onImportComplete={loadAlbums} 
      />}
      {showImportEnrichModal && <ImportEnrichModal 
        isOpen={showImportEnrichModal} 
        onClose={() => setShowImportEnrichModal(false)} 
        onImportComplete={loadAlbums} 
      />}
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
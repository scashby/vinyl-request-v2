// src/app/edit-collection/page.tsx
'use client';

// ... (Previous imports remain unchanged)
import { useCallback, useEffect, useState, useMemo, Suspense, memo } from 'react';
import Image from 'next/image';
import { supabase } from '../../lib/supabaseClient';
import CollectionTable from '../../components/CollectionTable';
import ColumnSelector from '../../components/ColumnSelector';
import { ColumnId, DEFAULT_VISIBLE_COLUMNS, DEFAULT_LOCKED_COLUMNS, SortState } from './columnDefinitions';
import { Album, toSafeStringArray, toSafeSearchString } from '../../types/album';
import EditAlbumModal from './EditAlbumModal';
import NewCrateModal from './crates/NewCrateModal';
import NewSmartCrateModal from './crates/NewSmartCrateModal';
import { AddToCrateModal } from './crates/AddToCrateModal';
import Header from './Header';
import type { Crate } from '../../types/crate';
import { albumMatchesSmartCrate } from '../../lib/crateUtils';
import { BoxIcon } from '../../components/BoxIcon';

// ... (Sort Options remain unchanged)
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
    return <div className="py-20 text-center text-gray-400 text-sm italic">Select an album to view details</div>;
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
    <div className="p-4 flex-1 overflow-y-auto bg-gradient-to-br from-[#f5f7fa] to-[#c3cfe2]">
      <div className="text-sm text-gray-800 mb-1 font-normal">{album.artist}</div>
      <div className="flex items-center gap-2 mb-4">
        <h4 className="text-[#2196F3] m-0 text-lg font-semibold">{album.title}</h4>
        <div className="bg-[#2196F3] text-white rounded px-1.5 py-0.5 text-xs flex items-center justify-center font-bold" title="Album owned">✓</div>
      </div>

      <div className="relative mb-4 group">
        {(imageIndex === 0 ? album.image_url : album.back_image_url) ? (
          <Image 
            src={(imageIndex === 0 ? album.image_url : album.back_image_url) || ''} 
            alt={`${album.artist} - ${album.title} ${imageIndex === 0 ? 'front' : 'back'}`}
            width={400}
            height={400}
            className="w-full h-auto aspect-square object-cover border border-gray-300 rounded shadow-sm"
            unoptimized
          />
        ) : (
          <div className="w-full aspect-square bg-white flex items-center justify-center text-gray-300 text-5xl border border-gray-200 rounded">🎵</div>
        )}
        
        {album.back_image_url && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            <div className={`w-2 h-2 rounded-full cursor-pointer ${imageIndex === 0 ? 'bg-[#333]' : 'bg-[#999]'}`} onClick={() => setImageIndex(0)} />
            <div className={`w-2 h-2 rounded-full cursor-pointer ${imageIndex === 1 ? 'bg-[#333]' : 'bg-[#999]'}`} onClick={() => setImageIndex(1)} />
          </div>
        )}
      </div>

      <div className="text-sm font-normal text-[#333] mb-2">
        {(album.labels && album.labels.length > 0 ? album.labels.join(', ') : (album.spotify_label || album.apple_music_label)) || 'Unknown Label'} 
        {album.year && ` (${album.year})`}
      </div>

      {/* FIXED: Check canonical genres/styles */}
      {(album.genres || album.styles || album.spotify_genres) && (
        <div className="text-[13px] text-[#666] mb-3 font-normal">
          {toSafeStringArray(album.genres || album.styles || album.spotify_genres).join(' | ')}
        </div>
      )}

      <div className="text-xs text-[#333] mb-2 font-mono font-normal">||||| {album.barcode || '—'}</div>
      <div className="text-[13px] text-[#333] mb-2 font-normal">{album.country || '—'}</div>
      <div className="text-[13px] text-[#333] mb-3 font-normal">
        {album.format || '—'}
        {' | '}{album.discs ? `${album.discs} Disc${album.discs > 1 ? 's' : ''}` : '—'}
        {' | '}{totalTracks > 0 ? `${totalTracks} Tracks` : '—'}
        {' | '}{totalRuntime}
      </div>

      <div className="text-[13px] text-[#666] mb-3 font-normal">
        <span className="font-semibold">CAT NO</span> {album.cat_no || '—'}
      </div>

      <a href={getEbayUrl()} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#2196F3] mb-4 block no-underline font-normal hover:underline">
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
          <div className="mb-4">
            {sortedDiscs.map(([discNumber, tracks]) => {
              const discMeta = album.disc_metadata?.find(d => d.disc_number === discNumber);
              const discTitle = discMeta?.title || `Disc #${discNumber}`;
              const runtime = getDiscRuntime(discNumber);

              return (
                <div key={discNumber} className="mb-4">
                  <div className="text-xs font-bold text-white mb-1.5 p-2 px-3 bg-[#2196F3] rounded flex justify-between items-center shadow-sm uppercase tracking-wider">
                    <span>{discTitle}</span>
                    {runtime && <span className="font-mono">{runtime}</span>}
                  </div>
                  <div className="flex flex-col gap-px">
                    {tracks.map((track, idx) => {
                      if (track.type === 'header') {
                        return (
                          <div key={idx} className={`text-[11px] font-semibold text-gray-500 px-2 py-1.5 bg-gray-100 ${idx > 0 ? 'mt-1' : ''}`}>
                            {track.title}
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className={`flex items-center px-2 py-1.5 text-[13px] font-normal ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <div className="min-w-[28px] text-gray-500 text-[13px]">{track.position}</div>
                          <div className="flex-1 text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap pr-2">{track.title}</div>
                          {track.duration && <div className="text-gray-500 text-[13px] min-w-[40px] text-right">{track.duration}</div>}
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

      <div className="mb-4">
        <div className="text-base font-bold text-[#2196F3] mb-3">Details</div>
        <div className="bg-white p-3 rounded">
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Release Date</span>
            <span>{album.year || '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Original Release Date</span>
            <span>{album.original_release_date ? formatDate(album.original_release_date) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Package/Sleeve Condition</span>
            <span>{album.package_sleeve_condition || '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Media Condition</span>
            <span>{album.media_condition || '—'}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-base font-bold text-[#2196F3] mb-3">Personal</div>
        <div className="bg-white p-3 rounded">
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Quantity</span>
            <span>1</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Index</span>
            <span>{album.index_number || '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Purchase Date</span>
            <span>{album.purchase_date ? formatDate(album.purchase_date) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Purchase Store</span>
            <span>{album.purchase_store || '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Purchase Price</span>
            <span>{album.purchase_price ? `$${album.purchase_price.toFixed(2)}` : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Current Value</span>
            <span>{album.current_value ? `$${album.current_value.toFixed(2)}` : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Owner</span>
            <span>{album.owner || '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">My Rating</span>
            <div className="flex-1">
              {album.my_rating ? (
                <div className="flex gap-0.5 items-center">
                  {Array.from({ length: album.my_rating }).map((_, i) => (
                    <span key={i} className="text-yellow-400 text-sm">★</span>
                  ))}
                  {Array.from({ length: 10 - album.my_rating }).map((_, i) => (
                    <span key={i} className="text-gray-300 text-sm">★</span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Last Cleaned</span>
            <span>{album.last_cleaned_date ? formatDate(album.last_cleaned_date) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Signed By</span>
            <span>
              {album.signed_by && Array.isArray(album.signed_by) && album.signed_by.length > 0 
                ? album.signed_by.join(', ') 
                : '—'}
            </span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Added Date</span>
            <span>{album.date_added ? formatDateTime(album.date_added) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Modified Date</span>
            <span>{album.modified_date ? formatDateTime(album.modified_date) : '—'}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-base font-bold text-[#2196F3] mb-3">Notes</div>
        <div className="text-[13px] text-gray-800 leading-relaxed bg-white p-3 rounded font-normal min-h-[40px]">{album.notes || '—'}</div>
      </div>

      <div>
        <div className="text-base font-bold text-[#2196F3] mb-3">Tags</div>
        {album.custom_tags && album.custom_tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {toSafeStringArray(album.custom_tags).map(tag => (
              <span key={tag} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-full text-[13px] font-normal">{tag}</span>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-gray-400 font-normal">No tags</div>
        )}
      </div>
    </div>
  );
});

function CollectionBrowserPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [showFolderModeDropdown, setShowFolderModeDropdown] = useState(false);
  const [showNewCrateModal, setShowNewCrateModal] = useState(false);
  const [showNewSmartCrateModal, setShowNewSmartCrateModal] = useState(false);
  const [showAddToCrateModal, setShowAddToCrateModal] = useState(false);
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
          // FIXED: Search canonical genres instead of discogs_genres
          toSafeSearchString(album.genres),
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

      <div className="fixed inset-0 flex flex-col overflow-hidden z-[9999] font-sans">
        <Header 
          albums={albums} 
          loadAlbums={loadAlbums} 
          loadCrates={loadCrates}
          filteredAndSortedAlbums={filteredAndSortedAlbums}
          selectedAlbumIds={selectedAlbumIds}
        />

        <div className="bg-[#3A3A3A] text-white px-4 py-2 flex items-center justify-between gap-5 h-[48px] shrink-0">
          <div className="flex gap-2 items-center shrink-0">
            <button title="Add new albums to collection" className="bg-[#368CF8] hover:bg-[#2c72c9] text-white border-none px-3 py-1.5 rounded cursor-pointer text-[13px] font-medium flex items-center gap-1 whitespace-nowrap transition-colors">
              <span className="text-[16px]">+</span>
              <span>Add Albums</span>
            </button>

            <div className="relative">
              <button onClick={() => setShowCollectionDropdown(!showCollectionDropdown)} title="Filter by collection status" className="bg-[#2a2a2a] text-white border border-[#555] px-3 py-1.5 rounded cursor-pointer text-[13px] flex items-center gap-1.5 hover:bg-[#333] transition-colors">
                <span>📚</span>
                <span>{collectionFilter}</span>
                <span className="text-[10px]">▼</span>
              </button>
            </div>
          </div>

          <div className="flex gap-0.5 items-center flex-1 justify-center">
            <button onClick={() => setSelectedLetter('All')} title="Show all albums" className={`bg-transparent text-white border-none px-2 py-1 cursor-pointer text-xs rounded-sm transition-colors ${selectedLetter === 'All' ? 'bg-[#5A9BD5]' : 'hover:bg-white/10'}`}>All</button>
            <button onClick={() => setSelectedLetter('0-9')} title="Filter by numbers" className={`bg-transparent text-white border-none px-2 py-1 cursor-pointer text-xs rounded-sm transition-colors ${selectedLetter === '0-9' ? 'bg-[#5A9BD5]' : 'hover:bg-white/10'}`}>0-9</button>
            {alphabet.map(letter => (
              <button key={letter} onClick={() => setSelectedLetter(letter)} title={`Filter by letter ${letter}`} className={`bg-transparent text-white border-none px-2 py-1 cursor-pointer text-xs rounded-sm transition-colors ${selectedLetter === letter ? 'bg-[#5A9BD5]' : 'hover:bg-white/10'}`}>{letter}</button>
            ))}
          </div>

          <div className="flex items-center shrink-0">
            <div className="relative">
              <button onClick={() => setShowSearchTypeDropdown(!showSearchTypeDropdown)} title="Search type" className="bg-[#2a2a2a] text-white border border-[#555] border-r-0 px-2.5 py-1.5 cursor-pointer text-[13px] rounded-l flex items-center gap-1 h-8 hover:bg-[#333] transition-colors">
                <span>🔍</span>
                <span className="text-[10px]">▼</span>
              </button>
            </div>
            <input type="text" placeholder="Search albums..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} title="Search your collection" className="bg-[#2a2a2a] text-white border border-[#555] border-l-0 px-3 py-1.5 rounded-r text-[13px] w-[220px] h-8 outline-none" />
          </div>
        </div>

        {selectedAlbumIds.size > 0 && (
          <div className="bg-[#5BA3D0] text-white px-4 py-2 flex items-center gap-2 h-10 shrink-0">
            <button onClick={() => setSelectedAlbumIds(new Set())} title="Clear selection" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">✕ Cancel</button>
            <button title="Select all albums" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">☑ All</button>
            <button title="Edit selected albums" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">✏️ Edit</button>
            <button title="Remove selected albums" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">🗑 Remove</button>
            <button onClick={() => setShowAddToCrateModal(true)} title="Add selected albums to a crate" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">📦 Add to Crate</button>
            <button title="Export selected to PDF" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">🖨 Print to PDF</button>
            <button title="More actions" className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">⋮</button>
            <div className="flex-1" />
            <span className="text-xs font-medium">{selectedAlbumIds.size} of {filteredAndSortedAlbums.length} selected</span>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-[220px] bg-[#2C2C2C] text-white flex flex-col overflow-hidden border-r border-[#1a1a1a] shrink-0">
            <div className="p-2.5 border-b border-[#1a1a1a] flex justify-between items-center shrink-0">
              <div className="relative">
                <button onClick={() => setShowFolderModeDropdown(!showFolderModeDropdown)} title="Change view mode" className="bg-[#3a3a3a] text-white border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-xs flex items-center gap-1.5">
                  <span>{folderMode === 'crates' ? '📦' : '📁'}</span>
                  <span>{folderMode === 'crates' ? 'Crates' : 'Format'}</span>
                  <span className="text-[10px]">▼</span>
                </button>

                {showFolderModeDropdown && (
                  <>
                    <div onClick={() => setShowFolderModeDropdown(false)} className="fixed inset-0 z-[99]" />
                    <div className="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-[#555] rounded z-[100] min-w-[180px] shadow-lg">
                      <div className="px-3 py-2 text-[10px] font-semibold text-[#999] uppercase tracking-wider">Favorites</div>
                      <button onClick={() => handleFolderModeChange('format')} className={`w-full px-4 py-2 bg-transparent border-none text-left cursor-pointer text-[13px] text-white flex items-center gap-2 hover:bg-[#3a3a3a] ${folderMode === 'format' ? 'bg-[#5A9BD5]' : ''}`}>
                        <span>📁</span>
                        <span>Format</span>
                      </button>

                      <div className="px-3 py-2 text-[10px] font-semibold text-[#999] uppercase tracking-wider mt-1 border-t border-[#444]">Crates</div>
                      <button onClick={() => handleFolderModeChange('crates')} className={`w-full px-4 py-2 bg-transparent border-none text-left cursor-pointer text-[13px] text-white flex items-center gap-2 hover:bg-[#3a3a3a] ${folderMode === 'crates' ? 'bg-[#5A9BD5]' : ''}`}>
                        <span>📦</span>
                        <span>Crates</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button title="View options" className="bg-transparent text-white border-none cursor-pointer text-base p-1">☰</button>
            </div>

            <div className="p-2.5 border-b border-[#1a1a1a] shrink-0">
              <input type="text" placeholder={folderMode === 'crates' ? 'Search crates...' : 'Search format...'} value={folderSearch} onChange={(e) => setFolderSearch(e.target.value)} title={folderMode === 'crates' ? 'Filter crates' : 'Filter formats'} className="w-full px-2 py-1.5 bg-[#3a3a3a] text-white border border-[#555] rounded text-xs outline-none" />
              <div className="mt-2 flex gap-1.5">
                <button onClick={() => setFolderSortByCount(!folderSortByCount)} title={folderSortByCount ? "Sort alphabetically" : "Sort by count"} className="bg-[#3a3a3a] text-white border border-[#555] px-2 py-1 rounded cursor-pointer text-xs">{folderSortByCount ? '🔢' : '🔤'}</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 min-h-0">
              {folderMode === 'format' ? (
                <>
                  <button onClick={() => setSelectedFolderValue(null)} title="Show all albums" className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${!selectedFolderValue ? 'bg-[#5A9BD5]' : ''}`}>
                    <span>[All Albums]</span>
                    <span className={`text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold ${!selectedFolderValue ? 'bg-[#3578b3]' : 'bg-[#555]'}`}>{albums.length}</span>
                  </button>

                  {sortedFolderItems.map(([format, count]) => (
                    <button key={format} onClick={() => setSelectedFolderValue(format)} title={`Filter by ${format}`} className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedFolderValue === format ? 'bg-[#5A9BD5]' : ''}`}>
                      <span>{format}</span>
                      <span className={`text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold ${selectedFolderValue === format ? 'bg-[#3578b3]' : 'bg-[#555]'}`}>{count}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button onClick={() => setSelectedCrateId(null)} title="Show all albums" className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedCrateId === null ? 'bg-[#5A9BD5]' : ''}`}>
                    <span>📚 [All Albums]</span>
                    <span className={`text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold ${selectedCrateId === null ? 'bg-[#3578b3]' : 'bg-[#555]'}`}>{albums.length}</span>
                  </button>

                  {cratesWithCounts
                    .filter(crate => !folderSearch || crate.name.toLowerCase().includes(folderSearch.toLowerCase()))
                    .map(crate => (
                    <button key={crate.id} onClick={() => setSelectedCrateId(crate.id)} title={`Filter by ${crate.name}`} className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedCrateId === crate.id ? 'bg-[#5A9BD5]' : ''}`}>
                      <span className="flex items-center gap-1.5">
                        {crate.is_smart ? (
                          <BoxIcon color={crate.icon} size={16} />
                        ) : (
                          <span>{crate.icon}</span>
                        )}
                        <span>{crate.name}</span>
                      </span>
                      <span className={`text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold ${selectedCrateId === crate.id ? 'bg-[#3578b3]' : 'bg-[#555]'}`}>{crate.album_count || 0}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">
            <div className="px-3 py-1.5 border-b border-[#555] flex items-center justify-between bg-[#4a4a4a] h-10 shrink-0">
              <div className="flex gap-1.5 items-center">
                <button title="Change view mode" className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white flex items-center gap-1">
                  <span>☰</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
                
                <div className="relative">
                  <button onClick={() => setShowSortDropdown(!showSortDropdown)} title="Change sort order" className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white flex items-center gap-1">
                    <span>↕️</span>
                    <span className="text-[9px]">▼</span>
                  </button>
                  
                  {showSortDropdown && (
                    <>
                      <div onClick={() => setShowSortDropdown(false)} className="fixed inset-0 z-[99]" />
                      <div className="absolute top-full left-0 mt-1 bg-white border border-[#ddd] rounded shadow-lg z-[100] min-w-[240px] max-h-[400px] overflow-y-auto">
                        {Object.entries(sortOptionsByCategory).map(([category, options]) => (
                          <div key={category}>
                            <div className="px-3 py-2 text-[11px] font-semibold text-[#999] uppercase tracking-wider bg-[#f8f8f8] border-b border-[#e8e8e8]">{category}</div>
                            {options.map(opt => (
                              <button key={opt.value} onClick={() => handleSortChange(opt.value)} className={`w-full px-4 py-2.5 bg-transparent border-none text-left cursor-pointer text-[13px] text-[#333] flex items-center justify-between hover:bg-[#f5f5f5] ${sortBy === opt.value ? 'bg-[#e3f2fd]' : ''}`}>
                                <span>{opt.label}</span>
                                {sortBy === opt.value && <span className="text-[#2196F3]">✓</span>}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                
                <button onClick={() => setShowColumnSelector(true)} title="Select visible columns" className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white flex items-center gap-1">
                  <span>⊞</span>
                  <span className="text-[9px]">▼</span>
                </button>
              </div>
              <div className="text-xs text-[#ddd] font-semibold">{loading ? 'Loading...' : `${filteredAndSortedAlbums.length} albums`}</div>
            </div>

            <div className="flex-1 overflow-hidden bg-white min-h-0">
              {loading ? (
                <div className="p-10 text-center text-[#666]">Loading albums...</div>
              ) : (
                <CollectionTable albums={filteredAndSortedAlbums} visibleColumns={visibleColumns} lockedColumns={lockedColumns} onAlbumClick={handleAlbumClick} selectedAlbums={selectedAlbumsAsStrings} onSelectionChange={handleSelectionChange} sortState={tableSortState} onSortChange={handleTableSortChange} onEditAlbum={handleEditAlbum} />
              )}
            </div>
          </div>

          <div className="hidden lg:flex w-[380px] bg-white border-l border-[#ddd] overflow-auto flex-col shrink-0">
            <div className="px-3 py-1.5 border-b border-[#555] flex items-center justify-between bg-[#4a4a4a] h-10 shrink-0">
              <div className="flex gap-1.5 items-center">
                <button onClick={() => selectedAlbumId && handleEditAlbum(selectedAlbumId)} title="Edit album details" className="bg-[#3a3a3a] border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-sm text-white">✏️</button>
                <button title="Share album" className="bg-[#3a3a3a] border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-sm text-white">↗️</button>
                <button title="Search on eBay" className="bg-[#3a3a3a] border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-xs text-white font-semibold">eBay</button>
                <button title="More actions" className="bg-[#3a3a3a] border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-sm text-white">⋮</button>
              </div>
              
              <button title="Select visible fields" className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white flex items-center gap-1">
                <span>⊞</span>
                <span className="text-[9px]">▼</span>
              </button>
            </div>

            <AlbumInfoPanel album={selectedAlbum} />
          </div>
        </div>
      </div>

      {showColumnSelector && <ColumnSelector visibleColumns={visibleColumns} onColumnsChange={handleColumnsChange} onClose={() => setShowColumnSelector(false)} />}
      {editingAlbumId && <EditAlbumModal albumId={editingAlbumId} onClose={() => setEditingAlbumId(null)} onRefresh={loadAlbums} onNavigate={(newAlbumId) => setEditingAlbumId(newAlbumId)} allAlbumIds={filteredAndSortedAlbums.map(a => a.id)} />}
      {showNewCrateModal && <NewCrateModal isOpen={showNewCrateModal} onClose={() => { setShowNewCrateModal(false); setEditingCrate(null); if (returnToAddToCrate) { setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }}} onCrateCreated={async (newCrateId) => { await loadCrates(); setEditingCrate(null); if (returnToAddToCrate) { setNewlyCreatedCrateId(newCrateId); setShowNewCrateModal(false); setShowAddToCrateModal(true); } else { setShowNewCrateModal(false); }}} editingCrate={editingCrate} />}
      {showNewSmartCrateModal && <NewSmartCrateModal isOpen={showNewSmartCrateModal} onClose={() => { setShowNewSmartCrateModal(false); setEditingCrate(null); }} onCrateCreated={() => { loadCrates(); setShowNewSmartCrateModal(false); setEditingCrate(null); }} editingCrate={editingCrate} />}
      {showAddToCrateModal && <AddToCrateModal isOpen={showAddToCrateModal} onClose={() => { setShowAddToCrateModal(false); setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }} crates={cratesWithCounts} onAddToCrates={handleAddToCrates} selectedCount={selectedAlbumIds.size} onOpenNewCrate={() => { setReturnToAddToCrate(true); setShowAddToCrateModal(false); setEditingCrate(null); setShowNewCrateModal(true); }} autoSelectCrateId={newlyCreatedCrateId} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen text-base text-gray-500">
        Loading...
      </div>
    }>
      <CollectionBrowserPage />
    </Suspense>
  );
}
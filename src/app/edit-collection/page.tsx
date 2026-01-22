// src/app/edit-collection/page.tsx
'use client';

import { useCallback, useEffect, useState, useMemo, Suspense } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CollectionTable from '../../components/CollectionTable';
import ColumnSelector from '../../components/ColumnSelector';
import { ColumnId, DEFAULT_VISIBLE_COLUMNS, DEFAULT_LOCKED_COLUMNS, SortState } from './columnDefinitions';
import { Album, toSafeStringArray, toSafeSearchString } from '../../types/album';
import EditAlbumModal from './EditAlbumModal';
import Header from './Header';
import type { Crate } from '../../types/crate';
import { albumMatchesSmartCrate } from '../../lib/crateUtils';
import AlbumDetailPanel from '../../components/AlbumDetailPanel';
import { BoxIcon } from '../../components/BoxIcon';

// Crate Management Components (Restored)
import NewCrateModal from './crates/NewCrateModal';
import NewSmartCrateModal from './crates/NewSmartCrateModal';
import { AddToCrateModal } from './crates/AddToCrateModal';
import { ManageCratesModal } from './crates/ManageCratesModal';

type SortOption = 
  | 'artist-asc' | 'artist-desc' 
  | 'title-asc' | 'title-desc' 
  | 'year-desc' | 'year-asc' 
  | 'added-desc' | 'added-asc' 
  | 'format-asc' | 'format-desc' 
  | 'tags-count-desc' | 'tags-count-asc' 
  | 'sale-price-desc' | 'sale-price-asc' 
  | 'condition-asc' | 'condition-desc'
  | 'location-asc' | 'location-desc'
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
  { value: 'location-asc', label: 'Location (A→Z)', category: 'Physical' },
  { value: 'location-desc', label: 'Location (Z→A)', category: 'Physical' },
  { value: 'condition-asc', label: 'Condition (A→Z)', category: 'Physical' },
  { value: 'condition-desc', label: 'Condition (Z→A)', category: 'Physical' },
  { value: 'sides-desc', label: 'Most Sides First', category: 'Physical' },
  { value: 'sides-asc', label: 'Fewest Sides First', category: 'Physical' },
  { value: 'tags-count-desc', label: 'Most Tags', category: 'Metadata' },
  { value: 'tags-count-asc', label: 'Fewest Tags', category: 'Metadata' },
  { value: 'popularity-desc', label: 'Most Popular (Spotify)', category: 'Metadata' },
  { value: 'popularity-asc', label: 'Least Popular (Spotify)', category: 'Metadata' },
  { value: 'sale-price-desc', label: 'Highest Price', category: 'Sales' },
  { value: 'sale-price-asc', label: 'Lowest Price', category: 'Sales' }
];

function CollectionBrowserPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchTypeDropdown, setShowSearchTypeDropdown] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<string>('All');
  
  // View State
  const [viewMode, setViewMode] = useState<string>('format');
  const [selectedGroupValue, setSelectedGroupValue] = useState<string | null>(null);
  const [selectedCrateId, setSelectedCrateId] = useState<number | null>(null);
  const [crates, setCrates] = useState<Crate[]>([]);
  
  // Filters
  const [collectionFilter, setCollectionFilter] = useState<string>('All');
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  
  // Selection
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<number>>(new Set());
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null);
  
  // Modals & UI State
  const [showViewModeDropdown, setShowViewModeDropdown] = useState(false);
  const [showNewCrateModal, setShowNewCrateModal] = useState(false);
  const [showNewSmartCrateModal, setShowNewSmartCrateModal] = useState(false);
  const [showAddToCrateModal, setShowAddToCrateModal] = useState(false);
  const [showManageCratesModal, setShowManageCratesModal] = useState(false);
  const [editingCrate, setEditingCrate] = useState<Crate | null>(null);
  const [returnToAddToCrate, setReturnToAddToCrate] = useState(false);
  const [newlyCreatedCrateId, setNewlyCreatedCrateId] = useState<number | null>(null);
  
  // Sorting
  const [sortBy, setSortBy] = useState<SortOption>('artist-asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [tableSortState, setTableSortState] = useState<SortState>({
    column: null,
    direction: null
  });

  // Columns
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [lockedColumns, setLockedColumns] = useState<ColumnId[]>(DEFAULT_LOCKED_COLUMNS);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Local Storage Effects
  useEffect(() => {
    const stored = localStorage.getItem('collection-visible-columns');
    if (stored) {
      try { setVisibleColumns(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('collection-locked-columns');
    if (stored) {
      try { setLockedColumns(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('collection-sort-preference');
    if (stored && SORT_OPTIONS.some(opt => opt.value === stored)) {
      setSortBy(stored as SortOption);
    }
  }, []);

  // Handlers
  const handleColumnsChange = useCallback((columns: ColumnId[]) => {
    setVisibleColumns(columns);
    localStorage.setItem('collection-visible-columns', JSON.stringify(columns));
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
        if (prev.direction === 'desc') return { column: null, direction: null };
      }
      return { column, direction: 'asc' };
    });
  }, []);

  // Data Loading
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
    if (data) setCrates(data as Crate[]);
  }, []);

  useEffect(() => {
    loadAlbums();
    loadCrates();
  }, [loadAlbums, loadCrates]);

  // Filtering Logic
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

      if (viewMode === 'crates' && selectedCrateId !== null) {
        const selectedCrate = crates.find(c => c.id === selectedCrateId);
        if (selectedCrate) {
          if (selectedCrate.is_smart) {
            if (!albumMatchesSmartCrate(album, selectedCrate)) return false;
          } else {
            // Manual crate logic to be implemented with relation check
            // For now, partial sync
          }
        }
      }

      if (viewMode === 'format' && selectedGroupValue) {
        if (album.format !== selectedGroupValue) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          album.artist,
          album.title,
          album.format,
          album.year,
          album.location,
          toSafeSearchString(album.custom_tags),
          toSafeSearchString(album.genres)
        ].join(' ').toLowerCase();
        
        if (!searchable.includes(q)) return false;
      }

      return true;
    });

    // Sorting Logic
    if (tableSortState.column && tableSortState.direction) {
      const { column, direction } = tableSortState;
      const multiplier = direction === 'asc' ? 1 : -1;
      
      filtered = [...filtered].sort((a, b) => {
        if (column === 'artist') return multiplier * (a.artist || '').localeCompare(b.artist || '');
        if (column === 'title') return multiplier * (a.title || '').localeCompare(b.title || '');
        // Add more column specific sorts here if needed
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
          case 'added-desc': return (b.date_added || '').localeCompare(a.date_added || '');
          case 'added-asc': return (a.date_added || '').localeCompare(b.date_added || '');
          case 'format-asc': return (a.format || '').localeCompare(b.format || '');
          case 'format-desc': return (b.format || '').localeCompare(a.format || '');
          case 'location-asc': return (a.location || '').localeCompare(b.location || '');
          case 'location-desc': return (b.location || '').localeCompare(a.location || '');
          default: return 0;
        }
      });
    }

    return filtered;
  }, [albums, collectionFilter, selectedLetter, selectedGroupValue, selectedCrateId, viewMode, crates, searchQuery, sortBy, tableSortState]);

  useEffect(() => {
    if (filteredAndSortedAlbums.length > 0 && !selectedAlbumId) {
      setSelectedAlbumId(filteredAndSortedAlbums[0].id);
    }
  }, [filteredAndSortedAlbums, selectedAlbumId]);

  // Derived State
  const groupCounts = useMemo(() => {
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
      }
      return { ...crate, album_count: count };
    });
  }, [crates, albums]);

  const sortedGroupItems = useMemo(() => {
    return Object.entries(groupCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([item]) => !groupSearch || item.toLowerCase().includes(groupSearch.toLowerCase()));
  }, [groupCounts, groupSearch]);

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

  // UI Handlers
  const handleAlbumClick = useCallback((album: Album) => setSelectedAlbumId(album.id), []);
  const handleSelectionChange = useCallback((albumIds: Set<string>) => setSelectedAlbumIds(new Set(Array.from(albumIds).map(id => Number(id)))), []);
  const handleEditAlbum = useCallback((albumId: number) => setEditingAlbumId(albumId), []);
  const selectedAlbumsAsStrings = useMemo(() => new Set(Array.from(selectedAlbumIds).map(id => String(id))), [selectedAlbumIds]);

  const handleViewModeChange = useCallback((mode: string) => {
    setViewMode(mode);
    setShowViewModeDropdown(false);
    setSelectedGroupValue(null);
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
    } catch (err) {
      console.error('Failed to add albums to crates:', err);
      alert('Failed to add albums to crates');
    }
  }, [selectedAlbumIds, loadCrates]);

  // Modal Handlers
  const openNewCrate = () => { setShowNewCrateModal(true); setEditingCrate(null); };
  const openNewSmartCrate = () => { setShowNewSmartCrateModal(true); setEditingCrate(null); };
  const openEditCrate = (crate: Crate) => { setEditingCrate(crate); setShowNewCrateModal(true); };
  const openEditSmartCrate = (crate: Crate) => { setEditingCrate(crate); setShowNewSmartCrateModal(true); };

  return (
    <>
      {/* Disable default layout headers/footers */}
      <style>{`
        body > div:first-child > nav, body > div:first-child > header:not(.clz-header), body > nav, body > header:not(.clz-header),
        [class*="navigation"], [class*="Navigation"], [class*="navbar"], [class*="NavBar"],
        body > [class*="sidebar"]:not(.clz-sidebar), body > [class*="Sidebar"]:not(.clz-sidebar) { display: none !important; }
        body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      `}</style>

      <div className="fixed inset-0 flex flex-col overflow-hidden z-[9999] font-sans">
        <Header 
          albums={albums} 
          loadAlbums={loadAlbums} 
          loadCrates={loadCrates}
          filteredAndSortedAlbums={filteredAndSortedAlbums}
          selectedAlbumIds={selectedAlbumIds}
        />

        {/* Action Bar */}
        <div className="bg-[#3A3A3A] text-white px-4 py-2 flex items-center justify-between gap-5 h-[48px] shrink-0">
          <div className="flex gap-2 items-center shrink-0">
            <button title="Add new albums" className="bg-[#368CF8] hover:bg-[#2c72c9] text-white border-none px-3 py-1.5 rounded cursor-pointer text-[13px] font-medium flex items-center gap-1 whitespace-nowrap transition-colors">
              <span className="text-[16px]">+</span>
              <span>Add Albums</span>
            </button>
            <div className="relative">
              <button onClick={() => setShowCollectionDropdown(!showCollectionDropdown)} className="bg-[#2a2a2a] text-white border border-[#555] px-3 py-1.5 rounded cursor-pointer text-[13px] flex items-center gap-1.5 hover:bg-[#333]">
                <span>📚</span><span>{collectionFilter}</span><span className="text-[10px]">▼</span>
              </button>
              {showCollectionDropdown && (
                <>
                  <div onClick={() => setShowCollectionDropdown(false)} className="fixed inset-0 z-[99]" />
                  <div className="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-[#555] rounded z-[100] min-w-[150px] shadow-lg">
                    {['All', 'For Sale'].map(opt => (
                      <button key={opt} onClick={() => { setCollectionFilter(opt); setShowCollectionDropdown(false); }} className={`w-full px-4 py-2 bg-transparent border-none text-left cursor-pointer text-[13px] text-white hover:bg-[#3a3a3a] ${collectionFilter === opt ? 'bg-[#5A9BD5]' : ''}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-0.5 items-center flex-1 justify-center">
            <button onClick={() => setSelectedLetter('All')} className={`bg-transparent text-white border-none px-2 py-1 cursor-pointer text-xs rounded-sm ${selectedLetter === 'All' ? 'bg-[#5A9BD5]' : 'hover:bg-white/10'}`}>All</button>
            {alphabet.map(letter => (
              <button key={letter} onClick={() => setSelectedLetter(letter)} className={`bg-transparent text-white border-none px-2 py-1 cursor-pointer text-xs rounded-sm ${selectedLetter === letter ? 'bg-[#5A9BD5]' : 'hover:bg-white/10'}`}>{letter}</button>
            ))}
          </div>

          <div className="flex items-center shrink-0">
            <input type="text" placeholder="Search albums..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-[#2a2a2a] text-white border border-[#555] px-3 py-1.5 rounded text-[13px] w-[220px] h-8 outline-none" />
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedAlbumIds.size > 0 && (
          <div className="bg-[#5BA3D0] text-white px-4 py-2 flex items-center gap-2 h-10 shrink-0">
            <button onClick={() => setSelectedAlbumIds(new Set())} className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">✕ Cancel</button>
            <button onClick={() => setShowAddToCrateModal(true)} className="bg-white/20 border-none text-white px-2.5 py-1 rounded cursor-pointer text-xs">📦 Add to Crate</button>
            <div className="flex-1" />
            <span className="text-xs font-medium">{selectedAlbumIds.size} selected</span>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className="hidden md:flex w-[220px] bg-[#2C2C2C] text-white flex-col overflow-hidden border-r border-[#1a1a1a] shrink-0">
            <div className="p-2.5 border-b border-[#1a1a1a] flex justify-between items-center shrink-0">
              <div className="relative">
                <button onClick={() => setShowViewModeDropdown(!showViewModeDropdown)} className="bg-[#3a3a3a] text-white border border-[#555] px-2.5 py-1.5 rounded cursor-pointer text-xs flex items-center gap-1.5">
                  <span>{viewMode === 'crates' ? '📦' : '📁'}</span>
                  <span>{viewMode === 'crates' ? 'Crates' : 'Format'}</span>
                  <span className="text-[10px]">▼</span>
                </button>
                {showViewModeDropdown && (
                  <>
                    <div onClick={() => setShowViewModeDropdown(false)} className="fixed inset-0 z-[99]" />
                    <div className="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-[#555] rounded z-[100] min-w-[180px] shadow-lg">
                      <button onClick={() => handleViewModeChange('format')} className="w-full px-4 py-2 bg-transparent border-none text-left cursor-pointer text-[13px] text-white hover:bg-[#3a3a3a]">📁 Format</button>
                      <button onClick={() => handleViewModeChange('crates')} className="w-full px-4 py-2 bg-transparent border-none text-left cursor-pointer text-[13px] text-white hover:bg-[#3a3a3a]">📦 Crates</button>
                    </div>
                  </>
                )}
              </div>
              {/* Manage Crates Button (Visible only in Crate Mode) */}
              {viewMode === 'crates' && (
                <button onClick={() => setShowManageCratesModal(true)} title="Manage Crates" className="bg-transparent text-white border-none cursor-pointer text-base p-1 hover:text-[#5A9BD5]">
                  ⚙️
                </button>
              )}
            </div>

            <div className="p-2.5 border-b border-[#1a1a1a] shrink-0">
              <input type="text" placeholder="Search..." value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} className="w-full px-2 py-1.5 bg-[#3a3a3a] text-white border border-[#555] rounded text-xs outline-none" />
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 min-h-0">
              {viewMode === 'format' ? (
                <>
                  <button onClick={() => setSelectedGroupValue(null)} className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${!selectedGroupValue ? 'bg-[#5A9BD5]' : ''}`}>
                    <span>[All Albums]</span>
                    <span className="text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold bg-[#555]">{albums.length}</span>
                  </button>
                  {sortedGroupItems.map(([format, count]) => (
                    <button key={format} onClick={() => setSelectedGroupValue(format)} className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedGroupValue === format ? 'bg-[#5A9BD5]' : ''}`}>
                      <span>{format}</span>
                      <span className="text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold bg-[#555]">{count}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button onClick={() => setSelectedCrateId(null)} className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedCrateId === null ? 'bg-[#5A9BD5]' : ''}`}>
                    <span>[All Albums]</span>
                    <span className="text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold bg-[#555]">{albums.length}</span>
                  </button>
                  {cratesWithCounts.map(crate => (
                    <button key={crate.id} onClick={() => setSelectedCrateId(crate.id)} className={`w-full flex justify-between items-center px-2 py-1.5 bg-transparent border-none rounded cursor-pointer mb-0.5 text-xs text-white text-left ${selectedCrateId === crate.id ? 'bg-[#5A9BD5]' : ''}`}>
                      <span className="flex items-center gap-1.5">
                        {crate.is_smart ? <BoxIcon color={crate.icon} size={14} /> : <span>{crate.icon}</span>}
                        <span>{crate.name}</span>
                      </span>
                      <span className="text-white px-1.5 py-0.5 rounded-[10px] text-[11px] font-semibold bg-[#555]">{crate.album_count}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">
            <div className="px-3 py-1.5 border-b border-[#555] flex items-center justify-between bg-[#4a4a4a] h-10 shrink-0">
              <div className="flex gap-1.5 items-center">
                <div className="relative">
                  <button onClick={() => setShowSortDropdown(!showSortDropdown)} className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white flex items-center gap-1">
                    <span>↕️</span><span className="text-[9px]">▼</span>
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
                <button onClick={() => setShowColumnSelector(true)} className="bg-[#3a3a3a] border border-[#555] px-2 py-1 rounded cursor-pointer text-xs text-white flex items-center gap-1">
                  <span>⊞</span><span className="text-[9px]">▼</span>
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
            {selectedAlbum && <AlbumDetailPanel album={selectedAlbum} onClose={() => setSelectedAlbumId(null)} onEditTags={() => setEditingAlbumId(selectedAlbumId)} onMarkForSale={() => { /* Sale logic */ }} />}
          </div>
        </div>

        {/* Modals */}
        {showColumnSelector && <ColumnSelector visibleColumns={visibleColumns} onColumnsChange={handleColumnsChange} onClose={() => setShowColumnSelector(false)} />}
        {editingAlbumId && <EditAlbumModal albumId={editingAlbumId} onClose={() => setEditingAlbumId(null)} onRefresh={loadAlbums} onNavigate={(newAlbumId) => setEditingAlbumId(newAlbumId)} allAlbumIds={filteredAndSortedAlbums.map(a => a.id)} />}
        
        {/* Crate Modals (Restored) */}
        {showNewCrateModal && <NewCrateModal isOpen={showNewCrateModal} onClose={() => { setShowNewCrateModal(false); setEditingCrate(null); if (returnToAddToCrate) { setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }}} onCrateCreated={async (newCrateId) => { await loadCrates(); setEditingCrate(null); if (returnToAddToCrate) { setNewlyCreatedCrateId(newCrateId); setShowNewCrateModal(false); setShowAddToCrateModal(true); } else { setShowNewCrateModal(false); }}} editingCrate={editingCrate} />}
        {showNewSmartCrateModal && <NewSmartCrateModal isOpen={showNewSmartCrateModal} onClose={() => { setShowNewSmartCrateModal(false); setEditingCrate(null); }} onCrateCreated={() => { loadCrates(); setShowNewSmartCrateModal(false); setEditingCrate(null); }} editingCrate={editingCrate} />}
        {showAddToCrateModal && <AddToCrateModal isOpen={showAddToCrateModal} onClose={() => { setShowAddToCrateModal(false); setReturnToAddToCrate(false); setNewlyCreatedCrateId(null); }} crates={cratesWithCounts} onAddToCrates={handleAddToCrates} selectedCount={selectedAlbumIds.size} onOpenNewCrate={() => { setReturnToAddToCrate(true); setShowAddToCrateModal(false); setEditingCrate(null); setShowNewCrateModal(true); }} autoSelectCrateId={newlyCreatedCrateId} />}
        {showManageCratesModal && <ManageCratesModal isOpen={showManageCratesModal} onClose={() => setShowManageCratesModal(false)} onCratesChanged={loadCrates} onOpenNewCrate={openNewCrate} onOpenNewSmartCrate={openNewSmartCrate} onOpenEditCrate={openEditCrate} onOpenEditSmartCrate={openEditSmartCrate} />}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-base text-gray-500">Loading...</div>}>
      <CollectionBrowserPage />
    </Suspense>
  );
}
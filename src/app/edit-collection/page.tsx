// src/app/edit-collection/page.tsx
'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import CollectionTable from '../../components/CollectionTable';
import AlbumDetailPanel from '../../components/AlbumDetailPanel';
import ColumnSelector from '../../components/ColumnSelector';
import { ColumnId, DEFAULT_VISIBLE_COLUMNS } from '../../lib/collection-columns';

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
  sale_notes: string | null;
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
  sides: number | { count: number } | string[] | null;
  is_box_set: boolean;
  parent_id: string | null;
  blocked: boolean;
  blocked_sides: string[] | null;
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
  enrichment_sources: string | null;
  artist_norm: string | null;
  album_norm: string | null;
  artist_album_norm: string | null;
  year_int: number | null;
  sale_quantity: number | null;
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
};

type TagDefinition = {
  id: string;
  tag_name: string;
  category: string;
  color: string;
};

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

// TODO: Expand view modes - see PROJECT_STATUS.md Phase 2
type ViewMode = 'format' | 'artist' | 'artist-release-year' | 'genre-artist' | 'label';

// TODO: Add database fields for these statuses - see PROJECT_STATUS.md Phase 5
type CollectionFilter = 'all' | 'in-collection' | 'for-sale' | 'on-wish-list' | 'on-order' | 'sold' | 'not-in-collection';

const PLATFORMS = [
  { value: 'discogs', label: 'Discogs' },
  { value: 'shopify', label: 'Shopify Store' },
  { value: 'ebay', label: 'eBay' },
  { value: 'reverb', label: 'Reverb LP' },
  { value: 'other', label: 'Other' }
];

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
  { value: 'sides-desc', label: 'Most Sides First', category: 'Physical' },
  { value: 'sides-asc', label: 'Fewest Sides First', category: 'Physical' },
  { value: 'tags-count-desc', label: 'Most Tags', category: 'Metadata' },
  { value: 'tags-count-asc', label: 'Fewest Tags', category: 'Metadata' },
  { value: 'popularity-desc', label: 'Most Popular (Spotify)', category: 'Metadata' },
  { value: 'popularity-asc', label: 'Least Popular (Spotify)', category: 'Metadata' },
  { value: 'sale-price-desc', label: 'Highest Price', category: 'Sales' },
  { value: 'sale-price-asc', label: 'Lowest Price', category: 'Sales' }
];

function toSafeSearchString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase();
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string').join(' ').toLowerCase();
  try { return String(value).toLowerCase(); } catch { return ''; }
}

function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => typeof item === 'string' && item.length > 0);
}

function CollectionBrowserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Core data
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
  
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState<SortOption>('artist-asc');
  const [selectedLetter, setSelectedLetter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('format');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  
  // Selection state - NEW for multi-select functionality
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<number>>(new Set());
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null); // For detail panel
  
  // Column management (existing)
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  
  // Format/View filter (existing, but now dynamic based on view mode)
  const [selectedViewItem, setSelectedViewItem] = useState<string | null>(null);
  const [viewItemSearch, setViewItemSearch] = useState('');
  
  // Modals (existing)
  const [showAddAlbumsModal, setShowAddAlbumsModal] = useState(false); // NEW modal
  const [editingTagsFor, setEditingTagsFor] = useState<number | null>(null);
  const [albumTags, setAlbumTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [saleModalAlbum, setSaleModalAlbum] = useState<Album | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [salePlatform, setSalePlatform] = useState('');
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [saleNotes, setSaleNotes] = useState('');
  const [savingSale, setSavingSale] = useState(false);
  
  // Active collection tab (NEW for multiple collections feature)
  const [activeCollection, setActiveCollection] = useState('music');

  // Load column preferences from localStorage (existing)
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
  
  const handleColumnsChange = (columns: ColumnId[]) => {
    setVisibleColumns(columns);
    localStorage.setItem('collection-visible-columns', JSON.stringify(columns));
  };

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    
    const { data: tagDefs } = await supabase
      .from('tag_definitions')
      .select('*')
      .order('category', { ascending: true });
    
    if (tagDefs) {
      setTagDefinitions(tagDefs as TagDefinition[]);
    }

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

  // Filter and sort albums (existing, with expanded collection filter)
  const filteredAndSortedAlbums = albums
    .filter(album => {
      // Collection filter
      // TODO: Expand with actual for_sale, wish_list, on_order, sold filtering
      // See PROJECT_STATUS.md Phase 5 for database fields needed
      if (collectionFilter === 'for-sale' && !album.for_sale) return false;
      if (collectionFilter === 'not-in-collection') return false; // TODO: Add logic
      
      // Letter filter (existing)
      if (selectedLetter !== 'all') {
        const firstChar = (album.artist || '').charAt(0).toUpperCase();
        if (selectedLetter === '0-9') {
          if (!/[0-9]/.test(firstChar)) return false;
        } else {
          if (firstChar !== selectedLetter) return false;
        }
      }

      // View item filter (existing for format, needs expansion for other view modes)
      // TODO: Expand for other view modes - see PROJECT_STATUS.md Phase 2
      if (viewMode === 'format' && selectedViewItem && album.format !== selectedViewItem) return false;
      if (viewMode === 'artist' && selectedViewItem && album.artist !== selectedViewItem) return false;
      // TODO: Add genre-artist, artist-release-year, label, etc.

      // Search filter (existing)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          album.artist,
          album.title,
          album.format,
          album.year,
          toSafeSearchString(album.custom_tags)
        ].join(' ').toLowerCase();
        
        if (!searchable.includes(q)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Existing sort logic - all 24 options preserved
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

  // Selection handlers - NEW for multi-select
  // TODO: See PROJECT_STATUS.md Phase 1 for batch operations to implement
  const toggleAlbumSelection = (albumId: number) => {
    setSelectedAlbumIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(albumId)) {
        newSet.delete(albumId);
      } else {
        newSet.add(albumId);
      }
      return newSet;
    });
  };

  const selectAllAlbums = () => {
    setSelectedAlbumIds(new Set(filteredAndSortedAlbums.map(a => a.id)));
  };

  const clearSelection = () => {
    setSelectedAlbumIds(new Set());
  };

  // Tag management (existing)
  const openTagEditor = (album: Album) => {
    setEditingTagsFor(album.id);
    setAlbumTags(toSafeStringArray(album.custom_tags));
  };

  const toggleTag = (tagName: string) => {
    setAlbumTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const addCustomTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !albumTags.includes(trimmed)) {
      setAlbumTags(prev => [...prev, trimmed]);
      setNewTagInput('');
    }
  };

  const removeTag = (tagName: string) => {
    setAlbumTags(prev => prev.filter(t => t !== tagName));
  };

  const saveTags = async () => {
    if (!editingTagsFor) return;
    setSavingTags(true);
    
    const { error } = await supabase
      .from('collection')
      .update({ custom_tags: albumTags })
      .eq('id', editingTagsFor);

    if (!error) {
      await loadAlbums();
      setEditingTagsFor(null);
    }
    
    setSavingTags(false);
  };

  // Sale management (existing)
  const openSaleModal = (album: Album) => {
    setSaleModalAlbum(album);
    setSalePrice(album.sale_price?.toString() || '');
    setSalePlatform(album.sale_platform || '');
    setSaleQuantity('1');
    setSaleNotes('');
  };

  const closeSaleModal = () => {
    setSaleModalAlbum(null);
    setSalePrice('');
    setSalePlatform('');
    setSaleQuantity('1');
    setSaleNotes('');
  };

  const markForSale = async () => {
    if (!saleModalAlbum) return;
    setSavingSale(true);
    
    const { error } = await supabase
      .from('collection')
      .update({
        for_sale: true,
        sale_price: salePrice ? parseFloat(salePrice) : null,
        sale_platform: salePlatform || null,
        sale_quantity: parseInt(saleQuantity) || 1,
        sale_notes: saleNotes || null
      })
      .eq('id', saleModalAlbum.id);

    if (!error) {
      await loadAlbums();
      closeSaleModal();
    }
    
    setSavingSale(false);
  };

  const tagsByCategory = tagDefinitions.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, TagDefinition[]>);

  const editingAlbum = albums.find(a => a.id === editingTagsFor);
  const selectedAlbum = albums.find(a => a.id === selectedAlbumId);

  // View item counts (existing for format, needs expansion for other view modes)
  // TODO: Expand for other view modes - see PROJECT_STATUS.md Phase 2
  const viewItemCounts = albums.reduce((acc, album) => {
    let itemKey = 'Unknown';
    if (viewMode === 'format') {
      itemKey = album.format || 'Unknown';
    } else if (viewMode === 'artist') {
      itemKey = album.artist || 'Unknown';
    }
    // TODO: Add genre-artist, artist-release-year, label, etc.
    
    acc[itemKey] = (acc[itemKey] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedViewItems = Object.entries(viewItemCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([item]) => 
      !viewItemSearch || item.toLowerCase().includes(viewItemSearch.toLowerCase())
    );

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: '#f5f5f5'
    }}>
      {/* LEFT HAMBURGER SIDEBAR - TODO: Build out full menu structure
          See PROJECT_STATUS.md Phase 3 for complete menu items */}
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
              zIndex: 1999
            }}
          />
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '280px',
            background: '#333',
            color: 'white',
            zIndex: 2000,
            overflowY: 'auto',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>MENU</div>
              <button
                onClick={() => setSidebarOpen(false)}
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

            {/* TODO: Build out full sidebar menu with sections:
                - Collection (Add Albums, Manage Pick Lists, Manage Collections)
                - Tools (Print to PDF, Statistics, Find Duplicates, Loan Manager)
                - Customization (CLZ Cloud Sharing, Pre-fill Settings, Settings)
                - Maintenance (Re-Assign Index Values, Backup/Restore, Clear Database, Transfer Field Data)
                - Import/Export (Export to CSV/TXT, Export to XML)
                See PROJECT_STATUS.md Phase 3
            */}
            <div style={{ fontSize: '14px', color: '#888', marginTop: '20px' }}>
              [Full sidebar menu structure to be built]
              <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                <li>Collection</li>
                <li>Tools</li>
                <li>Customization</li>
                <li>Maintenance</li>
                <li>Import / Export</li>
              </ul>
            </div>
          </div>
        </>
      )}

      {/* MAIN CONTENT AREA */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* TOP BAR */}
        <div style={{
          background: '#667eea',
          color: 'white',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '20px'
              }}
            >
              ☰
            </button>
            <span style={{ fontSize: '24px' }}>📚</span>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>Dead Wax Dialogues</div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>
                {filteredAndSortedAlbums.length} of {albums.length} albums
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowColumnSelector(true)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              ⚙️ Columns
            </button>
            <Link
              href="/admin/manage-tags"
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              🏷️ Manage Tags
            </Link>
          </div>
        </div>

        {/* CONTROLS BAR - NEW section with all the dropdowns and buttons */}
        <div style={{
          background: '#fff',
          borderBottom: '1px solid #ddd',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* Add Albums Button - NEW */}
          <button
            onClick={() => setShowAddAlbumsModal(true)}
            style={{
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            + Add Albums
          </button>

          {/* Collection Filter Dropdown - NEW */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowCollectionDropdown(!showCollectionDropdown)}
              style={{
                background: '#f0f0f0',
                border: '1px solid #ddd',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>📚</span>
              <span>{collectionFilter === 'all' ? 'All' : collectionFilter.replace('-', ' ')}</span>
              <span>▼</span>
            </button>
            {showCollectionDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 100,
                minWidth: '200px'
              }}>
                {/* TODO: Add proper icons for each filter option - see CLZ screenshots */}
                {['all', 'in-collection', 'for-sale', 'on-wish-list', 'on-order', 'sold', 'not-in-collection'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => {
                      setCollectionFilter(filter as CollectionFilter);
                      setShowCollectionDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: collectionFilter === filter ? '#e3f2fd' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: collectionFilter === filter ? '#1976d2' : '#333'
                    }}
                  >
                    {filter === 'all' ? 'All' : filter.replace('-', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Mode Selector - NEW (labeled as Format in CLZ) */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowViewDropdown(!showViewDropdown)}
              style={{
                background: '#f0f0f0',
                border: '1px solid #ddd',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>📋</span>
              <span>{viewMode === 'format' ? 'Format' : viewMode.replace('-', ' ')}</span>
              <span>▼</span>
            </button>
            {showViewDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 100,
                minWidth: '250px'
              }}>
                {/* TODO: Organize into expandable sections: Main, Details, Classical, People
                    See PROJECT_STATUS.md Phase 2 */}
                <div style={{ padding: '8px 0' }}>
                  <div style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Main</div>
                  {['format', 'artist', 'artist-release-year', 'genre-artist'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => {
                        setViewMode(mode as ViewMode);
                        setShowViewDropdown(false);
                        setSelectedViewItem(null);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 24px',
                        background: viewMode === mode ? '#e3f2fd' : 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: viewMode === mode ? '#1976d2' : '#333'
                      }}
                    >
                      {mode === 'artist-release-year' ? 'Artist / Release Year' :
                       mode === 'genre-artist' ? 'Genre / Artist' :
                       mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                  {/* TODO: Add Details, Classical, People sections with more view modes */}
                  <div style={{ padding: '8px 16px', fontSize: '12px', color: '#999' }}>
                    [More view modes to be added]
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* View Management Icons - NEW */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {/* List/Grid Toggle - TODO: Implement grid view - see PROJECT_STATUS.md Phase 6 */}
            <button
              style={{
                background: '#f0f0f0',
                border: '1px solid #ddd',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
              title="View mode (list/grid)"
            >
              ☰
            </button>
            
            {/* Manage Current View - TODO: Open manage modal for current view mode */}
            <button
              style={{
                background: '#f0f0f0',
                border: '1px solid #ddd',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
              title={`Manage ${viewMode === 'format' ? 'Formats' : viewMode === 'artist' ? 'Artists' : 'Items'}`}
            >
              ⚙️
            </button>
            
            {/* Sort/Filter Toggle */}
            <button
              style={{
                background: '#f0f0f0',
                border: '1px solid #ddd',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
              title="Sort and filter options"
            >
              ⋮
            </button>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Search */}
          <input
            type="text"
            placeholder="Search albums..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '300px',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          
          {/* Settings */}
          <button
            style={{
              background: '#f0f0f0',
              border: '1px solid #ddd',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
            title="Settings"
          >
            ⚙️
          </button>
        </div>

        {/* ALPHABET NAVIGATION */}
        <div style={{
          background: '#fff',
          borderBottom: '1px solid #ddd',
          padding: '12px 16px'
        }}>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedLetter('all')}
              style={{
                background: selectedLetter === 'all' ? '#667eea' : '#f0f0f0',
                color: selectedLetter === 'all' ? 'white' : '#333',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              All
            </button>
            <button
              onClick={() => setSelectedLetter('0-9')}
              style={{
                background: selectedLetter === '0-9' ? '#667eea' : '#f0f0f0',
                color: selectedLetter === '0-9' ? 'white' : '#333',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              0-9
            </button>
            {alphabet.map(letter => (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter)}
                style={{
                  background: selectedLetter === letter ? '#667eea' : '#f0f0f0',
                  color: selectedLetter === letter ? 'white' : '#333',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  minWidth: '32px'
                }}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>

        {/* SELECTION TOOLBAR - NEW - Shows when albums are selected */}
        {selectedAlbumIds.size > 0 && (
          <div style={{
            background: '#2196F3',
            color: 'white',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid #1976D2'
          }}>
            <button
              onClick={clearSelection}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ✕ Cancel
            </button>
            <button
              onClick={selectAllAlbums}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ☑ All
            </button>
            {/* TODO: Add more batch action buttons: Edit, Remove, Print to PDF, etc.
                See PROJECT_STATUS.md Phase 1.2 for implementation */}
            <button
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ✏️ Edit
            </button>
            <button
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🗑️ Remove
            </button>
            <button
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📄 Print to PDF
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              {selectedAlbumIds.size} of {filteredAndSortedAlbums.length} selected
            </span>
          </div>
        )}

        {/* THREE-PANEL LAYOUT */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* LEFT SIDEBAR - View Items (Format/Artist/etc) */}
          <div style={{
            width: '280px',
            background: '#fff',
            borderRight: '1px solid #ddd',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Search for view items */}
            <div style={{ padding: '16px', borderBottom: '1px solid #ddd' }}>
              <input
                type="text"
                placeholder={`Search ${viewMode}...`}
                value={viewItemSearch}
                onChange={(e) => setViewItemSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* View Items List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {/* All Items button */}
              <button
                onClick={() => setSelectedViewItem(null)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: !selectedViewItem ? '#e3f2fd' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  fontSize: '14px',
                  color: !selectedViewItem ? '#1976d2' : '#333'
                }}
              >
                <span>[All {viewMode === 'format' ? 'Albums' : viewMode === 'artist' ? 'Artists' : 'Items'}]</span>
                <span style={{
                  background: !selectedViewItem ? '#1976d2' : '#e0e0e0',
                  color: !selectedViewItem ? 'white' : '#666',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  {albums.length}
                </span>
              </button>

              {/* Individual view items */}
              {sortedViewItems.map(([item, count]) => (
                <button
                  key={item}
                  onClick={() => setSelectedViewItem(item)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: selectedViewItem === item ? '#e3f2fd' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginBottom: '4px',
                    fontSize: '14px',
                    color: selectedViewItem === item ? '#1976d2' : '#333',
                    textAlign: 'left'
                  }}
                >
                  <span>{item}</span>
                  <span style={{
                    background: selectedViewItem === item ? '#1976d2' : '#e0e0e0',
                    color: selectedViewItem === item ? 'white' : '#666',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* CENTER - TABLE WITH SELECTION */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#fff'
          }}>
            {/* Sort Controls */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #ddd',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <label style={{ fontSize: '14px', color: '#666' }}>Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {Object.entries(
                  SORT_OPTIONS.reduce((acc, opt) => {
                    if (!acc[opt.category]) acc[opt.category] = [];
                    acc[opt.category].push(opt);
                    return acc;
                  }, {} as Record<string, typeof SORT_OPTIONS>)
                ).map(([category, options]) => (
                  <optgroup key={category} label={category}>
                    {options.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Table with checkboxes */}
            {/* TODO: Update CollectionTable to include selection checkboxes
                See PROJECT_STATUS.md Phase 1.1 */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                  Loading albums...
                </div>
              ) : (
                <div>
                  <CollectionTable
                    albums={filteredAndSortedAlbums}
                    visibleColumns={visibleColumns}
                    onAlbumClick={setSelectedAlbumId}
                    onSellClick={openSaleModal}
                    selectedAlbumId={selectedAlbumId}
                  />
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                    [Selection checkboxes to be added to table - see PROJECT_STATUS.md Phase 1.1]
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT - DETAIL PANEL */}
          {selectedAlbum && (
            <div style={{
              width: '400px',
              background: '#fff',
              borderLeft: '1px solid #ddd',
              overflow: 'auto'
            }}>
              <AlbumDetailPanel
                album={selectedAlbum}
                onClose={() => setSelectedAlbumId(null)}
                onEditTags={() => openTagEditor(selectedAlbum)}
                onMarkForSale={() => openSaleModal(selectedAlbum)}
              />
            </div>
          )}
        </div>

        {/* BOTTOM COLLECTION TABS - NEW */}
        <div style={{
          background: '#333',
          borderTop: '1px solid #222',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          gap: '0'
        }}>
          {/* TODO: Load collections from database/settings
              See PROJECT_STATUS.md Phase 3.1 for Manage Collections implementation */}
          {['music', 'Vinyl', 'Singles (45s and 12")', 'Sale'].map(collection => (
            <button
              key={collection}
              onClick={() => setActiveCollection(collection)}
              style={{
                background: activeCollection === collection ? '#F97316' : 'transparent',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeCollection === collection ? 600 : 400,
                borderBottom: activeCollection === collection ? '3px solid #F97316' : 'none'
              }}
            >
              {collection}
            </button>
          ))}
          
          {/* Manage Collections button */}
          <button
            style={{
              background: 'transparent',
              color: '#999',
              border: 'none',
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: '14px',
              marginLeft: 'auto'
            }}
          >
            ⚙️ Manage Collections
          </button>
        </div>
      </div>

      {/* ADD ALBUMS MODAL - NEW - TODO: Build out full add albums interface
          See PROJECT_STATUS.md Phase 4 */}
      {showAddAlbumsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            maxWidth: 600,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              padding: 20,
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>
                Add Albums By:
              </h2>
              <button
                onClick={() => setShowAddAlbumsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20 }}>
              {/* TODO: Add tab buttons for Artist & Title, Barcode, Catalog Nr, Add Manually
                  See PROJECT_STATUS.md Phase 4.1 */}
              <div style={{ fontSize: '14px', color: '#666' }}>
                [Add Albums interface to be built]
              </div>
              <div style={{ marginTop: '20px' }}>
                <p>Options to implement:</p>
                <ul style={{ fontSize: '14px', color: '#666' }}>
                  <li>Artist & Title search</li>
                  <li>Barcode scan/entry</li>
                  <li>Catalog Number entry</li>
                  <li>Manual entry form</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXISTING MODALS - ALL PRESERVED BELOW */}
      
      {/* Column Selector Modal - EXISTING */}
      {showColumnSelector && (
        <ColumnSelector
          visibleColumns={visibleColumns}
          onColumnsChange={handleColumnsChange}
          onClose={() => setShowColumnSelector(false)}
        />
      )}

      {/* Tag Editor Modal - EXISTING */}
      {editingTagsFor && editingAlbum && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            maxWidth: 700,
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              padding: 20,
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: 0, marginBottom: 8 }}>
                Edit Tags
              </h2>
              <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
                {editingAlbum.artist} - {editingAlbum.title}
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {Object.entries(tagsByCategory).map(([category, tags]) => (
                <div key={category} style={{ marginBottom: 24 }}>
                  <h3 style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#333',
                    marginBottom: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {category}
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 8
                  }}>
                    {tags.map(tag => {
                      const isSelected = albumTags.includes(tag.tag_name);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.tag_name)}
                          style={{
                            padding: '8px 12px',
                            background: isSelected ? tag.color : 'white',
                            color: isSelected ? 'white' : '#333',
                            border: `2px solid ${isSelected ? tag.color : '#e0e0e0'}`,
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: isSelected ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'left'
                          }}
                        >
                          {tag.tag_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #e0e0e0' }}>
                <h3 style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Custom Tags
                </h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="Add custom tag..."
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: 6,
                      fontSize: 14
                    }}
                  />
                  <button
                    onClick={addCustomTag}
                    style={{
                      padding: '8px 16px',
                      background: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {albumTags
                    .filter(tag => !tagDefinitions.some(td => td.tag_name === tag))
                    .map(tag => (
                      <div key={tag} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        background: '#f0f0f0',
                        border: '1px solid #e0e0e0',
                        borderRadius: 6,
                        fontSize: 13
                      }}>
                        <span>{tag}</span>
                        <button
                          onClick={() => removeTag(tag)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#f44336',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: 16,
                            lineHeight: 1
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div style={{
              padding: 20,
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setEditingTagsFor(null)}
                disabled={savingTags}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingTags ? 'not-allowed' : 'pointer',
                  opacity: savingTags ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveTags}
                disabled={savingTags}
                style={{
                  padding: '10px 20px',
                  background: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingTags ? 'not-allowed' : 'pointer',
                  opacity: savingTags ? 0.5 : 1
                }}
              >
                {savingTags ? 'Saving...' : 'Save Tags'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Modal - EXISTING */}
      {saleModalAlbum && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            maxWidth: 500,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              padding: 20,
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: 0, marginBottom: 8 }}>
                Mark for Sale
              </h2>
              <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
                {saleModalAlbum.artist} - {saleModalAlbum.title}
              </p>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: 6
                }}>
                  Sale Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: 6
                }}>
                  Platform
                </label>
                <select
                  value={salePlatform}
                  onChange={e => setSalePlatform(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 14,
                    background: 'white'
                  }}
                >
                  <option value="">Select platform...</option>
                  {PLATFORMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: 6
                }}>
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={saleQuantity}
                  onChange={e => setSaleQuantity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: 6
                }}>
                  Sale Notes (optional)
                </label>
                <textarea
                  value={saleNotes}
                  onChange={e => setSaleNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 14,
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: 20,
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={closeSaleModal}
                disabled={savingSale}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingSale ? 'not-allowed' : 'pointer',
                  opacity: savingSale ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={markForSale}
                disabled={savingSale}
                style={{
                  padding: '10px 20px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingSale ? 'not-allowed' : 'pointer',
                  opacity: savingSale ? 0.5 : 1
                }}
              >
                {savingSale ? 'Saving...' : 'Mark for Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Suspense wrapper for useSearchParams - EXISTING
export default function Page() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading collection browser...
      </div>
    }>
      <CollectionBrowserPage />
    </Suspense>
  );
}
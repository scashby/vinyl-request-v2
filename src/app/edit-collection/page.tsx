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

type FolderMode = 'format' | 'artist' | 'artist-release-year' | 'genre-artist' | 'label';

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

// Folder options matching CLZ structure
const FOLDER_OPTIONS = {
  favorites: [
    { id: '1', filter: 'artist', name: 'Artist' },
    { id: '2', filter: 'format', name: 'Format' },
    { id: '3', filter: 'artist', name: 'Artist / Release Year' },
    { id: '4', filter: 'genre', name: 'Genre / Artist' }
  ],
  main: [
    { filter: 'artist', name: 'Artist' },
    { filter: 'format', name: 'Format' },
    { filter: 'genre', name: 'Genre' },
    { filter: 'label', name: 'Label' },
    { filter: 'originalreleasedate', name: 'Original Release Date' },
    { filter: 'originalreleasemonth', name: 'Original Release Month' },
    { filter: 'originalreleaseyear', name: 'Original Release Year' },
    { filter: 'recordingdate', name: 'Recording Date' },
    { filter: 'recordingmonth', name: 'Recording Month' },
    { filter: 'recordingyear', name: 'Recording Year' },
    { filter: 'releasedate', name: 'Release Date' },
    { filter: 'releasemonth', name: 'Release Month' },
    { filter: 'releaseyear', name: 'Release Year' }
  ],
  details: [
    { filter: 'boxset', name: 'Box Set' },
    { filter: 'country', name: 'Country' },
    { filter: 'extra', name: 'Extra' },
    { filter: 'instrument', name: 'Instrument' },
    { filter: 'islive', name: 'Is Live' },
    { filter: 'mediacondition', name: 'Media Condition' },
    { filter: 'condition', name: 'Package/Sleeve Condition' },
    { filter: 'packaging', name: 'Packaging' },
    { filter: 'rpm', name: 'RPM' },
    { filter: 'sparscode', name: 'SPARS' },
    { filter: 'soundtype', name: 'Sound' },
    { filter: 'storagedevice', name: 'Storage Device' },
    { filter: 'studio', name: 'Studio' },
    { filter: 'vinylcolor', name: 'Vinyl Color' }
  ],
  classical: [
    { filter: 'chorus', name: 'Chorus' },
    { filter: 'composer', name: 'Composer' },
    { filter: 'composition', name: 'Composition' },
    { filter: 'conductor', name: 'Conductor' },
    { filter: 'orchestra', name: 'Orchestra' }
  ],
  people: [
    { filter: 'engineer', name: 'Engineer' },
    { filter: 'musician', name: 'Musician' },
    { filter: 'producer', name: 'Producer' },
    { filter: 'songwriter', name: 'Songwriter' }
  ],
  personal: [
    { filter: 'added', name: 'Added Date' },
    { filter: 'addedmonth', name: 'Added Month' },
    { filter: 'addedyear', name: 'Added Year' },
    { filter: 'status', name: 'Collection Status' },
    { filter: 'issigned', name: 'Is Signed' },
    { filter: 'lastcleaneddate', name: 'Last Cleaned Date' },
    { filter: 'lastcleanedmonth', name: 'Last Cleaned Month' },
    { filter: 'lastcleanedyear', name: 'Last Cleaned Year' },
    { filter: 'location', name: 'Location' },
    { filter: 'modified', name: 'Modified Date' },
    { filter: 'modifiedmonth', name: 'Modified Month' },
    { filter: 'rating', name: 'My Rating' },
    { filter: 'owner', name: 'Owner' },
    { filter: 'consumptions', name: 'Played Date' },
    { filter: 'lastconsumedmonth', name: 'Played Month' },
    { filter: 'lastconsumedyear', name: 'Played Year' },
    { filter: 'purchased', name: 'Purchase Date' },
    { filter: 'purchasemonth', name: 'Purchase Month' },
    { filter: 'purchasestore', name: 'Purchase Store' },
    { filter: 'purchaseyear', name: 'Purchase Year' },
    { filter: 'signees', name: 'Signed by' },
    { filter: 'tags', name: 'Tags' }
  ]
};

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
  const [folderMode, setFolderMode] = useState<string>('format');
  const [selectedFolderValue, setSelectedFolderValue] = useState<string | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [expandedFolderGroups, setExpandedFolderGroups] = useState<Set<string>>(new Set());
  
  // Selection state
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<number>>(new Set());
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  
  // Column management
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  
  // Folder search
  const [folderSearch, setFolderSearch] = useState('');
  
  // Modals
  const [showAddAlbumsModal, setShowAddAlbumsModal] = useState(false);
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
  
  // Active collection tab
  const [activeCollection, setActiveCollection] = useState('music');

  // Load column preferences
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

  // Filter and sort albums
  const filteredAndSortedAlbums = albums
    .filter(album => {
      // Collection filter
      if (collectionFilter === 'for-sale' && !album.for_sale) return false;
      // TODO: Add other collection status filters
      
      // Letter filter
      if (selectedLetter !== 'all') {
        const firstChar = (album.artist || '').charAt(0).toUpperCase();
        if (selectedLetter === '0-9') {
          if (!/[0-9]/.test(firstChar)) return false;
        } else {
          if (firstChar !== selectedLetter) return false;
        }
      }

      // Folder filter
      if (selectedFolderValue) {
        if (folderMode === 'format' && album.format !== selectedFolderValue) return false;
        if (folderMode === 'artist' && album.artist !== selectedFolderValue) return false;
        // TODO: Add other folder modes
      }

      // Search filter
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

  // Selection handlers
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

  // Tag management
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

  // Sale management
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

  // Folder counts
  const folderCounts = albums.reduce((acc, album) => {
    let itemKey = 'Unknown';
    if (folderMode === 'format') {
      itemKey = album.format || 'Unknown';
    } else if (folderMode === 'artist') {
      itemKey = album.artist || 'Unknown';
    }
    // TODO: Add other folder modes
    
    acc[itemKey] = (acc[itemKey] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedFolderItems = Object.entries(folderCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([item]) => 
      !folderSearch || item.toLowerCase().includes(folderSearch.toLowerCase())
    );

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const toggleFolderGroup = (group: string) => {
    setExpandedFolderGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(group)) {
        newSet.delete(group);
      } else {
        newSet.add(group);
      }
      return newSet;
    });
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: '#f5f5f5',
      flexDirection: 'column'
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
              zIndex: 1999
            }}
          />
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '280px',
            background: '#2C2C2C',
            color: 'white',
            zIndex: 2000,
            overflowY: 'auto',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>CLZ MUSIC WEB</div>
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

            {/* Collection Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#999', marginBottom: '10px', textTransform: 'uppercase' }}>Collection</div>
              <button onClick={() => setShowAddAlbumsModal(true)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', borderRadius: '4px' }}>
                <span style={{ marginRight: '10px' }}>➕</span> Add Albums from Core
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>📋</span> Manage Pick Lists
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>💰</span> Manage Collections
              </button>
            </div>

            <hr style={{ borderColor: '#444', margin: '20px 0' }} />

            {/* Tools Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#999', marginBottom: '10px', textTransform: 'uppercase' }}>Tools</div>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>🖨️</span> Print to PDF
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>📊</span> Statistics
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>📋</span> Find Duplicates
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>🕐</span> Loan Manager
              </button>
            </div>

            <hr style={{ borderColor: '#444', margin: '20px 0' }} />

            {/* Customization Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#999', marginBottom: '10px', textTransform: 'uppercase' }}>Customization</div>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>🔗</span> CLZ Cloud Sharing
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>📝</span> Pre-fill Settings
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>⚙️</span> Settings
              </button>
            </div>

            <hr style={{ borderColor: '#444', margin: '20px 0' }} />

            {/* Maintenance Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#999', marginBottom: '10px', textTransform: 'uppercase' }}>Maintenance</div>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>🔢</span> Re-Assign Index Values
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>💾</span> Backup / Restore
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>🗑️</span> Clear Database
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>↔️</span> Transfer Field Data
              </button>
            </div>

            <hr style={{ borderColor: '#444', margin: '20px 0' }} />

            {/* Import/Export Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#999', marginBottom: '10px', textTransform: 'uppercase' }}>Import / Export</div>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>📤</span> Export to CSV / TXT
              </button>
              <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px' }}>
                <span style={{ marginRight: '10px' }}>📤</span> Export to XML
              </button>
            </div>
          </div>
        </>
      )}

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

      {/* TOOLBAR */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #ddd',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Add Albums Button */}
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

        {/* Collection Status Dropdown */}
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
            <span>{collectionFilter === 'all' ? 'All' : collectionFilter}</span>
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
              {['all', 'in-collection', 'for-sale', 'wish-list', 'on-order', 'sold', 'not-in-collection'].map(filter => (
                <button
                  key={filter}
                  onClick={() => {
                    setCollectionFilter(filter);
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
                  {filter === 'all' ? 'All' : 
                   filter === 'in-collection' ? 'In Collection' :
                   filter === 'for-sale' ? 'For Sale' :
                   filter === 'wish-list' ? 'On Wish List' :
                   filter === 'on-order' ? 'On Order' :
                   filter === 'sold' ? 'Sold' :
                   'Not in Collection'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Folder/View Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowFolderDropdown(!showFolderDropdown)}
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
            <span>📁</span>
            <span>{FOLDER_OPTIONS.favorites.find(f => f.filter === folderMode)?.name || 'Format'}</span>
            <span>▼</span>
          </button>
          {showFolderDropdown && (
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
              minWidth: '250px',
              maxHeight: '500px',
              overflowY: 'auto'
            }}>
              {/* Favorites */}
              <div style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Favorites</div>
              {FOLDER_OPTIONS.favorites.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => {
                    setFolderMode(folder.filter);
                    setSelectedFolderValue(null);
                    setShowFolderDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 24px',
                    background: folderMode === folder.filter ? '#e3f2fd' : 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: folderMode === folder.filter ? '#1976d2' : '#333'
                  }}
                >
                  {folder.name}
                </button>
              ))}

              {/* Main */}
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => toggleFolderGroup('main')}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    background: '#f5f5f5',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#666',
                    textTransform: 'uppercase',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Main</span>
                  <span>{expandedFolderGroups.has('main') ? '▼' : '▶'}</span>
                </button>
                {expandedFolderGroups.has('main') && FOLDER_OPTIONS.main.map(folder => (
                  <button
                    key={folder.filter}
                    onClick={() => {
                      setFolderMode(folder.filter);
                      setSelectedFolderValue(null);
                      setShowFolderDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 24px',
                      background: folderMode === folder.filter ? '#e3f2fd' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: folderMode === folder.filter ? '#1976d2' : '#333'
                    }}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>

              {/* Details */}
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => toggleFolderGroup('details')}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    background: '#f5f5f5',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#666',
                    textTransform: 'uppercase',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Details</span>
                  <span>{expandedFolderGroups.has('details') ? '▼' : '▶'}</span>
                </button>
                {expandedFolderGroups.has('details') && FOLDER_OPTIONS.details.map(folder => (
                  <button
                    key={folder.filter}
                    onClick={() => {
                      setFolderMode(folder.filter);
                      setSelectedFolderValue(null);
                      setShowFolderDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 24px',
                      background: folderMode === folder.filter ? '#e3f2fd' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: folderMode === folder.filter ? '#1976d2' : '#333'
                    }}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>

              {/* Classical */}
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => toggleFolderGroup('classical')}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    background: '#f5f5f5',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#666',
                    textTransform: 'uppercase',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Classical</span>
                  <span>{expandedFolderGroups.has('classical') ? '▼' : '▶'}</span>
                </button>
                {expandedFolderGroups.has('classical') && FOLDER_OPTIONS.classical.map(folder => (
                  <button
                    key={folder.filter}
                    onClick={() => {
                      setFolderMode(folder.filter);
                      setSelectedFolderValue(null);
                      setShowFolderDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 24px',
                      background: folderMode === folder.filter ? '#e3f2fd' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: folderMode === folder.filter ? '#1976d2' : '#333'
                    }}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>

              {/* People */}
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => toggleFolderGroup('people')}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    background: '#f5f5f5',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#666',
                    textTransform: 'uppercase',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>People</span>
                  <span>{expandedFolderGroups.has('people') ? '▼' : '▶'}</span>
                </button>
                {expandedFolderGroups.has('people') && FOLDER_OPTIONS.people.map(folder => (
                  <button
                    key={folder.filter}
                    onClick={() => {
                      setFolderMode(folder.filter);
                      setSelectedFolderValue(null);
                      setShowFolderDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 24px',
                      background: folderMode === folder.filter ? '#e3f2fd' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: folderMode === folder.filter ? '#1976d2' : '#333'
                    }}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>

              {/* Personal */}
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => toggleFolderGroup('personal')}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    background: '#f5f5f5',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#666',
                    textTransform: 'uppercase',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Personal</span>
                  <span>{expandedFolderGroups.has('personal') ? '▼' : '▶'}</span>
                </button>
                {expandedFolderGroups.has('personal') && FOLDER_OPTIONS.personal.map(folder => (
                  <button
                    key={folder.filter}
                    onClick={() => {
                      setFolderMode(folder.filter);
                      setSelectedFolderValue(null);
                      setShowFolderDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 24px',
                      background: folderMode === folder.filter ? '#e3f2fd' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: folderMode === folder.filter ? '#1976d2' : '#333'
                    }}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* View Management Icons */}
        <div style={{ display: 'flex', gap: '4px' }}>
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
          
          <button
            style={{
              background: '#f0f0f0',
              border: '1px solid #ddd',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
            title={`Manage ${folderMode}`}
          >
            ⚙️
          </button>
          
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

      {/* SELECTION TOOLBAR */}
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
        {/* LEFT SIDEBAR - Folder Panel */}
        <div style={{
          width: '280px',
          background: '#fff',
          borderRight: '1px solid #ddd',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Search for folder items */}
          <div style={{ padding: '16px', borderBottom: '1px solid #ddd' }}>
            <input
              type="text"
              placeholder={`Search ${folderMode}...`}
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Folder Items List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {/* All Items button */}
            <button
              onClick={() => setSelectedFolderValue(null)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: !selectedFolderValue ? '#e3f2fd' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '4px',
                fontSize: '14px',
                color: !selectedFolderValue ? '#1976d2' : '#333'
              }}
            >
              <span>[All Albums]</span>
              <span style={{
                background: !selectedFolderValue ? '#1976d2' : '#e0e0e0',
                color: !selectedFolderValue ? 'white' : '#666',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {albums.length}
              </span>
            </button>

            {/* Individual folder items */}
            {sortedFolderItems.map(([item, count]) => (
              <button
                key={item}
                onClick={() => setSelectedFolderValue(item)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: selectedFolderValue === item ? '#e3f2fd' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  fontSize: '14px',
                  color: selectedFolderValue === item ? '#1976d2' : '#333',
                  textAlign: 'left'
                }}
              >
                <span>{item}</span>
                <span style={{
                  background: selectedFolderValue === item ? '#1976d2' : '#e0e0e0',
                  color: selectedFolderValue === item ? 'white' : '#666',
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

          {/* Manage Collections Button */}
          <div style={{ padding: '12px', borderTop: '1px solid #ddd' }}>
            <button style={{
              width: '100%',
              padding: '10px',
              background: '#f0f0f0',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}>
              🎵 Manage Collections
            </button>
          </div>
        </div>

        {/* CENTER - TABLE */}
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

          {/* Table */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                Loading albums...
              </div>
            ) : (
              <CollectionTable
                albums={filteredAndSortedAlbums}
                visibleColumns={visibleColumns}
                onAlbumClick={setSelectedAlbumId}
                onSellClick={openSaleModal}
                selectedAlbumId={selectedAlbumId}
              />
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

      {/* BOTTOM COLLECTION TABS */}
      <div style={{
        background: '#333',
        borderTop: '1px solid #222',
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        gap: '0'
      }}>
        <button style={{
          background: 'transparent',
          color: 'white',
          border: 'none',
          padding: '12px 20px',
          cursor: 'pointer',
          fontSize: '16px'
        }}>
          ☰
        </button>
        {['music', 'Vinyl', 'Singles (45s and 12")', 'Sale'].map(collection => (
          <button
            key={collection}
            onClick={() => setActiveCollection(collection)}
            style={{
              background: activeCollection === collection ? '#667eea' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeCollection === collection ? 600 : 400,
              borderBottom: activeCollection === collection ? '3px solid #667eea' : 'none'
            }}
          >
            {collection}
          </button>
        ))}
        
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

      {/* ADD ALBUMS MODAL */}
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
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                [Add Albums interface to be built]
              </div>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '10px' }}>Options to implement:</p>
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

      {/* EXISTING MODALS */}
      
      {/* Column Selector Modal */}
      {showColumnSelector && (
        <ColumnSelector
          visibleColumns={visibleColumns}
          onColumnsChange={handleColumnsChange}
          onClose={() => setShowColumnSelector(false)}
        />
      )}

      {/* Tag Editor Modal */}
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

      {/* Sale Modal */}
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

// Suspense wrapper
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
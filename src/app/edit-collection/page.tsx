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
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value.toLowerCase();
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLowerCase();
  }
  
  if (Array.isArray(value)) {
    return value
      .filter(item => typeof item === 'string')
      .join(' ')
      .toLowerCase();
  }
  
  try {
    return String(value).toLowerCase();
  } catch {
    return '';
  }
}

function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  
  return value.filter(item => typeof item === 'string' && item.length > 0);
}

function CollectionBrowserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState<SortOption>('artist-asc');
  const [selectedLetter, setSelectedLetter] = useState<string>('all');
  
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  
  // Load column preferences from localStorage
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
  
  // Save column preferences to localStorage
  const handleColumnsChange = (columns: ColumnId[]) => {
    setVisibleColumns(columns);
    localStorage.setItem('collection-visible-columns', JSON.stringify(columns));
  };
  
  // Format filter
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [formatSearch, setFormatSearch] = useState('');
  
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
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

  const filteredAndSortedAlbums = albums
    .filter(album => {
      // Letter filter
      if (selectedLetter !== 'all') {
        const firstChar = (album.artist || '').charAt(0).toUpperCase();
        if (selectedLetter === '0-9') {
          if (!/[0-9]/.test(firstChar)) return false;
        } else {
          if (firstChar !== selectedLetter) return false;
        }
      }

      // Format filter
      if (selectedFormat && album.format !== selectedFormat) return false;

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
        case 'artist-asc':
          return (a.artist || '').localeCompare(b.artist || '');
        case 'artist-desc':
          return (b.artist || '').localeCompare(a.artist || '');
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'title-desc':
          return (b.title || '').localeCompare(a.title || '');
        case 'year-desc':
          return (b.year_int || 0) - (a.year_int || 0);
        case 'year-asc':
          return (a.year_int || 0) - (b.year_int || 0);
        case 'decade-desc':
          return (b.decade || 0) - (a.decade || 0);
        case 'decade-asc':
          return (a.decade || 0) - (b.decade || 0);
        case 'added-desc':
          return (b.date_added || '').localeCompare(a.date_added || '');
        case 'added-asc':
          return (a.date_added || '').localeCompare(b.date_added || '');
        case 'format-asc':
          return (a.format || '').localeCompare(b.format || '');
        case 'format-desc':
          return (b.format || '').localeCompare(a.format || '');
        case 'folder-asc':
          return (a.folder || '').localeCompare(b.folder || '');
        case 'folder-desc':
          return (b.folder || '').localeCompare(a.folder || '');
        case 'condition-asc':
          return (a.media_condition || '').localeCompare(b.media_condition || '');
        case 'condition-desc':
          return (b.media_condition || '').localeCompare(a.media_condition || '');
        case 'tags-count-desc':
          return toSafeStringArray(b.custom_tags).length - toSafeStringArray(a.custom_tags).length;
        case 'tags-count-asc':
          return toSafeStringArray(a.custom_tags).length - toSafeStringArray(b.custom_tags).length;
        case 'sale-price-desc':
          return (b.sale_price || 0) - (a.sale_price || 0);
        case 'sale-price-asc':
          return (a.sale_price || 0) - (b.sale_price || 0);
        case 'popularity-desc':
          return (b.spotify_popularity || 0) - (a.spotify_popularity || 0);
        case 'popularity-asc':
          return (a.spotify_popularity || 0) - (b.spotify_popularity || 0);
        case 'sides-desc':
          const aSides = typeof a.sides === 'number' ? a.sides : 0;
          const bSides = typeof b.sides === 'number' ? b.sides : 0;
          return bSides - aSides;
        case 'sides-asc':
          const aSidesAsc = typeof a.sides === 'number' ? a.sides : 0;
          const bSidesAsc = typeof b.sides === 'number' ? b.sides : 0;
          return aSidesAsc - bSidesAsc;
        default:
          return 0;
      }
    });

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

  // Format counts for sidebar
  const formatCounts = albums.reduce((acc, album) => {
    const format = album.format || 'Unknown';
    acc[format] = (acc[format] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedFormats = Object.entries(formatCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([format]) => 
      !formatSearch || format.toLowerCase().includes(formatSearch.toLowerCase())
    );

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: '#F9FAFB'
    }}>
      {/* APP BAR */}
      <div style={{
        background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
        color: 'white',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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

      {/* TOOLBAR WITH ALPHABET */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        padding: '16px 24px'
      }}>
        {/* Alphabet Navigation */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setSelectedLetter('all')}
            style={{
              background: selectedLetter === 'all' ? '#667EEA' : '#F3F4F6',
              color: selectedLetter === 'all' ? 'white' : '#374151',
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
              background: selectedLetter === '0-9' ? '#667EEA' : '#F3F4F6',
              color: selectedLetter === '0-9' ? 'white' : '#374151',
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
                background: selectedLetter === letter ? '#667EEA' : '#F3F4F6',
                color: selectedLetter === letter ? 'white' : '#374151',
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

        {/* Search Bar */}
        <div style={{ maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Search albums..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* THREE-PANEL LAYOUT */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* LEFT SIDEBAR - FORMAT FILTER */}
        <div style={{
          width: '280px',
          background: '#FFFFFF',
          borderRight: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Format Search */}
          <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
            <input
              type="text"
              placeholder="Search formats..."
              value={formatSearch}
              onChange={(e) => setFormatSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Format List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            <button
              onClick={() => setSelectedFormat(null)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: !selectedFormat ? '#EEF2FF' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '4px',
                fontSize: '14px',
                color: !selectedFormat ? '#667EEA' : '#374151'
              }}
            >
              <span>All Formats</span>
              <span style={{
                background: !selectedFormat ? '#667EEA' : '#E5E7EB',
                color: !selectedFormat ? 'white' : '#6B7280',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {albums.length}
              </span>
            </button>

            {sortedFormats.map(([format, count]) => (
              <button
                key={format}
                onClick={() => setSelectedFormat(format)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: selectedFormat === format ? '#EEF2FF' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  fontSize: '14px',
                  color: selectedFormat === format ? '#667EEA' : '#374151',
                  textAlign: 'left'
                }}
              >
                <span>{format}</span>
                <span style={{
                  background: selectedFormat === format ? '#667EEA' : '#E5E7EB',
                  color: selectedFormat === format ? 'white' : '#6B7280',
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

        {/* CENTER - TABLE */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#FFFFFF'
        }}>
          {/* Sort Controls */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <label style={{ fontSize: '14px', color: '#6B7280' }}>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                padding: '6px 12px',
                border: '1px solid #D1D5DB',
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
              <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
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
            background: '#FFFFFF',
            borderLeft: '1px solid #E5E7EB',
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

      {/* MODALS - Keep all existing modals */}
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
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: 0, marginBottom: 8 }}>
                Edit Tags
              </h2>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
                {editingAlbum.artist} - {editingAlbum.title}
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {Object.entries(tagsByCategory).map(([category, tags]) => (
                <div key={category} style={{ marginBottom: 24 }}>
                  <h3 style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#374151',
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
                            color: isSelected ? 'white' : '#374151',
                            border: `2px solid ${isSelected ? tag.color : '#e5e7eb'}`,
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

              <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
                <h3 style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
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
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14
                    }}
                  />
                  <button
                    onClick={addCustomTag}
                    style={{
                      padding: '8px 16px',
                      background: '#3b82f6',
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
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: 13
                      }}>
                        <span>{tag}</span>
                        <button
                          onClick={() => removeTag(tag)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
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
              borderTop: '1px solid #e5e7eb',
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
                  color: '#374151',
                  border: '1px solid #d1d5db',
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
                  background: '#3b82f6',
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
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: 0, marginBottom: 8 }}>
                Mark for Sale
              </h2>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
                {saleModalAlbum.artist} - {saleModalAlbum.title}
              </p>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#374151',
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
                    border: '1px solid #d1d5db',
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
                  color: '#374151',
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
                    border: '1px solid #d1d5db',
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
                  color: '#374151',
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
                    border: '1px solid #d1d5db',
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
                  color: '#374151',
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
                    border: '1px solid #d1d5db',
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
              borderTop: '1px solid #e5e7eb',
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
                  color: '#374151',
                  border: '1px solid #d1d5db',
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
                  background: '#10b981',
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

// Suspense wrapper for useSearchParams
export default function Page() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#6B7280'
      }}>
        Loading collection browser...
      </div>
    }>
      <CollectionBrowserPage />
    </Suspense>
  );
}
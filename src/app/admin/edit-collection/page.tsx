// src/app/admin/edit-collection/page.tsx - TYPE-SAFE WITH DEBUG
'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

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
  media_condition: string | null;
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
  is_1001: boolean;
  steves_top_200: boolean;
  this_weeks_top_10: boolean;
  inner_circle_preferred: boolean;
  discogs_master_id: string | null;
  discogs_release_id: string | null;
  master_release_id: string | null;
  spotify_id: string | null;
  apple_music_id: string | null;
  sides: number | null;
  is_box_set: boolean;
  parent_id: number | null;
  blocked: boolean;
  blocked_sides: string | null;
  child_album_ids: string | null;
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
};

type TagDefinition = {
  id: string;
  tag_name: string;
  category: string;
  color: string;
};

const PLATFORMS = [
  { value: 'discogs', label: 'Discogs' },
  { value: 'shopify', label: 'Shopify Store' },
  { value: 'ebay', label: 'eBay' },
  { value: 'reverb', label: 'Reverb LP' },
  { value: 'other', label: 'Other' }
];

// ========================================
// HELPER FUNCTIONS FOR TYPE SAFETY
// ========================================

/**
 * Safely converts any value to a lowercase searchable string
 * Returns empty string for null/undefined, handles arrays and objects
 */
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
    // Filter to only string elements, then join
    return value
      .filter(item => typeof item === 'string')
      .join(' ')
      .toLowerCase();
  }
  
  // For objects or other types, try toString
  try {
    return String(value).toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Safely extracts string elements from an array field
 * Returns empty array if not an array or contains non-strings
 */
function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  
  return value.filter(item => typeof item === 'string' && item.length > 0);
}

/**
 * Checks if a value contains a search query (case-insensitive)
 */
function safeIncludes(value: unknown, query: string): boolean {
  const searchStr = toSafeSearchString(value);
  return searchStr.includes(query.toLowerCase());
}

export default function EditCollectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
  const [editingTagsFor, setEditingTagsFor] = useState<number | null>(null);
  const [albumTags, setAlbumTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  
  // Sale modal state
  const [saleModalAlbum, setSaleModalAlbum] = useState<Album | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [salePlatform, setSalePlatform] = useState('');
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [saleNotes, setSaleNotes] = useState('');
  const [savingSale, setSavingSale] = useState(false);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    
    // Load tag definitions
    const { data: tagDefs } = await supabase
      .from('tag_definitions')
      .select('*')
      .order('category', { ascending: true });
    
    if (tagDefs) {
      setTagDefinitions(tagDefs as TagDefinition[]);
    }

    // Load albums with pagination
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

  const filteredAlbums = albums.filter(album => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    
    // Build comprehensive searchable text using safe helper functions
    const searchParts: string[] = [
      // Core text fields
      toSafeSearchString(album.artist),
      toSafeSearchString(album.title),
      toSafeSearchString(album.format),
      toSafeSearchString(album.folder),
      toSafeSearchString(album.year),
      toSafeSearchString(album.media_condition),
      toSafeSearchString(album.tracklists),
      toSafeSearchString(album.blocked_sides),
      toSafeSearchString(album.child_album_ids),
      toSafeSearchString(album.sell_price),
      toSafeSearchString(album.date_added),
      
      // Notes and descriptions
      toSafeSearchString(album.discogs_source),
      toSafeSearchString(album.discogs_notes),
      toSafeSearchString(album.sale_notes),
      toSafeSearchString(album.pricing_notes),
      toSafeSearchString(album.sale_platform),
      
      // ID fields
      toSafeSearchString(album.discogs_master_id),
      toSafeSearchString(album.discogs_release_id),
      toSafeSearchString(album.master_release_id),
      toSafeSearchString(album.spotify_id),
      toSafeSearchString(album.apple_music_id),
      
      // URL fields
      toSafeSearchString(album.image_url),
      toSafeSearchString(album.spotify_url),
      toSafeSearchString(album.spotify_image_url),
      toSafeSearchString(album.apple_music_url),
      toSafeSearchString(album.apple_music_artwork_url),
      
      // Label fields
      toSafeSearchString(album.spotify_label),
      toSafeSearchString(album.apple_music_label),
      toSafeSearchString(album.apple_music_genre),
      
      // Normalized fields
      toSafeSearchString(album.artist_norm),
      toSafeSearchString(album.album_norm),
      toSafeSearchString(album.artist_album_norm),
      
      // Date fields
      toSafeSearchString(album.master_release_date),
      toSafeSearchString(album.spotify_release_date),
      toSafeSearchString(album.apple_music_release_date),
      toSafeSearchString(album.last_enriched_at),
      toSafeSearchString(album.discogs_price_updated_at),
      
      // Other text fields
      toSafeSearchString(album.enrichment_sources),
      
      // Number fields
      toSafeSearchString(album.decade),
      toSafeSearchString(album.sides),
      toSafeSearchString(album.parent_id),
      toSafeSearchString(album.spotify_popularity),
      toSafeSearchString(album.spotify_total_tracks),
      toSafeSearchString(album.apple_music_track_count),
      toSafeSearchString(album.year_int),
      toSafeSearchString(album.sale_quantity),
      toSafeSearchString(album.wholesale_cost),
      toSafeSearchString(album.discogs_price_min),
      toSafeSearchString(album.discogs_price_median),
      toSafeSearchString(album.discogs_price_max),
      
      // Array fields - safely handled
      toSafeSearchString(album.custom_tags),
      toSafeSearchString(album.discogs_genres),
      toSafeSearchString(album.discogs_styles),
      toSafeSearchString(album.spotify_genres),
      toSafeSearchString(album.apple_music_genres),
      
      // Boolean fields - convert to searchable keywords
      album.is_1001 ? '1001 albums thousand and one 1001albums' : '',
      album.steves_top_200 ? 'top 200 steves top 200 top200 steve' : '',
      album.this_weeks_top_10 ? 'top 10 top10 this week weekly' : '',
      album.inner_circle_preferred ? 'inner circle preferred innercircle' : '',
      album.for_sale ? 'for sale selling available' : '',
      album.is_box_set ? 'box set boxset' : '',
      album.blocked ? 'blocked' : '',
    ];
    
    // Combine all parts and search
    const searchableText = searchParts
      .filter(part => part.length > 0)
      .join(' ');
    
    return searchableText.includes(query);
  });

  const getMatchInfo = (album: Album, query: string): string[] => {
    if (!query) return [];
    
    const q = query.toLowerCase();
    const matches: string[] = [];
    
    // Check core fields
    if (safeIncludes(album.artist, q)) matches.push(`Artist: ${album.artist}`);
    if (safeIncludes(album.title, q)) matches.push(`Title: ${album.title}`);
    if (safeIncludes(album.format, q)) matches.push(`Format: ${album.format}`);
    if (safeIncludes(album.folder, q)) matches.push(`Folder: ${album.folder}`);
    if (safeIncludes(album.year, q)) matches.push(`Year: ${album.year}`);
    if (safeIncludes(album.media_condition, q)) matches.push(`Condition: ${album.media_condition}`);
    
    // Tracklists - ENHANCED DEBUG VERSION
    if (album.tracklists && safeIncludes(album.tracklists, q)) {
      let foundTrack = false;
      try {
        const tracks = JSON.parse(album.tracklists);
        if (Array.isArray(tracks)) {
          // Check track titles first
          const matchingTracks = tracks
            .filter(t => t && typeof t === 'object' && typeof t.title === 'string' && safeIncludes(t.title, q))
            .map(t => t.title)
            .slice(0, 2);
          if (matchingTracks.length > 0) {
            matches.push(`Track titles: ${matchingTracks.join(', ')}`);
            foundTrack = true;
          }
          
          // Check OTHER track properties (not just title) - THIS IS THE DEBUG PART
          if (!foundTrack) {
            for (const track of tracks) {
              if (!track || typeof track !== 'object') continue;
              
              // Check each property in the track object
              for (const [key, value] of Object.entries(track)) {
                if (value && typeof value === 'string' && value.toLowerCase().includes(q)) {
                  matches.push(`🔍 Track field "${key}": ${value.substring(0, 100)}`);
                  foundTrack = true;
                  break;
                }
              }
              
              if (foundTrack) break;
            }
          }
        }
      } catch {
        // Not JSON - try text extraction
        if (typeof album.tracklists === 'string') {
          const lines = album.tracklists.split('\n');
          const matchingLines = lines
            .filter(line => typeof line === 'string' && line.length > 0 && safeIncludes(line, q))
            .map(line => {
              const cleaned = line.replace(/^[A-Z0-9]+\s*[-–\s]*/i, '').replace(/\s*\d+:\d+\s*$/,'').trim();
              return cleaned.length > 0 ? cleaned.substring(0, 100) : line.substring(0, 100);
            })
            .filter(line => line.length > 0)
            .slice(0, 2);
          
          if (matchingLines.length > 0) {
            matches.push(`Track text: ${matchingLines.join(' | ')}`);
            foundTrack = true;
          }
        }
      }
      
      // Fallback: show raw data snippet
      if (!foundTrack && typeof album.tracklists === 'string') {
        const trackText = album.tracklists.toLowerCase();
        const index = trackText.indexOf(q);
        if (index !== -1) {
          const start = Math.max(0, index - 60);
          const end = Math.min(trackText.length, index + q.length + 100);
          const snippet = album.tracklists.substring(start, end).trim();
          matches.push(`🔍 RAW: ...${snippet}...`);
        }
      }
    }
    
    // Array fields - safely check
    const customTags = toSafeStringArray(album.custom_tags);
    if (customTags.some(t => safeIncludes(t, q))) {
      const matched = customTags.filter(t => safeIncludes(t, q));
      matches.push(`Tags: ${matched.join(', ')}`);
    }
    
    const discogsGenres = toSafeStringArray(album.discogs_genres);
    if (discogsGenres.some(g => safeIncludes(g, q))) {
      const matched = discogsGenres.filter(g => safeIncludes(g, q));
      matches.push(`Discogs Genre: ${matched.join(', ')}`);
    }
    
    const discogsStyles = toSafeStringArray(album.discogs_styles);
    if (discogsStyles.some(s => safeIncludes(s, q))) {
      const matched = discogsStyles.filter(s => safeIncludes(s, q));
      matches.push(`Discogs Style: ${matched.join(', ')}`);
    }
    
    const spotifyGenres = toSafeStringArray(album.spotify_genres);
    if (spotifyGenres.some(g => safeIncludes(g, q))) {
      const matched = spotifyGenres.filter(g => safeIncludes(g, q));
      matches.push(`Spotify Genre: ${matched.join(', ')}`);
    }
    
    const appleMusicGenres = toSafeStringArray(album.apple_music_genres);
    if (appleMusicGenres.some(g => safeIncludes(g, q))) {
      const matched = appleMusicGenres.filter(g => safeIncludes(g, q));
      matches.push(`Apple Music Genre: ${matched.join(', ')}`);
    }
    
    // Labels
    if (safeIncludes(album.spotify_label, q)) matches.push(`Spotify Label: ${album.spotify_label}`);
    if (safeIncludes(album.apple_music_label, q)) matches.push(`Apple Music Label: ${album.apple_music_label}`);
    if (safeIncludes(album.apple_music_genre, q)) matches.push(`Apple Genre: ${album.apple_music_genre}`);
    
    // Notes
    if (album.discogs_notes && safeIncludes(album.discogs_notes, q)) {
      const snippet = typeof album.discogs_notes === 'string' && album.discogs_notes.length > 100 
        ? album.discogs_notes.substring(0, 100) + '...' 
        : album.discogs_notes;
      matches.push(`Discogs Notes: ${snippet}`);
    }
    if (album.sale_notes && safeIncludes(album.sale_notes, q)) {
      const snippet = typeof album.sale_notes === 'string' && album.sale_notes.length > 100 
        ? album.sale_notes.substring(0, 100) + '...' 
        : album.sale_notes;
      matches.push(`Sale Notes: ${snippet}`);
    }
    if (safeIncludes(album.pricing_notes, q)) matches.push(`Pricing notes match`);
    
    // Other fields
    if (safeIncludes(album.discogs_source, q)) matches.push(`Discogs metadata`);
    if (safeIncludes(album.blocked_sides, q)) matches.push(`Blocked: ${album.blocked_sides}`);
    if (safeIncludes(album.enrichment_sources, q)) matches.push(`Enrichment source`);
    if (safeIncludes(album.discogs_master_id, q)) matches.push(`Master ID: ${album.discogs_master_id}`);
    if (safeIncludes(album.discogs_release_id, q)) matches.push(`Release ID: ${album.discogs_release_id}`);
    if (safeIncludes(album.spotify_id, q)) matches.push(`Spotify ID`);
    if (safeIncludes(album.child_album_ids, q)) matches.push(`Child albums`);
    
    // Boolean badges
    if (album.is_1001 && ('1001'.includes(q) || 'albums'.includes(q) || 'thousand'.includes(q))) {
      matches.push('Badge: 1001 Albums');
    }
    if (album.steves_top_200 && ('top'.includes(q) || '200'.includes(q) || 'steve'.includes(q))) {
      matches.push("Badge: Steve's Top 200");
    }
    if (album.this_weeks_top_10 && ('top'.includes(q) || '10'.includes(q) || 'week'.includes(q))) {
      matches.push("Badge: This Week's Top 10");
    }
    if (album.inner_circle_preferred && ('inner'.includes(q) || 'circle'.includes(q) || 'preferred'.includes(q))) {
      matches.push('Badge: Inner Circle');
    }
    if (album.for_sale && ('sale'.includes(q) || 'selling'.includes(q))) {
      matches.push('Badge: For Sale');
    }
    
    return matches.slice(0, 7);
  };

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

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const exportResults = () => {
    const csv = [
      ['Artist', 'Title', 'Year', 'Format', 'Folder', 'Condition', 'Tags'].join(','),
      ...filteredAlbums.map(album => [
        `"${album.artist || ''}"`,
        `"${album.title || ''}"`,
        album.year || '',
        album.format || '',
        album.folder || '',
        album.media_condition || '',
        `"${toSafeStringArray(album.custom_tags).join(', ')}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-search-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printResults = () => {
    window.print();
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

  const removeFromSale = async (albumId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Remove this item from sale?')) return;
    
    const { error } = await supabase
      .from('collection')
      .update({
        for_sale: false,
        sale_price: null,
        sale_platform: null,
        sale_quantity: null,
        sale_notes: null
      })
      .eq('id', albumId);

    if (!error) {
      await loadAlbums();
    }
  };

  const tagsByCategory = tagDefinitions.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, TagDefinition[]>);

  const editingAlbum = albums.find(a => a.id === editingTagsFor);

  return (
    <div style={{
      padding: 24,
      background: '#f8fafc',
      minHeight: '100vh',
      maxWidth: 1400,
      margin: '0 auto'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 'bold',
            color: '#1f2937',
            margin: '0 0 8px 0'
          }}>
            📚 Browse & Edit Collection
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: 16,
            margin: 0
          }}>
            Your daily collection browser - {filteredAlbums.length} albums
          </p>
        </div>

        <Link
          href="/admin/manage-tags"
          style={{
            background: '#8b5cf6',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none'
          }}
        >
          🏷️ Manage Tags
        </Link>
      </div>

      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: '#374151',
            marginBottom: 6
          }}>
            Search Collection
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search everything: artist, title, tracks, format, year, tags, genres, styles, labels, notes..."
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 15,
              color: '#1f2937',
              backgroundColor: 'white'
            }}
          />
          {searchQuery && (
            <div style={{
              marginTop: 8,
              fontSize: 13,
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Found {filteredAlbums.length} album{filteredAlbums.length !== 1 ? 's' : ''}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={exportResults}
                  style={{
                    padding: '6px 12px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  📥 Export CSV
                </button>
                <button
                  onClick={printResults}
                  style={{
                    padding: '6px 12px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🖨️ Print
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          color: '#6b7280'
        }}>
          Loading albums...
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16
        }}>
          {filteredAlbums.map(album => {
            const safeTags = toSafeStringArray(album.custom_tags);
            return (
              <div
                key={album.id}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  position: 'relative',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {album.for_sale && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: '#10b981',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    💰 ${album.sale_price?.toFixed(2) || '—'}
                  </div>
                )}

                <div
                  onClick={() => openTagEditor(album)}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    borderRadius: 6,
                    overflow: 'hidden'
                  }}
                >
                  <Image
                    src={album.image_url || '/images/placeholder.png'}
                    alt={album.title || 'Album'}
                    width={180}
                    height={180}
                    style={{
                      width: '100%',
                      height: 'auto',
                      aspectRatio: '1',
                      objectFit: 'cover'
                    }}
                    unoptimized
                  />
                  
                  {safeTags.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      background: 'rgba(139, 92, 246, 0.9)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600
                    }}>
                      🏷️ {safeTags.length}
                    </div>
                  )}
                </div>

                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1f2937',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {album.title || 'Untitled'}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#6b7280',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {album.artist || 'Unknown Artist'}
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: 11,
                  color: '#6b7280',
                  borderTop: '1px solid #f3f4f6',
                  paddingTop: 8
                }}>
                  {album.format && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 600, color: '#3b82f6' }}>💿</span>
                      <span style={{ fontWeight: 600 }}>{album.format}</span>
                    </div>
                  )}
                  {album.folder && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 600, color: '#8b5cf6' }}>📁</span>
                      <span>{album.folder}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {album.year && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 600, color: '#f59e0b' }}>📅</span>
                        <span>{album.year}</span>
                      </div>
                    )}
                    {album.media_condition && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 600, color: '#10b981' }}>✓</span>
                        <span style={{ fontWeight: 600 }}>{album.media_condition}</span>
                      </div>
                    )}
                  </div>
                </div>

                {safeTags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {safeTags.slice(0, 3).map(tagName => {
                      const tagDef = tagDefinitions.find(t => t.tag_name === tagName);
                      return (
                        <span
                          key={tagName}
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: tagDef?.color || '#6b7280',
                            color: 'white',
                            fontWeight: 500
                          }}
                        >
                          {tagName}
                        </span>
                      );
                    })}
                    {safeTags.length > 3 && (
                      <span style={{ fontSize: 10, padding: '2px 6px', color: '#6b7280' }}>
                        +{safeTags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {searchQuery && getMatchInfo(album, searchQuery).length > 0 && (
                  <div style={{
                    borderTop: '1px solid #e5e7eb',
                    paddingTop: 8,
                    marginTop: 4
                  }}>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#059669',
                      marginBottom: 4
                    }}>
                      ✓ Matches:
                    </div>
                    {getMatchInfo(album, searchQuery).map((match, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: 10,
                          color: '#6b7280',
                          marginBottom: 3,
                          lineHeight: '1.4',
                          wordBreak: 'break-word'
                        }}
                      >
                        {match}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <Link
                    href={`/admin/edit-entry/${album.id}`}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      textAlign: 'center',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️ Edit
                  </Link>
                  
                  {album.for_sale ? (
                    <button
                      onClick={(e) => removeFromSale(album.id, e)}
                      style={{
                        flex: 1,
                        padding: '6px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      🚫 Unsell
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openSaleModal(album);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      💰 Sell
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
            maxWidth: 1000,
            width: '100%',
            maxHeight: '95vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0
            }}>
              <Image
                src={editingAlbum.image_url || '/images/placeholder.png'}
                alt={editingAlbum.title || 'Album'}
                width={60}
                height={60}
                style={{ borderRadius: 6, objectFit: 'cover' }}
                unoptimized
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 2 }}>
                  {editingAlbum.title || 'Untitled'}
                </div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  {editingAlbum.artist || 'Unknown Artist'}
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 20px', flex: 1, overflowY: 'auto' }}>
              {albumTags.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 6 }}>
                    Current Tags ({albumTags.length})
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    padding: 8,
                    background: '#f3f4f6',
                    borderRadius: 4
                  }}>
                    {albumTags.map(tagName => {
                      const tagDef = tagDefinitions.find(t => t.tag_name === tagName);
                      return (
                        <div
                          key={tagName}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 3,
                            background: tagDef?.color || '#6b7280',
                            color: 'white',
                            fontSize: 12,
                            fontWeight: 600
                          }}
                        >
                          <span>{tagName}</span>
                          <button
                            onClick={() => removeTag(tagName)}
                            style={{
                              background: 'rgba(255,255,255,0.3)',
                              border: 'none',
                              borderRadius: 3,
                              color: 'white',
                              cursor: 'pointer',
                              padding: '1px 4px',
                              fontSize: 11,
                              fontWeight: 'bold'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 6 }}>
                  Add Custom Tag
                </h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && addCustomTag()}
                    placeholder="Type tag name and press Enter..."
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 13,
                      color: '#1f2937',
                      backgroundColor: 'white'
                    }}
                  />
                  <button
                    onClick={addCustomTag}
                    disabled={!newTagInput.trim()}
                    style={{
                      padding: '6px 12px',
                      background: newTagInput.trim() ? '#10b981' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: newTagInput.trim() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>
                Quick Select
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {Object.entries(tagsByCategory).map(([category, tags]) => (
                  <div key={category}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      marginBottom: 4,
                      letterSpacing: '0.5px'
                    }}>
                      {category}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {tags.length === 0 ? (
                        <div style={{ color: '#9ca3af', fontSize: 11 }}>No tags</div>
                      ) : (
                        tags.map(tag => {
                          const isSelected = albumTags.includes(tag.tag_name);
                          return (
                            <button
                              key={tag.id}
                              onClick={() => toggleTag(tag.tag_name)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 3,
                                border: `1.5px solid ${tag.color}`,
                                background: isSelected ? tag.color : 'white',
                                color: isSelected ? 'white' : tag.color,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {isSelected && '✓ '}{tag.tag_name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              flexShrink: 0,
              background: 'white'
            }}>
              <button
                onClick={() => setEditingTagsFor(null)}
                disabled={savingTags}
                style={{
                  padding: '6px 14px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: savingTags ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveTags}
                disabled={savingTags}
                style={{
                  padding: '6px 14px',
                  background: savingTags ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: savingTags ? 'not-allowed' : 'pointer'
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
            <div style={{ padding: 24, borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 }}>
                💰 Mark for Sale
              </div>
              <div style={{ fontSize: 14, color: '#6b7280' }}>
                {saleModalAlbum.artist || 'Unknown Artist'} - {saleModalAlbum.title || 'Untitled'}
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6
                }}>
                  Sale Price (USD)
                </label>
                <input
                  type="number"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#1f2937',
                    backgroundColor: 'white'
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 14,
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
                    backgroundColor: 'white',
                    color: '#1f2937'
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
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6
                }}>
                  Quantity
                </label>
                <input
                  type="number"
                  value={saleQuantity}
                  onChange={e => setSaleQuantity(e.target.value)}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#1f2937',
                    backgroundColor: 'white'
                  }}
                />
              </div>

              <div style={{ marginBottom: 0 }}>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6
                }}>
                  Notes (Optional)
                </label>
                <textarea
                  value={saleNotes}
                  onChange={e => setSaleNotes(e.target.value)}
                  placeholder="Condition, special details..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    color: '#1f2937',
                    backgroundColor: 'white'
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: 24,
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12
            }}>
              <button
                onClick={closeSaleModal}
                disabled={savingSale}
                style={{
                  padding: '10px 20px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingSale ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={markForSale}
                disabled={savingSale}
                style={{
                  padding: '10px 20px',
                  background: savingSale ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingSale ? 'not-allowed' : 'pointer'
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
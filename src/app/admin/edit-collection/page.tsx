// src/app/admin/edit-collection/page.tsx
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
  const [sortBy, setSortBy] = useState<SortOption>('artist-asc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Search scope - ALL fields you can include in search
  const [searchInArtist, setSearchInArtist] = useState(true);
  const [searchInTitle, setSearchInTitle] = useState(true);
  const [searchInTags, setSearchInTags] = useState(true);
  const [searchInTracks, setSearchInTracks] = useState(true);
  const [searchInFormat, setSearchInFormat] = useState(true);
  const [searchInNotes, setSearchInNotes] = useState(true);
  const [searchInGenres, setSearchInGenres] = useState(true);
  const [searchInStyles, setSearchInStyles] = useState(true);
  const [searchInYear, setSearchInYear] = useState(true);
  const [searchInFolder, setSearchInFolder] = useState(true);
  const [searchInCondition, setSearchInCondition] = useState(true);
  const [searchInLabels, setSearchInLabels] = useState(true);
  const [searchInPlatform, setSearchInPlatform] = useState(true);
  const [searchInIds, setSearchInIds] = useState(false); // Off by default - power user feature
  
  // Boolean filters (checkboxes)
  const [filterForSale, setFilterForSale] = useState(false);
  const [filterNotForSale, setFilterNotForSale] = useState(false);
  const [filterHasTags, setFilterHasTags] = useState(false);
  const [filterNoTags, setFilterNoTags] = useState(false);
  const [filter1001, setFilter1001] = useState(false);
  const [filterTop200, setFilterTop200] = useState(false);
  const [filterTop10, setFilterTop10] = useState(false);
  const [filterInnerCircle, setFilterInnerCircle] = useState(false);
  const [filterBoxSet, setFilterBoxSet] = useState(false);
  const [filterBlocked, setFilterBlocked] = useState(false);
  
  // Text filters (contains/exact match)
  const [filterFormat, setFilterFormat] = useState('');
  const [filterArtist, setFilterArtist] = useState('');
  const [filterTitle, setFilterTitle] = useState('');
  const [filterFolder, setFilterFolder] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  
  // Tag filters (include/exclude)
  const [includeTag, setIncludeTag] = useState('');
  const [excludeTag, setExcludeTag] = useState('');
  
  // Numeric range filters
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [tagCountMin, setTagCountMin] = useState('');
  const [tagCountMax, setTagCountMax] = useState('');
  const [sidesMin, setSidesMin] = useState('');
  const [sidesMax, setSidesMax] = useState('');
  
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

  const matchesSearch = (album: Album, query: string): boolean => {
    if (!query) return true;
    
    const q = query.toLowerCase();
    const searchParts: string[] = [];
    
    // Build search parts based on what's enabled
    if (searchInArtist) searchParts.push(toSafeSearchString(album.artist));
    if (searchInTitle) searchParts.push(toSafeSearchString(album.title));
    if (searchInFormat) searchParts.push(toSafeSearchString(album.format));
    if (searchInFolder) searchParts.push(toSafeSearchString(album.folder));
    if (searchInYear) searchParts.push(toSafeSearchString(album.year), toSafeSearchString(album.decade));
    if (searchInCondition) searchParts.push(toSafeSearchString(album.media_condition));
    if (searchInTracks) searchParts.push(toSafeSearchString(album.tracklists));
    if (searchInTags) {
      searchParts.push(toSafeSearchString(album.custom_tags));
      // Add badge keywords if those badges are on
      if (album.is_1001) searchParts.push('1001 albums thousand and one 1001albums');
      if (album.steves_top_200) searchParts.push('top 200 steves top 200 top200 steve');
      if (album.this_weeks_top_10) searchParts.push('top 10 top10 this week weekly');
      if (album.inner_circle_preferred) searchParts.push('inner circle preferred innercircle');
      if (album.for_sale) searchParts.push('for sale selling available');
      if (album.is_box_set) searchParts.push('box set boxset');
      if (album.blocked) searchParts.push('blocked');
    }
    if (searchInNotes) {
      searchParts.push(toSafeSearchString(album.discogs_notes));
      searchParts.push(toSafeSearchString(album.sale_notes));
      searchParts.push(toSafeSearchString(album.pricing_notes));
      searchParts.push(toSafeSearchString(album.blocked_sides));
    }
    if (searchInGenres) {
      searchParts.push(toSafeSearchString(album.discogs_genres));
      searchParts.push(toSafeSearchString(album.spotify_genres));
      searchParts.push(toSafeSearchString(album.apple_music_genres));
      searchParts.push(toSafeSearchString(album.apple_music_genre));
    }
    if (searchInStyles) {
      searchParts.push(toSafeSearchString(album.discogs_styles));
    }
    if (searchInLabels) {
      searchParts.push(toSafeSearchString(album.spotify_label));
      searchParts.push(toSafeSearchString(album.apple_music_label));
    }
    if (searchInPlatform) {
      searchParts.push(toSafeSearchString(album.sale_platform));
    }
    if (searchInIds) {
      // Power user feature - search by IDs
      searchParts.push(
        toSafeSearchString(album.discogs_master_id),
        toSafeSearchString(album.discogs_release_id),
        toSafeSearchString(album.master_release_id),
        toSafeSearchString(album.spotify_id),
        toSafeSearchString(album.apple_music_id),
        toSafeSearchString(album.child_album_ids)
      );
    }
    
    // Always include these for advanced users
    searchParts.push(
      toSafeSearchString(album.sell_price),
      toSafeSearchString(album.date_added),
      toSafeSearchString(album.discogs_source)
    );
    
    const searchableText = searchParts
      .filter(part => part.length > 0)
      .join(' ');
    
    return searchableText.includes(q);
  };

  const filteredAndSortedAlbums = albums
    .filter(album => {
      // Search query filter
      if (searchQuery && !matchesSearch(album, searchQuery)) {
        return false;
      }
      
      // Boolean filters
      if (filterForSale && !album.for_sale) return false;
      if (filterNotForSale && album.for_sale) return false;
      if (filterHasTags && toSafeStringArray(album.custom_tags).length === 0) return false;
      if (filterNoTags && toSafeStringArray(album.custom_tags).length > 0) return false;
      if (filter1001 && !album.is_1001) return false;
      if (filterTop200 && !album.steves_top_200) return false;
      if (filterTop10 && !album.this_weeks_top_10) return false;
      if (filterInnerCircle && !album.inner_circle_preferred) return false;
      if (filterBoxSet && !album.is_box_set) return false;
      if (filterBlocked && !album.blocked) return false;
      
      // Text filters (contains match)
      if (filterFormat && !album.format?.toLowerCase().includes(filterFormat.toLowerCase())) return false;
      if (filterArtist && !album.artist?.toLowerCase().includes(filterArtist.toLowerCase())) return false;
      if (filterTitle && !album.title?.toLowerCase().includes(filterTitle.toLowerCase())) return false;
      if (filterFolder && !album.folder?.toLowerCase().includes(filterFolder.toLowerCase())) return false;
      if (filterCondition && !album.media_condition?.toLowerCase().includes(filterCondition.toLowerCase())) return false;
      if (filterPlatform && !album.sale_platform?.toLowerCase().includes(filterPlatform.toLowerCase())) return false;
      if (filterLabel) {
        const labelMatch = 
          album.spotify_label?.toLowerCase().includes(filterLabel.toLowerCase()) ||
          album.apple_music_label?.toLowerCase().includes(filterLabel.toLowerCase());
        if (!labelMatch) return false;
      }
      
      // Tag filters
      const albumTags = toSafeStringArray(album.custom_tags);
      if (includeTag && !albumTags.some(t => t.toLowerCase().includes(includeTag.toLowerCase()))) {
        return false;
      }
      if (excludeTag && albumTags.some(t => t.toLowerCase().includes(excludeTag.toLowerCase()))) {
        return false;
      }
      
      // Numeric range filters
      if (yearMin && (!album.year_int || album.year_int < parseInt(yearMin))) return false;
      if (yearMax && (!album.year_int || album.year_int > parseInt(yearMax))) return false;
      if (priceMin && (!album.sale_price || album.sale_price < parseFloat(priceMin))) return false;
      if (priceMax && (!album.sale_price || album.sale_price > parseFloat(priceMax))) return false;
      if (tagCountMin) {
        const count = toSafeStringArray(album.custom_tags).length;
        if (count < parseInt(tagCountMin)) return false;
      }
      if (tagCountMax) {
        const count = toSafeStringArray(album.custom_tags).length;
        if (count > parseInt(tagCountMax)) return false;
      }
      if (sidesMin && (!album.sides || album.sides < parseInt(sidesMin))) return false;
      if (sidesMax && (!album.sides || album.sides > parseInt(sidesMax))) return false;
      
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
          return (b.sides || 0) - (a.sides || 0);
        case 'sides-asc':
          return (a.sides || 0) - (b.sides || 0);
        default:
          return 0;
      }
    });

  const getMatchInfo = (album: Album, query: string): string[] => {
    if (!query) return [];
    
    const q = query.toLowerCase();
    const matches: string[] = [];
    
    if (safeIncludes(album.artist, q)) matches.push(`Artist: ${album.artist}`);
    if (safeIncludes(album.title, q)) matches.push(`Title: ${album.title}`);
    if (safeIncludes(album.format, q)) matches.push(`Format: ${album.format}`);
    if (safeIncludes(album.folder, q)) matches.push(`Folder: ${album.folder}`);
    if (safeIncludes(album.year, q)) matches.push(`Year: ${album.year}`);
    if (safeIncludes(album.media_condition, q)) matches.push(`Condition: ${album.media_condition}`);
    
    if (album.tracklists && safeIncludes(album.tracklists, q)) {
      let foundTrack = false;
      try {
        const tracks = JSON.parse(album.tracklists);
        if (Array.isArray(tracks)) {
          const matchingTracks = tracks
            .filter(t => t && typeof t === 'object' && typeof t.title === 'string' && safeIncludes(t.title, q))
            .map(t => t.title)
            .slice(0, 2);
          if (matchingTracks.length > 0) {
            matches.push(`Track titles: ${matchingTracks.join(', ')}`);
            foundTrack = true;
          }
          
          if (!foundTrack) {
            for (const track of tracks) {
              if (!track || typeof track !== 'object') continue;
              
              for (const [key, value] of Object.entries(track)) {
                if (value && typeof value === 'string' && value.toLowerCase().includes(q)) {
                  const trackTitle = track.title || track.position || 'Unknown track';
                  matches.push(`🔍 Track "${trackTitle}" - field "${key}": ${value.substring(0, 100)}`);
                  foundTrack = true;
                  break;
                }
              }
              
              if (foundTrack) break;
            }
          }
        }
      } catch {
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
    
    if (safeIncludes(album.spotify_label, q)) matches.push(`Spotify Label: ${album.spotify_label}`);
    if (safeIncludes(album.apple_music_label, q)) matches.push(`Apple Music Label: ${album.apple_music_label}`);
    if (safeIncludes(album.apple_music_genre, q)) matches.push(`Apple Genre: ${album.apple_music_genre}`);
    
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
    
    if (safeIncludes(album.discogs_source, q)) matches.push(`Discogs metadata`);
    if (safeIncludes(album.blocked_sides, q)) matches.push(`Blocked: ${album.blocked_sides}`);
    if (safeIncludes(album.enrichment_sources, q)) matches.push(`Enrichment source`);
    if (safeIncludes(album.discogs_master_id, q)) matches.push(`Master ID: ${album.discogs_master_id}`);
    if (safeIncludes(album.discogs_release_id, q)) matches.push(`Release ID: ${album.discogs_release_id}`);
    if (safeIncludes(album.spotify_id, q)) matches.push(`Spotify ID`);
    if (safeIncludes(album.child_album_ids, q)) matches.push(`Child albums`);
    
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

  const clearAllFilters = () => {
    setSearchQuery('');
    // Reset search scopes to all on
    setSearchInArtist(true);
    setSearchInTitle(true);
    setSearchInTags(true);
    setSearchInTracks(true);
    setSearchInFormat(true);
    setSearchInNotes(true);
    setSearchInGenres(true);
    setSearchInStyles(true);
    setSearchInYear(true);
    setSearchInFolder(true);
    setSearchInCondition(true);
    setSearchInLabels(true);
    setSearchInPlatform(true);
    setSearchInIds(false);
    // Reset boolean filters
    setFilterForSale(false);
    setFilterNotForSale(false);
    setFilterHasTags(false);
    setFilterNoTags(false);
    setFilter1001(false);
    setFilterTop200(false);
    setFilterTop10(false);
    setFilterInnerCircle(false);
    setFilterBoxSet(false);
    setFilterBlocked(false);
    // Reset text filters
    setFilterFormat('');
    setFilterArtist('');
    setFilterTitle('');
    setFilterFolder('');
    setFilterCondition('');
    setFilterPlatform('');
    setFilterLabel('');
    setIncludeTag('');
    setExcludeTag('');
    // Reset numeric ranges
    setYearMin('');
    setYearMax('');
    setPriceMin('');
    setPriceMax('');
    setTagCountMin('');
    setTagCountMax('');
    setSidesMin('');
    setSidesMax('');
    // Reset sort
    setSortBy('artist-asc');
  };

  const activeFilterCount = [
    // Boolean filters
    filterForSale,
    filterNotForSale,
    filterHasTags,
    filterNoTags,
    filter1001,
    filterTop200,
    filterTop10,
    filterInnerCircle,
    filterBoxSet,
    filterBlocked,
    // Text filters
    filterFormat,
    filterArtist,
    filterTitle,
    filterFolder,
    filterCondition,
    filterPlatform,
    filterLabel,
    includeTag,
    excludeTag,
    // Numeric ranges
    yearMin,
    yearMax,
    priceMin,
    priceMax,
    tagCountMin,
    tagCountMax,
    sidesMin,
    sidesMax,
    // Search scope modifications
    !searchInArtist,
    !searchInTitle,
    !searchInTags,
    !searchInTracks,
    !searchInFormat,
    !searchInNotes,
    !searchInGenres,
    !searchInStyles,
    !searchInYear,
    !searchInFolder,
    !searchInCondition,
    !searchInLabels,
    !searchInPlatform,
    searchInIds // This one counts when ON (it's off by default)
  ].filter(Boolean).length;

  const exportResults = () => {
    const csv = [
      ['Artist', 'Title', 'Year', 'Format', 'Folder', 'Condition', 'Tags'].join(','),
      ...filteredAndSortedAlbums.map(album => [
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
    <>
      <style jsx global>{`
        .screen-only {
          display: block;
        }
        
        .print-only {
          display: none !important;
        }
        
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }
          
          body * {
            visibility: hidden;
          }
          
          .print-only,
          .print-only * {
            visibility: visible !important;
          }
          
          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }
          
          .screen-only {
            display: none !important;
          }
          
          nav,
          aside,
          header:not(.print-only *),
          .sidebar,
          .navigation,
          .admin-nav,
          [role="navigation"],
          [role="banner"] {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {/* Print-only content */}
      <div className="print-only">
        <div style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: '9pt',
          lineHeight: '1.2',
          color: '#000'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            paddingBottom: '6px',
            borderBottom: '2px solid #000'
          }}>
            <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: 0 }}>
              Collection Checklist
            </h1>
            <div style={{ fontSize: '10pt' }}>
              {new Date().toLocaleDateString()} • {filteredAndSortedAlbums.length} albums
            </div>
          </div>

          {(() => {
            const byFormat: Record<string, Album[]> = {};
            filteredAndSortedAlbums.forEach(album => {
              const fmt = album.format?.includes('LP') || album.format?.includes('Vinyl') || album.format?.includes('12"') || album.format?.includes('10"') || album.format?.includes('7"') 
                ? 'Vinyl' 
                : album.format?.includes('CD') 
                ? 'CDs' 
                : album.format?.includes('Cass') 
                ? 'Cassettes' 
                : 'Other';
              if (!byFormat[fmt]) byFormat[fmt] = [];
              byFormat[fmt].push(album);
            });

            const formatOrder = ['Vinyl', 'CDs', 'Cassettes', 'Other'];
            
            return formatOrder.filter(fmt => byFormat[fmt]).map(formatName => {
              const albums = byFormat[formatName].sort((a, b) => {
                const artistCmp = (a.artist || '').localeCompare(b.artist || '');
                if (artistCmp !== 0) return artistCmp;
                return (a.title || '').localeCompare(b.title || '');
              });

              const midpoint = Math.ceil(albums.length / 2);
              const leftColumn = albums.slice(0, midpoint);
              const rightColumn = albums.slice(midpoint);

              return (
                <div key={formatName} style={{ marginBottom: '16px', breakInside: 'avoid' }}>
                  <h2 style={{
                    fontSize: '13pt',
                    fontWeight: 'bold',
                    margin: '0 0 8px 0',
                    padding: '3px 0',
                    borderBottom: '1.5px solid #000'
                  }}>
                    {formatName} ({albums.length})
                  </h2>
                  
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '9pt'
                  }}>
                    <tbody>
                      {Array.from({ length: Math.max(leftColumn.length, rightColumn.length) }).map((_, idx) => {
                        const leftAlbum = leftColumn[idx];
                        const rightAlbum = rightColumn[idx];
                        
                        const truncate = (str: string, max: number) => 
                          str.length > max ? str.substring(0, max) + '…' : str;

                        return (
                          <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                            <td style={{ 
                              padding: '2px 10px 2px 0',
                              width: '50%',
                              verticalAlign: 'top',
                              lineHeight: '1.3'
                            }}>
                              {leftAlbum && (
                                <span>
                                  <span style={{ marginRight: '6px' }}>☐</span>
                                  <strong>{truncate(leftAlbum.artist || 'Unknown', 28)}</strong>
                                  {' - '}
                                  {truncate(leftAlbum.title || 'Untitled', 32)}
                                </span>
                              )}
                            </td>
                            <td style={{ 
                              padding: '2px 0 2px 10px',
                              width: '50%',
                              verticalAlign: 'top',
                              lineHeight: '1.3'
                            }}>
                              {rightAlbum && (
                                <span>
                                  <span style={{ marginRight: '6px' }}>☐</span>
                                  <strong>{truncate(rightAlbum.artist || 'Unknown', 28)}</strong>
                                  {' - '}
                                  {truncate(rightAlbum.title || 'Untitled', 32)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Screen-only content */}
      <div className="screen-only" style={{
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
              Your daily collection browser - {filteredAndSortedAlbums.length} of {albums.length} albums
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

        {/* Search and filters */}
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Main search bar */}
          <div style={{ marginBottom: 16 }}>
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
              placeholder="Search your collection..."
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
          </div>

          {/* Search scope checkboxes - what to INCLUDE */}
          <details open style={{ marginBottom: 16 }}>
            <summary style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#374151',
              marginBottom: 8,
              cursor: 'pointer',
              userSelect: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              🔍 Search In (check fields to search)
            </summary>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 6,
              padding: '12px',
              background: '#f9fafb',
              borderRadius: 6,
              border: '1px solid #e5e7eb'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInArtist} onChange={e => setSearchInArtist(e.target.checked)} style={{ width: 14, height: 14 }} />
                Artist
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInTitle} onChange={e => setSearchInTitle(e.target.checked)} style={{ width: 14, height: 14 }} />
                Title
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInTags} onChange={e => setSearchInTags(e.target.checked)} style={{ width: 14, height: 14 }} />
                Tags
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInTracks} onChange={e => setSearchInTracks(e.target.checked)} style={{ width: 14, height: 14 }} />
                Tracks/Lyrics
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInFormat} onChange={e => setSearchInFormat(e.target.checked)} style={{ width: 14, height: 14 }} />
                Format
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInNotes} onChange={e => setSearchInNotes(e.target.checked)} style={{ width: 14, height: 14 }} />
                Notes
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInGenres} onChange={e => setSearchInGenres(e.target.checked)} style={{ width: 14, height: 14 }} />
                Genres
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInStyles} onChange={e => setSearchInStyles(e.target.checked)} style={{ width: 14, height: 14 }} />
                Styles
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInLabels} onChange={e => setSearchInLabels(e.target.checked)} style={{ width: 14, height: 14 }} />
                Labels
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInYear} onChange={e => setSearchInYear(e.target.checked)} style={{ width: 14, height: 14 }} />
                Year
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInFolder} onChange={e => setSearchInFolder(e.target.checked)} style={{ width: 14, height: 14 }} />
                Folder
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInCondition} onChange={e => setSearchInCondition(e.target.checked)} style={{ width: 14, height: 14 }} />
                Condition
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={searchInPlatform} onChange={e => setSearchInPlatform(e.target.checked)} style={{ width: 14, height: 14 }} />
                Platform
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#6b7280' }} title="Search Discogs, Spotify, Apple Music IDs">
                <input type="checkbox" checked={searchInIds} onChange={e => setSearchInIds(e.target.checked)} style={{ width: 14, height: 14 }} />
                IDs (advanced)
              </label>
            </div>
          </details>

          {/* Sort and filter controls */}
          <div style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            marginBottom: 16
          }}>
            <div style={{ flex: '1 1 250px' }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#374151',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                📊 SORT BY:
              </label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  backgroundColor: 'white',
                  color: '#1f2937',
                  fontWeight: 500
                }}
              >
                {Object.entries(
                  SORT_OPTIONS.reduce((acc, opt) => {
                    if (!acc[opt.category]) acc[opt.category] = [];
                    acc[opt.category].push(opt);
                    return acc;
                  }, {} as Record<string, typeof SORT_OPTIONS>)
                ).map(([category, opts]) => (
                  <optgroup key={category} label={category}>
                    {opts.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div style={{ flex: '0 0 auto', paddingTop: 22 }}>
              <button
                onClick={() => setShowFilters(!showFilters)}
                style={{
                  padding: '8px 16px',
                  background: showFilters ? '#3b82f6' : '#f3f4f6',
                  color: showFilters ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                🎯 Advanced Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </button>
            </div>

            {(searchQuery || activeFilterCount > 0 || sortBy !== 'artist-asc') && (
              <div style={{ flex: '0 0 auto', paddingTop: 22 }}>
                <button
                  onClick={clearAllFilters}
                  style={{
                    padding: '8px 16px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ✕ Clear All
                </button>
              </div>
            )}
          </div>

          {/* Comprehensive filters panel */}
          {showFilters && (
            <div style={{
              padding: 16,
              background: '#f9fafb',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              marginBottom: 16
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                
                {/* Boolean Badges Section */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🏆 BADGES
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filter1001} onChange={e => setFilter1001(e.target.checked)} style={{ width: 15, height: 15 }} />
                      1001 Albums
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filterTop200} onChange={e => setFilterTop200(e.target.checked)} style={{ width: 15, height: 15 }} />
                      Steve&apos;s Top 200
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filterTop10} onChange={e => setFilterTop10(e.target.checked)} style={{ width: 15, height: 15 }} />
                      This Week&apos;s Top 10
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filterInnerCircle} onChange={e => setFilterInnerCircle(e.target.checked)} style={{ width: 15, height: 15 }} />
                      Inner Circle
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filterBoxSet} onChange={e => setFilterBoxSet(e.target.checked)} style={{ width: 15, height: 15 }} />
                      Box Set
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filterBlocked} onChange={e => setFilterBlocked(e.target.checked)} style={{ width: 15, height: 15 }} />
                      Blocked
                    </label>
                  </div>
                </div>

                {/* Sale & Tags Section */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    💰 SALE & TAGS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filterForSale} onChange={e => setFilterForSale(e.target.checked)} style={{ width: 15, height: 15 }} />
                      For Sale
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filterNotForSale} onChange={e => setFilterNotForSale(e.target.checked)} style={{ width: 15, height: 15 }} />
                      NOT For Sale
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filterHasTags} onChange={e => setFilterHasTags(e.target.checked)} style={{ width: 15, height: 15 }} />
                      Has Tags
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={filterNoTags} onChange={e => setFilterNoTags(e.target.checked)} style={{ width: 15, height: 15 }} />
                      No Tags
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      type="text"
                      value={includeTag}
                      onChange={e => setIncludeTag(e.target.value)}
                      placeholder="Must have tag..."
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={excludeTag}
                      onChange={e => setExcludeTag(e.target.value)}
                      placeholder="Exclude tag..."
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                    />
                  </div>
                </div>

                {/* Text Filters Section */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📝 TEXT FILTERS (contains)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      type="text"
                      value={filterArtist}
                      onChange={e => setFilterArtist(e.target.value)}
                      placeholder="Artist contains..."
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={filterTitle}
                      onChange={e => setFilterTitle(e.target.value)}
                      placeholder="Title contains..."
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={filterFormat}
                      onChange={e => setFilterFormat(e.target.value)}
                      placeholder="Format contains (LP, CD...)"
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={filterFolder}
                      onChange={e => setFilterFolder(e.target.value)}
                      placeholder="Folder contains..."
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={filterCondition}
                      onChange={e => setFilterCondition(e.target.value)}
                      placeholder="Condition (VG+, M, NM...)"
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={filterPlatform}
                      onChange={e => setFilterPlatform(e.target.value)}
                      placeholder="Platform (Discogs, eBay...)"
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={filterLabel}
                      onChange={e => setFilterLabel(e.target.value)}
                      placeholder="Label contains..."
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                    />
                  </div>
                </div>

                {/* Numeric Ranges Section */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🔢 NUMERIC RANGES
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Year:</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          value={yearMin}
                          onChange={e => setYearMin(e.target.value)}
                          placeholder="Min"
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                        />
                        <input
                          type="number"
                          value={yearMax}
                          onChange={e => setYearMax(e.target.value)}
                          placeholder="Max"
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Price ($):</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          value={priceMin}
                          onChange={e => setPriceMin(e.target.value)}
                          placeholder="Min"
                          step="0.01"
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                        />
                        <input
                          type="number"
                          value={priceMax}
                          onChange={e => setPriceMax(e.target.value)}
                          placeholder="Max"
                          step="0.01"
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Tag Count:</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          value={tagCountMin}
                          onChange={e => setTagCountMin(e.target.value)}
                          placeholder="Min"
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                        />
                        <input
                          type="number"
                          value={tagCountMax}
                          onChange={e => setTagCountMax(e.target.value)}
                          placeholder="Max"
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Sides:</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          value={sidesMin}
                          onChange={e => setSidesMin(e.target.value)}
                          placeholder="Min"
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                        />
                        <input
                          type="number"
                          value={sidesMax}
                          onChange={e => setSidesMax(e.target.value)}
                          placeholder="Max"
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results summary */}
          {(searchQuery || activeFilterCount > 0) && (
            <div style={{
              marginTop: 16,
              fontSize: 13,
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 16,
              borderTop: '1px solid #e5e7eb'
            }}>
              <span>
                Found <strong style={{ color: '#1f2937' }}>{filteredAndSortedAlbums.length}</strong> of {albums.length} albums
              </span>
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
                  🖨️ Print Checklist
                </button>
              </div>
            </div>
          )}
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
            {filteredAndSortedAlbums.map(album => {
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
    </>
  );
}
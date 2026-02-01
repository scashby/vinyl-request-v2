// src/app/browse/browse-albums/page.tsx
"use client";

import { Suspense } from 'react';
import { useEffect, useState, useMemo } from 'react';
import AlbumCard from 'components/AlbumCard';
import AlbumSuggestionBox from 'components/AlbumSuggestionBox';
import { supabase } from 'src/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import { formatEventText } from 'src/utils/textFormatter';
import type { Database } from 'src/types/supabase';

interface BrowseAlbum {
  id: number;
  title: string;
  artist: string;
  year: string | number;
  format: string;           // Replaces 'folder' for media type
  location?: string;
  dateAdded?: string;
  justAdded?: boolean;
  
  // Cleaned up obsolete boolean flags (1001, Steve's, etc.)
  
  // Metadata for search
  personal_notes?: string;  // Replaces 'notes'
  release_notes?: string;
  media_condition?: string;
  genres?: string[];        // Replaces separate genre arrays
  styles?: string[];
  custom_tags?: string[];
  
  image: string;
}

type InventoryRow = Database['public']['Tables']['inventory']['Row'];
type ReleaseRow = Database['public']['Tables']['releases']['Row'];
type MasterRow = Database['public']['Tables']['masters']['Row'];
type ArtistRow = Database['public']['Tables']['artists']['Row'];

type MasterTagLinkRow = {
  master_tags?: { name: string | null } | null;
};

type InventoryQueryRow = InventoryRow & {
  release?: (ReleaseRow & {
    master?: (MasterRow & {
      artist?: ArtistRow | null;
      master_tag_links?: MasterTagLinkRow[] | null;
    }) | null;
  }) | null;
};

function BrowseAlbumsContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const allowedFormatsParam = searchParams.get('allowedFormats');
  const eventTitleParam = searchParams.get('eventTitle');

  const [albums, setAlbums] = useState<BrowseAlbum[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allowedFormats, setAllowedFormats] = useState<string[] | null>(null);
  const [allowedTags, setAllowedTags] = useState<string[] | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');
  const [sortField, setSortField] = useState('date_added');
  const [sortAsc, setSortAsc] = useState(false);
  
  // Only "Just Added" remains as a dynamic filter
  const [showJustAdded, setShowJustAdded] = useState(false);
  
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper function to check if album was added in last 2 weeks
  const isJustAdded = (dateAdded?: string) => {
    if (!dateAdded) return false;
    const addedDate = new Date(dateAdded);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    return addedDate >= twoWeeksAgo;
  };

  // Helper function to format date
  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === '9999-12-31') return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const buildFormatLabel = (release?: ReleaseRow | null) => {
    if (!release) return '';
    const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
    const base = parts.join(', ');
    const qty = release.qty ?? 1;
    if (!base) return '';
    return qty > 1 ? `${qty}x${base}` : base;
  };

  const extractTagNames = (links?: MasterTagLinkRow[] | null) => {
    if (!links) return [];
    return links
      .map((link) => link.master_tags?.name)
      .filter((name): name is string => Boolean(name));
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchEventDataIfNeeded() {
      if (eventId) {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, date, allowed_formats, allowed_tags')
          .eq('id', eventId)
          .single();
        if (!error && data && isMounted) {
          setAllowedFormats(data.allowed_formats || []);
          setAllowedTags(data.allowed_tags || []);
          setEventTitle(data.title || '');
          setEventDate(data.date || '');
        } else if (isMounted) {
          setAllowedFormats(null);
          setAllowedTags(null);
          setEventTitle('');
          setEventDate('');
        }
      } else if (allowedFormatsParam && eventTitleParam) {
        setAllowedFormats(allowedFormatsParam.split(',').map(f => f.trim()));
        setAllowedTags(null);
        setEventTitle(eventTitleParam);
        setEventDate('');
      } else {
        setAllowedFormats(null);
        setAllowedTags(null);
        setEventTitle('');
        setEventDate('');
      }
    }
    fetchEventDataIfNeeded();
    return () => { isMounted = false; };
  }, [eventId, allowedFormatsParam, eventTitleParam]);

  useEffect(() => {
    let isMounted = true;

    async function fetchAllAlbums() {
      setLoading(true);

      try {
        let allRows: InventoryQueryRow[] = [];
        let from = 0;
        const batchSize = 1000;
        let keepGoing = true;
        
        while (keepGoing && isMounted) {
            const { data: batch, error } = await supabase
              .from('inventory')
              .select(`
                id,
                location,
                media_condition,
                date_added,
                personal_notes,
                status,
                release:releases (
                  id,
                  media_type,
                  format_details,
                  qty,
                  notes,
                  master:masters (
                    title,
                    original_release_year,
                    cover_image_url,
                    genres,
                    styles,
                    artist:artists (
                      name
                    ),
                    master_tag_links (
                      master_tags (
                        name
                      )
                    )
                  )
                )
              `)
              .neq('status', 'sold')
              .range(from, from + batchSize - 1);

            if (error) {
                console.error('Error fetching albums:', error);
                break;
            }
            if (!batch || batch.length === 0) break;
            
            allRows = allRows.concat(batch);
            
            if (batch.length < batchSize) {
                keepGoing = false;
            } else {
                from += batchSize;
            }
        }
        
        if (!isMounted) return;

        const parsed: BrowseAlbum[] = allRows.map((album) => {
          const release = album.release ?? null;
          const master = release?.master ?? null;
          const artist = master?.artist?.name ?? 'Unknown Artist';
          const image = master?.cover_image_url?.trim();
          const formatLabel = buildFormatLabel(release);
          const tagNames = extractTagNames(master?.master_tag_links ?? null);

          return {
            id: album.id,
            title: master?.title ?? 'Untitled',
            artist,
            year: master?.original_release_year ? String(master.original_release_year) : '',
            format: formatLabel,
            location: album.location ?? undefined,
            dateAdded: album.date_added ?? undefined,
            justAdded: isJustAdded(album.date_added ?? undefined),
            personal_notes: album.personal_notes ?? undefined,
            release_notes: release?.notes ?? undefined,
            media_condition: album.media_condition ?? undefined,
            genres: master?.genres ?? [],
            styles: master?.styles ?? [],
            custom_tags: tagNames,
            image:
              image && image.toLowerCase() !== 'no'
                ? image
                : '/images/coverplaceholder.png'
          };
        });
        
        setAlbums(parsed);
      } catch (err) {
        console.error("Error loading albums:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    fetchAllAlbums();
    
    return () => { isMounted = false; };
  }, []);

  const splitFormatTokens = (format: string) => {
    if (!format) return [];
    return format
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^(\d+)x\s*(.+)$/i);
        return (match ? match[2] : part).trim().toLowerCase();
      });
  };

  const formatFilterAliases: Record<string, string> = {
    vinyl: 'vinyl',
    lp: 'vinyl',
    lps: 'vinyl',
    ep: 'vinyl',
    eps: 'vinyl',
    cassettes: 'cassette',
    cassette: 'cassette',
    cass: 'cassette',
    cd: 'cd',
    cds: 'cd',
    'compact disc': 'cd',
    '8-track': '8-track',
    '8 track': '8-track',
    '8tracks': '8-track',
    '8-track tape': '8-track',
    '45': '45s',
    '45s': '45s',
    '7"': '45s',
    '7-inch': '45s',
    '7 inch': '45s',
    single: '45s',
    singles: '45s',
    all: 'all',
    'all media': 'all',
  };

  const normalizeFormatFilter = (format: string) => {
    const key = format.trim().toLowerCase();
    return formatFilterAliases[key] ?? key;
  };

  const getFormatData = (format: string) => {
    const tokens = splitFormatTokens(format);
    const hasToken = (values: string[]) => values.some((value) => tokens.includes(value));

    const vinylTokens = ['vinyl', 'lp', 'ep', '12"', '10"', 'maxi-single', 'mini-album'];
    const cassetteTokens = ['cassette', 'cassettes', 'cass'];
    const cdTokens = ['cd', 'cds', 'compact disc'];
    const eightTrackTokens = ['8-track', '8 track', '8tracks', '8-track tape'];
    const fortyFiveTokens = ['45', '45s', '7"', '7-inch', '7 inch'];

    const hasVinyl = hasToken(vinylTokens);
    const hasCassette = hasToken(cassetteTokens);
    const hasCd = hasToken(cdTokens);
    const has8Track = hasToken(eightTrackTokens);
    const hasSingle = tokens.includes('single') || tokens.includes('singles');
    const has45 = hasToken(fortyFiveTokens);

    const categories = new Set<string>();
    if (hasVinyl) categories.add('vinyl');
    if (hasCassette) categories.add('cassette');
    if (hasCd) categories.add('cd');
    if (has8Track) categories.add('8-track');
    if (has45 || (hasSingle && !hasCd && !hasCassette && !has8Track)) categories.add('45s');

    return { tokens, categories };
  };

  const normalizedFormats = useMemo(() => (
    allowedFormats ? allowedFormats.map(normalizeFormatFilter) : null
  ), [allowedFormats]);

  const normalizedAllowedTags = useMemo(() => (
    allowedTags ? allowedTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean) : null
  ), [allowedTags]);

  const normalizedDropdown = allowedFormats?.length && allowedFormats.length > 0
    ? allowedFormats.map(f => f.trim())
    : ['Vinyl', 'Cassettes', 'CD', '45s', '8-Track'];

  const dropdownOptions = normalizedDropdown.map((format) => ({
    label: format,
    value: normalizeFormatFilter(format),
  }));

  const filteredAlbums = useMemo(() => {
    let fa = albums.filter(album => {
      // Use 'format' for media type filtering
      const { tokens: formatTokens, categories: formatCategories } = getFormatData(album.format || '');
      
      const searchLower = searchTerm.toLowerCase();

      const searchInArray = (arr?: string[]) => {
        if (!Array.isArray(arr)) return false;
        return arr.some(item => (item || '').toLowerCase().includes(searchLower));
      };

      const matchesSearch =
        (album.title || '').toLowerCase().includes(searchLower) ||
        (album.artist || '').toLowerCase().includes(searchLower) ||
        (album.media_condition || '').toLowerCase().includes(searchLower) ||
        (album.personal_notes || '').toLowerCase().includes(searchLower) ||
        (album.release_notes || '').toLowerCase().includes(searchLower) ||
        searchInArray(album.genres) ||
        searchInArray(album.styles) ||
        searchInArray(album.custom_tags);
      
      const isAllowed =
        !normalizedFormats ||
        normalizedFormats.includes('all') ||
        normalizedFormats.some((format) => formatCategories.has(format) || formatTokens.includes(format));
        
      const matchesFilter =
        !mediaFilter ||
        formatCategories.has(mediaFilter) ||
        formatTokens.includes(mediaFilter);

      const matchesAllowedTags =
        !normalizedAllowedTags ||
        normalizedAllowedTags.length === 0 ||
        normalizedAllowedTags.some((tag) => (album.custom_tags || []).some((value) => value.toLowerCase() === tag));
        
      const matchesJustAdded =
        !showJustAdded || album.justAdded;
        
      return matchesSearch && isAllowed && matchesFilter && matchesAllowedTags && matchesJustAdded;
    });
    
    fa = [...fa].sort((a: BrowseAlbum, b: BrowseAlbum) => {
      let va, vb;
      
      if (sortField === 'date_added') {
        va = new Date(a.dateAdded || '1970-01-01');
        vb = new Date(b.dateAdded || '1970-01-01');
        return sortAsc ? va.getTime() - vb.getTime() : vb.getTime() - va.getTime();
      } else {
        va = (a[sortField as keyof BrowseAlbum] || '').toString().toLowerCase();
        vb = (b[sortField as keyof BrowseAlbum] || '').toString().toLowerCase();
        if (va > vb) return sortAsc ? 1 : -1;
        if (va < vb) return sortAsc ? -1 : 1;
        return 0;
      }
    });
    
    return fa;
  }, [albums, searchTerm, mediaFilter, allowedFormats, allowedTags, normalizedFormats, normalizedAllowedTags, sortField, sortAsc, showJustAdded]);

  const justAddedCount = albums.filter(album => album.justAdded).length;
  const hasSearchQuery = searchTerm.trim().length > 0;
  const hasNoResults = hasSearchQuery && filteredAlbums.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="relative w-full h-[300px] flex items-center justify-center bg-gray-900 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: "url('/images/event-header-still.jpg')" }}
        />
        <div className="relative z-10 px-8 py-6 bg-black/40 rounded-xl backdrop-blur-sm text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white font-serif-display drop-shadow-lg">
            Browse the Collection{eventTitle ? (
              <span className="block text-2xl md:text-3xl mt-2 font-normal">
                {' '}for <span dangerouslySetInnerHTML={{ __html: formatEventText(eventTitle) }} />
                {eventDate && eventDate !== '9999-12-31' && (
                  <span className="block text-lg mt-2 opacity-90 font-sans">
                    {formatDate(eventDate)}
                  </span>
                )}
              </span>
            ) : ''}
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-xl text-gray-600 font-semibold animate-pulse">Loading albums...</div>
            <div className="text-sm text-gray-400 mt-2">Fetching collection data</div>
          </div>
        ) : (
          <>
            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
              <input
                type="text"
                placeholder="Search by artist, title, or notes"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:flex-[2] p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />

              <select
                value={mediaFilter}
                onChange={(e) => setMediaFilter(e.target.value)}
                className="w-full md:flex-1 p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Media Types</option>
                {dropdownOptions.map((format) => (
                  <option key={format.label} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>

              <select 
                value={sortField} 
                onChange={e => setSortField(e.target.value)}
                className="w-full md:w-40 p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="artist">Artist</option>
                <option value="date_added">Date Added</option>
                <option value="title">Title</option>
                <option value="year">Year</option>
              </select>

              <button
                onClick={() => setSortAsc(a => !a)}
                className="w-full md:w-auto px-4 py-2.5 bg-gray-100 text-blue-600 font-semibold rounded-lg hover:bg-gray-200 border border-gray-200 transition-colors whitespace-nowrap"
              >
                Sort: {sortAsc ? 'A→Z' : 'Z→A'}
              </button>

              {!hasNoResults && !showSuggestionBox && (
                <button
                  onClick={() => setShowSuggestionBox(true)}
                  className="w-full md:w-auto px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm"
                >
                  💡 Suggest Album
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center mb-6 w-full">
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold cursor-pointer transition-all ${
                justAddedCount > 0 
                  ? "bg-green-50 border-green-500 text-green-700 hover:bg-green-100" 
                  : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed opacity-60"
              }`}>
                <input
                  type="checkbox"
                  checked={showJustAdded}
                  onChange={(e) => setShowJustAdded(e.target.checked)}
                  disabled={justAddedCount === 0}
                  className="accent-green-600 w-4 h-4"
                />
                {justAddedCount > 0 && <span className="animate-pulse">✨</span>} Just Added ({justAddedCount})
              </label>
            </div>

            <div className="text-gray-500 text-sm mb-6 px-1">
              {hasSearchQuery ? (
                <>Showing {filteredAlbums.length} results for &ldquo;{searchTerm}&rdquo;</>
              ) : (
                <>Showing {filteredAlbums.length} albums</>
              )}
            </div>

            {(hasNoResults || showSuggestionBox) && (
              <div className="mb-8">
                <AlbumSuggestionBox 
                  context={hasNoResults ? "search" : "general"}
                  searchQuery={hasNoResults ? searchTerm : ''}
                  eventId={eventId}
                  eventTitle={eventTitle}
                  onClose={() => setShowSuggestionBox(false)}
                />
              </div>
            )}

            <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {filteredAlbums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={{
                    ...album,
                    eventId: eventId,
                    mediaType: album.format, // Pass format correctly for badge
                    justAdded: album.justAdded
                  }}
                />
              ))}
            </section>

            {filteredAlbums.length === 0 && !hasSearchQuery && (
              <div className="text-center py-16 text-gray-500">
                <div className="text-5xl mb-4">🎵</div>
                <p className="text-lg">No albums match your current filters.</p>
                <p className="text-sm mt-2">Try adjusting your filters or suggest new albums!</p>
              </div>
            )}

            {hasNoResults && (
              <div className="text-center py-12 px-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 my-8">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No albums found</h3>
                <p className="text-gray-600 mb-4">
                  No albums match your search for &ldquo;<strong>{searchTerm}</strong>&rdquo;
                </p>
                <p className="text-sm text-gray-500">
                  The album suggestion form above can help you request this album for the collection.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BrowseAlbumsContent />
    </Suspense>
  );
}

// Fixed Browse Albums page with compact search controls and all filter options
// Excludes "Sales" folder items from the collection
// Replace: src/app/browse/browse-albums/page.js

"use client";

import { Suspense } from 'react';
import { useEffect, useState, useMemo } from 'react';
import AlbumCard from 'components/AlbumCard';
import AlbumSuggestionBox from 'components/AlbumSuggestionBox';
import { supabase } from 'src/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import { formatEventText } from 'src/utils/textFormatter';

interface BrowseAlbum {
  id: number;
  title: string;
  artist: string;
  year?: string;
  folder?: string;
  mediaType?: string;
  dateAdded?: string;
  justAdded?: boolean;
  steves_top_200?: boolean;
  this_weeks_top_10?: boolean;
  inner_circle_preferred?: boolean;
  is_1001?: boolean;
  tracklists?: string;
  media_condition?: string;
  discogs_notes?: string;
  discogs_genres?: string[];
  discogs_styles?: string[];
  spotify_genres?: string[];
  spotify_label?: string;
  apple_music_genre?: string;
  apple_music_genres?: string[];
  apple_music_label?: string;
  image: string;
}

function BrowseAlbumsContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const allowedFormatsParam = searchParams.get('allowedFormats');
  const eventTitleParam = searchParams.get('eventTitle');

  const [albums, setAlbums] = useState<BrowseAlbum[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allowedFormats, setAllowedFormats] = useState<string[] | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');
  const [sortField, setSortField] = useState('date_added');
  const [sortAsc, setSortAsc] = useState(false);
  const [showJustAdded, setShowJustAdded] = useState(false);
  const [showStevesTop200, setShowStevesTop200] = useState(false);
  const [showThisWeeksTop10, setShowThisWeeksTop10] = useState(false);
  const [showInnerCirclePreferred, setShowInnerCirclePreferred] = useState(false);
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
    // Append T00:00:00 to force local time interpretation instead of UTC
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchEventDataIfNeeded() {
      if (eventId) {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, date, allowed_formats')
          .eq('id', eventId)
          .single();
        if (!error && data && isMounted) {
          setAllowedFormats(data.allowed_formats || []);
          setEventTitle(data.title || '');
          setEventDate(data.date || '');
        } else if (isMounted) {
          setAllowedFormats(null);
          setEventTitle('');
          setEventDate('');
        }
      } else if (allowedFormatsParam && eventTitleParam) {
        setAllowedFormats(allowedFormatsParam.split(',').map(f => f.trim()));
        setEventTitle(eventTitleParam);
        setEventDate('');
      } else {
        setAllowedFormats(null);
        setEventTitle('');
        setEventDate('');
      }
    }
    fetchEventDataIfNeeded();
    return () => { isMounted = false; };
  }, [eventId, allowedFormatsParam, eventTitleParam]);

  useEffect(() => {
    async function fetchAllAlbums() {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let allRows: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let keepGoing = true;
      
      while (keepGoing) {
        const { data: batch, error } = await supabase
          .from('collection')
          .select('*')
          .or('blocked.is.null,blocked.eq.false')
          .neq('folder', 'Sale')
          .range(from, from + batchSize - 1);
          
        if (error) {
          console.error('Error fetching albums:', error);
          break;
        }
        if (!batch || batch.length === 0) break;
        
        allRows = allRows.concat(batch);
        keepGoing = batch.length === batchSize;
        from += batchSize;
      }
      
      const parsed: BrowseAlbum[] = allRows.map(album => ({
        id: album.id,
        title: album.title,
        artist: album.artist,
        year: album.year,
        folder: album.folder,
        mediaType: album.folder,
        dateAdded: album.date_added,
        justAdded: isJustAdded(album.date_added),
        steves_top_200: album.steves_top_200,
        this_weeks_top_10: album.this_weeks_top_10,
        inner_circle_preferred: album.inner_circle_preferred,
        is_1001: album.is_1001,
        tracklists: album.tracklists,
        media_condition: album.media_condition,
        discogs_notes: album.discogs_notes,
        discogs_genres: album.discogs_genres,
        discogs_styles: album.discogs_styles,
        spotify_genres: album.spotify_genres,
        spotify_label: album.spotify_label,
        apple_music_genre: album.apple_music_genre,
        apple_music_genres: album.apple_music_genres,
        apple_music_label: album.apple_music_label,
        image:
          (album.image_url && album.image_url.trim().toLowerCase() !== 'no')
            ? album.image_url.trim()
            : '/images/coverplaceholder.png'
      }));
      
      setAlbums(parsed);
      setLoading(false);
    }
    
    fetchAllAlbums();
  }, []);

  const formatVariants = (format: string) => {
    const f = format.trim().toLowerCase();
    if (f === "cd" || f === "cds") return ["cd", "cds"];
    if (f === "cassette" || f === "cassettes") return ["cassette", "cassettes"];
    if (f === "45" || f === "45s") return ["45", "45s"];
    if (f === "8-track" || f === "8tracks" || f === "8-track tape" || f === "8 track") return ["8-track", "8tracks", "8-track tape", "8 track"];
    if (f === "vinyl") return ["vinyl"];
    return [f];
  };

  const normalizedFormats = useMemo(() => (
    allowedFormats ? allowedFormats.flatMap(formatVariants) : []
  ), [allowedFormats]);

  const normalizedDropdown = allowedFormats?.length && allowedFormats.length > 0
    ? allowedFormats.map(f => f.trim())
    : ['Vinyl', 'Cassettes', 'CD', '45s', '8-Track'];

  const filteredAlbums = useMemo(() => {
    let fa = albums.filter(album => {
      const folder = (album.folder || '').trim().toLowerCase();
      
      const searchLower = searchTerm.toLowerCase();

      const searchInArray = (arr?: string[]) => {
        if (!Array.isArray(arr)) return false;
        return arr.some(item => (item || '').toLowerCase().includes(searchLower));
      };

      const matchesSearch =
        (album.title || '').toLowerCase().includes(searchLower) ||
        (album.artist || '').toLowerCase().includes(searchLower) ||
        (album.tracklists || '').toLowerCase().includes(searchLower) ||
        (album.media_condition || '').toLowerCase().includes(searchLower) ||
        (album.discogs_notes || '').toLowerCase().includes(searchLower) ||
        (album.spotify_label || '').toLowerCase().includes(searchLower) ||
        (album.apple_music_genre || '').toLowerCase().includes(searchLower) ||
        (album.apple_music_label || '').toLowerCase().includes(searchLower) ||
        searchInArray(album.discogs_genres) ||
        searchInArray(album.discogs_styles) ||
        searchInArray(album.spotify_genres) ||
        searchInArray(album.apple_music_genres);
      
      const isAllowed =
        !allowedFormats ||
        normalizedFormats.includes(folder);
      const matchesFilter =
        !mediaFilter ||
        formatVariants(mediaFilter).includes(folder);
      const matchesJustAdded =
        !showJustAdded || album.justAdded;
      const matchesStevesTop200 =
        !showStevesTop200 || album.steves_top_200;
      const matchesThisWeeksTop10 =
        !showThisWeeksTop10 || album.this_weeks_top_10;
      const matchesInnerCirclePreferred =
        !showInnerCirclePreferred || album.inner_circle_preferred;
        
      return matchesSearch && isAllowed && matchesFilter && matchesJustAdded && 
             matchesStevesTop200 && matchesThisWeeksTop10 && matchesInnerCirclePreferred;
    });
    
    fa = [...fa].sort((a: BrowseAlbum, b: BrowseAlbum) => {
      let va, vb;
      
      if (sortField === 'date_added') {
        va = new Date(a.dateAdded || '1970-01-01');
        vb = new Date(b.dateAdded || '1970-01-01');
        return sortAsc ? va.getTime() - vb.getTime() : vb.getTime() - va.getTime();
      } else {
        va = (a[sortField] || '').toString().toLowerCase();
        vb = (b[sortField] || '').toString().toLowerCase();
        if (va > vb) return sortAsc ? 1 : -1;
        if (va < vb) return sortAsc ? -1 : 1;
        return 0;
      }
    });
    
    return fa;
  }, [albums, searchTerm, mediaFilter, allowedFormats, normalizedFormats, sortField, sortAsc, 
      showJustAdded, showStevesTop200, showThisWeeksTop10, showInnerCirclePreferred]);

  const justAddedCount = albums.filter(album => album.justAdded).length;
  const stevesTop200Count = albums.filter(album => album.steves_top_200).length;
  const thisWeeksTop10Count = albums.filter(album => album.this_weeks_top_10).length;
  const innerCirclePreferredCount = albums.filter(album => album.inner_circle_preferred).length;

  const hasSearchQuery = searchTerm.trim().length > 0;
  const hasNoResults = hasSearchQuery && filteredAlbums.length === 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600 font-semibold animate-pulse">Loading albums...</div>
      </div>
    );
  }

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
        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
          <input
            type="text"
            placeholder="Search by artist or title"
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
            {normalizedDropdown.map((format) => (
              <option key={format} value={format.trim().toLowerCase()}>
                {format}
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

          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold cursor-pointer transition-all ${
            stevesTop200Count > 0 
              ? "bg-red-50 border-red-500 text-red-700 hover:bg-red-100" 
              : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed opacity-60"
          }`}>
            <input
              type="checkbox"
              checked={showStevesTop200}
              onChange={(e) => setShowStevesTop200(e.target.checked)}
              disabled={stevesTop200Count === 0}
              className="accent-red-600 w-4 h-4"
            />
            🏆 Steve&apos;s Top 200 ({stevesTop200Count})
          </label>

          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold cursor-pointer transition-all ${
            thisWeeksTop10Count > 0 
              ? "bg-purple-50 border-purple-500 text-purple-700 hover:bg-purple-100" 
              : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed opacity-60"
          }`}>
            <input
              type="checkbox"
              checked={showThisWeeksTop10}
              onChange={(e) => setShowThisWeeksTop10(e.target.checked)}
              disabled={thisWeeksTop10Count === 0}
              className="accent-purple-600 w-4 h-4"
            />
            📈 This Week&apos;s Top 10 ({thisWeeksTop10Count})
          </label>

          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold cursor-pointer transition-all ${
            innerCirclePreferredCount > 0 
              ? "bg-orange-50 border-orange-500 text-orange-700 hover:bg-orange-100" 
              : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed opacity-60"
          }`}>
            <input
              type="checkbox"
              checked={showInnerCirclePreferred}
              onChange={(e) => setShowInnerCirclePreferred(e.target.checked)}
              disabled={innerCirclePreferredCount === 0}
              className="accent-orange-600 w-4 h-4"
            />
            ⭐ Inner Circle Preferred ({innerCirclePreferredCount})
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
// Updated Browse Albums page with Album Suggestion Component
// Replace: src/app/browse/browse-albums/page.js

"use client";

import { Suspense } from 'react';
import { useEffect, useState, useMemo } from 'react';
import AlbumCard from 'components/AlbumCard';
import AlbumSuggestionBox from 'components/AlbumSuggestionBox';
import 'styles/album-browse.css';
import 'styles/internal.css';
import { supabase } from 'src/lib/supabaseClient';

import { useSearchParams } from 'next/navigation';
//import Footer from 'components/Footer';

function BrowseAlbumsContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const allowedFormatsParam = searchParams.get('allowedFormats');
  const eventTitleParam = searchParams.get('eventTitle');

  const [albums, setAlbums] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allowedFormats, setAllowedFormats] = useState(null);
  const [eventTitle, setEventTitle] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');
  const [sortField, setSortField] = useState('title');
  const [sortAsc, setSortAsc] = useState(true);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchEventDataIfNeeded() {
      if (eventId) {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, allowed_formats')
          .eq('id', eventId)
          .single();
        if (!error && data) {
          if (isMounted) {
            setAllowedFormats(data.allowed_formats || []);
            setEventTitle(data.title || '');
          }
        } else {
          if (isMounted) {
            setAllowedFormats(null);
            setEventTitle('');
          }
        }
      } else if (allowedFormatsParam && eventTitleParam) {
        setAllowedFormats(allowedFormatsParam.split(',').map(f => f.trim()));
        setEventTitle(eventTitleParam);
      } else {
        setAllowedFormats(null);
        setEventTitle('');
      }
    }
    fetchEventDataIfNeeded();
    return () => { isMounted = false; };
  }, [eventId, allowedFormatsParam, eventTitleParam]);

  useEffect(() => {
  async function fetchAllAlbums() {
    let allRows = [];
    let from = 0;
    const batchSize = 1000;
    let keepGoing = true;
    while (keepGoing) {
      let { data: batch, error } = await supabase
        .from('collection')
        .select('*')
        .or('blocked.is.null,blocked.eq.false') // Exclude blocked items (handles NULL as not blocked)
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
    const parsed = allRows.map(album => ({
      id: album.id,
      title: album.title,
      artist: album.artist,
      year: album.year,
      folder: album.folder,
      mediaType: album.folder,
      image:
        album.image_url && album.image_url.trim().toLowerCase() !== 'no'
          ? album.image_url.trim()
          : '/images/coverplaceholder.png'
    }));
    setAlbums(parsed);
  }
  fetchAllAlbums();
}, []);

  const formatVariants = (format) => {
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

  const normalizedDropdown = allowedFormats?.length > 0
    ? allowedFormats.map(f => f.trim())
    : ['Vinyl', 'Cassettes', 'CD', '45s', '8-Track'];

  const filteredAlbums = useMemo(() => {
    let fa = albums.filter(album => {
      const folder = (album.folder || '').trim().toLowerCase();
      const matchesSearch =
        (album.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (album.artist || '').toLowerCase().includes(searchTerm.toLowerCase());
      const isAllowed =
        !allowedFormats ||
        normalizedFormats.includes(folder);
      const matchesFilter =
        !mediaFilter ||
        formatVariants(mediaFilter).includes(folder);
      return matchesSearch && isAllowed && matchesFilter;
    });
    fa = [...fa].sort((a, b) => {
      let va = (a[sortField] || '').toString().toLowerCase();
      let vb = (b[sortField] || '').toString().toLowerCase();
      if (va > vb) return sortAsc ? 1 : -1;
      if (va < vb) return sortAsc ? -1 : 1;
      return 0;
    });
    return fa;
  }, [albums, searchTerm, mediaFilter, allowedFormats, normalizedFormats, sortField, sortAsc]);

  const hasSearchQuery = searchTerm.trim().length > 0;
  const hasNoResults = hasSearchQuery && filteredAlbums.length === 0;

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>
            Browse the Collection{eventTitle ? ` for ${eventTitle}` : ''}
          </h1>
        </div>
      </header>

      <main className="browse-collection-body">
        <div className="search-filter-bar">
          <input
            type="text"
            placeholder="Search by artist or title"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value)}
          >
            <option value="">All Media Types</option>
            {normalizedDropdown.map((format) => (
              <option key={format} value={format.trim().toLowerCase()}>
                {format}
              </option>
            ))}
          </select>
          <select value={sortField} onChange={e => setSortField(e.target.value)}>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="year">Year</option>
          </select>
          <button
            className="button-secondary"
            onClick={() => setSortAsc(a => !a)}
          >
            Sort: {sortAsc ? 'Ascending' : 'Descending'}
          </button>
        </div>

        {/* Show suggestion box when no search results */}
        {hasNoResults && (
          <div style={{ marginBottom: 32 }}>
            <AlbumSuggestionBox 
              context="search" 
              searchQuery={searchTerm}
            />
          </div>
        )}

        {/* General suggestion box when not searching and not in event context */}
        {!hasSearchQuery && !eventId && !showSuggestionBox && (
          <div style={{ marginBottom: 24 }}>
            <AlbumSuggestionBox 
              compact={true}
              onClose={() => setShowSuggestionBox(true)}
            />
          </div>
        )}

        {/* Results count and suggestion toggle */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 20,
          padding: '0 8px'
        }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {hasSearchQuery ? (
              <>Showing {filteredAlbums.length} results for &quot;{searchTerm}&quot;</>
            ) : (
              <>Showing {filteredAlbums.length} albums</>
            )}
          </div>
          
          {/* Suggestion toggle button */}
          {!hasNoResults && (
            <button
              onClick={() => setShowSuggestionBox(!showSuggestionBox)}
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid #3b82f6',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: '#3b82f6',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              💡 Suggest an Album
            </button>
          )}
        </div>

        {/* Expandable suggestion box */}
        {showSuggestionBox && !hasNoResults && (
          <div style={{ marginBottom: 32 }}>
            <AlbumSuggestionBox 
              context={eventId ? "general" : "general"}
              onClose={() => setShowSuggestionBox(false)}
            />
          </div>
        )}

        <section className="album-grid">
          {filteredAlbums.map((album) => (
            <AlbumCard
              key={album.id}
              album={{
                ...album,
                eventId: eventId
              }}
            />
          ))}
        </section>

        {/* Additional help text for empty states */}
        {filteredAlbums.length === 0 && !hasSearchQuery && (
          <div style={{
            textAlign: 'center',
            padding: 40,
            color: '#6b7280',
            fontSize: 16
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
            <p>The collection is loading or no albums match your filters.</p>
            <p style={{ fontSize: 14 }}>
              Try adjusting your media type filter or suggest new albums above!
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
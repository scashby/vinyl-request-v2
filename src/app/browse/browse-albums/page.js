// Fixed Browse Albums page with proper search controls visibility
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
  const [sortField, setSortField] = useState('date_added');
  const [sortAsc, setSortAsc] = useState(false);
  const [showJustAdded, setShowJustAdded] = useState(false);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper function to check if album was added in last 2 weeks
  const isJustAdded = (dateAdded) => {
    if (!dateAdded) return false;
    const addedDate = new Date(dateAdded);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    return addedDate >= twoWeeksAgo;
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchEventDataIfNeeded() {
      if (eventId) {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, allowed_formats')
          .eq('id', eventId)
          .single();
        if (!error && data && isMounted) {
          setAllowedFormats(data.allowed_formats || []);
          setEventTitle(data.title || '');
        } else if (isMounted) {
          setAllowedFormats(null);
          setEventTitle('');
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
      setLoading(true);
      let allRows = [];
      let from = 0;
      const batchSize = 1000;
      let keepGoing = true;
      
      while (keepGoing) {
        let { data: batch, error } = await supabase
          .from('collection')
          .select('*')
          .or('blocked.is.null,blocked.eq.false')
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
        dateAdded: album.date_added,
        justAdded: isJustAdded(album.date_added),
        image:
          album.image_url && album.image_url.trim().toLowerCase() !== 'no'
            ? album.image_url.trim()
            : '/images/coverplaceholder.png'
      }));
      
      setAlbums(parsed);
      setLoading(false);
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
      const matchesJustAdded =
        !showJustAdded || album.justAdded;
        
      return matchesSearch && isAllowed && matchesFilter && matchesJustAdded;
    });
    
    // Sort albums
    fa = [...fa].sort((a, b) => {
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
  }, [albums, searchTerm, mediaFilter, allowedFormats, normalizedFormats, sortField, sortAsc, showJustAdded]);

  // Count just added albums
  const justAddedCount = albums.filter(album => album.justAdded).length;

  const hasSearchQuery = searchTerm.trim().length > 0;
  const hasNoResults = hasSearchQuery && filteredAlbums.length === 0;

  if (loading) {
    return (
      <div className="page-wrapper">
        <header className="event-hero">
          <div className="overlay">
            <h1>Loading Collection...</h1>
          </div>
        </header>
        <main className="browse-collection-body" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px',
          fontSize: '18px',
          color: '#666'
        }}>
          Loading albums...
        </main>
      </div>
    );
  }

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
        {/* Fixed Search Filter Bar */}
        <div style={{
          background: '#fff',
          padding: '20px',
          marginBottom: '24px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            alignItems: 'end',
            marginBottom: '16px'
          }}>
            {/* Search Input */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Search Albums
              </label>
              <input
                type="text"
                placeholder="Search by artist or title"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: '#fff'
                }}
              />
            </div>

            {/* Media Type Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Media Type
              </label>
              <select
                value={mediaFilter}
                onChange={(e) => setMediaFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#fff',
                  outline: 'none'
                }}
              >
                <option value="">All Media Types</option>
                {normalizedDropdown.map((format) => (
                  <option key={format} value={format.trim().toLowerCase()}>
                    {format}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Field */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Sort By
              </label>
              <select 
                value={sortField} 
                onChange={e => setSortField(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#fff',
                  outline: 'none'
                }}
              >
                <option value="date_added">Date Added</option>
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="year">Year</option>
              </select>
            </div>

            {/* Sort Direction */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Sort Order
              </label>
              <button
                onClick={() => setSortAsc(a => !a)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#f3f4f6',
                  border: '2px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: '#374151'
                }}
              >
                {sortAsc ? '↑ Ascending' : '↓ Descending'}
              </button>
            </div>
          </div>

          {/* Second row for filters and actions */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {/* Just Added Filter */}
            {justAddedCount > 0 && (
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#059669',
                cursor: 'pointer',
                background: '#f0fdf4',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #bbf7d0'
              }}>
                <input
                  type="checkbox"
                  checked={showJustAdded}
                  onChange={(e) => setShowJustAdded(e.target.checked)}
                  style={{ 
                    accentColor: '#059669',
                    transform: 'scale(1.2)'
                  }}
                />
                ✨ Just Added ({justAddedCount})
              </label>
            )}
            
            {/* Suggest Album Button */}
            {!hasNoResults && !showSuggestionBox && (
              <button
                onClick={() => setShowSuggestionBox(true)}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                💡 Suggest an Album
              </button>
            )}
          </div>
        </div>

        {/* Results Count */}
        <div style={{ 
          fontSize: '14px', 
          color: '#666',
          marginBottom: '24px',
          padding: '0 8px'
        }}>
          {hasSearchQuery ? (
            <>Showing {filteredAlbums.length} results for &ldquo;{searchTerm}&rdquo;</>
          ) : showJustAdded ? (
            <>Showing {filteredAlbums.length} just added albums</>
          ) : (
            <>Showing {filteredAlbums.length} albums{justAddedCount > 0 ? ` (${justAddedCount} just added)` : ''}</>
          )}
        </div>

        {/* Album Suggestion Box */}
        {(hasNoResults || showSuggestionBox) && (
          <div style={{ marginBottom: '40px' }}>
            <AlbumSuggestionBox 
              context={hasNoResults ? "search" : "general"}
              searchQuery={hasNoResults ? searchTerm : ''}
              eventId={eventId}
              eventTitle={eventTitle}
              onClose={() => setShowSuggestionBox(false)}
            />
          </div>
        )}

        {/* Album Grid */}
        <section className="album-grid">
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

        {/* Empty States */}
        {filteredAlbums.length === 0 && !hasSearchQuery && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6b7280',
            fontSize: '16px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
            <p>The collection is loading or no albums match your filters.</p>
            <p style={{ fontSize: '14px' }}>
              Try adjusting your filters or suggest new albums above!
            </p>
          </div>
        )}

        {hasNoResults && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6b7280',
            fontSize: '16px',
            background: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #d1d5db',
            margin: '20px 0'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <h3 style={{ fontSize: '24px', marginBottom: '12px', color: '#374151' }}>
              No albums found
            </h3>
            <p style={{ marginBottom: '16px' }}>
              No albums match your search for &ldquo;<strong>{searchTerm}</strong>&rdquo;
            </p>
            <p style={{ fontSize: '14px' }}>
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
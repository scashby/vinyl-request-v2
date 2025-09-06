// FIXED Browse Albums page with compact search and all filters
// Replace ENTIRE file: src/app/browse/browse-albums/page.js

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
  const [showStevesTop200, setShowStevesTop200] = useState(false);
  const [showThisWeeksTop10, setShowThisWeeksTop10] = useState(false);
  const [showInnerCirclePreferred, setShowInnerCirclePreferred] = useState(false);
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
        steves_top_200: album.steves_top_200,
        this_weeks_top_10: album.this_weeks_top_10,
        inner_circle_preferred: album.inner_circle_preferred,
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
      const matchesStevesTop200 =
        !showStevesTop200 || album.steves_top_200;
      const matchesThisWeeksTop10 =
        !showThisWeeksTop10 || album.this_weeks_top_10;
      const matchesInnerCirclePreferred =
        !showInnerCirclePreferred || album.inner_circle_preferred;
        
      return matchesSearch && isAllowed && matchesFilter && matchesJustAdded && 
             matchesStevesTop200 && matchesThisWeeksTop10 && matchesInnerCirclePreferred;
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
  }, [albums, searchTerm, mediaFilter, allowedFormats, normalizedFormats, sortField, sortAsc, 
      showJustAdded, showStevesTop200, showThisWeeksTop10, showInnerCirclePreferred]);

  // Count just added albums
  const justAddedCount = albums.filter(album => album.justAdded).length;
  const stevesTop200Count = albums.filter(album => album.steves_top_200).length;
  const thisWeeksTop10Count = albums.filter(album => album.this_weeks_top_10).length;
  const innerCircleCount = albums.filter(album => album.inner_circle_preferred).length;

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
        {/* COMPACT Search Controls */}
        <div style={{
          background: '#fff',
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '6px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          {/* Row 1: Main Controls */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <input
              type="text"
              placeholder="Search by artist or title"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: '1 1 200px',
                minWidth: '200px',
                padding: '6px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />

            <select
              value={mediaFilter}
              onChange={(e) => setMediaFilter(e.target.value)}
              style={{
                flex: '0 0 120px',
                padding: '6px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="">All Types</option>
              {normalizedDropdown.map((format) => (
                <option key={format} value={format.trim().toLowerCase()}>
                  {format}
                </option>
              ))}
            </select>

            <select 
              value={sortField} 
              onChange={e => setSortField(e.target.value)}
              style={{
                flex: '0 0 100px',
                padding: '6px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="date_added">Date Added</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="year">Year</option>
            </select>

            <button
              onClick={() => setSortAsc(a => !a)}
              style={{
                padding: '6px 10px',
                background: '#f3f4f6',
                border: '2px solid #000000',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                backgroundColor: '#f3f4f6',
                color: '#000000'
              }}
            >
              {sortAsc ? '↑' : '↓'}
            </button>

            <button
              onClick={() => setShowSuggestionBox(true)}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              💡 Suggest
            </button>
          </div>

          {/* Row 2: Filter Badges */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px'
          }}>
            {justAddedCount > 0 && (
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                fontSize: '11px',
                fontWeight: '600',
                color: '#059669',
                cursor: 'pointer',
                background: '#f0fdf4',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid #bbf7d0'
              }}>
                <input
                  type="checkbox"
                  checked={showJustAdded}
                  onChange={(e) => setShowJustAdded(e.target.checked)}
                  style={{ transform: 'scale(0.9)' }}
                />
                ✨ Just Added ({justAddedCount})
              </label>
            )}

            {stevesTop200Count > 0 && (
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                fontSize: '11px',
                fontWeight: '600',
                color: '#dc2626',
                cursor: 'pointer',
                background: '#fef2f2',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid #fecaca'
              }}>
                <input
                  type="checkbox"
                  checked={showStevesTop200}
                  onChange={(e) => setShowStevesTop200(e.target.checked)}
                  style={{ transform: 'scale(0.9)' }}
                />
                🏆 Top 200 ({stevesTop200Count})
              </label>
            )}

            {thisWeeksTop10Count > 0 && (
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                fontSize: '11px',
                fontWeight: '600',
                color: '#7c3aed',
                cursor: 'pointer',
                background: '#faf5ff',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid #e9d5ff'
              }}>
                <input
                  type="checkbox"
                  checked={showThisWeeksTop10}
                  onChange={(e) => setShowThisWeeksTop10(e.target.checked)}
                  style={{ transform: 'scale(0.9)' }}
                />
                📈 Top 10 ({thisWeeksTop10Count})
              </label>
            )}

            {innerCircleCount > 0 && (
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                fontSize: '11px',
                fontWeight: '600',
                color: '#ea580c',
                cursor: 'pointer',
                background: '#fff7ed',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid #fed7aa'
              }}>
                <input
                  type="checkbox"
                  checked={showInnerCirclePreferred}
                  onChange={(e) => setShowInnerCirclePreferred(e.target.checked)}
                  style={{ transform: 'scale(0.9)' }}
                />
                ⭐ Inner Circle ({innerCircleCount})
              </label>
            )}
          </div>
        </div>

        {/* Results Count */}
        <div style={{ 
          fontSize: '14px', 
          color: '#666',
          marginBottom: '16px',
          paddingLeft: '8px'
        }}>
          Showing {filteredAlbums.length} albums
          {hasSearchQuery && ` for "${searchTerm}"`}
        </div>

        {/* Album Suggestion Box */}
        {(hasNoResults || showSuggestionBox) && (
          <div style={{ marginBottom: '24px' }}>
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
            <p>No albums match your current filters.</p>
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
// Fixed Browse Albums page with compact search controls and all filter options
// Excludes "Sales" folder items from the collection
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
import { formatEventText } from 'src/utils/textFormatter';

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
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (album.title || '').toLowerCase().includes(searchLower) ||
        (album.artist || '').toLowerCase().includes(searchLower) ||
        (album.tracklists || '').toLowerCase().includes(searchLower) ||
        (album.notes || '').toLowerCase().includes(searchLower) ||
        (album.genre || '').toLowerCase().includes(searchLower) ||
        (album.label || '').toLowerCase().includes(searchLower) ||
        (album.media_condition || '').toLowerCase().includes(searchLower) ||
        (album.sleeve_condition || '').toLowerCase().includes(searchLower);
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

  // Count special albums
  const justAddedCount = albums.filter(album => album.justAdded).length;
  const stevesTop200Count = albums.filter(album => album.steves_top_200).length;
  const thisWeeksTop10Count = albums.filter(album => album.this_weeks_top_10).length;
  const innerCirclePreferredCount = albums.filter(album => album.inner_circle_preferred).length;

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
            Browse the Collection{eventTitle ? <span> for <span dangerouslySetInnerHTML={{ __html: formatEventText(eventTitle) }} /></span> : ''}
          </h1>
        </div>
      </header>

      <main className="browse-collection-body">
        {/* FIXED Search Filter Bar */}
        <div style={{
          background: '#ffffff',
          padding: '16px 20px',
          marginBottom: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '2px solid #e5e7eb'
        }}>
          {/* Main controls row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search by artist or title"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: '2 1 250px',
                minWidth: '250px',
                padding: '10px 12px',
                border: '2px solid #374151',
                borderRadius: '6px',
                fontSize: '16px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#000000',
                fontFamily: 'system-ui, sans-serif'
              }}
            />

            {/* Media Type Filter */}
            <select
              value={mediaFilter}
              onChange={(e) => setMediaFilter(e.target.value)}
              style={{
                flex: '1 1 150px',
                minWidth: '150px',
                padding: '10px 12px',
                border: '2px solid #374151',
                borderRadius: '6px',
                fontSize: '16px',
                backgroundColor: '#ffffff',
                color: '#000000',
                outline: 'none',
                fontFamily: 'system-ui, sans-serif'
              }}
            >
              <option value="" style={{ color: '#000000', backgroundColor: '#ffffff' }}>All Media Types</option>
              {normalizedDropdown.map((format) => (
                <option 
                  key={format} 
                  value={format.trim().toLowerCase()}
                  style={{ color: '#000000', backgroundColor: '#ffffff' }}
                >
                  {format}
                </option>
              ))}
            </select>

            {/* Sort Field */}
            <select 
              value={sortField} 
              onChange={e => setSortField(e.target.value)}
              style={{
                flex: '1 1 130px',
                minWidth: '130px',
                padding: '10px 12px',
                border: '2px solid #374151',
                borderRadius: '6px',
                fontSize: '16px',
                backgroundColor: '#ffffff',
                color: '#000000',
                outline: 'none',
                fontFamily: 'system-ui, sans-serif'
              }}
            >
              <option value="artist" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Artist</option>
              <option value="date_added" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Date Added</option>
              <option value="title" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Title</option>
              <option value="year" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Year</option>
            </select>

            {/* Sort Direction */}
            <button
              onClick={() => setSortAsc(a => !a)}
              style={{
                flex: '0 0 auto',
                padding: '10px 16px',
                background: '#f3f4f6',
                border: '2px solid #374151',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                color: '#000000',
                whiteSpace: 'nowrap',
                fontFamily: 'system-ui, sans-serif'
              }}
            >
              Sort: {sortAsc ? 'A→Z' : 'Z→A'}
            </button>

            {/* Suggest Album Button */}
            {!hasNoResults && !showSuggestionBox && (
              <button
                onClick={() => setShowSuggestionBox(true)}
                style={{
                  flex: '0 0 auto',
                  background: '#3b82f6',
                  color: '#ffffff',
                  border: '2px solid #1d4ed8',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'system-ui, sans-serif'
                }}
              >
                💡 Suggest Album
              </button>
            )}
          </div>

          {/* Filter badges row - ALWAYS SHOW ALL BADGES */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center'
          }}>
            {/* Just Added Filter */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#000000',
              cursor: justAddedCount > 0 ? 'pointer' : 'not-allowed',
              background: justAddedCount > 0 ? '#dcfce7' : '#f3f4f6',
              padding: '6px 10px',
              borderRadius: '6px',
              border: `2px solid ${justAddedCount > 0 ? '#16a34a' : '#9ca3af'}`,
              fontFamily: 'system-ui, sans-serif',
              opacity: justAddedCount > 0 ? 1 : 0.6
            }}>
              <input
                type="checkbox"
                checked={showJustAdded}
                onChange={(e) => setShowJustAdded(e.target.checked)}
                disabled={justAddedCount === 0}
                style={{ 
                  accentColor: '#16a34a',
                  transform: 'scale(1.2)'
                }}
              />
              ✨ Just Added ({justAddedCount})
            </label>

            {/* Steve's Top 200 Filter */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#000000',
              cursor: stevesTop200Count > 0 ? 'pointer' : 'not-allowed',
              background: stevesTop200Count > 0 ? '#fecaca' : '#f3f4f6',
              padding: '6px 10px',
              borderRadius: '6px',
              border: `2px solid ${stevesTop200Count > 0 ? '#dc2626' : '#9ca3af'}`,
              fontFamily: 'system-ui, sans-serif',
              opacity: stevesTop200Count > 0 ? 1 : 0.6
            }}>
              <input
                type="checkbox"
                checked={showStevesTop200}
                onChange={(e) => setShowStevesTop200(e.target.checked)}
                disabled={stevesTop200Count === 0}
                style={{ 
                  accentColor: '#dc2626',
                  transform: 'scale(1.2)'
                }}
              />
              🏆 Steve&apos;s Top 200 ({stevesTop200Count})
            </label>

            {/* This Week's Top 10 Filter */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#000000',
              cursor: thisWeeksTop10Count > 0 ? 'pointer' : 'not-allowed',
              background: thisWeeksTop10Count > 0 ? '#e9d5ff' : '#f3f4f6',
              padding: '6px 10px',
              borderRadius: '6px',
              border: `2px solid ${thisWeeksTop10Count > 0 ? '#7c3aed' : '#9ca3af'}`,
              fontFamily: 'system-ui, sans-serif',
              opacity: thisWeeksTop10Count > 0 ? 1 : 0.6
            }}>
              <input
                type="checkbox"
                checked={showThisWeeksTop10}
                onChange={(e) => setShowThisWeeksTop10(e.target.checked)}
                disabled={thisWeeksTop10Count === 0}
                style={{ 
                  accentColor: '#7c3aed',
                  transform: 'scale(1.2)'
                }}
              />
              📈 This Week&apos;s Top 10 ({thisWeeksTop10Count})
            </label>

            {/* Inner Circle Preferred Filter */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#000000',
              cursor: innerCirclePreferredCount > 0 ? 'pointer' : 'not-allowed',
              background: innerCirclePreferredCount > 0 ? '#fed7aa' : '#f3f4f6',
              padding: '6px 10px',
              borderRadius: '6px',
              border: `2px solid ${innerCirclePreferredCount > 0 ? '#ea580c' : '#9ca3af'}`,
              fontFamily: 'system-ui, sans-serif',
              opacity: innerCirclePreferredCount > 0 ? 1 : 0.6
            }}>
              <input
                type="checkbox"
                checked={showInnerCirclePreferred}
                onChange={(e) => setShowInnerCirclePreferred(e.target.checked)}
                disabled={innerCirclePreferredCount === 0}
                style={{ 
                  accentColor: '#ea580c',
                  transform: 'scale(1.2)'
                }}
              />
              ⭐ Inner Circle Preferred ({innerCirclePreferredCount})
            </label>
          </div>
        </div>

        {/* Results Count */}
        <div style={{ 
          fontSize: '14px', 
          color: '#666',
          marginBottom: '20px',
          padding: '0 8px'
        }}>
          {hasSearchQuery ? (
            <>Showing {filteredAlbums.length} results for &ldquo;{searchTerm}&rdquo;</>
          ) : (
            <>Showing {filteredAlbums.length} albums</>
          )}
        </div>

        {/* Album Suggestion Box */}
        {(hasNoResults || showSuggestionBox) && (
          <div style={{ marginBottom: '30px' }}>
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
              Try adjusting your filters or suggest new albums!
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
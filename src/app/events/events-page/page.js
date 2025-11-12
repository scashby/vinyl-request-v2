// src/app/browse/browse-albums/page.js
// Enhanced Browse Albums page with comprehensive checkbox filtering
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
  const [eventData, setEventData] = useState(null);
  
  // Filter states
  const [selectedFormats, setSelectedFormats] = useState([]);
  const [sortField, setSortField] = useState('date_added');
  const [sortAsc, setSortAsc] = useState(false);
  const [showJustAdded, setShowJustAdded] = useState(false);
  const [showStevesTop200, setShowStevesTop200] = useState(false);
  const [showThisWeeksTop10, setShowThisWeeksTop10] = useState(false);
  const [showInnerCirclePreferred, setShowInnerCirclePreferred] = useState(false);
  const [show1001Albums, setShow1001Albums] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

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
          .select('*')
          .eq('id', eventId)
          .single();
        if (!error && data && isMounted) {
          setAllowedFormats(data.allowed_formats || []);
          setEventTitle(data.title || '');
          setEventData(data);
        } else if (isMounted) {
          setAllowedFormats(null);
          setEventTitle('');
          setEventData(null);
        }
      } else if (allowedFormatsParam && eventTitleParam) {
        setAllowedFormats(allowedFormatsParam.split(',').map(f => f.trim()));
        setEventTitle(eventTitleParam);
      } else {
        setAllowedFormats(null);
        setEventTitle('');
        setEventData(null);
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
        is_1001: album.is_1001,
        custom_tags: album.custom_tags || [],
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
          album.image_url && album.image_url.trim().toLowerCase() !== 'no'
            ? album.image_url.trim()
            : '/images/coverplaceholder.png'
      }));
      
      // Extract all unique tags
      const tagsSet = new Set();
      parsed.forEach(album => {
        if (Array.isArray(album.custom_tags)) {
          album.custom_tags.forEach(tag => tagsSet.add(tag));
        }
      });
      setAvailableTags(Array.from(tagsSet).sort());
      
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

  const toggleFormat = (format) => {
    setSelectedFormats(prev => 
      prev.includes(format) 
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const filteredAlbums = useMemo(() => {
    let fa = albums.filter(album => {
      const folder = (album.folder || '').trim().toLowerCase();
      
      const searchLower = searchTerm.toLowerCase();

      const searchInArray = (arr) => {
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
      
      const matchesFormatFilter =
        selectedFormats.length === 0 ||
        selectedFormats.some(sf => formatVariants(sf).includes(folder));
      
      const matchesJustAdded =
        !showJustAdded || album.justAdded;
      const matchesStevesTop200 =
        !showStevesTop200 || album.steves_top_200;
      const matchesThisWeeksTop10 =
        !showThisWeeksTop10 || album.this_weeks_top_10;
      const matchesInnerCirclePreferred =
        !showInnerCirclePreferred || album.inner_circle_preferred;
      const matches1001Albums =
        !show1001Albums || album.is_1001;
      
      const matchesTags =
        selectedTags.length === 0 ||
        (Array.isArray(album.custom_tags) && selectedTags.every(tag => album.custom_tags.includes(tag)));
        
      return matchesSearch && isAllowed && matchesFormatFilter && matchesJustAdded && 
             matchesStevesTop200 && matchesThisWeeksTop10 && matchesInnerCirclePreferred &&
             matches1001Albums && matchesTags;
    });
    
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
  }, [albums, searchTerm, selectedFormats, allowedFormats, normalizedFormats, sortField, sortAsc, 
      showJustAdded, showStevesTop200, showThisWeeksTop10, showInnerCirclePreferred, show1001Albums, selectedTags]);

  const justAddedCount = albums.filter(album => album.justAdded).length;
  const stevesTop200Count = albums.filter(album => album.steves_top_200).length;
  const thisWeeksTop10Count = albums.filter(album => album.this_weeks_top_10).length;
  const innerCirclePreferredCount = albums.filter(album => album.inner_circle_preferred).length;
  const albums1001Count = albums.filter(album => album.is_1001).length;

  const hasSearchQuery = searchTerm.trim().length > 0;
  const hasNoResults = hasSearchQuery && filteredAlbums.length === 0;

  const queueType = eventData?.queue_type || 'side';

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
          {eventId && eventData && (
            <p style={{ fontSize: '16px', marginTop: '12px', opacity: 0.9 }}>
              Queue Mode: {queueType === 'track' ? '🎵 By Track' : queueType === 'album' ? '💿 By Album' : '📀 By Side'}
            </p>
          )}
        </div>
      </header>

      <main className="browse-collection-body">
        {/* Search and Basic Controls */}
        <div style={{
          background: '#ffffff',
          padding: '20px',
          marginBottom: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '2px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <input
              type="text"
              placeholder="Search by artist, title, or genre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: '2 1 300px',
                minWidth: '250px',
                padding: '10px 12px',
                border: '2px solid #374151',
                borderRadius: '6px',
                fontSize: '16px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#1f2937',
                fontFamily: 'system-ui, sans-serif'
              }}
            />

            <select 
              value={sortField} 
              onChange={e => setSortField(e.target.value)}
              style={{
                flex: '1 1 150px',
                minWidth: '150px',
                padding: '10px 12px',
                border: '2px solid #374151',
                borderRadius: '6px',
                fontSize: '16px',
                backgroundColor: '#ffffff',
                color: '#1f2937',
                outline: 'none',
                fontFamily: 'system-ui, sans-serif'
              }}
            >
              <option value="artist">Sort: Artist</option>
              <option value="date_added">Sort: Date Added</option>
              <option value="title">Sort: Title</option>
              <option value="year">Sort: Year</option>
            </select>

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
                color: '#1f2937',
                whiteSpace: 'nowrap',
                fontFamily: 'system-ui, sans-serif'
              }}
            >
              {sortAsc ? 'A→Z' : 'Z→A'}
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                flex: '0 0 auto',
                padding: '10px 20px',
                background: showFilters ? '#0284c7' : '#6b7280',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'system-ui, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {showFilters ? '▲' : '▼'} Filters
            </button>

            {!hasNoResults && !showSuggestionBox && (
              <button
                onClick={() => setShowSuggestionBox(true)}
                style={{
                  flex: '0 0 auto',
                  background: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
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

          {/* Expandable Filters Section */}
          {showFilters && (
            <div style={{
              borderTop: '2px solid #e5e7eb',
              paddingTop: '20px',
              marginTop: '8px'
            }}>
              {/* Format Filters */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#1f2937',
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Format
                </h3>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  {normalizedDropdown.map((format) => {
                    const isSelected = selectedFormats.includes(format);
                    return (
                      <label
                        key={format}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 14px',
                          background: isSelected ? '#dbeafe' : '#f3f4f6',
                          border: `2px solid ${isSelected ? '#0284c7' : '#d1d5db'}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '14px',
                          color: '#1f2937',
                          transition: 'all 0.2s ease',
                          userSelect: 'none'
                        }}
                        onMouseOver={(e) => {
                          if (!isSelected) e.currentTarget.style.background = '#e5e7eb';
                        }}
                        onMouseOut={(e) => {
                          if (!isSelected) e.currentTarget.style.background = '#f3f4f6';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFormat(format)}
                          style={{
                            accentColor: '#0284c7',
                            transform: 'scale(1.2)',
                            cursor: 'pointer'
                          }}
                        />
                        {format}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Collection Highlights */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#1f2937',
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Collection Highlights
                </h3>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f2937',
                    cursor: justAddedCount > 0 ? 'pointer' : 'not-allowed',
                    background: showJustAdded ? '#dcfce7' : '#f3f4f6',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: `2px solid ${showJustAdded ? '#16a34a' : '#d1d5db'}`,
                    fontFamily: 'system-ui, sans-serif',
                    opacity: justAddedCount > 0 ? 1 : 0.5,
                    userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={showJustAdded}
                      onChange={(e) => setShowJustAdded(e.target.checked)}
                      disabled={justAddedCount === 0}
                      style={{ 
                        accentColor: '#16a34a',
                        transform: 'scale(1.2)',
                        cursor: justAddedCount > 0 ? 'pointer' : 'not-allowed'
                      }}
                    />
                    ✨ Just Added ({justAddedCount})
                  </label>

                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f2937',
                    cursor: stevesTop200Count > 0 ? 'pointer' : 'not-allowed',
                    background: showStevesTop200 ? '#fecaca' : '#f3f4f6',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: `2px solid ${showStevesTop200 ? '#dc2626' : '#d1d5db'}`,
                    fontFamily: 'system-ui, sans-serif',
                    opacity: stevesTop200Count > 0 ? 1 : 0.5,
                    userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={showStevesTop200}
                      onChange={(e) => setShowStevesTop200(e.target.checked)}
                      disabled={stevesTop200Count === 0}
                      style={{ 
                        accentColor: '#dc2626',
                        transform: 'scale(1.2)',
                        cursor: stevesTop200Count > 0 ? 'pointer' : 'not-allowed'
                      }}
                    />
                    🏆 Steve&apos;s Top 200 ({stevesTop200Count})
                  </label>

                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f2937',
                    cursor: thisWeeksTop10Count > 0 ? 'pointer' : 'not-allowed',
                    background: showThisWeeksTop10 ? '#e9d5ff' : '#f3f4f6',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: `2px solid ${showThisWeeksTop10 ? '#7c3aed' : '#d1d5db'}`,
                    fontFamily: 'system-ui, sans-serif',
                    opacity: thisWeeksTop10Count > 0 ? 1 : 0.5,
                    userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={showThisWeeksTop10}
                      onChange={(e) => setShowThisWeeksTop10(e.target.checked)}
                      disabled={thisWeeksTop10Count === 0}
                      style={{ 
                        accentColor: '#7c3aed',
                        transform: 'scale(1.2)',
                        cursor: thisWeeksTop10Count > 0 ? 'pointer' : 'not-allowed'
                      }}
                    />
                    📈 This Week&apos;s Top 10 ({thisWeeksTop10Count})
                  </label>

                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f2937',
                    cursor: innerCirclePreferredCount > 0 ? 'pointer' : 'not-allowed',
                    background: showInnerCirclePreferred ? '#fed7aa' : '#f3f4f6',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: `2px solid ${showInnerCirclePreferred ? '#ea580c' : '#d1d5db'}`,
                    fontFamily: 'system-ui, sans-serif',
                    opacity: innerCirclePreferredCount > 0 ? 1 : 0.5,
                    userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={showInnerCirclePreferred}
                      onChange={(e) => setShowInnerCirclePreferred(e.target.checked)}
                      disabled={innerCirclePreferredCount === 0}
                      style={{ 
                        accentColor: '#ea580c',
                        transform: 'scale(1.2)',
                        cursor: innerCirclePreferredCount > 0 ? 'pointer' : 'not-allowed'
                      }}
                    />
                    ⭐ Inner Circle Preferred ({innerCirclePreferredCount})
                  </label>

                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f2937',
                    cursor: albums1001Count > 0 ? 'pointer' : 'not-allowed',
                    background: show1001Albums ? '#fef3c7' : '#f3f4f6',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: `2px solid ${show1001Albums ? '#f59e0b' : '#d1d5db'}`,
                    fontFamily: 'system-ui, sans-serif',
                    opacity: albums1001Count > 0 ? 1 : 0.5,
                    userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={show1001Albums}
                      onChange={(e) => setShow1001Albums(e.target.checked)}
                      disabled={albums1001Count === 0}
                      style={{ 
                        accentColor: '#f59e0b',
                        transform: 'scale(1.2)',
                        cursor: albums1001Count > 0 ? 'pointer' : 'not-allowed'
                      }}
                    />
                    📚 1001 Albums ({albums1001Count})
                  </label>
                </div>
              </div>

              {/* Tags Filter */}
              {availableTags.length > 0 && (
                <div>
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1f2937',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Tags {selectedTags.length > 0 && `(${selectedTags.length} selected)`}
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    padding: '8px',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    {availableTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <label
                          key={tag}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: isSelected ? '#dbeafe' : '#ffffff',
                            border: `2px solid ${isSelected ? '#0284c7' : '#e5e7eb'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#1f2937',
                            transition: 'all 0.2s ease',
                            userSelect: 'none'
                          }}
                          onMouseOver={(e) => {
                            if (!isSelected) e.currentTarget.style.borderColor = '#9ca3af';
                          }}
                          onMouseOut={(e) => {
                            if (!isSelected) e.currentTarget.style.borderColor = '#e5e7eb';
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTag(tag)}
                            style={{
                              accentColor: '#0284c7',
                              transform: 'scale(1.1)',
                              cursor: 'pointer'
                            }}
                          />
                          {tag}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

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
          {(selectedFormats.length > 0 || selectedTags.length > 0 || showJustAdded || showStevesTop200 || showThisWeeksTop10 || showInnerCirclePreferred || show1001Albums) && (
            <> with active filters</>
          )}
        </div>

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
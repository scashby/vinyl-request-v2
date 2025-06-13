// Browse Albums page ("/browse/browse-albums")
// Lists and filters all albums in the collection with search, sort, and filter by media type.
// Supports event context via query parameters (?eventID=...).

"use client";

import { Suspense } from 'react';
import { useEffect, useState, useMemo } from 'react';
import AlbumCard from 'components/AlbumCard';
import 'styles/album-browse.css';
import 'styles/internal.css';
import { supabase } from 'lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import Footer from 'components/Footer';
import Link from "next/link";

function BrowseAlbumsContent() {
  const searchParams = useSearchParams();
  const eventID = searchParams.get('eventID');
  const allowedFormatsParam = searchParams.get('allowedFormats');
  const eventTitleParam = searchParams.get('eventTitle');

  const [albums, setAlbums] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allowedFormats, setAllowedFormats] = useState(null);
  const [eventTitle, setEventTitle] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');
  const [sortField, setSortField] = useState('title');
  const [sortAsc, setSortAsc] = useState(true);

  // loading and error state
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Fetch event context only if eventID param is present
  useEffect(() => {
    let isMounted = true;
    setFetchError('');
    if (eventID) {
      async function fetchEventDataIfNeeded() {
        setLoading(true);
        const { data, error } = await supabase
          .from('events')
          .select('id, title, allowed_formats')
          .eq('id', eventID)
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
            setFetchError('Event not found.');
          }
        }
        setLoading(false);
      }
      fetchEventDataIfNeeded();
    } else if (allowedFormatsParam && eventTitleParam) {
      setAllowedFormats(allowedFormatsParam.split(',').map(f => f.trim()));
      setEventTitle(eventTitleParam)
      setFetchError('');
    } else {
      setAllowedFormats(null);
      setEventTitle('');
      setFetchError('');
    }
    return () => { isMounted = false; }
  }, [eventID, allowedFormatsParam, eventTitleParam]);

  // Fetch all albums on mount or when eventID changes
  useEffect(() => {
    let isMounted = true;
    async function fetchAlbums() {
      setLoading(true);
      setFetchError('');
      let query = supabase.from('albums').select('*');
      // Only filter by event if we have one
      if (eventID) {
        query = query.eq('event_id', eventID);
      }
      const { data, error } = await query;
      if (isMounted) {
        if (!error && data) {
          setAlbums(data);
        } else {
          setAlbums([]);
          setFetchError('Could not load albums.');
        }
        setLoading(false);
      }
    }
    fetchAlbums();
    return () => { isMounted = false; }
  }, [eventID]);

  const filteredAlbums = useMemo(() => {
    let filtered = albums;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(album =>
        album.artist.toLowerCase().includes(search) ||
        album.title.toLowerCase().includes(search)
      );
    }

    if (mediaFilter) {
      filtered = filtered.filter(album =>
        album.folder === mediaFilter ||
        album.format?.toLowerCase().includes(mediaFilter.toLowerCase())
      );
    } else if (eventID && allowedFormats && allowedFormats.length > 0) {
      filtered = filtered.filter(album =>
        allowedFormats.includes(album.folder)
      );
    }

    filtered = [...filtered].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [albums, searchTerm, mediaFilter, allowedFormats, sortField, sortAsc, eventID]);

  // Loading and error UI for fetch errors only (not for missing eventID)
  if (loading) return <div>Loading...</div>;
  if (fetchError) return <div>{fetchError}<br /><Link href="/events">Browse events</Link></div>;
  if (!filteredAlbums.length) return <div>No albums found{eventTitle ? ` for ${eventTitle}` : ""}.</div>;

  return (
    <div className="browse-albums-page">
      <h1>
        Browse the Collection
        {eventTitle ? ` for ${eventTitle}` : ''}
      </h1>
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
          {(allowedFormats || ['Vinyl', 'Cassettes', 'CD', '45s']).map(format => (
            <option key={format} value={format}>{format}</option>
          ))}
        </select>
        <button onClick={() => {
          setSortAsc(!sortAsc);
        }}>
          Sort {sortAsc ? '▲' : '▼'}
        </button>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
        >
          <option value="title">Title</option>
          <option value="artist">Artist</option>
          <option value="year">Year</option>
        </select>
      </div>
      <div className="albums-grid">
        {filteredAlbums.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>
      <Footer />
    </div>
  );
}

export default function BrowseAlbumsPage() {
  return (
    <Suspense fallback={<div>Loading albums...</div>}>
      <BrowseAlbumsContent />
    </Suspense>
  );
}

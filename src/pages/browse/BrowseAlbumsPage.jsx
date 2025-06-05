import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import AlbumCard from '../../components/AlbumCard';
import '../../styles/album-browse.css';
import '../../styles/internal.css';
import { supabase } from '../../lib/supabaseClient';
import { useLocation, useParams } from 'react-router-dom';

// Supabase setup
const supabaseUrl = 'https://bntoivaipesuovselglg.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function BrowseAlbumsPage() {
  const [albums, setAlbums] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation();
  const { eventID } = useParams();
  const [allowedFormats, setAllowedFormats] = useState(null);

    useEffect(() => {
      if (location.state?.eventData) {
        const { eventData } = location.state;
        setEventData(eventData);
        const formats = Array.isArray(eventData.allowed_formats)
          ? eventData.allowed_formats.map(f => f.trim().toLowerCase())
          : [];
        console.log("✓ Set allowedFormats from eventData:", formats);
        setAllowedFormats(formats);
      } else {
        console.warn("✗ No eventData in location.state");
        setAllowedFormats([]);
      }
    }, [location.state]);

  const eventTitle = location.state?.trail?.[1] || null;

  const [mediaFilter, setMediaFilter] = useState('');

  useEffect(() => {
    async function fetchAlbums() {
      const { data, error } = await supabase.from('collection').select('*');
      if (error) {
        console.error('Error fetching albums:', error);
      } else {
        const parsed = data.map(album => ({
          id: album.id,
          title: album.title,
          artist: album.artist,
          year: album.year,
          folder: album.folder, // ← this is what was missing
          mediaType: album.folder,
          image:
            album.image_url && album.image_url.trim().toLowerCase() !== 'no'
              ? album.image_url.trim()
              : '/images/coverplaceholder.png'
        }));
        setAlbums(parsed);
      }
    }
    fetchAlbums();
  }, []);

const normalizedFormats = allowedFormats?.map(f => f.toLowerCase()) || [];

const filteredAlbums = (albums || []).filter(album => {
  if (!album || !album.folder) return false;
  const folder = album.folder?.toLowerCase();
  console.log('Album folder:', folder);

  const matchesSearch =
    album.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    album.artist.toLowerCase().includes(searchTerm.toLowerCase());

  const matchesFilter = allowedFormats
    ? normalizedFormats.includes(folder)
    : mediaFilter === '' || folder === mediaFilter.toLowerCase();

  console.log('→ Allowed:', allowedFormats, '| Normalized:', normalizedFormats, '| Match:', matchesFilter);

  return matchesSearch && matchesFilter;
});



  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>
            Browse the Collection{eventTitle ? ` for ${eventTitle}` : ''}
          </h1>
        </div>
      </header>

      <main className="page-body">
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
            <option value="Vinyl">Vinyl</option>
            <option value="Cassettes">Cassettes</option>
            <option value="CD">CD</option>
            <option value="45s">45s</option>
            <option value="8-Track">8-Track</option>
          </select>
        </div>

        <section className="album-grid">
          {filteredAlbums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </section>
      </main>

      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </div>
  );
}

export default BrowseAlbumsPage;

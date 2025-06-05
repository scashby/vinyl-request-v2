import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import AlbumCard from '../../components/AlbumCard';
import '../../styles/album-browse.css';
import '../../styles/internal.css';
import { supabase } from '../../lib/supabaseClient';

// Supabase setup
const supabaseUrl = 'https://bntoivaipesuovselglg.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const [searchTerm, setSearchTerm] = useState('');
const [mediaFilter, setMediaFilter] = useState('');

function BrowseAlbumsPage() {
  const [albums, setAlbums] = useState([]);

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

const filteredAlbums = albums.filter(album => {
  const matchesSearch = (
    album.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    album.artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const matchesFilter = mediaFilter === '' || album.mediaType === mediaFilter;

  return matchesSearch && matchesFilter;
});

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Browse Collection</h1>
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

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import AlbumCard from '../../components/AlbumCard';
import '../../styles/album-browse.css';
import '../../styles/internal.css';
import { supabase } from '../../lib/supabaseClient';

// Supabase setup
const supabaseUrl = 'https://bntoivaipesuovselglg.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Browse Collection</h1>
        </div>
      </header>

      <main className="page-body">
        <section className="album-grid">
          {albums.map(album => (
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

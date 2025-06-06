import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import AlbumCard from '../../components/AlbumCard';
import '../../styles/album-browse.css';
import '../../styles/internal.css';

function BrowseAlbumsPage() {
  const location = useLocation();
  const eventData = location.state?.eventData;
  const [albums, setAlbums] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');
  const [eventTitle, setEventTitle] = useState('');

  useEffect(() => {
    if (eventData?.title) setEventTitle(eventData.title);
  }, [eventData]);

  useEffect(() => {
    const fetchAlbums = async () => {
      const { data, error } = await supabase.from('collection').select('*');
      if (error) {
        console.error('Error fetching albums:', error.message);
        return;
      }

      let filtered = data;

      if (eventData?.allowed_formats?.length) {
        const allowed = eventData.allowed_formats.map(f => f.toLowerCase().trim());
        filtered = filtered.filter(album =>
          allowed.includes(album.folder?.toLowerCase().trim())
        );
      }

      setAlbums(filtered);
    };

    fetchAlbums();
  }, [eventData]);

  const filteredAlbums = albums.filter(album => {
    const matchesSearch =
      album.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      album.artist.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMedia =
      !mediaFilter || album.folder?.toLowerCase() === mediaFilter.toLowerCase();

    return matchesSearch && matchesMedia;
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

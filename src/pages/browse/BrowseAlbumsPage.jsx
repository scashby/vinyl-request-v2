import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import supabase from '../../supabase';
import AlbumCard from '../../components/AlbumCard';
import '../../styles/album-browse.css';

function BrowseAlbumsPage() {
  const location = useLocation();
  const eventData = location.state?.eventData || null;

  const [albums, setAlbums] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');
  const [allowedFormats, setAllowedFormats] = useState(null);

  useEffect(() => {
    if (eventData?.allowed_formats?.length) {
      setAllowedFormats(eventData.allowed_formats.map(f => f.toLowerCase()));
    }
  }, [eventData]);

  useEffect(() => {
    const fetchAlbums = async () => {
      const { data, error } = await supabase.from('collection').select('*');
      if (!error && data) setAlbums(data);
    };
    fetchAlbums();
  }, []);

  const filteredAlbums = albums.filter(album => {
    const matchesSearch = searchTerm === '' ||
      album.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      album.artist?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMedia = mediaFilter === '' ||
      album.folder?.toLowerCase() === mediaFilter.toLowerCase();

    const matchesAllowed = !allowedFormats ||
      allowedFormats.includes(album.folder?.toLowerCase());

    return matchesSearch && matchesMedia && matchesAllowed;
  });

  return (
    <main>
      <div className="overlay"></div>
      <div className="internal-page">
        <div className="internal-header">
          <h1>Browse Collection{eventData?.title ? ` — ${eventData.title}` : ''}</h1>
        </div>
        <div className="browse-controls">
          <input
            type="text"
            placeholder="Search by title or artist"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select value={mediaFilter} onChange={(e) => setMediaFilter(e.target.value)}>
            <option value="">All</option>
            <option value="Vinyl">Vinyl</option>
            <option value="Cassettes">Cassettes</option>
            <option value="45s">45s</option>
            <option value="CD">CD</option>
            <option value="8-Track">8-Track</option>
          </select>
        </div>
        <section className="album-grid">
          {filteredAlbums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </section>
      </div>
    </main>
  );
}

export default BrowseAlbumsPage;

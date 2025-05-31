import React, { useEffect, useState } from 'react';
import AlbumCard from '../../components/AlbumCard';
import '../../styles/album-browse.css';

function BrowseAlbumsPage() {
  const [albums, setAlbums] = useState([]);

  useEffect(() => {
    fetch('/data/albums.json')
      .then(response => response.json())
      .then(data => setAlbums(data))
      .catch(err => console.error('Error fetching albums:', err));
  }, []);

  return (
    <div className="album-browse-page">
      {albums.map(album => (
        <AlbumCard key={album.id} album={album} />
      ))}
    </div>
  );
}

export default BrowseAlbumsPage;

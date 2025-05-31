import React from 'react';
import '../../styles/browse-albums.css';

export default function BrowseAlbumsPage() {
  const albums = [
    {
      id: 1,
      title: 'British Steel',
      artist: 'Judas Priest',
      year: 1980,
      format: 'Vinyl',
      cover: '/images/british-steel.jpg'
    },
    {
      id: 2,
      title: 'Love at First Sting',
      artist: 'Scorpions',
      year: 1984,
      format: 'Cassette',
      cover: '/images/love-at-first-sting.jpg'
    }
  ];

  const formatColors = {
    Vinyl: 'purple-600',
    Cassette: 'green-600',
    '45s': 'red-600',
    CD: 'teal-600',
    '8-Track': 'orange-600'
  };

  return (
    <div className="browse-container">
      <h1 className="browse-title">Browse Collection</h1>
      <div className="album-list">
        {albums.map((album) => (
          <div key={album.id} className="album-card">
            <div className={`media-badge bg-${formatColors[album.format]}`}>{album.format}</div>
            <img src={album.cover} alt={album.title} className="album-image" />
            <h2 className="album-name text-blue-600">{album.title}</h2>
            <p className="album-info">{album.artist} • {album.year}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

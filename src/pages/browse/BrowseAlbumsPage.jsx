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

  const formatColor = {
    Vinyl: 'purple-600',
    Cassette: 'green-600',
    '45s': 'red-600',
    CD: 'teal-600',
    '8-Track': 'orange-600'
  };

  return (
    <div className="browse-wrapper">
      <h1 className="browse-header">Browse Collection</h1>
      <div className="album-grid">
        {albums.map((album) => (
          <div key={album.id} className="album-card">
            <div className={`media-badge bg-${formatColor[album.format]}`}>{album.format}</div>
            <img className="album-img" src={album.cover} alt={album.title} />
            <h2 className="album-title text-blue-600">{album.title}</h2>
            <p className="album-meta">{album.artist} • {album.year}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
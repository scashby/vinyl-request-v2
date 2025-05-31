// ✅ BrowseAlbumsPage.jsx
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

  const badgeColors = {
    Vinyl: 'purple',
    Cassette: 'green',
    '45s': 'red',
    CD: 'teal',
    '8-Track': 'orange'
  };

  return (
    <div className="browse-wrapper">
      <h1 className="browse-header">Browse Collection</h1>
      <div className="album-grid">
        {albums.map(album => (
          <div key={album.id} className="album-card">
            <div className={`media-badge ${badgeColors[album.format]}`}>{album.format}</div>
            <img src={album.cover} alt={album.title} className="album-cover" />
            <div className="album-text">
              <h2 className="album-title">{album.title}</h2>
              <p className="album-meta">{album.artist} • {album.year}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import '../../styles/album-browse.css';

const albums = [
  {
    id: 1,
    title: 'British Steel',
    artist: 'Judas Priest',
    year: '1980',
    image: '/images/british-steel.jpg',
    format: 'Vinyl',
  },
  {
    id: 2,
    title: 'Love at First Sting',
    artist: 'Scorpions',
    year: '1984',
    image: '/images/love-at-first-sting.jpg',
    format: 'Cassette',
  },
];

const formatColors = {
  Vinyl: 'purple',
  Cassette: 'green',
  '45s': 'red',
  CD: 'teal',
  '8-Track': 'orange',
};

export default function BrowseAlbumsPage() {
  return (
    <div className="browse-container">
      <h1 className="browse-title">Browse Collection</h1>
      <div className="album-grid">
        {albums.map((album) => (
          <div className="album-card" key={album.id}>
            <div className="badge" style={{ backgroundColor: `var(--${formatColors[album.format]})` }}>
              {album.format}
            </div>
            <img src={album.image} alt={album.title} className="album-image" />
            <h2 className="album-title">{album.title}</h2>
            <p className="album-meta">{album.artist} • {album.year}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

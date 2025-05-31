import React from 'react';
import '../../styles/album-browse.css';
import { Link } from 'react-router-dom';

const albums = [
  {
    id: 1,
    title: 'British Steel',
    artist: 'Judas Priest',
    year: 1980,
    image: '/images/british-steel.jpg',
    format: 'Vinyl',
  },
];

export default function BrowseAlbumsPage() {
  return (
    <div className="browse-page">
      <h1>Browse Collection</h1>
      <div className="album-grid">
        {albums.map((album) => (
          <Link to={`/album/${album.id}`} key={album.id} className="album-card">
            <span className={`badge ${album.format.toLowerCase()}`}>{album.format}</span>
            <img src={album.image} alt={album.title} />
            <div className="info">
              <p className="title">{album.title}</p>
              <p className="artist">{album.artist} • {album.year}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

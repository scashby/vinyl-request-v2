import React from 'react';
import '../../styles/browse-albums.css';

const albums = [
  {
    id: 1,
    title: "British Steel",
    artist: "Judas Priest",
    year: 1980,
    cover: "/images/judas-priest-british-steel.jpg",
    format: "vinyl"
  },
  {
    id: 2,
    title: "Love at First Sting",
    artist: "Scorpions",
    year: 1984,
    cover: "/images/scorpions-love-at-first-sting.jpg",
    format: "cassette"
  }
];

const BrowseAlbumsPage = () => {
  return (
    <div className="album-browse-page">
      <h1 className="page-title">Browse Collection</h1>
      <div className="album-grid">
        {albums.map((album) => (
          <div key={album.id} className="album-card">
            <div className="album-thumb">
              <img src={album.cover} alt={album.title} />
              <span className={`badge badge-${album.format}`}>{album.format.charAt(0).toUpperCase() + album.format.slice(1)}</span>
            </div>
            <div className="album-meta">
              <h2>{album.title}</h2>
              <p>{album.artist} • {album.year}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrowseAlbumsPage;
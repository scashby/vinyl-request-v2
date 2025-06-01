import React from 'react';
import '../../styles/album-browse.css';

export default function BrowseAlbumsPage() {
  return (
    <div className="browse-collection">
      <h1 className="browse-heading">Browse Collection</h1>
      <div className="album-grid">
        <div className="album-card">
          <div className="badge badge-vinyl">Vinyl</div>
          <img src="/assets/images/british-steel.jpg" alt="British Steel" className="album-image" />
          <div className="album-info">
            <h2 className="album-title">British Steel</h2>
            <p className="album-meta">Judas Priest • 1980</p>
          </div>
        </div>
        <div className="album-card">
          <div className="badge badge-cassette">Cassette</div>
          <img src="/assets/images/love-at-first-sting.jpg" alt="Love at First Sting" className="album-image" />
          <div className="album-info">
            <h2 className="album-title">Love at First Sting</h2>
            <p className="album-meta">Scorpions • 1984</p>
          </div>
        </div>
      </div>
    </div>
  );
}

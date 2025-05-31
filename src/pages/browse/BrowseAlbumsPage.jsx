// ✅ BrowseAlbumsPage.jsx
import React from 'react';
import '../../styles/browse-albums.css';

const BrowseAlbumsPage = () => {
  return (
    <div className="album-browse-page">
      <h1 className="page-title">Browse Collection</h1>
      <div className="album-grid">
        <div className="album-card">
          <img src="/judas-priest-british-steel.jpg" alt="British Steel" className="album-image" />
          <div className="album-info">
            <h2>Judas Priest</h2>
            <p>British Steel</p>
            <span className="badge badge-vinyl">Vinyl</span>
          </div>
        </div>
        <div className="album-card">
          <img src="/scorpions-love-at-first-sting.jpg" alt="Love at First Sting" className="album-image" />
          <div className="album-info">
            <h2>Scorpions</h2>
            <p>Love at First Sting</p>
            <span className="badge badge-cassette">Cassette</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrowseAlbumsPage;
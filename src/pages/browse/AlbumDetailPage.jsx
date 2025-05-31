import React from 'react';
import { useParams } from 'react-router-dom';
import '../../styles/album-detail.css';

function AlbumDetailPage() {
  const { id } = useParams();

  return (
    <div className="album-detail-page">
      <div className="background-blur" />
      <div className="album-content">
        <img src={`/images/albums/${id}.jpg`} alt="Album cover" className="album-cover" />
        <div className="album-metadata">
          <h2 className="album-title">Album Title</h2>
          <p className="album-subtitle">Artist • Year</p>
          <span className="media-badge vinyl">Vinyl</span>
        </div>
        <div className="tracklist">
          <h3>Side A</h3>
          <ul>
            <li>A1. Track One</li>
            <li>A2. Track Two</li>
          </ul>
          <h3>Side B</h3>
          <ul>
            <li>B1. Track Three</li>
            <li>B2. Track Four</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default AlbumDetailPage;

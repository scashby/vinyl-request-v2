import React from 'react';
import '../../styles/album-detail.css';

export default function AlbumDetailPage() {
  return (
    <div className="album-detail-container">
      <img src="/assets/images/british-steel.jpg" alt="Album cover" className="album-art" />
      <div className="album-detail-info">
        <h1 className="album-detail-title">British Steel</h1>
        <p className="album-detail-meta">Judas Priest • 1980</p>
        <div className="badge badge-vinyl">Vinyl</div>
        <p className="track-count">9 TRACKS</p>
        <div className="tracklist">
          <div className="side">
            <h3>Side A</h3>
            <ul>
              <li><strong>A1.</strong> Rapid Fire</li>
              <li><strong>A2.</strong> Metal Gods</li>
              <li><strong>A3.</strong> Breaking the Law</li>
              <li><strong>A4.</strong> Grinder</li>
            </ul>
          </div>
          <div className="side">
            <h3>Side B</h3>
            <ul>
              <li><strong>B1.</strong> United</li>
              <li><strong>B2.</strong> You Don’t Have to Be Old to Be Wise</li>
              <li><strong>B3.</strong> Living After Midnight</li>
              <li><strong>B4.</strong> The Rage</li>
              <li><strong>B5.</strong> Steeler</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

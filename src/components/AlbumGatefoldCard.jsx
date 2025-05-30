// ✅ AlbumGatefoldCard.jsx (Hardcoded Demo)
import React from 'react';
import '../../styles/gatefold.css';

const AlbumGatefoldCard = () => {
  return (
    <div className="gatefold-wrapper">
      {/* Left: Album cover */}
      <div className="gatefold-cover">
        <img
          src="/images/hotel-california.jpg"
          alt="Hotel California cover"
          className="cover-art"
        />
      </div>

      {/* Right: Album info */}
      <div className="gatefold-info">
        <h2>Hotel California</h2>
        <h3>The Eagles</h3>

        <div className="sides">
          <div className="side">
            <h4>Side A</h4>
            <ul>
              <li>Hotel California</li>
              <li>New Kid in Town</li>
              <li>Life in the Fast Lane</li>
              <li>Wasted Time</li>
            </ul>
          </div>
          <div className="side">
            <h4>Side B</h4>
            <ul>
              <li>Wasted Time (Reprise)</li>
              <li>Victim of Love</li>
              <li>Pretty Maids All in a Row</li>
              <li>Try and Love Again</li>
              <li>The Last Resort</li>
            </ul>
          </div>
        </div>

        <div className="gatefold-actions">
          <button className="queue-button">➕ Add to Queue</button>
          <button className="return-button">↩️ Return to Collection</button>
        </div>
      </div>
    </div>
  );
};

export default AlbumGatefoldCard;
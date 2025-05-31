// ✅ Imports
import React from 'react';
import '../styles/gatefold.css';

// ✅ Component: AlbumGatefoldCard (Hardcoded Content)
const AlbumGatefoldCard = () => {
  return (
    <div className="gatefold-container">
      {/* Left Panel - Full Album Cover */}
      <div className="gatefold-left">
        <img
          src="https://i.discogs.com/PZz0RZth-jDXq_vEwv640MTGizMZe5KEc6KTzM6ZKzY/rs:fit/g:sm/q:90/h:600/w:596/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTEzNTQ4/MTYtMTM4MzkwOTE3/MC0xNzEyLmpwZWc.jpeg"
          alt="Hotel California cover"
          className="gatefold-cover"
        />
      </div>

      {/* Right Panel - Info & Tracklist */}
      <div className="gatefold-right">
        <div className="gatefold-text">
          <h1 className="album-title">Hotel California</h1>
          <h2 className="album-artist">Eagles</h2>

          <div className="side-block">
            <h3 className="side-label">Side A</h3>
            <ul className="tracklist">
              <li>Hotel California</li>
              <li>New Kid in Town</li>
              <li>Life in the Fast Lane</li>
              <li>Wasted Time</li>
            </ul>
          </div>

          <div className="side-block">
            <h3 className="side-label">Side B</h3>
            <ul className="tracklist">
              <li>Wasted Time (Reprise)</li>
              <li>Victim of Love</li>
              <li>Pretty Maids All in a Row</li>
              <li>Try and Love Again</li>
              <li>The Last Resort</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlbumGatefoldCard;
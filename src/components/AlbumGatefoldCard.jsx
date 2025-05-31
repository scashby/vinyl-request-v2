// ✅ AlbumGatefoldCard.jsx

import React from 'react';
import './gatefold.css';

const AlbumGatefoldCard = ({ album }) => {
  if (!album) return null;
  const { image, title, artist, sides } = album;

  return (
    <div className="gatefold-container">
      <div className="gatefold-left">
        <img
          src={image}
          alt={title}
          className="gatefold-image"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/fallback.jpg';
          }}
        />
      </div>
      <div className="gatefold-right">
        <h1 className="gatefold-title">{title}</h1>
        <h2 className="gatefold-artist">{artist}</h2>
        {sides?.map((side, i) => (
          <div key={i}>
            <h3 className="gatefold-side">Side {side.label}</h3>
            <ul>
              {side.tracks.map((track, idx) => (
                <li key={idx} className="gatefold-track">{track}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlbumGatefoldCard;

import React from 'react';
import '../styles/gatefold.css';

const AlbumGatefoldCard = ({ title, artist, sides, image }) => {
  return (
    <div className="gatefold-container">
      <div className="gatefold-left">
        <img src={image} alt={title} className="album-image" />
      </div>
      <div className="gatefold-right">
        <h1 className="title">{title}</h1>
        <h2 className="artist">{artist}</h2>
        {sides?.map((side, i) => (
          <div key={i}>
            <h3 className="side-label">Side {side.side}</h3>
            <ul className="tracklist">
              {side.tracks.map((track, idx) => (
                <li key={idx}>{track}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlbumGatefoldCard;
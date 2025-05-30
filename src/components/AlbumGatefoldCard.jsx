// ✅ AlbumGatefoldCard.jsx

import React from "react";
import "./gatefold.css";

const AlbumGatefoldCard = ({ album }) => {
  const { title, artist, image, sides } = album;

  return (
    <div className="gatefold-container">
      <div className="gatefold-left">
        <img src={image} alt={title} className="gatefold-image" />
      </div>
      <div className="gatefold-right">
        <h1 className="gatefold-title">{title}</h1>
        <h2 className="gatefold-artist">{artist}</h2>
        {sides?.map((side, index) => (
          <div key={index} className="gatefold-side">
            <h3 className="gatefold-side-title">Side {side.side}</h3>
            <ul>
              {side.tracks.map((track, idx) => (
                <li key={idx} className="gatefold-track">
                  {track}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlbumGatefoldCard;

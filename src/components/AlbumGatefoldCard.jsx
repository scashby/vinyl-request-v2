// ✅ Gatefold AlbumCard Component

import React from "react";
import "../styles/gatefold.css";

const AlbumGatefoldCard = ({ album }) => {
  if (!album) return null;
  const { title, artist, image, sides } = album;

  return (
    <div className="gatefold-wrapper">
      <div className="gatefold-left">
        <img src={image} alt={title} className="gatefold-artwork" />
      </div>
      <div className="gatefold-right">
        <h1 className="gatefold-title">{title}</h1>
        <h2 className="gatefold-artist">{artist}</h2>
        {sides?.map((side) => (
          <div key={side.name} className="gatefold-side">
            <h3 className="gatefold-side-name">{side.name}</h3>
            <ul className="gatefold-tracklist">
              {side.tracks.map((track, i) => (
                <li key={i}>{track}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlbumGatefoldCard;

import React from "react";
import "../styles/gatefold.css";

const AlbumGatefoldCard = ({ album }) => {
  if (!album) return null;
  const { title, artist, sides, imageUrl } = album;

  return (
    <div className="gatefold-wrapper">
      <div className="gatefold-left">
        <img src={imageUrl} alt={`${title} cover`} className="album-image" />
      </div>
      <div className="gatefold-right">
        <h1>{title}</h1>
        <h2>{artist}</h2>
        {sides.map((side, idx) => (
          <div key={idx} className="side">
            <h3>{`Side ${side.label}`}</h3>
            <ul>
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

import React from "react";
import "../styles/gatefold.css"; // ✅ Fixed import path

const AlbumGatefoldCard = ({ album }) => {
  if (!album) return <div>Album data not found.</div>;

  const { title, artist, coverImage, sides } = album;

  return (
    <div className="gatefold-container">
      <div className="gatefold-left">
        <img src={coverImage} alt={`${title} cover`} className="gatefold-cover" />
      </div>
      <div className="gatefold-right">
        <h2>{title}</h2>
        <h3>{artist}</h3>
        {sides?.map((side, idx) => (
          <div key={idx}>
            <h4>Side {side.name}</h4>
            <ul>
              {side.tracks?.map((track, i) => (
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
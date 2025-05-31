import React from "react";
import "./gatefold.css";

const AlbumGatefoldCard = ({ album }) => {
  if (!album) return null;

  const { title, artist, imageUrl, tracksA = [], tracksB = [] } = album;

  return (
    <div className="gatefold-container">
      <div className="gatefold-left">
        <img src={imageUrl} alt={title} className="album-image" />
      </div>
      <div className="gatefold-right">
        <h1 className="title">{title}</h1>
        <h2 className="artist">{artist}</h2>

        <div className="tracklist">
          <h3 className="side">Side A</h3>
          {tracksA.map((track, index) => (
            <p className="track" key={`A-${index}`}>{track}</p>
          ))}
          <h3 className="side">Side B</h3>
          {tracksB.map((track, index) => (
            <p className="track" key={`B-${index}`}>{track}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlbumGatefoldCard;
import React from 'react';
import { Link } from 'react-router-dom';

function AlbumCard({ album }) {
  const typeClass = album.mediaType
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/-/g, '');

  return (
    <div className="album-card">
      <Link to={`/album/${album.id}`}>
        <span className={`badge ${typeClass}`}>{album.mediaType}</span>
        <img src={`/images/${album.image}`} alt={album.title} />
      </Link>
      <div className="info">
        <p className="title text-blue-600 font-semibold">{album.title}</p>
        <p className="artist">{album.artist} • {album.year}</p>
      </div>
    </div>
  );
}

export default AlbumCard;

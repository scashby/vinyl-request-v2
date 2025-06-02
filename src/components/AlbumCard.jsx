import React from 'react';
import { Link } from 'react-router-dom';

function AlbumCard({ album }) {
  // Convert mediaType to lowercase and match class naming in CSS
  const typeClass = album.mediaType
    .toLowerCase()
    .replace(/\s/g, '') // remove spaces
    .replace(/-/g, '')  // remove dashes

  return (
    <Link className="album-card" to={`/album/${album.id}`}>
      <span className={`badge ${typeClass}`}>
        {album.mediaType}
      </span>
      <img src={`/images/${album.image}`} alt={album.title} />
      <div className="info">
        <p className="title text-blue-600 font-semibold">{album.title}</p>
        <p className="artist">{album.artist} • {album.year}</p>
      </div>
    </Link>
  );
}

export default AlbumCard;

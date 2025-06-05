import React from 'react';
import { Link } from 'react-router-dom';

function AlbumCard({ album }) {
  const typeMap = {
  vinyl: 'vinyl',
  cassettes: 'cassette',
  cd: 'cd',
  '45s': 'fortyfive',
  '8-track': 'eighttrack'
};

const typeClass = typeMap[album.mediaType?.toLowerCase()] || 'vinyl';


  return (
    <div className="album-card">
      <Link
        to={`/album/${album.id}${album.eventId ? `?eventId=${album.eventId}` : ''}`}
        state={album.trail ? { trail: album.trail } : undefined}
      >
        <span className={`badge ${typeClass}`}>{album.mediaType}</span>
        <img src={album.image} alt={album.title} />
      </Link>

      <div className="info">
        <p className="album-title text-blue-600 font-semibold">{album.title}</p>
        <p className="album-artist">{album.artist} • {album.year}</p>
      </div>
    </div>
  );
}

export default AlbumCard;

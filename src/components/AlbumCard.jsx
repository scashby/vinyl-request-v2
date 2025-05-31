import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/album-browse.css';

const badgeColors = {
  Vinyl: 'bg-purple-600',
  Cassette: 'bg-green-600',
  '45s': 'bg-red-600',
  CD: 'bg-teal-600',
  '8-Track': 'bg-orange-600',
};

function AlbumCard({ album }) {
  const badgeClass = badgeColors[album.mediaType] || 'bg-gray-500';

  return (
    <Link to={`/album/${album.id}`} className="album-card">
      <div className="album-image-container">
        <img src={`/images/albums/${album.id}.jpg`} alt={album.title} className="album-image" />
        <span className={`media-badge ${badgeClass}`}>{album.mediaType}</span>
      </div>
      <h3 className="album-title text-blue-600">{album.title}</h3>
      <p className="album-meta">{album.artist} • {album.year}</p>
      <p className="track-count">{album.trackCount} tracks</p>
    </Link>
  );
}

export default AlbumCard;

import React from 'react';

const badgeColors = {
  Vinyl: 'bg-purple-600',
  Cassette: 'bg-green-600',
  '45 RPM': 'bg-red-600',
  CD: 'bg-teal-600',
  '8-Track': 'bg-orange-600',
};

function AlbumCard({ album }) {
  const badgeClass = badgeColors[album.mediaType] || 'bg-gray-400';

  return (
    <a className="album-card" href="#">
      <span className={`badge text-white text-xs px-2 py-1 rounded ${badgeClass}`}>
        {album.mediaType}
      </span>
      <img src={`/images/${album.image}`} alt={album.title} />
      <div className="info">
        <p className="title text-blue-600 font-semibold">{album.title}</p>
        <p className="artist text-gray-700">{album.artist} • {album.year}</p>
      </div>
    </a>
  );
}

export default AlbumCard;

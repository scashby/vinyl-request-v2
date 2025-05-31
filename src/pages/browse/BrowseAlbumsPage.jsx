import React from 'react';
import '../../styles/browse-albums.css';

const formatColors = {
  Vinyl: 'bg-purple-600',
  Cassette: 'bg-green-600',
  '45s': 'bg-red-600',
  CD: 'bg-teal-600',
  '8-Track': 'bg-orange-600'
};

const albums = [
  {
    id: 1,
    title: 'British Steel',
    artist: 'Judas Priest',
    year: 1980,
    format: 'Vinyl',
    cover: '/images/british-steel.jpg'
  },
  {
    id: 2,
    title: 'Love at First Sting',
    artist: 'Scorpions',
    year: 1984,
    format: 'Cassette',
    cover: '/images/love-at-first-sting.jpg'
  }
];

export default function BrowseAlbumsPage() {
  return (
    <div className="browse-container bg-gray-100 min-h-screen p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Browse Collection</h1>
      <div className="grid grid-cols-2 gap-6">
        {albums.map((album) => (
          <div key={album.id} className="relative bg-white rounded-xl shadow p-3">
            <div className={`absolute top-2 left-2 text-xs text-white px-2 py-1 rounded ${formatColors[album.format]}`}>
              {album.format}
            </div>
            <img
              src={album.cover}
              alt={album.title}
              className="w-full h-auto rounded mb-2 object-cover"
            />
            <h2 className="text-blue-600 text-lg font-semibold">{album.title}</h2>
            <p className="text-sm text-gray-600">{album.artist} • {album.year}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

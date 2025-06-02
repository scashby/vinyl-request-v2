import React from 'react';
import AlbumCard from '../components/AlbumCard';
import '../styles/album-browse.css';

const albums = [
  {{
    title: 'British Steel',
    artist: 'Judas Priest',
    year: 1980,
    mediaType: 'Vinyl',
    image: 'british-steel.jpg'
  }},
  {{
    title: 'Love at First Sting',
    artist: 'Scorpions',
    year: 1984,
    mediaType: 'Cassette',
    image: 'love-at-first-sting.jpg'
  }}
];

function BrowseAlbumsPage() {{
  return (
    <div className="browse-page">
      <h1 className="text-3xl font-bold mb-6">Browse Collection</h1>
      <div className="album-grid">
        {{albums.map((album, index) => (
          <AlbumCard key={index} album={{...album}} />
        ))}}
      </div>
    </div>
  );
}}

export default BrowseAlbumsPage;

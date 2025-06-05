import React from 'react';
import AlbumCard from '../../components/AlbumCard';
import '../../styles/album-browse.css';
import '../../styles/internal.css';

const albums = [
  {
    title: 'British Steel',
    artist: 'Judas Priest',
    year: 1980,
    mediaType: 'Vinyl',
    image: 'judas-priest-british-steel.jpg'
  },
  {
    title: 'Love at First Sting',
    artist: 'Scorpions',
    year: 1984,
    mediaType: 'Cassette',
    image: 'scorpions-love-at-first-sting.jpg'
  }
];

function BrowseAlbumsPage() {
  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Browse Collection</h1>
        </div>
      </header>

      <main className="page-body">
        <section className="album-grid">
          {albums.map((album, index) => (
            <AlbumCard key={index} album={album} />
          ))}
        </section>
      </main>

      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </div>
  );
}

export default BrowseAlbumsPage;

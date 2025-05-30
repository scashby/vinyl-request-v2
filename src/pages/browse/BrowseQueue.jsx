
import React from 'react';
import '../../styles/internal.css';
import '../../styles/browse-queue.css';

const BrowseQueue = () => {
  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Event Name Placeholder</h1>
        </div>
      </header>
      <main className="page-body browse-queue">
        <aside className="event-sidebar">
          <article className="event-card">
            <img src="/images/event-header-still.jpg" alt="Vinyl Sunday" className="card-square" />
            <h2>Vinyl Sunday</h2>
            <p>June 2, 2025</p>
          </article>
        </aside>
        <section className="queue-display">
          <div className="spotify-header-row">
            <div>Album</div>
            <div>Artist</div>
            <div>Side</div>
            <div>Votes</div>
            <div>Like</div>
          </div>
          <div className="spotify-row">
            <div>The Dark Side of the Moon</div>
            <div>Pink Floyd</div>
            <div>A</div>
            <div className="votes">★★★★☆</div>
            <div><button className="vote-button">👍</button></div>
          </div>
          <div className="spotify-row">
            <div>Abbey Road</div>
            <div>The Beatles</div>
            <div>B</div>
            <div className="votes">★★★★★+</div>
            <div><button className="vote-button">👍</button></div>
          </div>
          <div className="spotify-row">
            <div>Random Album</div>
            <div>Unknown Artist</div>
            <div>A</div>
            <div className="votes">☆☆☆☆☆</div>
            <div><button className="vote-button">👍</button></div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default BrowseQueue;

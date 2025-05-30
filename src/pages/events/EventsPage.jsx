import React from 'react';
import '../../styles/internal.css';

const EventsPage = () => {
  return (
    <>
      <header className="event-hero">
        <div className="overlay">
          <h1>Upcoming Vinyl Nights</h1>
        </div>
      </header>

      <main className="event-body">
        <section className="event-grid">
          <article className="event-card">
            <img src="/images/event-header-still.jpg" alt="Album Art" />
            <h2>Vinyl Sunday</h2>
            <p>June 2, 2025</p>
          </article>
          <article className="event-card">
            <img src="/images/event-header-still.jpg" alt="Album Art" />
            <h2>80s Night</h2>
            <p>June 9, 2025</p>
          </article>
        </section>
      </main>

      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </>
  );
};

export default EventsPage;

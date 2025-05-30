import React from 'react';
import '../../styles/events.css';

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
          <div className="event-card">
            <img src="/images/event-header-still.jpg" alt="Vinyl Sunday" />
            <h3>Vinyl Sunday</h3>
            <p>June 2, 2025</p>
          </div>
          <div className="event-card">
            <img src="/images/event-header-still.jpg" alt="80s Night" />
            <h3>80s Night</h3>
            <p>June 9, 2025</p>
          </div>
        </section>
      </main>

      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </>
  );
};

export default EventsPage;

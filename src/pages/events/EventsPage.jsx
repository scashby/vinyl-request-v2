import React from 'react';
import InternalLayout from '../../layouts/InternalLayout';

const EventsPage = () => {
  return (
    <InternalLayout title="Upcoming Vinyl Nights">
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
    </InternalLayout>
  );
};

export default EventsPage;

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/internal.css';
import Breadcrumbs from '../../components/Breadcrumbs';
import '../../styles/breadcrumb.css';

const EventsPage = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
      } else {
        setEvents(data);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Upcoming Vinyl Nights</h1>
        </div>
      </header>

      <Breadcrumbs />

      <main className="event-body">
        <section className="event-grid">
          {events.map((event) => {
            const imageSrc = event.image_url && event.image_url.includes('dropbox.com')
              ? event.image_url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').split('?')[0]
              : event.image_url || '/images/event-header-still.jpg';

            return (
              <article className="event-card" key={event.id}>
                <img
                  src={imageSrc}
                  alt={event.title}
                  className="card-square"
                />
                <h2>{event.title}</h2>
                {event.location && (
                  <p>
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {event.location}
                    </a>
                  </p>
                )}
                <p>{event.date}</p>
                <p>{event.time}</p>
              </article>
            );
          })}
        </section>
      </main>

      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </div>
  );
};

export default EventsPage;

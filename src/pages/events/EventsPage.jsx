import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/internal.css';
import Breadcrumbs from '../../components/Breadcrumbs';
import '../../styles/breadcrumb.css';
import { Link } from 'react-router-dom';

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
        const today = new Date();
        const filtered = data.filter(event => new Date(event.date) >= today);
        setEvents(filtered);
      }
    };

    fetchEvents();
  }, []);

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    return `${new Date(`${month}/${day}/${year}`).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`;
  };

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
          const imageSrc = event.image_url || "/images/placeholder.png";
          return (
            <Link
              to={`/events/${event.id}`}
              state={{ trail: ["events"] }}
              key={event.id}
            >
              <article className="event-card">
                <img
                  src={imageSrc}
                  alt={event.title}
                  className="card-square"
                />
                <h2>{event.title}</h2>
                {event.location && (
                  <p>
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(
                        event.location
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {event.location}
                    </a>
                  </p>
                )}
                <p className="event-date">
                  {formatDate(event.date)}
                  <br />
                  <span className="event-time">{event.time}</span>
                </p>
              </article>
            </Link>
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

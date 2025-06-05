import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/internal.css';
import QueueSection from "../../components/QueueSection";

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching event:', error);
      } else {
        setEvent(data);
      }
    };

    fetchEvent();
  }, [id]);

  if (!event) return <div>Loading...</div>;

  const {
    title,
    date,
    time,
    location,
    image_url,
    info,
    info_url,
    has_queue
  } = event;

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    return new Date(`${month}/${day}/${year}`).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const imageSrc = image_url?.includes('dropbox.com')
    ? image_url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/\?.*$/, '')
    : image_url || '/images/event-header-still.jpg';

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>{title}</h1>
        </div>
      </header>

      <main className="page-body browse-queue" style={{ display: 'flex', gap: '2rem' }}>
        <aside className="event-sidebar">
          <article className="event-card">
            <img src={imageSrc} alt={title} className="card-square" />
            <h2>{title}</h2>
            {location && (
              <p>
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {location}
                </a>
              </p>
            )}
            <p className="event-date">
              {formatDate(date)}
              <br />
              {time && <span className="event-time">{time}</span>}
            </p>
          </article>
        </aside>

        <section style={{ flex: 2 }}>
          {(info || info_url) && (
            <div className="event-info-card">
              <h3>About This Event</h3>
              {info && <p>{info}</p>}
              {info_url && (
                <a
                  href={info_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View the event page
                </a>
              )}
            </div>
          )}
          {event.has_queue && (
            <>
              <QueueSection eventId={event.id} />

              <Link
                to={`/browse?eventId=${event.id}&formats=${encodeURIComponent(event.formats || '')}`}
                state={{ trail: ['events', event.title, 'browse'] }}
                className="text-blue-600 underline mt-4 inline-block"
              >
                Browse the Collection
              </Link>
            </>
          )} 
        </section>
      </main>

      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </div>
  );
}


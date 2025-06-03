import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/internal.css';
import '../../styles/breadcrumb.css';
import Breadcrumbs from '../../components/Breadcrumbs';

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

  if (!event) {
    return <div>Loading...</div>;
  }

  const {
    title,
    date,
    time,
    location,
    image_url,
    info,
    has_queue
  } = event;

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>{title}</h1>
        </div>
      </header>

      <Breadcrumbs />

      <main className="page-body">
        <section className="event-content">
          <img
            src={image_url || '/images/event-header-still.jpg'}
            alt={title}
            className="card-square"
          />
          <h2>{formattedDate} {time && `• ${time}`}</h2>
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
          {info && <p className="event-info">{info}</p>}
        </section>

        {has_queue && (
          <section className="queue-display mt-8">
            <h3 className="text-xl font-bold mb-4">Request Queue</h3>
            <div className="tracklist text-black bg-white p-4 rounded shadow">
              <div className="tracklist-header font-bold text-sm border-b border-gray-300 pb-2 mb-2 grid grid-cols-4 gap-4">
                <span>Album</span><span>Artist</span><span>Side</span><span>Votes</span>
              </div>
              <div className="track grid grid-cols-4 gap-4 py-1">
                <span>Sample Album</span><span>Sample Artist</span><span>A</span><span>★★★★☆</span>
              </div>
            </div>
            <Link to="/browse" className="button mt-4 inline-block bg-purple-600 text-white px-4 py-2 rounded">Add to Queue</Link>
          </section>
        )}
      </main>

      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </div>
  );
}

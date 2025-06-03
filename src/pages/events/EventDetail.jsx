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

      <Breadcrumbs />

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
          {info && (
            <div className="event-info bg-white text-black p-4 mb-4 rounded shadow">
              <h3 className="text-lg font-semibold mb-2">About This Event</h3>
              <p className="text-sm leading-relaxed">{info}</p>
            </div>
          )}
          {info_url && (
            <div className="event-link mb-6">
              <a
                href={info_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline text-sm"
              >
                Event info page
              </a>
            </div>
          )}

          {has_queue && (
            <section className="queue-display">
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
        </section>
      </main>

      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </div>
  );
}

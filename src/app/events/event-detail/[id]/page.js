// Event Detail page ("/events/event-detail/[id]")
// Shows event info, image, queue, and "browse the collection" link for this event.

"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from 'src/lib/supabaseClient';
import { formatEventText } from 'src/utils/textFormatter';
import 'styles/internal.css';
import 'styles/events.css';
import Image from 'next/image';
import QueueSection from 'components/QueueSection';
import EventDJSets from 'components/EventDJSets';

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;
  const [event, setEvent] = useState(null);
  const [prevEventId, setPrevEventId] = useState(null);
  const [nextEventId, setNextEventId] = useState(null);

  useEffect(() => {
    const fetchEventAndNavigation = async () => {
      // Fetch current event
      const { data: currentEvent, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching event:', error);
        return;
      }
      
      setEvent(currentEvent);

      // Fetch all events ordered by date (descending - most recent first)
      const { data: allEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, date')
        .order('date', { ascending: false });

      if (eventsError) {
        console.error('Error fetching all events:', eventsError);
        return;
      }

      // Find current event's position and set prev/next
      const currentIndex = allEvents.findIndex(e => e.id === parseInt(id));
      if (currentIndex > 0) {
        setPrevEventId(allEvents[currentIndex - 1].id);
      } else {
        setPrevEventId(null);
      }
      if (currentIndex < allEvents.length - 1) {
        setNextEventId(allEvents[currentIndex + 1].id);
      } else {
        setNextEventId(null);
      }
    };

    fetchEventAndNavigation();
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

  const goToBrowse = () => {
    router.push(`/browse/browse-albums?eventId=${event.id}`);
  };

  const navigateToEvent = (eventId) => {
    router.push(`/events/event-detail/${eventId}`);
  };

  return (
    <div className="page-wrapper event-detail-body">
      <header className="event-hero">
        <div className="overlay">
          <h1 dangerouslySetInnerHTML={{ __html: formatEventText(title) }} />
        </div>
      </header>

      {/* Navigation buttons at top */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <button
          onClick={() => navigateToEvent(prevEventId)}
          disabled={!prevEventId}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: prevEventId ? '#2563eb' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: prevEventId ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          ← Previous Event
        </button>
        <button
          onClick={() => router.push('/events/events-page')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6b7280',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          All Events
        </button>
        <button
          onClick={() => navigateToEvent(nextEventId)}
          disabled={!nextEventId}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: nextEventId ? '#2563eb' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: nextEventId ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          Next Event →
        </button>
      </div>

      <main className="event-body">
        <div className="event-content-grid">
          <aside className="event-sidebar">
            <article className="event-card">
              <Image
                src={imageSrc}
                alt={title}
                className="card-square"
                width={350}
                height={350}
                style={{ objectFit: "cover", borderRadius: 16 }}
                unoptimized
              />
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

          <section>
            {(info || info_url) && (
              <div className="event-info-card event-section">
                <h3>About This Event</h3>
                {info && <p dangerouslySetInnerHTML={{ __html: formatEventText(info) }} />}
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

            {/* DJ Sets Section */}
            <EventDJSets eventId={event.id} />

            {has_queue && (
              <>
                <QueueSection eventId={event.id} />
                <button
                  className="text-blue-600 underline mt-4 inline-block"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: "1rem"
                  }}
                  onClick={goToBrowse}
                >
                  Browse the Collection
                </button>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Navigation buttons at bottom */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <button
          onClick={() => navigateToEvent(prevEventId)}
          disabled={!prevEventId}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: prevEventId ? '#2563eb' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: prevEventId ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          ← Previous Event
        </button>
        <button
          onClick={() => navigateToEvent(nextEventId)}
          disabled={!nextEventId}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: nextEventId ? '#2563eb' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: nextEventId ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          Next Event →
        </button>
      </div>
    </div>
  );
}
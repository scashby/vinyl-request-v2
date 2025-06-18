// Event Detail page ("/events/event-detail/[id]")
// Shows event info, image, queue, and "browse the collection" link for this event.

"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient';
import 'styles/internal.css';
import 'styles/events.css';
import Image from 'next/image';
import QueueSection from 'components/QueueSection';
// import Footer from 'components/Footer';

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;
  const [event, setEvent] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      if (!error) setEvent(data);
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
    // allowed_formats,
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

  // Go to browse page (Next.js style)
  const goToBrowse = () => {
    router.push(`/browse/browse-albums?eventId=${event.id}`);
  };

  return (
   <div className="page-wrapper event-body event-detail-body">
      <header className="event-hero">
        <div className="overlay">
          <h1>{title}</h1>
        </div>
      </header>
      <main>
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
    </div>
  );
}

// Events Page ("/events/events-page")
// Lists all upcoming vinyl events, with images, dates, and links to event details.

"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/internal.css';
import Link from 'next/link';
import Image from 'next/image';
import Footer from '../../components/Footer';

export default function Page() {
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
      <main className="event-body">
        <section className="event-grid">
          {events.map((event) => {
            const imageSrc = event.image_url || "/images/placeholder.png";
            return (
              <article className="event-card" key={event.id}>
                <Link href={`/events/event-detail/${event.id}`}>
                  <Image
                    src={imageSrc}
                    alt={event.title}
                    className="card-square"
                    width={350}
                    height={350}
                    style={{ objectFit: "cover", borderRadius: 16 }}
                    unoptimized
                  />
                </Link>
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
                <p className="event-date">
                  {formatDate(event.date)}
                  <br />
                  <span className="event-time">{event.time}</span>
                </p>
              </article>
            );
          })}
        </section>
      </main>
      <Footer />
    </div>
  );
}

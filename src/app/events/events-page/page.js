// Events Page ("/events/events-page")
// Lists all upcoming vinyl events, with images, dates, and links to event details.
// Now includes TBA events, empty state message, and booking contact info.

"use client";

import { useState, useEffect } from 'react';
import { supabase } from 'src/lib/supabaseClient';

import 'styles/internal.css';
import 'styles/events.css';
import Link from 'next/link';
import Image from 'next/image';

export default function Page() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        setLoading(false);
      } else {
        // Get today's date string in YYYY-MM-DD format
        const today = new Date();
        const todayString = today.getFullYear() + '-' + 
          String(today.getMonth() + 1).padStart(2, '0') + '-' + 
          String(today.getDate()).padStart(2, '0');
        
        // Filter events to include today, future dates, and TBA events
        // TBA events can be represented with date '9999-12-31' or empty/null dates
        const filtered = data.filter(event => {
          if (!event.date || event.date === '') return true; // TBA events with no date
          if (event.date === '9999-12-31') return true; // TBA events with special date
          return event.date >= todayString; // Regular future events
        });
        
        // Sort so TBA events appear at the end
        const sorted = filtered.sort((a, b) => {
          // TBA events (no date or special date) go to the end
          const aIsTBA = !a.date || a.date === '' || a.date === '9999-12-31';
          const bIsTBA = !b.date || b.date === '' || b.date === '9999-12-31';
          
          if (aIsTBA && !bIsTBA) return 1;
          if (!aIsTBA && bIsTBA) return -1;
          if (aIsTBA && bIsTBA) return 0; // Both TBA, maintain order
          
          // Both have real dates, sort by date
          return a.date.localeCompare(b.date);
        });
        
        setEvents(sorted);
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const formatDate = (dateString) => {
    // Handle TBA events
    if (!dateString || dateString === '' || dateString === '9999-12-31') {
      return 'Date TBA';
    }
    
    const [year, month, day] = dateString.split('-');
    return `${new Date(`${month}/${day}/${year}`).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`;
  };

  const renderEmptyState = () => (
    <div style={{
      textAlign: 'center',
      padding: '3rem 1rem',
      color: '#666',
      fontSize: '1.1rem'
    }}>
      <h3 style={{ 
        fontSize: '1.5rem', 
        marginBottom: '1rem',
        color: '#333'
      }}>
        No upcoming events scheduled
      </h3>
      <p style={{ marginBottom: '2rem' }}>
        Check back soon for more vinyl nights and events!
      </p>
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '1.5rem',
        display: 'inline-block',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        <h4 style={{ 
          margin: '0 0 1rem 0',
          color: '#495057',
          fontSize: '1.2rem'
        }}>
          Want to book an event?
        </h4>
        
        {/* Book Online Button for empty state */}
        <div style={{ marginBottom: '1rem' }}>
          <a 
            href="https://calendly.com/deadwaxdialogues" // Replace with your actual booking URL
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              backgroundColor: '#007bff',
              color: '#ffffff',
              padding: '0.6rem 1.2rem',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '1rem',
              fontWeight: '600',
              boxShadow: '0 2px 4px rgba(0, 123, 255, 0.2)',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#0056b3';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#007bff';
            }}
          >
            📅 Book Online
          </a>
        </div>

        <div style={{ 
          color: '#666', 
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          or contact directly:
        </div>

        <p style={{ margin: '0.5rem 0', color: '#495057' }}>
          <strong>Steve Ashby</strong><br />
          Dead Wax Dialogues
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <a href="mailto:steve@deadwaxdialogues.com" 
             style={{ color: '#007bff', textDecoration: 'none' }}>
            steve@deadwaxdialogues.com
          </a>
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <a href="tel:443-235-6608" 
             style={{ color: '#007bff', textDecoration: 'none' }}>
            443-235-6608
          </a>
        </p>
      </div>
    </div>
  );

  const renderBookingSection = () => (
    <section style={{
      backgroundColor: '#f8f9fa',
      padding: '3rem 1rem',
      marginTop: '3rem',
      borderTop: '1px solid #e9ecef'
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <h3 style={{
          fontSize: '1.8rem',
          marginBottom: '1rem',
          color: '#333'
        }}>
          Book Dead Wax Dialogues for Your Event
        </h3>
        <p style={{
          fontSize: '1.1rem',
          color: '#666',
          marginBottom: '2rem',
          lineHeight: '1.6'
        }}>
          Looking to bring vinyl culture to your venue or event? 
          Get in touch to discuss hosting a Dead Wax Dialogues experience.
        </p>
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '2rem',
          display: 'inline-block',
          textAlign: 'left',
          minWidth: '320px'
        }}>
          <h4 style={{
            margin: '0 0 1.5rem 0',
            color: '#495057',
            fontSize: '1.3rem',
            textAlign: 'center'
          }}>
            Get In Touch
          </h4>
          
          {/* Book Online Button */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <a 
              href="https://calendly.com/deadwaxdialogues" // Replace with your actual booking URL
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                backgroundColor: '#007bff',
                color: '#ffffff',
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '1.1rem',
                fontWeight: '600',
                boxShadow: '0 2px 4px rgba(0, 123, 255, 0.2)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#0056b3';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#007bff';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              📅 Book Online
            </a>
          </div>

          <div style={{ 
            textAlign: 'center', 
            color: '#666', 
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            or contact directly:
          </div>

          <p style={{ margin: '0.75rem 0', fontSize: '1.1rem' }}>
            <strong>Steve Ashby</strong><br />
            <span style={{ color: '#666' }}>Dead Wax Dialogues</span>
          </p>
          <p style={{ margin: '0.75rem 0' }}>
            <strong>Email:</strong><br />
            <a href="mailto:steve@deadwaxdialogues.com" 
               style={{ 
                 color: '#007bff', 
                 textDecoration: 'none',
                 fontSize: '1.1rem'
               }}>
              steve@deadwaxdialogues.com
            </a>
          </p>
          <p style={{ margin: '0.75rem 0' }}>
            <strong>Phone:</strong><br />
            <a href="tel:443-235-6608" 
               style={{ 
                 color: '#007bff', 
                 textDecoration: 'none',
                 fontSize: '1.1rem'
               }}>
              443-235-6608
            </a>
          </p>
        </div>
      </div>
    </section>
  );

  if (loading) {
    return (
      <div className="page-wrapper">
        <header className="event-hero">
          <div className="overlay">
            <h1>Upcoming Vinyl Nights</h1>
          </div>
        </header>
        <main className="event-body events-page-body">
          <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem' }}>
            Loading events...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Upcoming Vinyl Nights</h1>
        </div>
      </header>
      <main className="event-body events-page-body">
        {events.length === 0 ? (
          renderEmptyState()
        ) : (
          <section className="event-grid">
            {events.map((event) => {
              const imageSrc = event.image_url || "/images/placeholder.png";
              const isTBA = !event.date || event.date === '' || event.date === '9999-12-31';
              
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
                    {!isTBA && event.time && (
                      <>
                        <br />
                        <span className="event-time">{event.time}</span>
                      </>
                    )}
                    {isTBA && (
                      <span style={{ 
                        display: 'block', 
                        fontSize: '0.9rem', 
                        color: '#666',
                        fontStyle: 'italic',
                        marginTop: '0.25rem'
                      }}>
                        Coming Soon
                      </span>
                    )}
                  </p>
                </article>
              );
            })}
          </section>
        )}
        {renderBookingSection()}
      </main>
    </div>
  );
}
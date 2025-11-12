// src/app/events/events-page/page.js
// Events Page - 9:30 Club Layout
// Section 1: "Up Next" - 1-2 large featured events (side by side)
// Section 2: 4-column grid of event cards  
// Section 3: Two-column layout - LEFT: vertical rows | RIGHT: sidebar

"use client";

import { useState, useEffect } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import 'styles/internal.css';
import 'styles/events.css';
import Link from 'next/link';
import Image from 'next/image';
import { formatEventText } from 'src/utils/textFormatter';

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
        const today = new Date();
        const todayString = today.getFullYear() + '-' + 
          String(today.getMonth() + 1).padStart(2, '0') + '-' + 
          String(today.getDate()).padStart(2, '0');
        
        const filtered = data.filter(event => {
          if (!event.date || event.date === '') return true;
          if (event.date === '9999-12-31') return true;
          return event.date >= todayString;
        });
        
        const sorted = filtered.sort((a, b) => {
          const aIsTBA = !a.date || a.date === '' || a.date === '9999-12-31';
          const bIsTBA = !b.date || b.date === '' || b.date === '9999-12-31';
          
          if (aIsTBA && !bIsTBA) return 1;
          if (!aIsTBA && bIsTBA) return -1;
          if (aIsTBA && bIsTBA) return 0;
          
          return a.date.localeCompare(b.date);
        });
        
        setEvents(sorted);
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, []);

  const formatCompactDate = (dateString) => {
    if (!dateString || dateString === '' || dateString === '9999-12-31') {
      return { month: 'TBA', day: '', weekday: '' };
    }
    
    const [year, month, day] = dateString.split('-');
    const date = new Date(`${month}/${day}/${year}`);
    
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: date.getDate(),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
    };
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <header className="event-hero">
          <div className="overlay">
            <h1>Upcoming Vinyl Nights</h1>
          </div>
        </header>
        <main className="event-body">
          <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem' }}>
            Loading events...
          </div>
        </main>
      </div>
    );
  }

  // Split events: 2 featured, 8 grid, rest in list
  const featuredEvents = events.slice(0, 2);
  const gridEvents = events.slice(2, 10);
  const listEvents = events.slice(10);

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Upcoming Vinyl Nights</h1>
        </div>
      </header>
      
      <main className="event-body" style={{ padding: 0 }}>
        {/* ========== SECTION 1: "UP NEXT" - FEATURED EVENTS ========== */}
        {featuredEvents.length > 0 && (
          <section style={{
            background: '#000',
            padding: '3rem 2rem',
            borderBottom: '1px solid #333'
          }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              <h2 style={{
                color: '#fff',
                fontSize: '3rem',
                fontWeight: 'bold',
                marginBottom: '2rem'
              }}>
                Up Next
              </h2>
              
              {/* Two large featured events side by side */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: featuredEvents.length === 1 ? '1fr' : '1fr 1fr',
                gap: '2rem'
              }}>
                {featuredEvents.map((event) => {
                  const imageSrc = event.image_url || "/images/placeholder.png";
                  const dateInfo = formatCompactDate(event.date);
                  const isTBA = !event.date || event.date === '' || event.date === '9999-12-31';
                  
                  return (
                    <Link 
                      key={event.id} 
                      href={`/events/event-detail/${event.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        background: '#111',
                        borderRadius: '0',
                        overflow: 'hidden',
                        transition: 'transform 0.2s',
                        cursor: 'pointer',
                        border: '1px solid #333'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                        {/* Event Image */}
                        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                          <Image
                            src={imageSrc}
                            alt={event.title}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="700px"
                            unoptimized
                          />
                        </div>
                        
                        {/* Event Info */}
                        <div style={{ padding: '1.5rem', background: '#000' }}>
                          <h3 style={{
                            color: '#fff',
                            fontSize: '1.8rem',
                            fontWeight: 'bold',
                            marginBottom: '1rem'
                          }}
                          dangerouslySetInnerHTML={{ __html: formatEventText(event.title) }}
                          />
                          
                          <div style={{ color: '#0ff', fontSize: '1.2rem', fontWeight: 'bold' }}>
                            {isTBA ? 'TBA' : `${dateInfo.weekday} ${dateInfo.month} ${dateInfo.day}`}
                          </div>
                          
                          {event.time && (
                            <div style={{ color: '#999', fontSize: '1rem', marginTop: '0.5rem' }}>
                              Doors: {event.time}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ========== SECTION 2: 4-COLUMN GRID ========== */}
        {gridEvents.length > 0 && (
          <section style={{
            background: '#000',
            padding: '3rem 2rem',
            borderTop: '1px solid #333'
          }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              {/* 4-column grid of cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '2rem'
              }}>
                {gridEvents.map((event) => {
                  const imageSrc = event.image_url || "/images/placeholder.png";
                  const dateInfo = formatCompactDate(event.date);
                  const isTBA = !event.date || event.date === '' || event.date === '9999-12-31';
                  
                  return (
                    <Link 
                      key={event.id} 
                      href={`/events/event-detail/${event.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        background: '#111',
                        borderRadius: '0',
                        overflow: 'hidden',
                        transition: 'transform 0.2s',
                        cursor: 'pointer',
                        border: '1px solid #333'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                        {/* Square image */}
                        <div style={{ position: 'relative', width: '100%', paddingTop: '100%' }}>
                          <Image
                            src={imageSrc}
                            alt={event.title}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="300px"
                            unoptimized
                          />
                        </div>
                        
                        {/* Card info */}
                        <div style={{ padding: '1rem', background: '#000' }}>
                          <h4 style={{
                            color: '#fff',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            marginBottom: '0.5rem',
                            minHeight: '2.5rem'
                          }}
                          dangerouslySetInnerHTML={{ __html: formatEventText(event.title) }}
                          />
                          
                          <div style={{ color: '#0ff', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            {isTBA ? 'TBA' : `${dateInfo.month} ${dateInfo.day}`}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ========== SECTION 3: UPCOMING SHOWS - TWO COLUMNS ========== */}
        {listEvents.length > 0 && (
          <section style={{
            background: '#000',
            padding: '3rem 2rem',
            borderTop: '3px solid #333'
          }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              <h2 style={{
                color: '#fff',
                fontSize: '3rem',
                fontWeight: 'bold',
                marginBottom: '2rem',
                textTransform: 'uppercase'
              }}>
                Upcoming Shows
              </h2>
              
              {/* TWO COLUMNS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 350px',
                gap: '2rem',
                alignItems: 'start'
              }}>
                
                {/* LEFT COLUMN: Vertical stack of horizontal rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {listEvents.map((event, index) => {
                    const imageSrc = event.image_url || "/images/placeholder.png";
                    const dateInfo = formatCompactDate(event.date);
                    const isTBA = !event.date || event.date === '' || event.date === '9999-12-31';
                    
                    return (
                      <Link
                        key={event.id}
                        href={`/events/event-detail/${event.id}`}
                        style={{ textDecoration: 'none', display: 'block' }}
                      >
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '120px 200px 1fr 150px',
                          gap: '1.5rem',
                          padding: '1.5rem',
                          background: index % 2 === 0 ? '#0a0a0a' : '#111',
                          borderBottom: '1px solid #222',
                          transition: 'background 0.2s',
                          cursor: 'pointer',
                          alignItems: 'center'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#1a1a1a'}
                        onMouseOut={(e) => e.currentTarget.style.background = index % 2 === 0 ? '#0a0a0a' : '#111'}>
                          
                          {/* Date Box */}
                          <div style={{
                            background: '#1a1a1a',
                            border: '2px solid #333',
                            padding: '1rem',
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#0ff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              {isTBA ? 'TBA' : dateInfo.weekday}
                            </div>
                            <div style={{ color: '#fff', fontSize: '2rem', fontWeight: 'bold', margin: '0.25rem 0' }}>
                              {isTBA ? '' : dateInfo.day}
                            </div>
                            <div style={{ color: '#0ff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              {isTBA ? '' : dateInfo.month}
                            </div>
                          </div>
                          
                          {/* Event Image */}
                          <div style={{
                            position: 'relative',
                            width: '200px',
                            height: '200px',
                            flexShrink: 0
                          }}>
                            <Image
                              src={imageSrc}
                              alt={event.title}
                              fill
                              style={{ objectFit: 'cover' }}
                              sizes="200px"
                              unoptimized
                            />
                          </div>
                          
                          {/* Event Info */}
                          <div>
                            <h3 style={{
                              color: '#fff',
                              fontSize: '1.5rem',
                              fontWeight: 'bold',
                              marginBottom: '0.5rem'
                            }}
                            dangerouslySetInnerHTML={{ __html: formatEventText(event.title) }}
                            />
                            
                            {event.time && (
                              <div style={{ color: '#999', fontSize: '0.9rem' }}>
                                Doors: {event.time}
                              </div>
                            )}
                            
                            {event.location && (
                              <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                {event.location}
                              </div>
                            )}
                          </div>
                          
                          {/* Button */}
                          <div style={{
                            background: '#0ff',
                            color: '#000',
                            padding: '0.75rem 1.5rem',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase'
                          }}>
                            More Info
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* RIGHT COLUMN: Sidebar */}
                <aside style={{
                  background: '#111',
                  border: '1px solid #333',
                  padding: '2rem'
                }}>
                  <div style={{
                    background: '#0ff',
                    color: '#000',
                    padding: '0.75rem',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    marginBottom: '1.5rem',
                    textTransform: 'uppercase'
                  }}>
                    Just Announced
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {events.slice(0, 5).map((event) => {
                      const dateInfo = formatCompactDate(event.date);
                      const isTBA = !event.date || event.date === '' || event.date === '9999-12-31';
                      
                      return (
                        <Link
                          key={event.id}
                          href={`/events/event-detail/${event.id}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <div style={{
                            background: '#1a1a1a',
                            padding: '1rem',
                            border: '1px solid #333',
                            transition: 'background 0.2s',
                            cursor: 'pointer'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#222'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#1a1a1a'}>
                            <h4 style={{
                              color: '#fff',
                              fontSize: '0.95rem',
                              fontWeight: 'bold',
                              marginBottom: '0.5rem'
                            }}
                            dangerouslySetInnerHTML={{ __html: formatEventText(event.title) }}
                            />
                            <div style={{ color: '#0ff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              {isTBA ? 'TBA' : `${dateInfo.weekday}, ${dateInfo.month} ${dateInfo.day}`}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </aside>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
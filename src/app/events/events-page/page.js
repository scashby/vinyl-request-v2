// Events Page ("/events/events-page")
// Lists all upcoming vinyl events, with images, dates, and links to event details.
// Includes TBA events, empty state message, booking contact info, and past DJ sets section.

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
  const [pastDJSets, setPastDJSets] = useState([]);
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
    
    const fetchPastDJSets = async () => {
      try {
        const { data: djSetsData, error: djError } = await supabase
          .from('dj_sets')
          .select(`
            *,
            events (
              id,
              title,
              date,
              location
            )
          `)
          .order('recorded_at', { ascending: false })
          .limit(10);

        if (djError) {
          console.error('Error fetching DJ sets:', djError);
        } else {
          const today = new Date().toISOString().split('T')[0];
          const pastSets = djSetsData?.filter(set => 
            set.events && set.events.date && set.events.date < today
          ) || [];
          setPastDJSets(pastSets);
        }
      } catch (error) {
        console.error('Error loading past DJ sets:', error);
      }
    };
    
    fetchEvents();
    fetchPastDJSets();
  }, []);

  const formatDate = (dateString) => {
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

  const handleDownload = async (setId, fileUrl, title) => {
    try {
      await supabase
        .from('dj_sets')
        .update({ 
          download_count: (pastDJSets.find(s => s.id === setId)?.download_count || 0) + 1 
        })
        .eq('id', setId);

      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = `${title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
    }
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
        
        <div style={{ marginBottom: '1rem' }}>
          <a 
            href="https://calendly.com/deadwaxdialogues"
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
    <div style={{
      backgroundColor: '#f8f9fa',
      padding: '3rem 1rem'
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
          
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <a 
              href="https://calendly.com/deadwaxdialogues"
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
    </div>
  );

  const renderPastDJSets = () => {
    if (pastDJSets.length === 0) return null;

    return (
      <div style={{
        backgroundColor: '#ffffff',
        padding: '3rem 1rem',
        borderTop: '1px solid #e9ecef'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <h2 style={{
            fontSize: '2rem',
            marginBottom: '1rem',
            textAlign: 'center',
            color: '#333'
          }}>
            🎧 DJ Sets from Past Events
          </h2>
          <p style={{
            textAlign: 'center',
            color: '#666',
            marginBottom: '2rem',
            fontSize: '1.1rem'
          }}>
            Listen to recordings from our vinyl nights
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '2rem'
          }}>
            {pastDJSets.map((set) => (
              <div
                key={set.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '2rem',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 600, 
                    marginBottom: '0.5rem',
                    color: '#1f2937'
                  }}>
                    {set.title}
                  </h3>
                  
                  {set.events && (
                    <div style={{ 
                      color: '#4285f4', 
                      fontSize: '0.9rem',
                      marginBottom: '0.5rem'
                    }}>
                      📍 {set.events.title}
                      {set.events.location && ` • ${set.events.location}`}
                    </div>
                  )}

                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: '#6b7280'
                  }}>
                    {new Date(set.recorded_at || set.created_at).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                    {set.download_count > 0 && ` • ${set.download_count} downloads`}
                  </div>
                </div>

                {set.description && (
                  <p style={{ 
                    fontSize: '0.9rem', 
                    lineHeight: 1.6, 
                    marginBottom: '1.5rem',
                    color: '#4b5563'
                  }}>
                    {set.description}
                  </p>
                )}

                {set.tags && set.tags.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    {set.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: 'inline-block',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          marginRight: '0.5rem',
                          marginBottom: '0.25rem'
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  <a
                    href={set.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '1rem 2rem',
                      fontSize: '1rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'all 0.2s ease',
                      flex: 1,
                      minWidth: '180px',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(66, 133, 244, 0.3)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(66, 133, 244, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(66, 133, 244, 0.3)';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>▶</span>
                    Play in Google Drive
                  </a>

                  <a
                    href={set.download_url || set.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleDownload(set.id, set.file_url, set.title)}
                    style={{
                      background: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.75rem 1.5rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#047857'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#059669'}
                  >
                    ⬇ Download
                  </a>
                </div>

                {set.track_listing && set.track_listing.length > 0 && (
                  <details style={{ marginTop: '1.5rem' }}>
                    <summary style={{
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: '0.9rem',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      🎵 Track Listing ({set.track_listing.length} tracks)
                    </summary>
                    <div style={{
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginTop: '0.5rem',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                        {set.track_listing.map((track, index) => (
                          <li
                            key={index}
                            style={{
                              fontSize: '0.8rem',
                              color: '#4b5563',
                              marginBottom: '0.25rem',
                              fontFamily: 'monospace'
                            }}
                          >
                            {track}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link
              href="/dj-sets"
              style={{
                display: 'inline-block',
                background: '#3b82f6',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'background-color 0.2s ease'
              }}
            >
              Browse All DJ Sets →
            </Link>
          </div>
        </div>
      </div>
    );
  };

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
                  
                  {/* Date & Time - EMPHASIZED at top and LINKED */}
                  <Link href={`/events/event-detail/${event.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      backgroundColor: '#f0f9ff',
                      border: '2px solid #0284c7',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginTop: '1rem',
                      marginBottom: '1rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#e0f2fe';
                      e.currentTarget.style.borderColor = '#0369a1';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0f9ff';
                      e.currentTarget.style.borderColor = '#0284c7';
                    }}>
                      <p style={{
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: '#0369a1',
                        margin: '0 0 0.25rem 0',
                        lineHeight: '1.3'
                      }}>
                        {formatDate(event.date)}
                      </p>
                      {!isTBA && event.time && (
                        <p style={{
                          fontSize: '1.1rem',
                          fontWeight: '600',
                          color: '#075985',
                          margin: 0
                        }}>
                          {event.time}
                        </p>
                      )}
                      {isTBA && (
                        <p style={{ 
                          fontSize: '1rem', 
                          color: '#666',
                          fontStyle: 'italic',
                          fontWeight: '500',
                          margin: 0
                        }}>
                          Coming Soon
                        </p>
                      )}
                    </div>
                  </Link>
                  
                  <Link href={`/events/event-detail/${event.id}`} style={{ textDecoration: 'none' }}>
                    <h2 
                      style={{ cursor: 'pointer' }}
                      dangerouslySetInnerHTML={{ __html: formatEventText(event.title) }}
                    />
                  </Link>
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
                </article>
              );
            })}
          </section>
        )}
      </main>
      
      {/* DJ Sets and Booking section - side by side */}
      {(pastDJSets.length > 0 || events.length > 0) && (
        <section style={{
          padding: '3rem 1rem',
          marginTop: '0',
          borderTop: '1px solid #e9ecef'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: pastDJSets.length > 0 ? 'repeat(auto-fit, minmax(500px, 1fr))' : '1fr',
            gap: '3rem',
            alignItems: 'start'
          }}>
            {/* DJ Sets on the left */}
            {pastDJSets.length > 0 && renderPastDJSets()}
            
            {/* Bookings on the right */}
            {events.length > 0 && renderBookingSection()}
          </div>
        </section>
      )}
    </div>
  );
}
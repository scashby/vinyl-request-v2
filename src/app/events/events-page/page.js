// src/app/events/events-page/page.js
// Events Page with featured events and compact organized list
// Replace: src/app/events/events-page/page.js

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
          .limit(6);

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

  const formatCompactDate = (dateString) => {
    if (!dateString || dateString === '' || dateString === '9999-12-31') {
      return { month: 'TBA', day: '', weekday: '' };
    }
    
    const [year, month, day] = dateString.split('-');
    const date = new Date(`${month}/${day}/${year}`);
    
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: date.getDate(),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' })
    };
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

  // Split events into featured (first 3) and remaining
  const featuredEvents = events.slice(0, Math.min(3, events.length));
  const remainingEvents = events.slice(Math.min(3, events.length));

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Upcoming Vinyl Nights</h1>
        </div>
      </header>
      
      <main className="event-body" style={{ padding: '0' }}>
        {events.length === 0 ? (
          <div style={{ 
            padding: '4rem 2rem', 
            textAlign: 'center',
            background: '#fff',
            color: '#333'
          }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              No upcoming events scheduled
            </h3>
            <p style={{ marginBottom: '2rem', color: '#666' }}>
              Check back soon for more vinyl nights and events!
            </p>
            <div style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #e9ecef',
              borderRadius: '8px',
              padding: '2rem',
              display: 'inline-block',
              maxWidth: '400px'
            }}>
              <h4 style={{ marginBottom: '1rem', color: '#495057' }}>
                Want to book an event?
              </h4>
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
                  fontWeight: '600',
                  marginBottom: '1rem'
                }}
              >
                📅 Book Online
              </a>
              <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
                Steve Ashby • Dead Wax Dialogues
              </p>
              <p style={{ margin: '0.5rem 0' }}>
                <a href="mailto:steve@deadwaxdialogues.com" style={{ color: '#007bff' }}>
                  steve@deadwaxdialogues.com
                </a>
              </p>
              <p style={{ margin: '0.5rem 0' }}>
                <a href="tel:443-235-6608" style={{ color: '#007bff' }}>
                  443-235-6608
                </a>
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Featured Events Section */}
            {featuredEvents.length > 0 && (
              <section style={{
                background: 'linear-gradient(180deg, #000000 0%, #1a1a1a 100%)',
                padding: '3rem 2rem 4rem',
                borderBottom: '3px solid #333'
              }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: featuredEvents.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))',
                    gap: '2.5rem'
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
                            background: '#222',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer',
                            border: '2px solid #444',
                            height: '100%'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-8px)';
                            e.currentTarget.style.boxShadow = '0 12px 30px rgba(2, 132, 199, 0.4)';
                            e.currentTarget.style.borderColor = '#0284c7';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = '#444';
                          }}>
                            <div style={{ position: 'relative', width: '100%', paddingTop: '100%' }}>
                              <Image
                                src={imageSrc}
                                alt={event.title}
                                fill
                                style={{ objectFit: 'cover' }}
                                sizes="(max-width: 768px) 100vw, 500px"
                                unoptimized
                              />
                            </div>
                            
                            <div style={{ padding: '1.5rem' }}>
                              <div style={{
                                background: isTBA ? '#6b7280' : '#0284c7',
                                color: '#fff',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                textAlign: 'center'
                              }}>
                                <div style={{
                                  fontSize: '1.5rem',
                                  fontWeight: 'bold',
                                  marginBottom: '0.25rem'
                                }}>
                                  {isTBA ? 'TBA' : `${dateInfo.month} ${dateInfo.day}`}
                                </div>
                                {!isTBA && event.time && (
                                  <div style={{ fontSize: '1rem', opacity: 0.9 }}>
                                    {event.time}
                                  </div>
                                )}
                              </div>
                              
                              <h3 style={{
                                color: '#fff',
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                marginBottom: '0.75rem',
                                lineHeight: '1.3'
                              }}
                              dangerouslySetInnerHTML={{ __html: formatEventText(event.title) }}
                              />
                              
                              {event.location && (
                                <div style={{
                                  color: '#94a3b8',
                                  fontSize: '0.95rem',
                                  marginBottom: '0.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  📍 {event.location}
                                </div>
                              )}
                              
                              <div style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                background: '#0284c7',
                                color: '#fff',
                                textAlign: 'center',
                                borderRadius: '6px',
                                fontWeight: '600'
                              }}>
                                View Details →
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

            {/* Remaining Events - Compact List */}
            {remainingEvents.length > 0 && (
              <section style={{
                background: '#fff',
                padding: '3rem 2rem'
              }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                  <h2 style={{
                    fontSize: '1.75rem',
                    marginBottom: '2rem',
                    color: '#1f2937',
                    fontWeight: 'bold'
                  }}>
                    All Upcoming Events
                  </h2>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    {remainingEvents.map((event) => {
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
                            display: 'grid',
                            gridTemplateColumns: '120px 1fr',
                            gap: '1.5rem',
                            padding: '1rem',
                            background: '#f9fafb',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            alignItems: 'center'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#f0f9ff';
                            e.currentTarget.style.borderColor = '#0284c7';
                            e.currentTarget.style.transform = 'translateX(4px)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }}>
                            <div style={{
                              position: 'relative',
                              width: '120px',
                              height: '120px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              flexShrink: 0
                            }}>
                              <Image
                                src={imageSrc}
                                alt={event.title}
                                fill
                                style={{ objectFit: 'cover' }}
                                sizes="120px"
                                unoptimized
                              />
                            </div>
                            
                            <div style={{ minWidth: 0 }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                marginBottom: '0.5rem',
                                flexWrap: 'wrap'
                              }}>
                                <div style={{
                                  background: isTBA ? '#6b7280' : '#0284c7',
                                  color: '#fff',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '6px',
                                  fontWeight: 'bold',
                                  fontSize: '0.9rem',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {isTBA ? 'TBA' : `${dateInfo.month} ${dateInfo.day}`}
                                  {!isTBA && event.time && ` • ${event.time}`}
                                </div>
                                
                                {event.location && (
                                  <div style={{
                                    color: '#6b7280',
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}>
                                    📍 {event.location}
                                  </div>
                                )}
                              </div>
                              
                              <h3 style={{
                                color: '#1f2937',
                                fontSize: '1.25rem',
                                fontWeight: 'bold',
                                marginBottom: '0.25rem',
                                lineHeight: '1.3'
                              }}
                              dangerouslySetInnerHTML={{ __html: formatEventText(event.title) }}
                              />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </>
        )}


        {/* DJ Sets Section - Full Width */}
        {pastDJSets.length > 0 && (
          <section style={{
            background: '#f9fafb',
            padding: '3rem 2rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <h2 style={{
                fontSize: '2rem',
                marginBottom: '0.5rem',
                textAlign: 'center',
                color: '#1f2937',
                fontWeight: 'bold'
              }}>
                🎧 DJ Sets from Past Events
              </h2>
              <p style={{
                textAlign: 'center',
                color: '#6b7280',
                marginBottom: '2.5rem',
                fontSize: '1.1rem'
              }}>
                Listen to recordings from our vinyl nights
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '2rem'
              }}>
                {pastDJSets.map((set) => (
                  <div
                    key={set.id}
                    style={{
                      background: '#fff',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '2rem',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                      e.currentTarget.style.borderColor = '#0284c7';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  >
                    <h3 style={{ 
                      fontSize: '1.35rem', 
                      fontWeight: 600, 
                      marginBottom: '0.5rem',
                      color: '#1f2937'
                    }}>
                      {set.title}
                    </h3>
                    
                    {set.events && (
                      <div style={{ 
                        color: '#0284c7', 
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem',
                        fontWeight: 500
                      }}>
                        📍 {set.events.title}
                        {set.events.location && ` • ${set.events.location}`}
                      </div>
                    )}

                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: '#6b7280',
                      marginBottom: '1rem'
                    }}>
                      {new Date(set.recorded_at || set.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                      {set.download_count > 0 && ` • ${set.download_count} downloads`}
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
                              background: '#dbeafe',
                              color: '#0369a1',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '1rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              marginRight: '0.5rem',
                              marginBottom: '0.5rem'
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      gap: '0.75rem',
                      flexWrap: 'wrap'
                    }}>
                      <a
                        href={set.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          minWidth: '160px',
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: 'white',
                          padding: '0.85rem 1.5rem',
                          borderRadius: '8px',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          transition: 'all 0.2s ease',
                          textAlign: 'center'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.3)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <span>▶</span> Play
                      </a>

                      <a
                        href={set.download_url || set.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleDownload(set.id, set.file_url, set.title)}
                        style={{
                          background: '#059669',
                          color: 'white',
                          padding: '0.85rem 1.5rem',
                          borderRadius: '8px',
                          fontSize: '0.95rem',
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
                          borderTop: '1px solid #e5e7eb',
                          marginTop: '1rem'
                        }}>
                          🎵 Track Listing ({set.track_listing.length} tracks)
                        </summary>
                        <div style={{
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          padding: '1rem',
                          marginTop: '0.5rem',
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}>
                          <ol style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
                            {set.track_listing.map((track, index) => (
                              <li
                                key={index}
                                style={{
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

              <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
                <Link
                  href="/dj-sets"
                  style={{
                    display: 'inline-block',
                    background: '#0284c7',
                    color: 'white',
                    padding: '0.85rem 2rem',
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
          </section>
        )}

        {/* Booking Section - Full Width */}
        {events.length > 0 && (
          <section style={{
            background: '#1f2937',
            padding: '4rem 2rem',
            borderTop: '1px solid #374151'
          }}>
            <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
              <h2 style={{
                fontSize: '2rem',
                marginBottom: '1rem',
                color: '#fff',
                fontWeight: 'bold'
              }}>
                Book Dead Wax Dialogues
              </h2>
              <p style={{
                fontSize: '1.1rem',
                color: '#d1d5db',
                marginBottom: '2.5rem',
                lineHeight: '1.6'
              }}>
                Looking to bring vinyl culture to your venue or event? 
                Get in touch to discuss hosting a Dead Wax Dialogues experience.
              </p>
              
              <div style={{
                backgroundColor: '#374151',
                border: '2px solid #4b5563',
                borderRadius: '12px',
                padding: '2.5rem',
                display: 'inline-block',
                textAlign: 'center',
                minWidth: '350px'
              }}>
                <a 
                  href="https://calendly.com/deadwaxdialogues"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    padding: '1rem 2.5rem',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    marginBottom: '2rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#0369a1';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#0284c7';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  📅 Book Online
                </a>
                
                <div style={{ 
                  color: '#9ca3af', 
                  marginBottom: '1.5rem',
                  fontSize: '0.95rem'
                }}>
                  or contact directly:
                </div>

                <p style={{ margin: '0.85rem 0', fontSize: '1.05rem', color: '#e5e7eb' }}>
                  <strong>Steve Ashby</strong><br />
                  <span style={{ color: '#9ca3af', fontSize: '0.95rem' }}>Dead Wax Dialogues</span>
                </p>
                <p style={{ margin: '0.85rem 0' }}>
                  <a 
                    href="mailto:steve@deadwaxdialogues.com" 
                    style={{ 
                      color: '#60a5fa', 
                      textDecoration: 'none',
                      fontSize: '1.05rem'
                    }}
                  >
                    steve@deadwaxdialogues.com
                  </a>
                </p>
                <p style={{ margin: '0.85rem 0' }}>
                  <a 
                    href="tel:443-235-6608" 
                    style={{ 
                      color: '#60a5fa', 
                      textDecoration: 'none',
                      fontSize: '1.05rem'
                    }}
                  >
                    443-235-6608
                  </a>
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
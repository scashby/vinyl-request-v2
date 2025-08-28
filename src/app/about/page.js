// About page ("/about") — Database-driven content

'use client'

import React, { useEffect, useState } from "react"
import SocialEmbeds from "components/SocialEmbeds"
import 'styles/about.css'

export default function AboutPage() {
  const [mostWanted, setMostWanted] = useState([]);
  const [aboutContent, setAboutContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch most wanted list
      try {
        const mostWantedResponse = await fetch("/api/most-wanted");
        const mostWantedData = await mostWantedResponse.json();
        setMostWanted(mostWantedData);
      } catch (error) {
        console.error("Error fetching most wanted:", error);
      }

      // Fetch about content from database
      try {
        const aboutResponse = await fetch("/api/about-content");
        if (aboutResponse.ok) {
          const aboutData = await aboutResponse.json();
          setAboutContent(aboutData);
        }
      } catch (error) {
        console.error("Error fetching about content:", error);
      }
      
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="page-wrapper">
        <header className="about-hero">
          <div className="overlay">
            <h1>About</h1>
          </div>
        </header>
        <main className="event-body">
          <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem' }}>
            Loading...
          </div>
        </main>
      </div>
    );
  }

  if (!aboutContent) {
    return (
      <div className="page-wrapper">
        <header className="about-hero">
          <div className="overlay">
            <h1>About</h1>
          </div>
        </header>
        <main className="event-body">
          <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem' }}>
            Content not available. Please contact the administrator.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <header className="about-hero">
        <div className="overlay">
          <h1>About</h1>
        </div>
      </header>
      <main className="event-body">
        <div className="about-body-row">
          <div className="about-main-col">
            <div className="about-body-container">
              <h2 className="about-title">About Dead Wax Dialogues</h2>
              {aboutContent.main_description && aboutContent.main_description.split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}

              {/* Booking Information Section */}
              <div style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '12px',
                padding: '2rem',
                marginTop: '2rem',
                marginBottom: '2rem'
              }}>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#333',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  Book Dead Wax Dialogues
                </h3>
                
                <p style={{
                  fontSize: '1.1rem',
                  color: '#666',
                  textAlign: 'center',
                  marginBottom: '2rem',
                  lineHeight: '1.6'
                }}>
                  {aboutContent.booking_description}
                </p>

                {/* Book Online Button */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <a 
                    href={aboutContent.calendly_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#007bff',
                      color: '#ffffff',
                      padding: '0.75rem 2rem',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '1.2rem',
                      fontWeight: '600',
                      boxShadow: '0 4px 8px rgba(0, 123, 255, 0.2)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#0056b3';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#007bff';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    📅 Schedule a Consultation
                  </a>
                </div>

                {/* Services Grid */}
                {aboutContent.services && aboutContent.services.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                  }}>
                    {aboutContent.services.map((service, index) => (
                      <div key={index} style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #dee2e6',
                        borderRadius: '8px',
                        padding: '1.5rem'
                      }}>
                        <h4 style={{
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          color: '#333',
                          marginBottom: '0.5rem'
                        }}>
                          {service.title}
                        </h4>
                        <p style={{
                          color: '#666',
                          marginBottom: '1rem',
                          lineHeight: '1.5'
                        }}>
                          {service.description}
                        </p>
                        <div style={{
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          color: '#007bff'
                        }}>
                          {service.price}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Testimonials */}
                {aboutContent.testimonials && aboutContent.testimonials.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{
                      fontSize: '1.3rem',
                      fontWeight: 'bold',
                      color: '#333',
                      marginBottom: '1rem',
                      textAlign: 'center'
                    }}>
                      What People Say
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '1rem'
                    }}>
                      {aboutContent.testimonials.map((testimonial, index) => (
                        <div key={index} style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #dee2e6',
                          borderRadius: '8px',
                          padding: '1.25rem',
                          borderLeft: '4px solid #007bff'
                        }}>
                          <p style={{
                            fontStyle: 'italic',
                            color: '#555',
                            marginBottom: '0.75rem',
                            lineHeight: '1.5'
                          }}>
                            &ldquo;{testimonial.text}&rdquo;
                          </p>
                          <div style={{
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: '#007bff'
                          }}>
                            — {testimonial.author}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact Information */}
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  textAlign: 'center'
                }}>
                  <h4 style={{
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    color: '#333',
                    marginBottom: '1rem'
                  }}>
                    Contact Information
                  </h4>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <strong>{aboutContent.contact_name}</strong><br />
                      <span style={{ color: '#666' }}>{aboutContent.contact_company}</span>
                    </div>
                    <div>
                      <a href={`mailto:${aboutContent.contact_email}`} 
                         style={{ color: '#007bff', textDecoration: 'none' }}>
                        {aboutContent.contact_email}
                      </a>
                    </div>
                    <div>
                      <a href={`tel:${aboutContent.contact_phone}`} 
                         style={{ color: '#007bff', textDecoration: 'none' }}>
                        {aboutContent.contact_phone}
                      </a>
                    </div>
                  </div>

                  {aboutContent.booking_notes && (
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#666',
                      fontStyle: 'italic',
                      lineHeight: '1.4'
                    }}>
                      {aboutContent.booking_notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="about-sidebar">
            <div className="about-sidebar-title">Top 10 Most Wanted</div>
            <ol className="about-mostwanted">
              {mostWanted.map((item) => (
                <li key={item.id}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                </li>
              ))}
            </ol>
            
            <div className="about-wishlist">
              <div className="about-sidebar-title">Wish List</div>
              <a href={aboutContent.amazon_wishlist_url} target="_blank" rel="noopener noreferrer">
                Full Amazon Wish List
              </a>
              <a href={aboutContent.discogs_wantlist_url} target="_blank" rel="noopener noreferrer">
                Full Discogs Wantlist
              </a>
            </div>

            {/* Social Feed - MOVED HERE */}
            <div className="about-social-feed">
              <div className="about-sidebar-title">Recent Social Posts</div>
              <div className="social-widgets">
                <SocialEmbeds />
                <div className="social-embed">
                  <a
                    href={aboutContent.linktree_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="linktree-button"
                  >
                    Visit Our Linktree
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
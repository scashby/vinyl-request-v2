// About page ("/about") — Enhanced with booking information and rates

'use client'

import React, { useEffect, useState } from "react"
import SocialEmbeds from "components/SocialEmbeds"
import 'styles/about.css'

export default function AboutPage() {
  const [mostWanted, setMostWanted] = useState([]);
  const [aboutContent, setAboutContent] = useState({
    main_description: "Hi, I'm Stephen. If you ever wanted to know why anyone still loves vinyl, cassettes, or tangling with Discogs, you're in the right place.\n\nThis site is a home for vinyl drop nights, weird collection habits, top 10 wishlists, and the best and worst audio formats ever invented.\n\nThere will be occasional silly interviews, commentary, and projects from the road (and the turntable).",
    booking_description: "Looking to bring vinyl culture to your venue or event? Dead Wax Dialogues offers unique vinyl experiences that connect people through music discovery and storytelling.",
    services: [
      {
        title: "Vinyl Drop Nights",
        description: "Interactive vinyl listening experiences where attendees discover new music and share stories",
        price: "Contact for pricing"
      },
      {
        title: "Private Events",
        description: "Custom vinyl experiences for parties, corporate events, and special occasions",
        price: "Starting at $500"
      },
      {
        title: "Educational Workshops",
        description: "Learn about vinyl history, collecting, and the culture surrounding physical media",
        price: "Starting at $300"
      }
    ],
    testimonials: [
      {
        text: "Steve brought such a unique energy to our event. The vinyl experience was unforgettable!",
        author: "Sarah M., Event Coordinator"
      },
      {
        text: "Dead Wax Dialogues turned our corporate gathering into something truly special.",
        author: "Mike R., Corporate Events"
      }
    ],
    booking_notes: "All events include professional setup, curated vinyl selection, and engaging facilitation. Travel fees may apply for events outside the Baltimore/DC area."
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch most wanted list
      try {
        const mostWantedResponse = await fetch("/api/most-wanted");
        const mostWantedData = await mostWantedResponse.json();
        setMostWanted(mostWantedData);
      } catch (_err) {
        console.error("Error fetching most wanted:", _err);
      }

      // Try to fetch about content from database
      try {
        const aboutResponse = await fetch("/api/about-content");
        if (aboutResponse.ok) {
          const aboutData = await aboutResponse.json();
          if (aboutData) {
            setAboutContent(prevContent => ({
              ...prevContent,
              ...aboutData
            }));
          }
        }
      } catch {
        console.log("Using default about content (no database content found)");
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
              {aboutContent.main_description.split('\n\n').map((paragraph, index) => (
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
                    href="https://calendly.com/deadwaxdialogues"
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
                      <strong>Steve Ashby</strong><br />
                      <span style={{ color: '#666' }}>Dead Wax Dialogues</span>
                    </div>
                    <div>
                      <a href="mailto:steve@deadwaxdialogues.com" 
                         style={{ color: '#007bff', textDecoration: 'none' }}>
                        steve@deadwaxdialogues.com
                      </a>
                    </div>
                    <div>
                      <a href="tel:443-235-6608" 
                         style={{ color: '#007bff', textDecoration: 'none' }}>
                        443-235-6608
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

              {/* Social Feed */}
              <div className="about-social-feed">
                <div className="about-sidebar-title">Recent Social Posts</div>
                <div className="social-widgets">
                  <SocialEmbeds />
                  <div className="social-embed">
                    <a
                      href="https://linktr.ee/deadwaxdialogues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="linktree-button"
                    >
                      Visit Our Linktree
                    </a>
                  </div>
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
              <a href="https://www.amazon.com/hz/wishlist/ls/D5MXYF471325?ref_=wl_share" target="_blank" rel="noopener noreferrer">
                Full Amazon Wish List
              </a>
              <a href="https://www.discogs.com/wantlist?user=socialblunders" target="_blank" rel="noopener noreferrer">
                Full Discogs Wantlist
              </a>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
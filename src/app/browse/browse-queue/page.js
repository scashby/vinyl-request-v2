// Fixed Browse Queue page - Clean version without renderVoteStars
// Replace: src/app/browse/browse-queue/page.js

"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import AlbumSuggestionBox from 'components/AlbumSuggestionBox';
import { supabase } from 'src/lib/supabaseClient';
import 'styles/internal.css';
import 'styles/browse-queue.css';

function BrowseQueueContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  
  const [queueItems, setQueueItems] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);

  const loadEventAndQueue = useCallback(async () => {
    if (!eventId) {
      // Show placeholder data if no eventId
      setEventData({
        id: 'placeholder',
        title: 'Event Name Placeholder',
        date: 'June 2, 2025',
        image_url: '/images/event-header-still.jpg'
      });
      setQueueItems([
        {
          id: 1,
          artist: 'Pink Floyd',
          title: 'The Dark Side of the Moon',
          side: 'A',
          votes: 4,
          album_id: null
        },
        {
          id: 2,
          artist: 'The Beatles',
          title: 'Abbey Road',
          side: 'B',
          votes: 5,
          album_id: null
        },
        {
          id: 3,
          artist: 'Unknown Artist',
          title: 'Random Album',
          side: 'A',
          votes: 0,
          album_id: null
        }
      ]);
      setLoading(false);
      return;
    }

    try {
      // Load event details
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) {
        console.error('Error loading event:', eventError);
      } else {
        setEventData(event);
      }

      // Load queue items for this event - using EXACT same approach as QueueSection
      const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('event_id', eventId)
        .order('id', { ascending: true }); // Same ordering as QueueSection

      if (requestsError) {
        console.error('Error loading requests:', requestsError);
        setQueueItems([]);
        return;
      }

      if (!requests || requests.length === 0) {
        setQueueItems([]);
        return;
      }

      // Get unique album IDs
      const albumIds = requests.map(r => r.album_id).filter(Boolean);
      
      if (albumIds.length === 0) {
        // Handle requests without album_id (direct artist/title entries)
        const mapped = requests.map(req => ({
          id: req.id,
          artist: req.artist || '',
          title: req.title || '',
          side: req.side || 'A',
          votes: req.votes || 1,
          album_id: req.album_id,
          created_at: req.created_at,
          collection: null
        }));
        setQueueItems(mapped);
        return;
      }

      // Load album details
      const { data: albums, error: albumsError } = await supabase
        .from('collection')
        .select('id, artist, title, image_url, year, format')
        .in('id', albumIds);

      if (albumsError) {
        console.error('Error loading albums:', albumsError);
        setQueueItems([]);
        return;
      }

      // Map requests with album data
      const mapped = requests.map(req => {
        const album = albums?.find(a => a.id === req.album_id);
        return {
          id: req.id,
          artist: req.artist || album?.artist || '',
          title: req.title || album?.title || '',
          side: req.side || 'A',
          votes: req.votes || 1,
          album_id: req.album_id,
          created_at: req.created_at,
          collection: album ? {
            id: album.id,
            image_url: album.image_url,
            year: album.year,
            format: album.format
          } : null
        };
      });
      
      // Sort by votes desc, then by created_at asc
      const sorted = mapped.sort((a, b) => {
        if (b.votes !== a.votes) {
          return b.votes - a.votes;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setQueueItems(sorted);

    } catch (error) {
      console.error('Error loading event and queue:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEventAndQueue();
  }, [loadEventAndQueue]);

  const voteForItem = async (itemId) => {
    try {
      const currentItem = queueItems.find(item => item.id === itemId);
      const newVotes = (currentItem?.votes || 1) + 1;
      
      const { error } = await supabase
        .from('requests')
        .update({ votes: newVotes })
        .eq('id', itemId);

      if (!error) {
        // Update local state
        setQueueItems(prev => 
          prev.map(item => 
            item.id === itemId 
              ? { ...item, votes: newVotes }
              : item
          ).sort((a, b) => {
            // Sort by votes descending, then by created_at ascending
            if (b.votes !== a.votes) {
              return b.votes - a.votes;
            }
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          })
        );
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="page-wrapper" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        color: '#666',
        fontSize: '18px'
      }}>
        Loading event queue...
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <div style={{ textAlign: 'center' }}>
            <h1>{eventData?.title || 'Event Queue'}</h1>
            {eventData?.date && (
              <p style={{ 
                fontSize: '18px', 
                opacity: 0.9, 
                margin: '16px 0 0 0',
                fontWeight: '500'
              }}>
                {formatDate(eventData.date)}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="page-body browse-queue">
        <aside className="event-sidebar">
          <article className="event-card">
            <Image
              src={eventData?.image_url || "/images/event-header-still.jpg"}
              alt={eventData?.title || "Event"}
              className="card-square"
              width={250}
              height={250}
              priority
              unoptimized
            />
            <h2>{eventData?.title || 'Event Name'}</h2>
            <p>{eventData?.date ? formatDate(eventData.date) : 'Date TBD'}</p>
          </article>
        </aside>

        <section className="queue-display">
          {/* Queue Header with Stats and Actions */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            {/* Row 1: Title Only */}
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: '#1f2937' 
            }}>
              Current Queue
            </h3>

            {/* Row 2: Stats and Action Buttons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div style={{ 
                display: 'flex', 
                gap: '24px', 
                fontSize: '14px', 
                color: '#6b7280',
                fontWeight: '500',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📀</span> {queueItems.length} requests
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🗳️</span> {queueItems.reduce((sum, item) => sum + item.votes, 0)} total votes
                </div>
                {queueItems.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🏆</span> Top: {queueItems[0]?.votes || 0} votes
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {!showSuggestionBox && (
                  <button
                    onClick={() => setShowSuggestionBox(true)}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    💡 Suggest an Album
                  </button>
                )}
                
                <a
                  href={`/browse/browse-albums?eventId=${eventId}`}
                  style={{
                    background: '#059669',
                    color: 'white',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📚 Browse Collection
                </a>
                
                <a
                  href={`/events/event-detail/${eventId}`}
                  style={{
                    background: '#9333ea',
                    color: 'white',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📅 Event Details
                </a>
              </div>
            </div>
          </div>

          {/* Suggestion Box (when shown) */}
          {showSuggestionBox && (
            <div style={{ marginBottom: '24px' }}>
              <AlbumSuggestionBox 
                context="general"
                onClose={() => setShowSuggestionBox(false)}
              />
            </div>
          )}

          {queueItems.length > 0 ? (
            <div className="queue-wrapper">
              <table className="queue-table" style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed'
              }}>
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center', padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', border: 'none' }}>#</th>
                    <th style={{ width: '60px', textAlign: 'left', padding: '0.75rem 0.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', border: 'none' }}></th>
                    <th style={{ width: 'auto', minWidth: '200px', textAlign: 'left', padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', border: 'none' }}>Album / Artist</th>
                    <th style={{ width: '60px', textAlign: 'center', padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', border: 'none' }}>Side</th>
                    <th style={{ width: '60px', textAlign: 'center', padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', border: 'none' }}>👍</th>
                    <th style={{ width: '80px', textAlign: 'right', padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', border: 'none' }}>Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map((item, index) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <td className="queue-index" style={{ width: '50px', textAlign: 'center', padding: '0.75rem 0.5rem', verticalAlign: 'middle', color: '#9ca3af', fontSize: '0.875rem', fontWeight: '600' }}>{index + 1}</td>
                      <td style={{ width: '60px', textAlign: 'left', padding: '0.75rem 0.25rem', verticalAlign: 'middle' }}>
                        <Image
                          src={item.collection?.image_url || "/images/placeholder.png"}
                          alt={item.title || ""}
                          className="queue-cover"
                          width={48}
                          height={48}
                          style={{ 
                            cursor: "pointer", 
                            objectFit: "cover", 
                            borderRadius: "6px",
                            display: 'block',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                          }}
                          unoptimized
                        />
                      </td>
                      <td className="queue-meta" style={{ width: 'auto', minWidth: '200px', textAlign: 'left', padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                        <div className="queue-title" style={{
                          fontWeight: index < 3 ? 'bold' : '600',
                          color: index === 0 ? '#059669' : index === 1 ? '#0369a1' : index === 2 ? '#7c3aed' : '#2563eb',
                          fontSize: '0.95rem',
                          lineHeight: '1.2',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: '0.25rem'
                        }}>
                          {index < 3 && (
                            <span style={{ marginRight: '8px', fontSize: '16px' }}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          )}
                          {item.title}
                        </div>
                        <div className="queue-artist" style={{
                          fontSize: '0.825rem',
                          color: '#d1d5db',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          fontWeight: '500'
                        }}>{item.artist}</div>
                      </td>
                      <td className="queue-side" style={{ 
                        width: '60px', 
                        textAlign: 'center', 
                        padding: '0.75rem 0.5rem', 
                        verticalAlign: 'middle',
                        fontSize: '0.875rem',
                        color: '#fff',
                        fontWeight: '700'
                      }}>
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.2)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          minWidth: '24px'
                        }}>
                          {item.side}
                        </span>
                      </td>
                      <td className="queue-plus" style={{ width: '60px', textAlign: 'center', padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                        <button
                          className="queue-plus-btn"
                          onClick={() => voteForItem(item.id)}
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '16px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                          }}
                          title="Vote for this entry"
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb, #1e40af)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          ＋
                        </button>
                      </td>
                      <td className="queue-votes" style={{ width: '80px', textAlign: 'right', padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <span className="queue-heart" style={{ fontSize: '1.125rem', color: '#ef4444' }}>♥</span>
                          <span className="queue-count" style={{ fontSize: '0.875rem', color: '#f3f4f6', fontWeight: '600' }}>x{item.votes}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Empty Queue State */
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#fff',
              borderRadius: '12px',
              border: '2px dashed #d1d5db',
              margin: '20px 0'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
              <h3 style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                margin: '0 0 12px 0',
                color: '#374151'
              }}>
                Queue is Empty
              </h3>
              <p style={{ 
                fontSize: '16px', 
                color: '#6b7280',
                margin: '0 0 24px 0',
                lineHeight: 1.6
              }}>
                No albums have been added to the queue yet.
                {eventId ? ' Browse the collection to add some!' : ' Start by suggesting albums below!'}
              </p>
              
              {eventId ? (
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={`/browse/browse-albums?eventId=${eventId}`}
                    style={{
                      background: '#059669',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '16px',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    📚 Browse Collection
                  </a>
                  <button
                    onClick={() => setShowSuggestionBox(true)}
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    💡 Suggest an Album
                  </button>
                </div>
              ) : (
                <AlbumSuggestionBox context="general" />
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function BrowseQueuePage() {
  return (
    <Suspense fallback={<div>Loading queue...</div>}>
      <BrowseQueueContent />
    </Suspense>
  );
}
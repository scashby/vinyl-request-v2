// Fixed Browse Queue page with consistent queue loading
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
    // Add debugging
    console.log('🔍 Debug: eventId from URL:', eventId);
    console.log('🔍 Debug: Loading event and queue...');
    
    if (!eventId) {
      console.log('🔍 Debug: No eventId provided, showing placeholder');
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
      console.log('🔍 Debug: Fetching event with ID:', eventId);
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      console.log('🔍 Debug: Event query result:', { event, eventError });

      if (eventError) {
        console.error('Error loading event:', eventError);
      } else {
        setEventData(event);
      }

      // Load queue items for this event - using EXACT same approach as QueueSection
      console.log('🔍 Debug: Fetching requests for event_id:', eventId);
      const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('event_id', eventId)
        .order('id', { ascending: true }); // Same ordering as QueueSection

      console.log('🔍 Debug: Requests query result:', { requests, requestsError, count: requests?.length });

      if (requestsError) {
        console.error('Error loading requests:', requestsError);
        setQueueItems([]);
        return;
      }

      if (!requests || requests.length === 0) {
        console.log('🔍 Debug: No requests found, setting empty queue');
        setQueueItems([]);
        return;
      }

      // Get unique album IDs
      const albumIds = requests.map(r => r.album_id).filter(Boolean);
      console.log('🔍 Debug: Album IDs found:', albumIds);
      
      if (albumIds.length === 0) {
        console.log('🔍 Debug: No album IDs, using direct request data');
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
        console.log('🔍 Debug: Mapped requests without albums:', mapped);
        setQueueItems(mapped);
        return;
      }

      // Load album details
      console.log('🔍 Debug: Fetching albums for IDs:', albumIds);
      const { data: albums, error: albumsError } = await supabase
        .from('collection')
        .select('id, artist, title, image_url, year, format')
        .in('id', albumIds);

      console.log('🔍 Debug: Albums query result:', { albums, albumsError });

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

      console.log('🔍 Debug: Final mapped queue items:', mapped);
      
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

  const renderVoteStars = (votes) => {
    const maxStars = 5;
    const filledStars = Math.min(votes, maxStars);
    const stars = '★'.repeat(filledStars) + '☆'.repeat(maxStars - filledStars);
    return votes > maxStars ? stars + '+' : stars;
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
          <h1>{eventData?.title || 'Event Queue'}</h1>
          {eventData?.date && (
            <p style={{ 
              fontSize: '18px', 
              opacity: 0.9, 
              margin: '8px 0 0 0' 
            }}>
              {formatDate(eventData.date)}
            </p>
          )}
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
            
            {/* Queue Stats */}
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Queue Status:</strong>
              </div>
              <div>📀 {queueItems.length} requests</div>
              <div>🗳️ {queueItems.reduce((sum, item) => sum + item.votes, 0)} total votes</div>
              {queueItems.length > 0 && (
                <div>🏆 Top: {queueItems[0]?.votes || 0} votes</div>
              )}
            </div>
            
            {/* Suggestion Box Toggle */}
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => setShowSuggestionBox(!showSuggestionBox)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {showSuggestionBox ? '✕ Hide Suggestions' : '💡 Suggest an Album'}
              </button>
            </div>

            {/* Event Actions */}
            {eventId && (
              <div style={{ marginTop: '16px' }}>
                <a
                  href={`/browse/browse-albums?eventId=${eventId}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: '#059669',
                    color: 'white',
                    textAlign: 'center',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: '8px'
                  }}
                >
                  📚 Browse Collection
                </a>
                <a
                  href={`/events/event-detail/${eventId}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: '#9333ea',
                    color: 'white',
                    textAlign: 'center',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  📅 Event Details
                </a>
              </div>
            )}
          </article>

          {/* Album Suggestion Box in Sidebar */}
          {showSuggestionBox && (
            <div style={{ marginTop: '20px' }}>
              <AlbumSuggestionBox 
                context="general"
                onClose={() => setShowSuggestionBox(false)}
              />
            </div>
          )}
        </aside>

        <section className="queue-display">
          {queueItems.length > 0 ? (
            <>
              <div className="spotify-header-row" style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 80px 100px 80px',
                gap: '16px',
                padding: '16px 20px',
                background: '#f8fafc',
                fontWeight: 'bold',
                fontSize: '14px',
                color: '#374151',
                borderRadius: '8px 8px 0 0',
                border: '1px solid #e5e7eb'
              }}>
                <div>Album</div>
                <div>Artist</div>
                <div>Side</div>
                <div>Votes</div>
                <div>Like</div>
              </div>

              {queueItems.map((item, index) => (
                <div 
                  key={item.id}
                  className="spotify-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 80px 100px 80px',
                    gap: '16px',
                    padding: '16px 20px',
                    background: index % 2 === 0 ? '#fff' : '#f9fafb',
                    borderLeft: '1px solid #e5e7eb',
                    borderRight: '1px solid #e5e7eb',
                    borderBottom: '1px solid #e5e7eb',
                    alignItems: 'center',
                    fontSize: '14px',
                    ...(index === queueItems.length - 1 && { 
                      borderRadius: '0 0 8px 8px' 
                    })
                  }}
                >
                  <div style={{ 
                    fontWeight: index < 3 ? 'bold' : 'normal',
                    color: index === 0 ? '#059669' : index === 1 ? '#0369a1' : index === 2 ? '#7c3aed' : '#374151'
                  }}>
                    {index < 3 && (
                      <span style={{ marginRight: '8px', fontSize: '16px' }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </span>
                    )}
                    {item.title}
                  </div>
                  <div style={{ color: '#6b7280' }}>{item.artist}</div>
                  <div style={{ 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: '#374151'
                  }}>
                    {item.side}
                  </div>
                  <div className="votes" style={{
                    fontSize: '16px',
                    color: item.votes > 0 ? '#f59e0b' : '#d1d5db',
                    textAlign: 'center'
                  }}>
                    {renderVoteStars(item.votes)}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button 
                      className="vote-button"
                      onClick={() => voteForItem(item.id)}
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                      }}
                      title="Vote for this request"
                    >
                      👍
                    </button>
                  </div>
                </div>
              ))}
            </>
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

          {/* Bottom suggestion area for when there are items but user might want more */}
          {queueItems.length > 0 && !showSuggestionBox && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.08))',
              border: '2px dashed #3b82f6',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              margin: '32px 0',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)'
            }}
            onClick={() => setShowSuggestionBox(true)}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12))';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.08))';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>💡</div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: '700', 
                color: '#1e40af', 
                marginBottom: '8px',
                letterSpacing: '-0.02em'
              }}>
                Don&rsquo;t see your favorite album in the queue?
              </div>
              <div style={{ 
                fontSize: '15px', 
                color: '#64748b',
                fontWeight: '500'
              }}>
                Click to suggest new albums for the collection
              </div>
            </div>
          )}

          {/* Expanded suggestion box at bottom */}
          {showSuggestionBox && queueItems.length > 0 && (
            <div style={{ margin: '24px 0' }}>
              <AlbumSuggestionBox 
                context="general"
                onClose={() => setShowSuggestionBox(false)}
              />
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
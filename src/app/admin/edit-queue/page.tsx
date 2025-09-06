// Admin Edit Queue page ("/admin/edit-queue")
// Updated to allow selection of specific event queue before editing

"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from 'lib/supabaseClient'
import 'styles/admin-edit-queue.css';

type Event = {
  id: string;
  title: string;
  date: string;
  has_queue: boolean;
  [key: string]: unknown;
};

type Request = {
  id: string;
  artist: string;
  title: string;
  side: string;
  votes: number;
  event_id: string;
  created_at: string;
  album_id?: string | number | null;
  [key: string]: unknown;
};

function EditQueueContent() {
  const searchParams = useSearchParams();
  const urlEventId = searchParams.get('eventId');

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      console.log('🔍 Admin Debug: Fetching events with queues...');
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('has_queue', true)
        .order('date', { ascending: false });
      
      console.log('🔍 Admin Debug: Events query result:', { data, error, count: data?.length });
      
      if (error) {
        console.error('Error fetching events:', error);
      } else {
        setEvents((data || []) as Event[]);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestsForEvent = async (eventId: string) => {
    try {
      console.log('🔍 Admin Debug: Fetching requests for event_id:', eventId);
      
      // Load queue items for this event - using EXACT same approach as QueueSection and browse-queue
      const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('event_id', eventId)
        .order('id', { ascending: true }); // Same ordering as QueueSection

      console.log('🔍 Admin Debug: Requests query result:', { requests, requestsError, count: requests?.length });

      if (requestsError) {
        console.error('Error loading requests:', requestsError);
        setRequests([]);
        return;
      }

      if (!requests || requests.length === 0) {
        console.log('🔍 Admin Debug: No requests found, setting empty queue');
        setRequests([]);
        return;
      }

      // Get unique album IDs
      const albumIds = requests.map(r => r.album_id).filter(Boolean);
      console.log('🔍 Admin Debug: Album IDs found:', albumIds);
      
      if (albumIds.length === 0) {
        console.log('🔍 Admin Debug: No album IDs, using direct request data');
        // Handle requests without album_id (direct artist/title entries)
        const mapped = requests.map(req => ({
          id: req.id,
          artist: req.artist || '',
          title: req.title || '',
          side: req.side || 'A',
          votes: req.votes || 1,
          album_id: req.album_id,
          created_at: req.created_at,
          event_id: req.event_id
        }));
        console.log('🔍 Admin Debug: Mapped requests without albums:', mapped);
        
        // Sort by votes desc, then by created_at asc
        const sorted = mapped.sort((a, b) => {
          if (b.votes !== a.votes) {
            return b.votes - a.votes;
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        
        setRequests(sorted);
        return;
      }

      // Load album details
      console.log('🔍 Admin Debug: Fetching albums for IDs:', albumIds);
      const { data: albums, error: albumsError } = await supabase
        .from('collection')
        .select('id, artist, title, image_url, year, format')
        .in('id', albumIds);

      console.log('🔍 Admin Debug: Albums query result:', { albums, albumsError });

      if (albumsError) {
        console.error('Error loading albums:', albumsError);
        setRequests([]);
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
          event_id: req.event_id
        };
      });

      console.log('🔍 Admin Debug: Final mapped queue items:', mapped);
      
      // Sort by votes desc, then by created_at asc
      const sorted = mapped.sort((a, b) => {
        if (b.votes !== a.votes) {
          return b.votes - a.votes;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setRequests(sorted);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setRequests([]);
    }
  };

  const removeRequest = async (id: string) => {
    try {
      console.log('🔍 Admin Debug: Removing request with ID:', id);
      
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error removing request:', error);
        alert('Error removing request: ' + error.message);
      } else {
        console.log('🔍 Admin Debug: Successfully removed request:', id);
        setRequests(requests.filter(r => r.id !== id));
      }
    } catch (error) {
      console.error('Error removing request:', error);
      alert('Error removing request');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  useEffect(() => {
    console.log('🔍 Admin Debug: Edit Queue component mounted');
    console.log('🔍 Admin Debug: URL eventId:', urlEventId);
    fetchEvents();
  }, [urlEventId]);

  useEffect(() => {
    // Auto-select event if eventId in URL and events are loaded
    if (urlEventId && events.length > 0 && !selectedEvent) {
      console.log('🔍 Admin Debug: Auto-selecting event from URL:', urlEventId);
      const eventFromUrl = events.find(e => e.id === urlEventId);
      if (eventFromUrl) {
        console.log('🔍 Admin Debug: Found event from URL:', eventFromUrl.title);
        setSelectedEvent(eventFromUrl);
      } else {
        console.log('🔍 Admin Debug: Event not found in events list for ID:', urlEventId);
      }
    }
  }, [events, urlEventId, selectedEvent]);

  useEffect(() => {
    if (selectedEvent) {
      console.log('🔍 Admin Debug: Selected event changed, fetching requests for:', selectedEvent.id);
      fetchRequestsForEvent(selectedEvent.id);
    }
  }, [selectedEvent]);

  if (loading) {
    return (
      <div className="admin-edit-queue-page">
        <div className="loading-state">
          Loading events...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-edit-queue-page">
      <div className="edit-queue-container">
        <h1 className="edit-queue-title">
          Edit Event Queue
        </h1>

        {!selectedEvent ? (
          // Event Selection View
          <div>
            <h2 className="edit-queue-subtitle">
              Select an Event
            </h2>
            
            {events.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <h3 className="empty-state-title">No Events with Queues</h3>
                <p className="empty-state-text">No events have been created with queue functionality enabled.</p>
              </div>
            ) : (
              <div className="event-selection-grid">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="event-selection-card"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <h3 className="event-card-title">
                      {event.title}
                    </h3>
                    <p className="event-card-date">
                      {formatDate(event.date)}
                    </p>
                    <div className="event-card-badge">
                      🎵 Queue Enabled
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Queue Management View
          <div>
            <div className="queue-management-header">
              <div>
                <h2 className="queue-management-title">
                  {selectedEvent.title} - Queue
                </h2>
                <p className="queue-management-subtitle">
                  {formatDate(selectedEvent.date)} • {requests.length} requests
                </p>
              </div>
              <button
                className="back-button"
                onClick={() => {
                  setSelectedEvent(null);
                  setRequests([]);
                }}
              >
                ← Back to Events
              </button>
            </div>

            {requests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🎵</div>
                <h3 className="empty-state-title">Queue is Empty</h3>
                <p className="empty-state-text">No requests have been added to this event&apos;s queue yet.</p>
              </div>
            ) : (
              <div className="queue-table-container">
                {/* Header */}
                <div className="queue-table-header">
                  <div>Album</div>
                  <div>Artist</div>
                  <div>Side</div>
                  <div>Votes</div>
                  <div>Action</div>
                </div>

                {/* Requests */}
                {requests.map((req) => (
                  <div key={req.id} className="queue-table-row">
                    <div className="queue-album-title">
                      {req.title}
                    </div>
                    <div className="queue-artist-name">
                      {req.artist}
                    </div>
                    <div className="queue-side-indicator">
                      {req.side}
                    </div>
                    <div className={`queue-votes-count ${req.votes === 0 ? 'no-votes' : ''}`}>
                      {req.votes}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button
                        className="remove-button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove "${req.title}" by ${req.artist} from the queue?`)) {
                            removeRequest(req.id);
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary Stats */}
            {requests.length > 0 && (
              <div className="queue-summary">
                <strong>Queue Summary:</strong> {requests.length} requests, {requests.reduce((sum, req) => sum + req.votes, 0)} total votes
              </div>
            )}

            {/* Debug Info */}
            {process.env.NODE_ENV === 'development' && (
              <div style={{ 
                marginTop: '2rem', 
                padding: '1rem', 
                background: '#fef3c7', 
                borderRadius: '8px', 
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
                <strong>Debug Info:</strong><br />
                Event ID: {selectedEvent.id}<br />
                URL Event ID: {urlEventId || 'none'}<br />
                Requests found: {requests.length}<br />
                Request IDs: {requests.map(r => r.id).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="admin-edit-queue-page"><div className="loading-state">Loading queue editor...</div></div>}>
      <EditQueueContent />
    </Suspense>
  );
}
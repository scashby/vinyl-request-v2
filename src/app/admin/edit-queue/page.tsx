// src/app/admin/edit-queue/page.tsx
// Admin Edit Queue page ("/admin/edit-queue")
// Updated with queue type support (track/side/album)

"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from 'lib/supabaseClient'
import 'styles/admin-edit-queue.css';
import { formatEventText } from 'src/utils/textFormatter';
import type { DbEvent, DbRequest, Collection } from 'types/supabase';

type Event = {
  id: string;
  title: string;
  date: string;
  has_queue: boolean;
  queue_type: string;
  [key: string]: unknown;
};

type Request = {
  id: string;
  artist: string;
  title: string;
  side: string | null;
  track_number: string | null;
  track_name: string | null;
  track_duration: string | null;
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
      
      const typedData = (data || []) as DbEvent[];
      
      console.log('🔍 Admin Debug: Events query result:', { data: typedData, error, count: typedData?.length });
      
      if (error) {
        console.error('Error fetching events:', error);
      } else {
        setEvents(typedData as unknown as Event[]);
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
      
      const { data, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('event_id', eventId)
        .order('id', { ascending: true });

      const typedRequests = (data || []) as DbRequest[];

      console.log('🔍 Admin Debug: Requests query result:', { requests: typedRequests, requestsError, count: typedRequests?.length });

      if (requestsError) {
        console.error('Error loading requests:', requestsError);
        setRequests([]);
        return;
      }

      if (!typedRequests || typedRequests.length === 0) {
        console.log('🔍 Admin Debug: No requests found, setting empty queue');
        setRequests([]);
        return;
      }

      const albumIds = typedRequests.map(r => r.album_id).filter(Boolean);
      console.log('🔍 Admin Debug: Album IDs found:', albumIds);
      
      if (albumIds.length === 0) {
        console.log('🔍 Admin Debug: No album IDs, using direct request data');
        const mapped = typedRequests.map(req => ({
          id: req.id.toString(),
          artist: req.artist || '',
          title: req.title || '',
          side: req.side || null,
          track_number: req.track_number || null,
          track_name: req.track_name || null,
          track_duration: req.track_duration || null,
          votes: req.votes || 1,
          album_id: req.album_id,
          created_at: req.created_at,
          event_id: req.event_id.toString()
        }));
        console.log('🔍 Admin Debug: Mapped requests without albums:', mapped);
        
        const sorted = mapped.sort((a, b) => {
          if (b.votes !== a.votes) {
            return b.votes - a.votes;
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        
        setRequests(sorted);
        return;
      }

      console.log('🔍 Admin Debug: Fetching albums for IDs:', albumIds);
      const { data: albumData, error: albumsError } = await supabase
        .from('collection')
        .select('id, artist, title, image_url, year, format')
        .in('id', albumIds);

      const albums = (albumData || []) as Collection[];

      console.log('🔍 Admin Debug: Albums query result:', { albums, albumsError });

      if (albumsError) {
        console.error('Error loading albums:', albumsError);
        setRequests([]);
        return;
      }

      const mapped = typedRequests.map(req => {
        const album = albums?.find(a => a.id === req.album_id);
        return {
          id: req.id.toString(),
          artist: req.artist || album?.artist || '',
          title: req.title || album?.title || '',
          side: req.side || null,
          track_number: req.track_number || null,
          track_name: req.track_name || null,
          track_duration: req.track_duration || null,
          votes: req.votes || 1,
          album_id: req.album_id,
          created_at: req.created_at,
          event_id: req.event_id.toString()
        };
      });

      console.log('🔍 Admin Debug: Final mapped queue items:', mapped);
      
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

  const getQueueTypeLabel = (queueType: string) => {
    switch(queueType) {
      case 'track': return '🎵 By Track';
      case 'album': return '💿 By Album';
      case 'side':
      default: return '📀 By Side';
    }
  };

  useEffect(() => {
    console.log('🔍 Admin Debug: Edit Queue component mounted');
    console.log('🔍 Admin Debug: URL eventId:', urlEventId);
    fetchEvents();
  }, [urlEventId]);

  useEffect(() => {
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

  const queueType = selectedEvent?.queue_type || 'side';

  return (
    <div className="admin-edit-queue-page">
      <div className="edit-queue-container">
        <h1 className="edit-queue-title">
          Edit Event Queue
        </h1>

        {!selectedEvent ? (
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
                    <h3 
                      className="event-card-title"
                      dangerouslySetInnerHTML={{ __html: formatEventText(event.title) }}
                    />
                    <p className="event-card-date">
                      {formatDate(event.date)}
                    </p>
                    <div className="event-card-badge">
                      {getQueueTypeLabel(event.queue_type || 'side')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="queue-management-header">
              <div>
                <h2 className="queue-management-title">
                  <span dangerouslySetInnerHTML={{ __html: formatEventText(selectedEvent.title) }} /> - Queue
                </h2>
                <p className="queue-management-subtitle">
                  {formatDate(selectedEvent.date)} • {requests.length} requests • {getQueueTypeLabel(queueType)}
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
                <div className="queue-table-header">
                  <div>{queueType === 'track' ? 'Track' : 'Album'}</div>
                  <div>Artist</div>
                  {queueType === 'side' && <div>Side</div>}
                  {queueType === 'track' && <div>Track #</div>}
                  {queueType === 'track' && <div>Duration</div>}
                  <div>Votes</div>
                  <div>Action</div>
                </div>

                {requests.map((req) => (
                  <div key={req.id} className="queue-table-row">
                    <div className="queue-album-title">
                      {queueType === 'track' ? (req.track_name || req.title) : req.title}
                    </div>
                    <div className="queue-artist-name">
                      {req.artist}
                    </div>
                    {queueType === 'side' && (
                      <div className="queue-side-indicator">
                        {req.side || '--'}
                      </div>
                    )}
                    {queueType === 'track' && (
                      <>
                        <div style={{ textAlign: 'center', fontSize: '14px' }}>
                          {req.track_number || '--'}
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '14px' }}>
                          {req.track_duration || '--:--'}
                        </div>
                      </>
                    )}
                    <div className={`queue-votes-count ${req.votes === 0 ? 'no-votes' : ''}`}>
                      {req.votes}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button
                        className="remove-button"
                        onClick={() => {
                          const itemDesc = queueType === 'track' 
                            ? `"${req.track_name || req.title}"` 
                            : `"${req.title}" by ${req.artist}`;
                          if (confirm(`Are you sure you want to remove ${itemDesc} from the queue?`)) {
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

            {requests.length > 0 && (
              <div className="queue-summary">
                <strong>Queue Summary:</strong> {requests.length} requests, {requests.reduce((sum, req) => sum + req.votes, 0)} total votes
              </div>
            )}

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
                Queue Type: {queueType}<br />
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
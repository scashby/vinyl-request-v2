// Admin Edit Queue page ("/admin/edit-queue")
// Updated to allow selection of specific event queue before editing

"use client";

import { useEffect, useState } from 'react';
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
  [key: string]: unknown;
};

export default function Page() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchRequestsForEvent(selectedEvent.id);
    }
  }, [selectedEvent]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('has_queue', true)
        .order('date', { ascending: false });
      
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
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('event_id', eventId)
        .order('votes', { ascending: false })
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching requests:', error);
        setRequests([]);
      } else {
        setRequests((data || []) as Request[]);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      setRequests([]);
    }
  };

  const removeRequest = async (id: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error removing request:', error);
        alert('Error removing request');
      } else {
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
          </div>
        )}
      </div>
    </div>
  );
}
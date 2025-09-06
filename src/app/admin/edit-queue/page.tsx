// Admin Edit Queue page ("/admin/edit-queue")
// Updated to allow selection of specific event queue before editing

"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'lib/supabaseClient'

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
      <div style={{ 
        padding: '2rem',
        textAlign: 'center',
        color: '#666',
        fontSize: '18px'
      }}>
        Loading events...
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto',
      color: '#111'
    }}>
      <h1 style={{ 
        fontSize: '2rem',
        fontWeight: 'bold',
        marginBottom: '2rem',
        color: '#111'
      }}>
        Edit Event Queue
      </h1>

      {!selectedEvent ? (
        // Event Selection View
        <div>
          <h2 style={{ 
            fontSize: '1.5rem',
            marginBottom: '1.5rem',
            color: '#374151'
          }}>
            Select an Event
          </h2>
          
          {events.length === 0 ? (
            <div style={{
              background: '#f9fafb',
              border: '2px dashed #d1d5db',
              borderRadius: '8px',
              padding: '3rem',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No Events with Queues</h3>
              <p>No events have been created with queue functionality enabled.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1.5rem'
            }}>
              {events.map((event) => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                  }}
                >
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    margin: '0 0 0.5rem 0',
                    color: '#111'
                  }}>
                    {event.title}
                  </h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    margin: '0 0 1rem 0'
                  }}>
                    {formatDate(event.date)}
                  </p>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#dbeafe',
                    color: '#1e40af',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '2rem',
            paddingBottom: '1rem',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                margin: '0',
                color: '#111'
              }}>
                {selectedEvent.title} - Queue
              </h2>
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                margin: '0.25rem 0 0 0'
              }}>
                {formatDate(selectedEvent.date)} • {requests.length} requests
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedEvent(null);
                setRequests([]);
              }}
              style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
                color: '#374151'
              }}
            >
              ← Back to Events
            </button>
          </div>

          {requests.length === 0 ? (
            <div style={{
              background: '#f9fafb',
              border: '2px dashed #d1d5db',
              borderRadius: '8px',
              padding: '3rem',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎵</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Queue is Empty</h3>
              <p>No requests have been added to this event&apos;s queue yet.</p>
            </div>
          ) : (
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 80px 100px 120px',
                gap: '1rem',
                padding: '1rem 1.5rem',
                background: '#f8fafc',
                borderBottom: '1px solid #e5e7eb',
                fontWeight: '600',
                fontSize: '0.875rem',
                color: '#374151'
              }}>
                <div>Album</div>
                <div>Artist</div>
                <div>Side</div>
                <div>Votes</div>
                <div>Action</div>
              </div>

              {/* Requests */}
              {requests.map((req, index) => (
                <div
                  key={req.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 80px 100px 120px',
                    gap: '1rem',
                    padding: '1rem 1.5rem',
                    background: index % 2 === 0 ? '#fff' : '#f9fafb',
                    borderBottom: index < requests.length - 1 ? '1px solid #f3f4f6' : 'none',
                    alignItems: 'center',
                    fontSize: '0.875rem'
                  }}
                >
                  <div style={{ 
                    fontWeight: '500',
                    color: '#111'
                  }}>
                    {req.title}
                  </div>
                  <div style={{ color: '#6b7280' }}>
                    {req.artist}
                  </div>
                  <div style={{ 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    {req.side}
                  </div>
                  <div style={{
                    textAlign: 'center',
                    fontWeight: '600',
                    color: req.votes > 0 ? '#f59e0b' : '#d1d5db'
                  }}>
                    {req.votes}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to remove "${req.title}" by ${req.artist} from the queue?`)) {
                          removeRequest(req.id);
                        }
                      }}
                      style={{
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#b91c1c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#dc2626';
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
            <div style={{
              marginTop: '2rem',
              padding: '1.25rem',
              background: '#dbeafe',
              borderRadius: '12px',
              border: '2px solid #3b82f6',
              fontSize: '0.875rem',
              color: '#1e3a8a',
              fontWeight: '600'
            }}>
              <strong>Queue Summary:</strong> {requests.length} requests, {requests.reduce((sum, req) => sum + req.votes, 0)} total votes
            </div>
          )}
        </div>
      )}
    </div>
  );
}
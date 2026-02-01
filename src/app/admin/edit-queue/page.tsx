// src/app/admin/edit-queue/page.tsx
// Admin Edit Queue page ("/admin/edit-queue")
// Updated with queue type support (track/side/album)

"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from 'lib/supabaseClient'
import { formatEventText } from 'src/utils/textFormatter';
import { Button } from 'components/ui/Button';
import { Card } from 'components/ui/Card';
import { Container } from 'components/ui/Container';
import type { DbEvent, DbRequestV3, Inventory, Release, Master, Artist } from 'types/supabase';

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
  inventory_id?: number | null;
  [key: string]: unknown;
};

type InventoryQueryRow = Inventory & {
  release?: (Release & {
    master?: (Master & {
      artist?: Artist | null;
    }) | null;
  }) | null;
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
        .from('requests_v3')
        .select(`
          *,
          inventory:inventory (
            id,
            release:releases (
              master:masters (
                title,
                artist:artists (
                  name
                )
              )
            )
          ),
          recording:recordings (
            title,
            duration_seconds
          )
        `)
        .eq('event_id', eventId)
        .order('id', { ascending: true });

      const typedRequests = (data || []) as DbRequestV3[];

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

      const inventoryIds = typedRequests.map(r => r.inventory_id).filter(Boolean);
      console.log('🔍 Admin Debug: Inventory IDs found:', inventoryIds);
      
      if (inventoryIds.length === 0) {
        console.log('🔍 Admin Debug: No album IDs, using direct request data');
        const mapped = typedRequests.map(req => ({
          id: req.id.toString(),
          artist: req.artist_name || '',
          title: req.track_title || '',
          side: req.track_title && req.track_title.toLowerCase().startsWith('side ')
            ? req.track_title.replace(/side\s+/i, '')
            : null,
          track_number: null,
          track_name: req.track_title || null,
          track_duration: null,
          votes: req.votes || 1,
          inventory_id: req.inventory_id,
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

      const mapped = typedRequests.map(req => {
        const inventory = (req as DbRequestV3 & { inventory?: InventoryQueryRow | null }).inventory ?? null;
        const master = inventory?.release?.master ?? null;
        const artistName = master?.artist?.name ?? req.artist_name ?? '';
        const title = master?.title ?? req.track_title ?? '';
        const sideLabel = req.track_title && req.track_title.toLowerCase().startsWith('side ')
          ? req.track_title.replace(/side\s+/i, '')
          : null;
        return {
          id: req.id.toString(),
          artist: artistName,
          title,
          side: sideLabel,
          track_number: null,
          track_name: req.track_title || null,
          track_duration: null,
          votes: req.votes || 1,
          inventory_id: req.inventory_id,
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
        .from('requests_v3')
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600 text-lg">
          Loading events...
        </div>
      </div>
    );
  }

  const queueType = selectedEvent?.queue_type || 'side';

  return (
    <div className="min-h-screen bg-white text-black">
      <Container className="py-8">
        <h1 className="text-4xl font-bold mb-8 text-gray-900 text-center">
          Edit Event Queue
        </h1>

        {!selectedEvent ? (
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">
              Select an Event
            </h2>
            
            {events.length === 0 ? (
              <div className="text-center p-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
                <div className="text-5xl mb-4">📅</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Events with Queues</h3>
                <p className="text-gray-600">No events have been created with queue functionality enabled.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <Card
                    key={event.id}
                    variant="interactive"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <h3 
                      className="text-xl font-semibold mb-2 text-gray-900"
                      dangerouslySetInnerHTML={{ __html: formatEventText(event.title) }}
                    />
                    <p className="text-sm text-gray-600 mb-4">
                      {formatDate(event.date)}
                    </p>
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {getQueueTypeLabel(event.queue_type || 'side')}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 p-6 bg-gray-50 rounded-xl border-b-4 border-gray-200">
              <div className="mb-4 md:mb-0 text-center md:text-left">
                <h2 className="text-3xl font-bold text-gray-900">
                  <span dangerouslySetInnerHTML={{ __html: formatEventText(selectedEvent.title) }} /> - Queue
                </h2>
                <p className="text-gray-600 mt-1">
                  {formatDate(selectedEvent.date)} • {requests.length} requests • {getQueueTypeLabel(queueType)}
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setSelectedEvent(null);
                  setRequests([]);
                }}
              >
                ← Back to Events
              </Button>
            </div>

            {requests.length === 0 ? (
              <div className="text-center p-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
                <div className="text-5xl mb-4">🎵</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Queue is Empty</h3>
                <p className="text-gray-600">No requests have been added to this event&apos;s queue yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="hidden md:grid grid-cols-[2fr_2fr_80px_100px_120px] gap-4 p-4 bg-gray-900 text-white font-bold text-sm uppercase tracking-wider">
                  <div>{queueType === 'track' ? 'Track' : 'Album'}</div>
                  <div>Artist</div>
                  {queueType === 'side' && <div>Side</div>}
                  {queueType === 'track' && <div>Track #</div>}
                  {queueType === 'track' && <div>Duration</div>}
                  <div className="text-center">Votes</div>
                  <div className="text-center">Action</div>
                </div>

                {requests.map((req) => (
                  <div key={req.id} className="grid grid-cols-1 md:grid-cols-[2fr_2fr_80px_100px_120px] gap-2 md:gap-4 p-4 items-center border-b border-gray-100 hover:bg-gray-50">
                    <div className="font-semibold text-gray-900">
                      <span className="md:hidden text-xs text-gray-500 block uppercase">Title</span>
                      {queueType === 'track' ? (req.track_name || req.title) : req.title}
                    </div>
                    <div className="text-gray-600">
                      <span className="md:hidden text-xs text-gray-500 block uppercase">Artist</span>
                      {req.artist}
                    </div>
                    {queueType === 'side' && (
                      <div className="text-center font-semibold text-gray-900">
                        <span className="md:hidden text-xs text-gray-500 block uppercase">Side</span>
                        {req.side || '--'}
                      </div>
                    )}
                    {queueType === 'track' && (
                      <>
                        <div className="text-center text-sm text-gray-600">
                          <span className="md:hidden text-xs text-gray-500 block uppercase">Track #</span>
                          {req.track_number || '--'}
                        </div>
                        <div className="text-center text-sm text-gray-600">
                          <span className="md:hidden text-xs text-gray-500 block uppercase">Duration</span>
                          {req.track_duration || '--:--'}
                        </div>
                      </>
                    )}
                    <div className={`text-center font-bold text-lg ${req.votes === 0 ? 'text-gray-300' : 'text-amber-500'}`}>
                      <span className="md:hidden text-xs text-gray-500 block uppercase font-normal">Votes</span>
                      {req.votes}
                    </div>
                    <div className="text-center">
                      <Button
                        variant="danger"
                        size="sm"
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
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {requests.length > 0 && (
              <div className="mt-8 p-5 bg-blue-50 border-2 border-blue-500 rounded-xl text-sm text-blue-900 font-semibold">
                <strong>Queue Summary:</strong> {requests.length} requests, {requests.reduce((sum, req) => sum + req.votes, 0)} total votes
              </div>
            )}

            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 p-4 bg-yellow-50 rounded-lg text-xs font-mono text-yellow-900 border border-yellow-200">
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
      </Container>
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

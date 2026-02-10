// Event Detail page ("/events/event-detail/[id]")
// Shows event info, image, queue, and "browse the collection" link for this event.

"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from 'src/lib/supabaseClient';
import { formatEventText } from 'src/utils/textFormatter';
import Image from 'next/image';
import { Container } from 'components/ui/Container';
import { Card } from 'components/ui/Card';
import { Button } from 'components/ui/Button';
import QueueSection from 'components/QueueSection';
import EventDJSets from 'components/EventDJSets';

interface EventData {
  id: number;
  title: string;
  date: string;
  time?: string;
  location?: string;
  image_url?: string;
  info?: string;
  info_url?: string;
  has_queue?: boolean;
  allowed_tags?: string[] | string | null;
}

const EVENT_TYPE_TAG_PREFIX = 'event_type:';

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.replace(/[{}]/g, '').split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const getTagValue = (tags: string[], prefix: string): string => {
  const match = tags.find((tag) => tag.startsWith(prefix));
  return match ? match.replace(prefix, '') : '';
};

const getDisplayTitle = (eventData: EventData): string => {
  const tags = normalizeStringArray(eventData.allowed_tags);
  const eventType = getTagValue(tags, EVENT_TYPE_TAG_PREFIX);
  if (eventType === 'private-dj') return 'Private Event';
  return eventData.title;
};

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [event, setEvent] = useState<EventData | null>(null);
  const [prevEventId, setPrevEventId] = useState<number | null>(null);
  const [nextEventId, setNextEventId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    const eventIdNum = Number(id);
    if (Number.isNaN(eventIdNum)) return;

    const fetchEventAndNavigation = async () => {
      // Fetch current event
      const { data: currentEvent, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventIdNum)
        .single();
      
      if (error) {
        console.error('Error fetching event:', error);
        return;
      }
      
      setEvent(currentEvent);

      // Fetch all events ordered by date (ascending - earliest first)
      const { data: allEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, date')
        .order('date', { ascending: true });

      if (eventsError) {
        console.error('Error fetching all events:', eventsError);
        return;
      }

      // Find current event's position and set prev/next
      const currentIndex = allEvents.findIndex(e => e.id === eventIdNum);
      if (currentIndex > 0) {
        setPrevEventId(allEvents[currentIndex - 1].id);
      } else {
        setPrevEventId(null);
      }
      if (currentIndex < allEvents.length - 1) {
        setNextEventId(allEvents[currentIndex + 1].id);
      } else {
        setNextEventId(null);
      }
    };

    fetchEventAndNavigation();
  }, [id]);

  if (!event) return <div>Loading...</div>;

  const {
    date,
    time,
    location,
    image_url,
    info,
    info_url,
    has_queue,
    allowed_tags
  } = event;

  const displayTitle = getDisplayTitle({ ...event, allowed_tags });
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const mapQuery = location ? encodeURIComponent(location) : '';
  const mapSearchUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${mapQuery}`
    : '';
  const directionsUrl = mapQuery
    ? `https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`
    : '';

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return new Date(`${month}/${day}/${year}`).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const imageSrc = image_url?.includes('dropbox.com')
    ? image_url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/\?.*$/, '')
    : image_url || '/images/event-header-still.jpg';

  const goToBrowse = () => {
    router.push(`/browse/browse-albums?eventId=${event.id}`);
  };

  const navigateToEvent = (eventId: number | null) => {
    if (eventId) {
      router.push(`/events/event-detail/${eventId}`);
    }
  };

  return (
    <div className="bg-white min-h-screen text-black pb-20">
      <header className="relative h-[300px] flex items-center justify-center bg-gray-900">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: "url('/images/event-header-still.jpg')" }}
        />
        <div className="relative z-10 px-8 py-6 bg-black/40 rounded-xl backdrop-blur-sm">
          <h1 
            className="text-4xl md:text-5xl font-bold text-white font-serif-display text-center"
            dangerouslySetInnerHTML={{ __html: formatEventText(displayTitle) }} 
          />
        </div>
      </header>

      {/* Navigation buttons at top */}
      <Container className="py-6 flex justify-between items-center gap-4">
        <Button
          variant="primary"
          onClick={() => navigateToEvent(prevEventId)}
          disabled={!prevEventId}
        >
          ← Previous Event
        </Button>
        <Button
          variant="secondary"
          onClick={() => router.push('/events/events-page')}
        >
          All Events
        </Button>
        <Button
          variant="primary"
          onClick={() => navigateToEvent(nextEventId)}
          disabled={!nextEventId}
        >
          Next Event →
        </Button>
      </Container>

      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-12 items-start">
          <aside className="w-full lg:sticky lg:top-8">
            <Card className="text-center" noPadding>
              <div className="relative aspect-square w-full">
                <Image
                  src={imageSrc}
                  alt={displayTitle}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
                <div className="p-6">
                <h2 className="text-2xl font-bold text-purple-700 mb-2">{displayTitle}</h2>
                {location && (
                  <div className="mb-4">
                    <a
                      href={mapSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      📍 {location}
                    </a>
                    {directionsUrl && (
                      <div className="mt-2">
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-purple-700 font-semibold hover:underline"
                        >
                          Get directions
                        </a>
                      </div>
                    )}
                  </div>
                )}
                <div className="text-gray-600 font-medium border-t pt-4 mt-2">
                  {formatDate(date)}
                  <br />
                  {time && <span className="text-gray-500 text-sm">{time}</span>}
                </div>
              </div>
            </Card>
          </aside>

          <section className="flex-1 min-w-0 space-y-8">
            {(info || info_url) && (
              <div className="prose max-w-none">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">About This Event</h3>
                {info && <div className="text-gray-700 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: formatEventText(info) }} />}
                {info_url && (
                  <a
                    href={info_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    View the event page
                  </a>
                )}
              </div>
            )}

            {location && (
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-gray-900">Map &amp; Directions</h3>
                {googleMapsKey ? (
                  <div className="aspect-video w-full overflow-hidden rounded-2xl border border-gray-200">
                    <iframe
                      title={`Map for ${displayTitle}`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="h-full w-full"
                      src={`https://www.google.com/maps/embed/v1/place?key=${googleMapsKey}&q=${mapQuery}`}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to show the embedded map.
                  </p>
                )}
                {directionsUrl && (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Open directions in Google Maps
                  </a>
                )}
              </div>
            )}

            {/* DJ Sets Section */}
            <EventDJSets eventId={event.id} />

            {has_queue && (
              <>
                <QueueSection eventId={String(event.id)} />
                <button
                  className="text-blue-600 underline mt-4 inline-block font-medium text-base hover:text-blue-800 transition-colors"
                  onClick={goToBrowse}
                >
                  Browse the Collection
                </button>
              </>
            )}
          </section>
        </div>
      </Container>

      {/* Navigation buttons at bottom */}
      <Container className="py-8 flex justify-between items-center gap-4 border-t border-gray-200 mt-12">
        <Button
          variant="primary"
          onClick={() => navigateToEvent(prevEventId)}
          disabled={!prevEventId}
        >
          ← Previous Event
        </Button>
        <Button
          variant="primary"
          onClick={() => navigateToEvent(nextEventId)}
          disabled={!nextEventId}
        >
          Next Event →
        </Button>
      </Container>
    </div>
  );
}
// AUDIT: inspected, no changes.

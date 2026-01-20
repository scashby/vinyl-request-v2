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
}

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [event, setEvent] = useState<EventData | null>(null);
  const [prevEventId, setPrevEventId] = useState<number | null>(null);
  const [nextEventId, setNextEventId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchEventAndNavigation = async () => {
      // Fetch current event
      const { data: currentEvent, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching event:', error);
        return;
      }
      
      setEvent(currentEvent);

      // Fetch all events ordered by date (descending - most recent first)
      const { data: allEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, date')
        .order('date', { ascending: false });

      if (eventsError) {
        console.error('Error fetching all events:', eventsError);
        return;
      }

      // Find current event's position and set prev/next
      const currentIndex = allEvents.findIndex(e => e.id === parseInt(id));
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
    title,
    date,
    time,
    location,
    image_url,
    info,
    info_url,
    has_queue
  } = event;

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
            dangerouslySetInnerHTML={{ __html: formatEventText(title) }} 
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
                  alt={title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-bold text-purple-700 mb-2">{title}</h2>
                {location && (
                  <div className="mb-4">
                    <a
                      href={`http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      📍 {location}
                    </a>
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
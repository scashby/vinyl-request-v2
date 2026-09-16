// Event Detail page ("/events/event-detail/[id]")
// Shows event info, image, queue, and "browse the collection" link for this event.

"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from 'src/lib/supabaseClient';
import { formatEventText } from 'src/utils/textFormatter';
import Image from 'next/image';
import { Container } from 'components/ui/Container';
import QueueSection from 'components/QueueSection';
import EventDJSets from 'components/EventDJSets';
import { useActiveTheme } from 'src/lib/useActiveTheme';

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
const IMAGE_FOCUS_SQUARE_TAG_PREFIX = 'image_focus_square:';

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

const clampFocusValue = (value: number): number => {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
};

const getImageFocusFromTags = (tagsValue: unknown, prefix: string): { x: number; y: number } => {
  const tags = normalizeStringArray(tagsValue);
  const raw = getTagValue(tags, prefix);
  if (!raw) return { x: 50, y: 50 };
  const [xRaw, yRaw] = raw.split(':');
  return {
    x: clampFocusValue(Number.parseFloat(xRaw ?? '50')),
    y: clampFocusValue(Number.parseFloat(yRaw ?? '50')),
  };
};

function NavButton({
  onClick,
  disabled,
  children,
  variant = 'primary',
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        variant === 'primary'
          ? 'px-5 py-2.5 rounded-full font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)] hover:bg-[var(--dwd-accent-1-hover)]'
          : 'px-5 py-2.5 rounded-full font-bold text-sm transition-opacity bg-transparent text-[var(--dwd-ink)] border-2 border-[var(--dwd-ink)] hover:opacity-65'
      }
    >
      {children}
    </button>
  );
}

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [event, setEvent] = useState<EventData | null>(null);
  const [prevEventId, setPrevEventId] = useState<number | null>(null);
  const [nextEventId, setNextEventId] = useState<number | null>(null);
  const { cssVars } = useActiveTheme();

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

  if (!event) {
    return (
      <div className="min-h-screen font-[family-name:var(--dwd-font-body)] bg-[var(--dwd-bg)] text-[var(--dwd-ink)]" style={cssVars}>
        <div className="py-16 text-center text-[var(--dwd-ink-faint)]">Loading&hellip;</div>
      </div>
    );
  }

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
  const squareFocus = getImageFocusFromTags(allowed_tags, IMAGE_FOCUS_SQUARE_TAG_PREFIX);

  const goToBrowse = () => {
    router.push(`/browse/browse-albums?eventId=${event.id}`);
  };

  const navigateToEvent = (eventId: number | null) => {
    if (eventId) {
      router.push(`/events/event-detail/${eventId}`);
    }
  };

  return (
    <div
      className="min-h-screen font-[family-name:var(--dwd-font-body)] bg-[var(--dwd-bg)] text-[var(--dwd-ink)] pb-20"
      style={cssVars}
    >
      <Container size="xl">
        <div className="pt-16 pb-8 md:pt-20">
          <h1
            className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-4xl md:text-5xl"
            dangerouslySetInnerHTML={{ __html: formatEventText(displayTitle) }}
          />
        </div>
      </Container>

      {/* Navigation buttons at top */}
      <Container size="xl">
        <div className="pb-6 flex justify-between items-center gap-4">
          <NavButton onClick={() => navigateToEvent(prevEventId)} disabled={!prevEventId}>
            &larr; Previous Event
          </NavButton>
          <NavButton variant="secondary" onClick={() => router.push('/events/events-page')}>
            All Events
          </NavButton>
          <NavButton onClick={() => navigateToEvent(nextEventId)} disabled={!nextEventId}>
            Next Event &rarr;
          </NavButton>
        </div>
      </Container>

      <Container size="xl">
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-12 items-start">
          <aside className="w-full lg:sticky lg:top-8">
            <div
              className="text-center overflow-hidden bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)] -rotate-[0.6deg]"
            >
              <div className="relative aspect-square w-full">
                <Image
                  src={imageSrc}
                  alt={displayTitle}
                  fill
                  className="object-cover"
                  style={{ objectPosition: `${squareFocus.x}% ${squareFocus.y}%` }}
                  unoptimized
                />
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-2">{displayTitle}</h2>
                {location && (
                  <div className="mb-4">
                    <a
                      href={mapSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--dwd-accent-1)] hover:text-[var(--dwd-accent-1-hover)] font-medium"
                    >
                      {location}
                    </a>
                    {directionsUrl && (
                      <div className="mt-2">
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--dwd-accent-2)] font-semibold hover:underline"
                        >
                          Get directions
                        </a>
                      </div>
                    )}
                  </div>
                )}
                <div className="text-[var(--dwd-ink-soft)] font-medium border-t border-[var(--dwd-ink)]/10 pt-4 mt-2">
                  {formatDate(date)}
                  <br />
                  {time && <span className="text-[var(--dwd-ink-faint)] text-sm">{time}</span>}
                </div>
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0 space-y-8">
            {(info || info_url) && (
              <div className="prose max-w-none">
                <h3 className="text-2xl font-bold mb-4">About This Event</h3>
                {info && <div className="text-[var(--dwd-ink-soft)] leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: formatEventText(info) }} />}
                {info_url && (
                  <a
                    href={info_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--dwd-accent-1)] hover:underline font-semibold"
                  >
                    View the event page
                  </a>
                )}
              </div>
            )}

            {location && (
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">Map &amp; Directions</h3>
                {googleMapsKey ? (
                  <div className="aspect-video w-full overflow-hidden rounded-2xl [border:var(--dwd-card-border)]">
                    <iframe
                      title={`Map for ${displayTitle}`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="h-full w-full"
                      src={`https://www.google.com/maps/embed/v1/place?key=${googleMapsKey}&q=${mapQuery}`}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-[var(--dwd-ink-faint)]">
                    Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to show the embedded map.
                  </p>
                )}
                {directionsUrl && (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-sm font-semibold text-[var(--dwd-accent-1)] hover:text-[var(--dwd-accent-1-hover)]"
                  >
                    Open directions in Google Maps
                  </a>
                )}
              </div>
            )}

            {/* DJ Sets Section (left as-is — its own established styling) */}
            <EventDJSets eventId={event.id} />

            {has_queue && (
              <>
                {/* Queue Section (left as-is — may double as a live venue-screen display) */}
                <QueueSection eventId={String(event.id)} />
                <button
                  className="text-[var(--dwd-accent-1)] underline mt-4 inline-block font-medium text-base hover:text-[var(--dwd-accent-1-hover)] transition-colors"
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
      <Container size="xl">
        <div className="py-8 flex justify-between items-center gap-4 border-t border-[var(--dwd-ink)]/10 mt-12">
          <NavButton onClick={() => navigateToEvent(prevEventId)} disabled={!prevEventId}>
            &larr; Previous Event
          </NavButton>
          <NavButton onClick={() => navigateToEvent(nextEventId)} disabled={!nextEventId}>
            Next Event &rarr;
          </NavButton>
        </div>
      </Container>
    </div>
  );
}

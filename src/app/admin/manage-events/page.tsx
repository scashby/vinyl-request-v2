// src/app/admin/manage-events/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient'
import { Container } from 'components/ui/Container';
import { Button } from 'components/ui/Button';
import { Card } from 'components/ui/Card';

// Define the Event interface to satisfy linting
interface Event {
  id: number;
  title: string;
  date: string;
  is_recurring?: boolean;
  parent_event_id?: number | null;
  crate_id?: number | null;
  has_queue?: boolean;
  has_games?: boolean;
  game_modes?: string[] | string | null;
  is_featured_grid?: boolean;
  featured_priority?: number | null;
  allowed_tags?: string[] | string | null;
  [key: string]: unknown; // Allow for other dynamic fields
}

const EVENT_TYPE_TAG_PREFIX = 'event_type:';
const EVENT_SUBTYPE_TAG_PREFIX = 'event_subtype:';

const eventTypeLabels: Record<string, string> = {
  brewery: 'Brewery Event',
  'public-dj': 'Public DJ Event',
  'private-dj': 'Private DJ Event',
  other: 'Other Event',
};

const eventSubtypeLabels: Record<string, string> = {
  'live-jukebox': 'Live Jukebox',
  'vinyl-sundays': 'Vinyl Sundays',
  'vinyl-trivia': 'Vinyl Trivia',
  'vinyl-bingo': 'Vinyl Music Bingo',
  'vinyl-bracketology': 'Vinyl Bracketology',
};

const GAME_MODE_LABELS: Record<string, string> = {
  bracketology: 'Bracketology',
  bingo: 'Vinyl Bingo',
  trivia: 'Needle Drop Trivia',
};

const gameModeLabels: Record<string, string> = {
  bracketology: 'Bracketology',
  bingo: 'Vinyl Bingo',
  trivia: 'Needle Drop Trivia',
};

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

export default function Page() {
  const [events, setEvents] = useState<Event[]>([]);
  const [crates, setCrates] = useState<Record<number, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      // Fetch Crates Map
      const { data: cratesData } = await supabase.from('crates').select('id, name');
      if (cratesData) {
        const crateMap: Record<number, string> = {};
        cratesData.forEach(c => crateMap[c.id] = c.name);
        setCrates(crateMap);
      }

      // Fetch Events
      const { data: eventsData, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
        
      if (!error && eventsData) setEvents(eventsData as Event[]);
    }
    fetchData();
  }, []);

  const refreshEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
    setEvents((data as Event[]) || []);
  };

  const updateEventFlags = async (eventId: number, updates: Partial<Event>) => {
    setEvents((prev) => prev.map((ev) => (ev.id === eventId ? { ...ev, ...updates } : ev)));
    const normalizedUpdates: Record<string, unknown> = { ...updates };
    if (typeof normalizedUpdates.allowed_tags === 'string') {
      normalizedUpdates.allowed_tags = [normalizedUpdates.allowed_tags];
    }
    const { error } = await supabase.from('events').update(normalizedUpdates).eq('id', eventId);
    if (error) {
      alert(`Error saving changes: ${error.message}`);
      await refreshEvents();
    }
  };

  const handleFeaturedToggle = (eventRow: Event, nextChecked: boolean) => {
    updateEventFlags(eventRow.id, { is_featured_grid: nextChecked });
  };

  const handlePriorityChange = (eventRow: Event, value: string) => {
    const trimmed = value.trim();
    const parsed =
      trimmed === ''
        ? null
        : Number.isNaN(parseInt(trimmed, 10))
        ? null
        : parseInt(trimmed, 10);

    updateEventFlags(eventRow.id, { featured_priority: parsed });
  };

  const handleCopy = (event: Event) => {
    if (typeof window !== 'undefined') {
      const eventCopy = {
        ...event,
        id: undefined,
        created_at: undefined,
        updated_at: undefined,
        is_recurring: false,
        recurrence_end_date: '',
        parent_event_id: undefined,
        title: `${event.title} (Copy)`
      };
      sessionStorage.setItem('copiedEvent', JSON.stringify(eventCopy));
    }
    router.push('/admin/manage-events/edit');
  };

  const handleDelete = async (event: Event) => {
    let confirmMessage = `Are you sure you want to delete "${event.title}"?`;
    if (event.is_recurring || event.parent_event_id) {
      confirmMessage = event.is_recurring 
        ? `Delete entire recurring series for "${event.title}"?`
        : `This is part of a series. Delete all events?`;
    }
    
    if (!confirm(confirmMessage)) return;
    
    try {
      let query = supabase.from('events').delete();
      
      if (event.is_recurring || event.parent_event_id) {
        const parentId = event.parent_event_id || event.id;
        query = query.or(`id.eq.${parentId},parent_event_id.eq.${parentId}`);
      } else {
        query = query.eq('id', event.id);
      }
      
      const { error } = await query;
      if (error) throw error;
      
      // Refresh list
      await refreshEvents();
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error: ${msg}`);
    }
  };

  const filteredEvents = events.filter((event) =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Container size="md" className="py-8 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Manage Events</h2>
          <p className="text-sm text-gray-500 mt-1">
            Edit event details, toggle featured status, and manage recurring series.
          </p>
        </div>
        <Button onClick={() => router.push('/admin/manage-events/edit')}>
          Add New Event
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search events..."
          className="w-full md:max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
        />
        <span className="text-xs text-gray-500">
          Showing {filteredEvents.length} of {events.length}
        </span>
      </div>

      <div className="space-y-4">
        {filteredEvents.map(event => {
          const tags = normalizeStringArray(event.allowed_tags);
          const gameModes = normalizeStringArray(event.game_modes);
          const eventType = getTagValue(tags, EVENT_TYPE_TAG_PREFIX);
          const eventSubtype = getTagValue(tags, EVENT_SUBTYPE_TAG_PREFIX);

          return (
            <Card key={event.id} className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <span className="font-semibold text-lg text-gray-900 block">
                    {event.title} <span className="text-gray-500 font-normal">– {event.date}</span>
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {event.is_recurring && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                        Recurring
                      </span>
                    )}
                    {eventType && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                        {eventTypeLabels[eventType] || eventType}
                      </span>
                    )}
                    {eventSubtype && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-1 rounded-full">
                        {eventSubtypeLabels[eventSubtype] || eventSubtype}
                      </span>
                    )}
                    {event.crate_id && crates[event.crate_id] && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                        📦 {crates[event.crate_id]}
                      </span>
                    )}
                    {event.has_queue && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                        Queue Active
                      </span>
                    )}
                    {event.has_games && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-1 rounded-full">
                        Vinyl Games
                      </span>
                    )}
                    {event.has_games && gameModes.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full">
                        {gameModes.map((mode) => gameModeLabels[mode] || mode).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => router.push(`/admin/manage-events/edit?id=${event.id}`)}
                  >
                    Edit
                  </Button>
                  <Button 
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCopy(event)}
                  >
                    Copy
                  </Button>
                  <Button 
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(event)}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!event.is_featured_grid}
                    onChange={(e) => handleFeaturedToggle(event, e.target.checked)}
                    className="h-4 w-4"
                  />
                  Featured on events page
                </label>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Priority</span>
                  <input
                    type="number"
                    value={event.featured_priority ?? ''}
                    onChange={(e) => handlePriorityChange(event, e.target.value)}
                    className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm"
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Container>
  );
}
// AUDIT: inspected, no changes.

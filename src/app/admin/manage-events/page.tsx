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
  [key: string]: unknown; // Allow for other dynamic fields
}

export default function Page() {
  const [events, setEvents] = useState<Event[]>([]);
  const [crates, setCrates] = useState<Record<number, string>>({});
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
      const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
      setEvents((data as Event[]) || []);
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error: ${msg}`);
    }
  };

  return (
    <Container size="md" className="py-8 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Manage Events</h2>
        <Button onClick={() => router.push('/admin/manage-events/edit')}>
          Add New Event
        </Button>
      </div>

      <div className="space-y-4">
        {events.map(event => (
          <Card key={event.id} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="font-semibold text-lg text-gray-900 block md:inline">
                {event.title} <span className="text-gray-500 font-normal">– {event.date}</span>
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {event.is_recurring && (
                  <span className="inline-block text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                    Recurring
                  </span>
                )}
                {event.crate_id && crates[event.crate_id] && (
                  <span className="inline-block text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                    📦 {crates[event.crate_id]}
                  </span>
                )}
                {event.has_queue && (
                  <span className="inline-block text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                    Queue Active
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
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
          </Card>
        ))}
      </div>
    </Container>
  );
}
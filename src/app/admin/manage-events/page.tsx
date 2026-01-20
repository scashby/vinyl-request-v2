// Admin Manage Events page ("/admin/manage-events") 
// Lets admins view, add, edit, and copy events in the Supabase "events" table.

"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient';
import { Container } from 'components/ui/Container';
import { Button } from 'components/ui/Button';
import { Card } from 'components/ui/Card';

interface Event {
  id: number;
  title: string;
  date: string;
  is_recurring?: boolean;
  recurrence_end_date?: string;
  parent_event_id?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export default function Page() {
  const [events, setEvents] = useState<Event[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      if (!error && data) setEvents(data);
    }
    fetchEvents();
  }, []);

  const handleCopy = (event: Event) => {
    if (typeof window !== 'undefined') {
      // Create a copy of the event without the ID and other auto-generated fields
      const eventCopy = {
        ...event,
        id: undefined, // Remove ID so Supabase generates a new one
        created_at: undefined, // Remove timestamp fields if they exist
        updated_at: undefined,
        // Reset recurring event fields for copies
        is_recurring: false,
        recurrence_end_date: '',
        parent_event_id: undefined,
        // Optionally modify the title to indicate it's a copy
        title: `${event.title} (Copy)`
      };
      sessionStorage.setItem('copiedEvent', JSON.stringify(eventCopy));
    }
    router.push('/admin/manage-events/edit');
  };

  const handleDelete = async (event: Event) => {
    let confirmMessage = `Are you sure you want to delete "${event.title}"?`;
    
    // If this is a recurring event (parent) or part of a series, ask about deleting the whole series
    if (event.is_recurring || event.parent_event_id) {
      if (event.is_recurring) {
        // This is the parent recurring event
        confirmMessage = `This is a recurring event. Do you want to delete the entire series including all future occurrences?`;
      } else {
        // This is part of a recurring series
        confirmMessage = `This event is part of a recurring series. Do you want to delete just this occurrence or the entire series?\n\nClick OK to delete the entire series, or Cancel to delete just this occurrence.`;
      }
    }
    
    const deleteEntireSeries = confirm(confirmMessage);
    
    try {
      if (event.is_recurring && deleteEntireSeries) {
        // Delete all events in the series (parent + children)
        const { error } = await supabase
          .from('events')
          .delete()
          .or(`id.eq.${event.id},parent_event_id.eq.${event.id}`);
        
        if (error) throw error;
        alert('Entire recurring series deleted successfully!');
      } else if (event.parent_event_id && deleteEntireSeries) {
        // Delete all events in the series (find parent first)
        const { error } = await supabase
          .from('events')
          .delete()
          .or(`id.eq.${event.parent_event_id},parent_event_id.eq.${event.parent_event_id}`);
        
        if (error) throw error;
        alert('Entire recurring series deleted successfully!');
      } else {
        // Delete just this single event
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', event.id);
        
        if (error) throw error;
        alert('Event deleted successfully!');
      }
      
      // Refresh the events list
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      setEvents(data || []);
      
    } catch (error: any) {
      alert(
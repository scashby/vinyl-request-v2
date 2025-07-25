// Admin Manage Events page ("/admin/manage-events")
// Lets admins view, add, edit, and copy events in the Supabase "events" table.

"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient'

export default function Page() {
  const [events, setEvents] = useState([]);
  const router = useRouter();

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      if (!error) setEvents(data);
    }
    fetchEvents();
  }, []);

  const handleCopy = (event) => {
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

  const handleDelete = async (event) => {
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
      
    } catch (error) {
      alert(`Error deleting event: ${error.message}`);
    }
  };

  return (
    <div style={{
      maxWidth: '640px',
      margin: '2rem auto',
      padding: '2rem',
      backgroundColor: '#ffffff',
      color: '#000000',
      border: '1px solid #ddd',
      borderRadius: '8px',
      minHeight: '100vh',
      boxShadow: '0 0 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: 'bold',
        marginBottom: '1.5rem'
      }}>Manage Events</h2>

      <button
        type="button"
        onClick={() => router.push('/admin/manage-events/edit')}
        style={{
          backgroundColor: '#2563eb',
          color: '#fff',
          padding: '0.5rem 1rem',
          border: 'none',
          borderRadius: '4px',
          marginBottom: '1.5rem',
          cursor: 'pointer'
        }}>
        Add New Event
      </button>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {events.map(event => (
          <li key={event.id} style={{
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            border: '1px solid #e0e0e0'
          }}>
            <div>
              <span style={{ fontWeight: '500' }}>
                {event.title} – {event.date}
              </span>
              {event.is_recurring && (
                <span style={{ 
                  marginLeft: '0.5rem', 
                  fontSize: '0.8rem', 
                  color: '#666',
                  backgroundColor: '#e0f2fe',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '12px'
                }}>
                  Recurring
                </span>
              )}
              {event.parent_event_id && (
                <span style={{ 
                  marginLeft: '0.5rem', 
                  fontSize: '0.8rem', 
                  color: '#666',
                  backgroundColor: '#f3e8ff',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '12px'
                }}>
                  Series
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => router.push(`/admin/manage-events/edit?id=${event.id}`)}
                style={{
                  color: '#2563eb',
                  textDecoration: 'underline',
                  fontWeight: '500',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}>
                Edit
              </button>
              <button onClick={() => handleCopy(event)} style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontWeight: '500'
              }}>
                Copy
              </button>
              <button 
                onClick={() => handleDelete(event)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: '500'
                }}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
// EditEventForm.tsx — Updated with recurring events functionality

"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient';

const formatList = ['Vinyl', 'Cassettes', 'CD', '45s', '8-Track'];

interface EventData {
  title: string;
  date: string;
  time: string;
  location: string;
  image_url: string;
  info: string;
  info_url: string;
  has_queue: boolean;
  allowed_formats: string[];
  is_recurring: boolean;
  recurrence_pattern: string;
  recurrence_interval: number;
  recurrence_end_date: string;
  parent_event_id?: number;
}

// Utility function to generate recurring events
function generateRecurringEvents(baseEvent: EventData & { id?: number }): Omit<EventData, 'id'>[] {
  const events: Omit<EventData, 'id'>[] = [];
  
  if (!baseEvent.is_recurring || !baseEvent.recurrence_end_date) {
    return [baseEvent];
  }

  const startDate = new Date(baseEvent.date);
  const endDate = new Date(baseEvent.recurrence_end_date);
  const pattern = baseEvent.recurrence_pattern;
  const interval = baseEvent.recurrence_interval || 1;

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Create event for current date
    const eventForDate: Omit<EventData, 'id'> = {
      ...baseEvent,
      date: currentDate.toISOString().split('T')[0],
      parent_event_id: baseEvent.id // Link to parent
    };
    events.push(eventForDate);

    // Calculate next occurrence
    switch (pattern) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + interval);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + (7 * interval));
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + interval);
        break;
      default:
        return events; // Stop if pattern is unrecognized
    }
  }

  return events;
}

export default function EditEventForm() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  const [eventData, setEventData] = useState<EventData>({
    title: '',
    date: '',
    time: '',
    location: '',
    image_url: '',
    info: '',
    info_url: '',
    has_queue: false,
    allowed_formats: [] as string[],
    is_recurring: false,
    recurrence_pattern: 'weekly',
    recurrence_interval: 1,
    recurrence_end_date: '',
  });

  useEffect(() => {
    const fetchEvent = async () => {
      let copiedEvent = null;
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('copiedEvent');
        if (stored) {
          copiedEvent = JSON.parse(stored);
          sessionStorage.removeItem('copiedEvent');
        }
      }
      if (copiedEvent) {
        setEventData({
          ...eventData,
          ...copiedEvent,
          allowed_formats: Array.isArray(copiedEvent.allowed_formats)
            ? copiedEvent.allowed_formats
            : typeof copiedEvent.allowed_formats === 'string'
              ? copiedEvent.allowed_formats.replace(/[{}]/g, '').split(',').map((f: string) => f.trim()).filter(Boolean)
              : [],
          title: copiedEvent.title ? `${copiedEvent.title} (Copy)` : '',
          // Reset recurring settings for copied events
          is_recurring: false,
          recurrence_end_date: '',
          parent_event_id: undefined,
        });
      } else if (id) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error fetching event:', error);
        } else if (data) {
          setEventData({
            ...eventData,
            ...data,
            allowed_formats: Array.isArray(data.allowed_formats)
              ? data.allowed_formats
              : typeof data.allowed_formats === 'string'
                ? data.allowed_formats.replace(/[{}]/g, '').split(',').map((f: string) => f.trim()).filter(Boolean)
                : [],
            is_recurring: data.is_recurring || false,
            recurrence_pattern: data.recurrence_pattern || 'weekly',
            recurrence_interval: data.recurrence_interval || 1,
            recurrence_end_date: data.recurrence_end_date || '',
          });
        }
      }
    };
    fetchEvent();
    // eslint-disable-next-line
  }, [id]);

  // For all text inputs and textareas (NO CHECKBOXES HERE)
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEventData((prev) => ({
      ...prev,
      [name]: name === 'recurrence_interval' ? parseInt(value) || 1 : value,
    }));
  };

  // For has_queue and is_recurring checkboxes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEventData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // For allowed_formats checkboxes only
  const handleFormatChange = (format: string, checked: boolean) => {
    setEventData((prev) => {
      const formats = Array.isArray(prev.allowed_formats) ? [...prev.allowed_formats] : [];
      if (checked) {
        return { ...prev, allowed_formats: [...formats, format] };
      } else {
        return { ...prev, allowed_formats: formats.filter((f) => f !== format) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...eventData,
        allowed_formats: `{${eventData.allowed_formats.map(f => f.trim()).join(',')}}`,
      };

      if (eventData.is_recurring && !id) {
        // Creating a new recurring event
        const { data: savedEvent, error: saveError } = await supabase
          .from('events')
          .insert([payload])
          .select()
          .single();

        if (saveError) throw saveError;

        // Generate and save recurring instances
        const recurringEvents = generateRecurringEvents({
          ...savedEvent,
          id: savedEvent.id
        });

        // Remove the first event (it's already saved) and save the rest
        const eventsToInsert = recurringEvents.slice(1).map(e => ({
          ...e,
          allowed_formats: `{${e.allowed_formats.map(f => f.trim()).join(',')}}`,
          parent_event_id: savedEvent.id
        }));

        if (eventsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('events')
            .insert(eventsToInsert);

          if (insertError) throw insertError;
        }

        alert(`Successfully created ${recurringEvents.length} recurring events!`);
      } else {
        // Single event or updating existing event
        let result;
        if (id) {
          result = await supabase.from('events').update(payload).eq('id', id);
        } else {
          result = await supabase.from('events').insert([payload]);
        }

        if (result.error) throw result.error;
        alert('Event saved successfully!');
      }

      router.push('/admin/manage-events');
    } catch (error: any) {
      alert(`Error saving event: ${error.message}`);
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
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
        {id ? 'Edit Event' : 'New Event'}
      </h2>
      <form onSubmit={handleSubmit}>
        <input
          name="title"
          value={eventData.title}
          onChange={handleChange}
          placeholder="Title"
          required
          style={{ display: 'block', width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <input
          name="date"
          type="date"
          value={eventData.date}
          onChange={handleChange}
          placeholder="Date"
          required
          style={{ display: 'block', width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <input
          name="time"
          value={eventData.time}
          onChange={handleChange}
          placeholder="Time (e.g., 3:00 PM - 6:00 PM)"
          style={{ display: 'block', width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <input
          name="location"
          value={eventData.location}
          onChange={handleChange}
          placeholder="Location"
          style={{ display: 'block', width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <input
          name="image_url"
          value={eventData.image_url}
          onChange={handleChange}
          placeholder="Image URL"
          style={{ display: 'block', width: '100%', marginBottom: '0.5rem', padding: '0.5rem' }}
        />
        <a
          href="https://supabase.com/dashboard/project/bntoivaipesuovselglg/storage/buckets/event-images"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', marginBottom: '1rem', color: '#2563eb', textDecoration: 'underline' }}
        >
          Upload image manually to Supabase
        </a>
        <textarea
          name="info"
          value={eventData.info}
          onChange={handleChange}
          placeholder="Event Info"
          style={{ display: 'block', width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <input
          name="info_url"
          value={eventData.info_url || ''}
          onChange={handleChange}
          placeholder="Event Info URL (optional)"
          style={{ display: 'block', width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            name="has_queue"
            checked={eventData.has_queue}
            onChange={handleCheckboxChange}
          />
          {' '}Has Queue
        </label>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            name="is_recurring"
            checked={eventData.is_recurring}
            onChange={handleCheckboxChange}
          />
          {' '}Recurring Event
        </label>

        {eventData.is_recurring && (
          <div style={{ 
            border: '1px solid #ddd', 
            padding: '1rem', 
            borderRadius: '4px', 
            marginBottom: '1rem',
            backgroundColor: '#f9f9f9'
          }}>
            <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Recurrence Settings</h4>
            
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              Pattern:
              <select
                name="recurrence_pattern"
                value={eventData.recurrence_pattern}
                onChange={handleChange}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: '1rem' }}>
              Every:
              <input
                type="number"
                name="recurrence_interval"
                min="1"
                value={eventData.recurrence_interval}
                onChange={handleChange}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
              <small style={{ color: '#666' }}>
                {eventData.recurrence_pattern === 'daily' && 'day(s)'}
                {eventData.recurrence_pattern === 'weekly' && 'week(s)'}
                {eventData.recurrence_pattern === 'monthly' && 'month(s)'}
              </small>
            </label>

            <label style={{ display: 'block', marginBottom: '1rem' }}>
              End Date:
              <input
                type="date"
                name="recurrence_end_date"
                value={eventData.recurrence_end_date}
                onChange={handleChange}
                required
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </label>
          </div>
        )}

        <fieldset style={{ marginBottom: '1rem' }}>
          <legend>Allowed Formats</legend>
          {formatList.map((format) => (
            <label key={format} style={{ display: 'block', marginBottom: '0.25rem' }}>
              <input
                type="checkbox"
                name="allowed_formats"
                value={format}
                checked={Array.isArray(eventData.allowed_formats) ? eventData.allowed_formats.includes(format) : false}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormatChange(format, e.target.checked)}
              />
              {' '}{format}
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          style={{
            backgroundColor: '#2563eb',
            color: '#fff',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {eventData.is_recurring && !id ? 'Create Recurring Events' : 'Save Event'}
        </button>
      </form>
    </div>
  );
}
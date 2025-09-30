// EditEventForm.tsx — Enhanced with TBA support and fixed date handling for recurring events

"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from 'src/lib/supabaseClient';

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
  is_tba: boolean;
}

// Utility function to generate recurring events
function generateRecurringEvents(baseEvent: EventData & { id?: number }): Omit<EventData, 'id'>[] {
  const events: Omit<EventData, 'id'>[] = [];
  
  if (!baseEvent.is_recurring || !baseEvent.recurrence_end_date || baseEvent.is_tba) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...eventWithoutId } = baseEvent;
    return [eventWithoutId];
  }

  const startDate = new Date(baseEvent.date);
  const endDate = new Date(baseEvent.recurrence_end_date);
  const pattern = baseEvent.recurrence_pattern;
  const interval = baseEvent.recurrence_interval || 1;

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...baseEventWithoutId } = baseEvent;
    const eventForDate: Omit<EventData, 'id'> = {
      ...baseEventWithoutId,
      date: currentDate.toISOString().split('T')[0],
      parent_event_id: baseEvent.id
    };
    events.push(eventForDate);

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
        return events;
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
    is_tba: false,
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
        const isTBA = !copiedEvent.date || copiedEvent.date === '' || copiedEvent.date === '9999-12-31';
        setEventData({
          ...eventData,
          ...copiedEvent,
          allowed_formats: Array.isArray(copiedEvent.allowed_formats)
            ? copiedEvent.allowed_formats
            : typeof copiedEvent.allowed_formats === 'string'
              ? copiedEvent.allowed_formats.replace(/[{}]/g, '').split(',').map((f: string) => f.trim()).filter(Boolean)
              : [],
          title: copiedEvent.title ? `${copiedEvent.title} (Copy)` : '',
          is_tba: isTBA,
          date: isTBA ? '' : copiedEvent.date,
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
          const isTBA = !data.date || data.date === '' || data.date === '9999-12-31';
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
            is_tba: isTBA,
            date: isTBA ? '' : data.date,
          });
        }
      }
    };
    fetchEvent();
    // eslint-disable-next-line
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEventData((prev) => ({
      ...prev,
      [name]: name === 'recurrence_interval' ? parseInt(value) || 1 : value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEventData((prev) => ({
      ...prev,
      [name]: checked,
      ...(name === 'is_tba' && checked ? { 
        date: '', 
        is_recurring: false,
        recurrence_end_date: '' 
      } : {}),
      ...(name === 'is_recurring' && !checked ? { recurrence_end_date: '' } : {})
    }));
  };

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
      if (!eventData.is_tba && eventData.is_recurring) {
        if (!eventData.date) {
          alert('Please set a start date for the recurring event');
          return;
        }
        if (!eventData.recurrence_end_date) {
          alert('Please set an end date for the recurring event');
          return;
        }
        if (new Date(eventData.recurrence_end_date) <= new Date(eventData.date)) {
          alert('End date must be after the start date');
          return;
        }
      }

      const payload = {
        title: eventData.title,
        date: eventData.is_tba ? '9999-12-31' : eventData.date,
        time: eventData.time,
        location: eventData.location,
        image_url: eventData.image_url,
        info: eventData.info,
        info_url: eventData.info_url,
        has_queue: eventData.has_queue,
        allowed_formats: `{${eventData.allowed_formats.map(f => f.trim()).join(',')}}`,
        is_recurring: eventData.is_tba ? false : eventData.is_recurring,
        ...(!eventData.is_tba && eventData.is_recurring ? {
          recurrence_pattern: eventData.recurrence_pattern,
          recurrence_interval: eventData.recurrence_interval,
          recurrence_end_date: eventData.recurrence_end_date || null,
        } : {
          recurrence_pattern: null,
          recurrence_interval: null,
          recurrence_end_date: null,
        }),
        ...(eventData.parent_event_id ? { parent_event_id: eventData.parent_event_id } : {})
      };

      console.log('Submitting payload:', payload);

      if (!eventData.is_tba && eventData.is_recurring) {
        if (id) {
          // EDIT or CONVERT to recurring
          console.log('Updating event to be recurring...');
          
          const { error: updateError } = await supabase
            .from('events')
            .update(payload)
            .eq('id', id);

          if (updateError) {
            console.error('Error updating parent event:', updateError);
            throw updateError;
          }

          const recurringEvents = generateRecurringEvents({
            ...eventData,
            id: parseInt(id)
          });

          console.log('Generated recurring events:', recurringEvents.length);

          const { data: existingChildren } = await supabase
            .from('events')
            .select('id, date')
            .eq('parent_event_id', parseInt(id)); // numeric compare

          const existingDates = new Set(existingChildren?.map(e => e.date) || []);
          const newDates = recurringEvents.slice(1).map(e => e.date);
          
          // Update or cancel existing children
          for (const child of existingChildren || []) {
            if (newDates.includes(child.date)) {
              await supabase
                .from('events')
                .update({
                  title: eventData.title,
                  time: eventData.time,
                  location: eventData.location,
                  image_url: eventData.image_url,
                  info: eventData.info,
                  info_url: eventData.info_url,
                  has_queue: eventData.has_queue,
                  allowed_formats: `{${eventData.allowed_formats.map(f => f.trim()).join(',')}}`,
                })
                .eq('id', child.id);
            } else {
              // soft-cancel
              try {
                const { error: cancelErr } = await supabase
                  .from('events')
                  .update({ 
                    title: `${eventData.title} (Cancelled)`,
                    info: `This event was cancelled as part of a recurring series update.`,
                    is_cancelled: true
                  })
                  .eq('id', child.id);
                if (cancelErr) throw cancelErr;
              } catch {
                await supabase
                  .from('events')
                  .update({ 
                    title: `${eventData.title} (Cancelled)`,
                    info: `This event was cancelled as part of a recurring series update.`
                  })
                  .eq('id', child.id);
              }
            }
          }

          // Insert new children for any new dates
          const eventsToInsert = recurringEvents
            .slice(1)
            .filter(e => !existingDates.has(e.date))
            .map(e => ({
              ...e,
              date: e.date,
              allowed_formats: `{${e.allowed_formats.map(f => f.trim()).join(',')}}`,
              parent_event_id: parseInt(id),
              recurrence_pattern: null,
              recurrence_interval: null,
              recurrence_end_date: null,
            }));

          if (eventsToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('events')
              .insert(eventsToInsert);

            if (insertError) {
              console.error('Error inserting new recurring events:', insertError);
              throw insertError;
            }
          }

          alert(`Successfully updated recurring event series! (${recurringEvents.length} total events)`);
        } else {
          // CREATE recurring
          console.log('Creating new recurring event...');
          const { data: savedEvent, error: saveError } = await supabase
            .from('events')
            .insert([payload])
            .select()
            .single();

          if (saveError) {
            console.error('Error saving main event:', saveError);
            throw saveError;
          }

          console.log('Main event saved:', savedEvent);

          const recurringEvents = generateRecurringEvents({
            ...eventData,
            id: savedEvent.id
          });

          console.log('Generated recurring events:', recurringEvents.length);

          const eventsToInsert = recurringEvents.slice(1).map(e => ({
            ...e,
            date: e.date,
            allowed_formats: `{${e.allowed_formats.map(f => f.trim()).join(',')}}`,
            parent_event_id: savedEvent.id,
            recurrence_pattern: null,
            recurrence_interval: null,
            recurrence_end_date: null,
          }));

          console.log('Events to insert:', eventsToInsert);

          if (eventsToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('events')
              .insert(eventsToInsert);

            if (insertError) {
              console.error('Error inserting recurring events:', insertError);
              throw insertError;
            }
          }

          alert(`Successfully created ${recurringEvents.length} recurring events!`);
        }
      } else {
        // Single event (including TBA) or non-recurring update

        // If converting from recurring → single, soft-cancel existing children
        if (id) {
          const { data: childrenToCancel } = await supabase
            .from('events')
            .select('id, date')
            .eq('parent_event_id', parseInt(id));

          if (childrenToCancel && childrenToCancel.length) {
            const targetDate = payload.date;
            for (const child of childrenToCancel) {
              if (child.date !== targetDate) {
                try {
                  const { error: cancelErr2 } = await supabase
                    .from('events')
                    .update({
                      title: `${eventData.title} (Cancelled)`,
                      info: `This event was cancelled when the series was changed to a single date.`,
                      is_cancelled: true
                    })
                    .eq('id', child.id);
                  if (cancelErr2) throw cancelErr2;
                } catch {
                  await supabase
                    .from('events')
                    .update({
                      title: `${eventData.title} (Cancelled)`,
                      info: `This event was cancelled when the series was changed to a single date.`
                    })
                    .eq('id', child.id);
                }
              }
            }
          }
        }

        console.log('Saving single event...');
        const result = id
          ? await supabase.from('events').update(payload).eq('id', id)
          : await supabase.from('events').insert([payload]);

        if (result.error) {
          console.error('Error saving single event:', result.error);
          throw result.error;
        }
        alert('Event saved successfully!');
      }

      router.push('/admin/manage-events');
    } catch (error: unknown) {
      console.error('Full error object:', error);
      
      let errorMessage = 'An unknown error occurred';
      
      if (error && typeof error === 'object') {
        if ('message' in error && typeof (error as { message?: string }).message === 'string') {
          errorMessage = (error as { message: string }).message;
        } else if ('details' in error && typeof (error as { details?: string }).details === 'string') {
          errorMessage = (error as { details: string }).details;
        } else if ('hint' in error && typeof (error as { hint?: string }).hint === 'string') {
          errorMessage = (error as { hint: string }).hint;
        }
      }
      
      alert(`Error saving event: ${errorMessage}`);
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

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            name="is_tba"
            checked={eventData.is_tba}
            onChange={handleCheckboxChange}
          />
          {' '}Date To Be Announced (TBA)
        </label>

        {!eventData.is_tba && (
          <input
            name="date"
            type="date"
            value={eventData.date}
            onChange={handleChange}
            placeholder="Date"
            required
            style={{ display: 'block', width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
          />
        )}

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

        {!eventData.is_tba && (
          <label style={{ display: 'block', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              name="is_recurring"
              checked={eventData.is_recurring}
              onChange={handleCheckboxChange}
            />
            {' '}Recurring Event
          </label>
        )}

        {eventData.is_tba && (
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#856404'
          }}>
            <strong>Note:</strong> TBA events cannot be set as recurring. Please set a specific date to enable recurring options.
          </div>
        )}

        {!eventData.is_tba && eventData.is_recurring && (
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
          {!eventData.is_tba && eventData.is_recurring && !id ? 'Create Recurring Events' : 'Save Event'}
        </button>
      </form>
    </div>
  );
}

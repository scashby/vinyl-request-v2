// src/components/EditEventForm.tsx
// Enhanced with checkbox filters for queue types and tags

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
  queue_types: string[];
  allowed_formats: string[];
  allowed_tags: string[];
  is_recurring: boolean;
  recurrence_pattern: string;
  recurrence_interval: number;
  recurrence_end_date: string;
  parent_event_id?: number;
  // ➕ FEATURED FIELDS (kept for DB wiring, but now edited on separate admin page)
  is_featured_grid?: boolean;
  is_featured_upnext?: boolean;
  featured_priority?: number | null;
}

interface TagDefinition {
  id: number;
  tag_name: string;
  category: string;
  color: string;
  description: string;
}

// Type for database event records
interface DbEvent extends EventData {
  id: number;
  queue_type?: string; // Legacy field
}

// Utility function to generate recurring events
function generateRecurringEvents(baseEvent: EventData & { id?: number }): Omit<EventData, 'id'>[] {
  const events: Omit<EventData, 'id'>[] = [];
  
  const isTBA = !baseEvent.date || baseEvent.date === '' || baseEvent.date === '9999-12-31';
  
  if (!baseEvent.is_recurring || !baseEvent.recurrence_end_date || isTBA) {
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
  const [availableTags, setAvailableTags] = useState<TagDefinition[]>([]);
  const [editMode, setEditMode] = useState<'all' | 'future' | 'single'>('all');
  const [isPartOfSeries, setIsPartOfSeries] = useState(false);
  const [isParentEvent, setIsParentEvent] = useState(false);
  const [eventData, setEventData] = useState<EventData>({
    title: '',
    date: '',
    time: '',
    location: '',
    image_url: '',
    info: '',
    info_url: '',
    has_queue: false,
    queue_types: [],
    allowed_formats: [] as string[],
    allowed_tags: [] as string[],
    is_recurring: false,
    recurrence_pattern: 'weekly',
    recurrence_interval: 1,
    recurrence_end_date: '',
    // FEATURED defaults (still mapped to DB, but UI now lives on /admin/featured-events)
    is_featured_grid: false,
    is_featured_upnext: false,
    featured_priority: null,
  });

  useEffect(() => {
    const fetchTags = async () => {
      const { data, error } = await supabase
        .from('tag_definitions')
        .select('*')
        .order('category', { ascending: true })
        .order('tag_name', { ascending: true });
      
      if (!error && data) {
        setAvailableTags(data);
      }
    };
    
    fetchTags();
  }, []);

  useEffect(() => {
    const fetchEvent = async () => {
      let copiedEvent: Partial<DbEvent> | null = null;
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('copiedEvent');
        if (stored) {
          copiedEvent = JSON.parse(stored) as Partial<DbEvent>;
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
          queue_types: Array.isArray(copiedEvent.queue_types)
            ? copiedEvent.queue_types
            : copiedEvent.queue_type
              ? [copiedEvent.queue_type]
              : [],
          allowed_tags: Array.isArray(copiedEvent.allowed_tags)
            ? copiedEvent.allowed_tags
            : typeof copiedEvent.allowed_tags === 'string'
              ? copiedEvent.allowed_tags.replace(/[{}]/g, '').split(',').map((t: string) => t.trim()).filter(Boolean)
              : [],
          title: copiedEvent.title ? `${copiedEvent.title} (Copy)` : '',
          date: isTBA ? '9999-12-31' : (copiedEvent.date || ''),
          is_recurring: false,
          recurrence_end_date: '',
          parent_event_id: undefined,
          // FEATURED copy behavior: keep grid/priority; clear upnext to avoid accidental promotion
          is_featured_grid: !!copiedEvent.is_featured_grid,
          is_featured_upnext: false,
          featured_priority: copiedEvent.featured_priority ?? null,
        });
        setIsPartOfSeries(false);
        setIsParentEvent(false);
      } else if (id) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error fetching event:', error);
        } else if (data) {
          const dbEvent = data as DbEvent;
          const isTBA = !dbEvent.date || dbEvent.date === '' || dbEvent.date === '9999-12-31';
          setEventData({
            ...eventData,
            ...dbEvent,
            allowed_formats: Array.isArray(dbEvent.allowed_formats)
              ? dbEvent.allowed_formats
              : typeof dbEvent.allowed_formats === 'string'
                ? dbEvent.allowed_formats.replace(/[{}]/g, '').split(',').map((f: string) => f.trim()).filter(Boolean)
                : [],
            queue_types: Array.isArray(dbEvent.queue_types)
              ? dbEvent.queue_types
              : dbEvent.queue_type
                ? [dbEvent.queue_type]
                : [],
            allowed_tags: Array.isArray(dbEvent.allowed_tags)
              ? dbEvent.allowed_tags
              : typeof dbEvent.allowed_tags === 'string'
                ? dbEvent.allowed_tags.replace(/[{}]/g, '').split(',').map((t: string) => t.trim()).filter(Boolean)
                : [],
            is_recurring: dbEvent.is_recurring || false,
            recurrence_pattern: dbEvent.recurrence_pattern || 'weekly',
            recurrence_interval: dbEvent.recurrence_interval || 1,
            recurrence_end_date: dbEvent.recurrence_end_date || '',
            date: isTBA ? '9999-12-31' : dbEvent.date,
            // FEATURED flags in DB (still loaded so they survive edits)
            is_featured_grid: !!dbEvent.is_featured_grid,
            is_featured_upnext: !!dbEvent.is_featured_upnext,
            featured_priority: dbEvent.featured_priority ?? null,
          });
          
          // Determine if this is part of a recurring series
          setIsParentEvent(dbEvent.is_recurring === true);
          setIsPartOfSeries(!!dbEvent.parent_event_id);
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
      [name]:
        name === 'recurrence_interval'
          ? parseInt(value) || 1
          : name === 'featured_priority'
            ? (value === '' ? null : parseInt(value))
            : value,
      // If date is being cleared, disable recurring
      ...(name === 'date' && !value ? { is_recurring: false, recurrence_end_date: '' } : {})
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEventData((prev) => ({
      ...prev,
      [name]: checked,
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

  const handleQueueTypeChange = (queueType: string, checked: boolean) => {
    setEventData((prev) => {
      const types = Array.isArray(prev.queue_types) ? [...prev.queue_types] : [];
      if (checked) {
        return { ...prev, queue_types: [...types, queueType] };
      } else {
        return { ...prev, queue_types: types.filter((t) => t !== queueType) };
      }
    });
  };

  const handleTagChange = (tagName: string, checked: boolean) => {
    setEventData((prev) => {
      const tags = Array.isArray(prev.allowed_tags) ? [...prev.allowed_tags] : [];
      if (checked) {
        return { ...prev, allowed_tags: [...tags, tagName] };
      } else {
        return { ...prev, allowed_tags: tags.filter((t) => t !== tagName) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const isTBA = !eventData.date || eventData.date === '' || eventData.date === '9999-12-31';
      
      if (!isTBA && eventData.is_recurring) {
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

      const payload: Record<string, unknown> = {
        title: eventData.title,
        date: isTBA ? '9999-12-31' : eventData.date,
        time: eventData.time,
        location: eventData.location,
        image_url: eventData.image_url,
        info: eventData.info,
        info_url: eventData.info_url,
        has_queue: eventData.has_queue,
        queue_types: eventData.has_queue && eventData.queue_types.length > 0 
          ? `{${eventData.queue_types.join(',')}}`
          : null,
        allowed_formats: `{${eventData.allowed_formats.map(f => f.trim()).join(',')}}`,
        allowed_tags: eventData.allowed_tags.length > 0
          ? `{${eventData.allowed_tags.map(t => t.trim()).join(',')}}`
          : null,
        is_recurring: isTBA ? false : eventData.is_recurring,
        ...(!isTBA && eventData.is_recurring ? {
          recurrence_pattern: eventData.recurrence_pattern,
          recurrence_interval: eventData.recurrence_interval,
          recurrence_end_date: eventData.recurrence_end_date || null,
        } : {
          recurrence_pattern: null,
          recurrence_interval: null,
          recurrence_end_date: null,
        }),
        ...(eventData.parent_event_id && editMode !== 'single' ? { parent_event_id: eventData.parent_event_id } : {}),
        // FEATURED (still persisted, but now normally edited via /admin/featured-events)
        is_featured_grid: !!eventData.is_featured_grid,
        is_featured_upnext: !!eventData.is_featured_upnext,
        featured_priority: eventData.featured_priority ?? null,
      };

      console.log('Submitting payload:', payload);

      // Handle editing a recurring series
      if (id && (isParentEvent || isPartOfSeries)) {
        if (editMode === 'single') {
          // Edit this event only - detach from series
          const singlePayload: Record<string, unknown> = {
            ...payload,
            is_recurring: false,
            recurrence_pattern: null,
            recurrence_interval: null,
            recurrence_end_date: null,
            parent_event_id: null
          };
          
          const { error: updateError } = await supabase
            .from('events')
            .update(singlePayload)
            .eq('id', id);

          if (updateError) throw updateError;
          alert('Event updated successfully and detached from series!');
          
        } else if (editMode === 'future') {
          // Edit this and future events
          const parentId = eventData.parent_event_id || id;
          
          // Update this event and all future events in the series
          const { error: updateError } = await supabase
            .from('events')
            .update({
              title: eventData.title,
              time: eventData.time,
              location: eventData.location,
              image_url: eventData.image_url,
              info: eventData.info,
              info_url: eventData.info_url,
              has_queue: eventData.has_queue,
              queue_types: eventData.has_queue && eventData.queue_types.length > 0 
                ? `{${eventData.queue_types.join(',')}}`
                : null,
              allowed_formats: `{${eventData.allowed_formats.map(f => f.trim()).join(',')}}`,
              allowed_tags: eventData.allowed_tags.length > 0
                ? `{${eventData.allowed_tags.map(t => t.trim()).join(',')}}`
                : null,
              // FEATURED fields applied to future items too (unchanged logic)
              is_featured_grid: !!eventData.is_featured_grid,
              is_featured_upnext: !!eventData.is_featured_upnext,
              featured_priority: eventData.featured_priority ?? null,
            })
            .or(`id.eq.${id},parent_event_id.eq.${parentId}`)
            .gte('date', eventData.date);

          if (updateError) throw updateError;
          alert('This and future events updated successfully!');
          
        } else {
          // Edit all events in series
          const parentId = eventData.parent_event_id || id;
          
          const { error: updateError } = await supabase
            .from('events')
            .update(payload)
            .or(`id.eq.${parentId},parent_event_id.eq.${parentId}`);

          if (updateError) throw updateError;
          alert('All events in series updated successfully!');
        }
      } else if (!isTBA && eventData.is_recurring && !id) {
        // CREATING a new recurring event
        console.log('Creating new recurring event...');
        const { data: savedEvent, error: saveError } = await supabase
          .from('events')
          .insert([payload])
          .select()
          .single();

        if (saveError) throw saveError;
        if (!savedEvent) throw new Error('Failed to create event');

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
          queue_types: eventData.has_queue && eventData.queue_types.length > 0 
            ? `{${eventData.queue_types.join(',')}}`
            : null,
          allowed_tags: e.allowed_tags.length > 0
            ? `{${e.allowed_tags.map(t => t.trim()).join(',')}}`
            : null,
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

          if (insertError) throw insertError;
        }

        alert(`Successfully created ${recurringEvents.length} recurring events!`);
      } else {
        // Single event (including TBA) or non-recurring update
        console.log('Saving single event...');
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
    } catch (error: unknown) {
      console.error('Full error object:', error);
      
      let errorMessage = 'An unknown error occurred';
      
      if (error && typeof error === 'object') {
        if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
          errorMessage = (error as { message: string }).message;
        } else if ('details' in error && typeof (error as { details?: unknown }).details === 'string') {
          errorMessage = (error as { details: string }).details;
        } else if ('hint' in error && typeof (error as { hint?: unknown }).hint === 'string') {
          errorMessage = (error as { hint: string }).hint;
        }
      }
      
      alert(`Error saving event: ${errorMessage}`);
    }
  };

  const categoryColors = {
    theme: '#f97316',
    mood: '#8b5cf6',
    occasion: '#14b8a6',
    special: '#eab308'
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

      {(isParentEvent || isPartOfSeries) && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 'bold' }}>
            📅 Editing Recurring Event
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '0.75rem',
              background: editMode === 'single' ? '#fff' : '#fef3c7',
              border: `2px solid ${editMode === 'single' ? '#f59e0b' : '#fde68a'}`,
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="editMode"
                value="single"
                checked={editMode === 'single'}
                onChange={(e) => setEditMode(e.target.value as 'all' | 'future' | 'single')}
                style={{ marginRight: '0.75rem', transform: 'scale(1.2)', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: '600' }}>Edit this event only</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  Changes won&apos;t affect other events. This event will be detached from the series.
                </div>
              </div>
            </label>

            <label style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '0.75rem',
              background: editMode === 'future' ? '#fff' : '#fef3c7',
              border: `2px solid ${editMode === 'future' ? '#f59e0b' : '#fde68a'}`,
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="editMode"
                value="future"
                checked={editMode === 'future'}
                onChange={(e) => setEditMode(e.target.value as 'all' | 'future' | 'single')}
                style={{ marginRight: '0.75rem', transform: 'scale(1.2)', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: '600' }}>Edit this and future events</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  Changes will apply to this event and all events after this date.
                </div>
              </div>
            </label>

            <label style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '0.75rem',
              background: editMode === 'all' ? '#fff' : '#fef3c7',
              border: `2px solid ${editMode === 'all' ? '#f59e0b' : '#fde68a'}`,
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="editMode"
                value="all"
                checked={editMode === 'all'}
                onChange={(e) => setEditMode(e.target.value as 'all' | 'future' | 'single')}
                style={{ marginRight: '0.75rem', transform: 'scale(1.2)', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: '600' }}>Edit all events in series</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  Changes will apply to all events in this recurring series.
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

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
          value={eventData.date === '9999-12-31' ? '' : eventData.date}
          onChange={handleChange}
          placeholder="Date (leave empty for TBA)"
          style={{ display: 'block', width: '100%', marginBottom: '0.25rem', padding: '0.5rem' }}
        />
        <small style={{ display: 'block', marginBottom: '1rem', color: '#666' }}>
          Leave empty for &ldquo;Date To Be Announced&rdquo; events
        </small>

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

        {/* RECURRING EVENT SECTION */}
        {eventData.date && eventData.date !== '9999-12-31' && !isPartOfSeries && (
          <div style={{
            border: '2px solid #8b5cf6',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#faf5ff'
          }}>
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                name="is_recurring"
                checked={eventData.is_recurring}
                onChange={handleCheckboxChange}
              />
              {' '}<strong>Recurring Event</strong>
            </label>

            {eventData.is_recurring && (
              <div style={{ marginLeft: '1.5rem' }}>
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
          </div>
        )}

        {(!eventData.date || eventData.date === '9999-12-31') && (
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
        
        {/* Queue Settings Section */}
        <div style={{
          border: '2px solid #3b82f6',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#eff6ff'
        }}>
          <label style={{ display: 'block', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              name="has_queue"
              checked={eventData.has_queue}
              onChange={handleCheckboxChange}
            />
            {' '}<strong>Enable Queue</strong>
          </label>

          {eventData.has_queue && (
            <div style={{ marginLeft: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <strong>Queue Types:</strong>
              </label>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.5rem',
                marginBottom: '0.75rem'
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '0.5rem',
                  background: eventData.queue_types.includes('side') ? '#dbeafe' : '#f9fafb',
                  border: `2px solid ${eventData.queue_types.includes('side') ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={eventData.queue_types.includes('side')}
                    onChange={(e) => handleQueueTypeChange('side', e.target.checked)}
                    style={{ marginRight: '0.5rem', transform: 'scale(1.2)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: '600' }}>📀 By Side</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      Attendees can request specific album sides (A, B, C, etc.)
                    </div>
                  </div>
                </label>

                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '0.5rem',
                  background: eventData.queue_types.includes('track') ? '#dbeafe' : '#f9fafb',
                  border: `2px solid ${eventData.queue_types.includes('track') ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={eventData.queue_types.includes('track')}
                    onChange={(e) => handleQueueTypeChange('track', e.target.checked)}
                    style={{ marginRight: '0.5rem', transform: 'scale(1.2)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: '600' }}>🎵 By Track</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      Attendees can request individual songs
                    </div>
                  </div>
                </label>

                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '0.5rem',
                  background: eventData.queue_types.includes('album') ? '#dbeafe' : '#f9fafb',
                  border: `2px solid ${eventData.queue_types.includes('album') ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={eventData.queue_types.includes('album')}
                    onChange={(e) => handleQueueTypeChange('album', e.target.checked)}
                    style={{ marginRight: '0.5rem', transform: 'scale(1.2)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: '600' }}>💿 By Album</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      Attendees can request full albums
                    </div>
                  </div>
                </label>
              </div>
              
              {eventData.queue_types.length === 0 && (
                <small style={{ display: 'block', color: '#dc2626', fontSize: '0.85rem' }}>
                  ⚠️ Please select at least one queue type
                </small>
              )}
            </div>
          )}
        </div>

        <fieldset style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
          <legend style={{ fontWeight: 'bold', padding: '0 0.5rem' }}>Allowed Formats</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {formatList.map((format) => (
              <label key={format} style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  name="allowed_formats"
                  value={format}
                  checked={Array.isArray(eventData.allowed_formats) ? eventData.allowed_formats.includes(format) : false}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormatChange(format, e.target.checked)}
                  style={{ marginRight: '0.5rem', transform: 'scale(1.2)' }}
                />
                {format}
              </label>
            ))}
          </div>
        </fieldset>

        {availableTags.length > 0 && (
          <fieldset style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <legend style={{ fontWeight: 'bold', padding: '0 0.5rem' }}>
              Allowed Tags (Optional)
              {eventData.allowed_tags.length > 0 && ` - ${eventData.allowed_tags.length} selected`}
            </legend>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              maxHeight: '200px',
              overflowY: 'auto',
              padding: '0.5rem',
              background: '#f9fafb',
              borderRadius: '4px'
            }}>
              {availableTags.map((tag) => {
                const isSelected = eventData.allowed_tags.includes(tag.tag_name);
                return (
                  <label
                    key={tag.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: isSelected ? tag.color + '20' : '#ffffff',
                      border: `2px solid ${isSelected ? tag.color : '#e5e7eb'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleTagChange(tag.tag_name, e.target.checked)}
                      style={{ 
                        cursor: 'pointer',
                        transform: 'scale(1.1)'
                      }}
                    />
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '3px',
                        background: tag.color
                      }}
                    />
                    <span>{tag.tag_name}</span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '0.125rem 0.375rem',
                      background: categoryColors[tag.category as keyof typeof categoryColors] || '#6b7280',
                      color: 'white',
                      borderRadius: '3px',
                      textTransform: 'uppercase',
                      fontWeight: '600'
                    }}>
                      {tag.category}
                    </span>
                  </label>
                );
              })}
            </div>
            <small style={{ display: 'block', color: '#666', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Leave empty to allow all albums, or select specific tags to filter the collection for this event
            </small>
          </fieldset>
        )}

        <button
          type="submit"
          style={{
            backgroundColor: '#2563eb',
            color: '#fff',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem'
          }}
        >
          {eventData.date && eventData.date !== '9999-12-31' && eventData.is_recurring && !id ? 'Create Recurring Events' : 'Save Event'}
        </button>
      </form>
    </div>
  );
}
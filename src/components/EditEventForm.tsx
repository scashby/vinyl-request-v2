// src/components/EditEventForm.tsx
// Full implementation restoring UI sections

"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from 'src/lib/supabaseClient';
import type { Crate } from 'src/types/crate';

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
  // Replaced legacy tags with Crate ID
  crate_id?: number | null;
  
  is_recurring: boolean;
  recurrence_pattern: string;
  recurrence_interval: number;
  recurrence_end_date: string;
  parent_event_id?: number;
  
  // Featured Flags
  is_featured_grid?: boolean;
  is_featured_upnext?: boolean;
  featured_priority?: number | null;
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

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.replace(/[{}]/g, '').split(',').map((item: string) => item.trim()).filter(Boolean);
  }
  return [];
}

export default function EditEventForm() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  
  const [crates, setCrates] = useState<Crate[]>([]);
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
    crate_id: null,
    is_recurring: false,
    recurrence_pattern: 'weekly',
    recurrence_interval: 1,
    recurrence_end_date: '',
    is_featured_grid: false,
    is_featured_upnext: false,
    featured_priority: null,
  });

  // Fetch Available Crates
  useEffect(() => {
    const fetchCrates = async () => {
      const { data, error } = await supabase
        .from('crates')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (!error && data) {
        setCrates(data as Crate[]);
      }
    };
    
    fetchCrates();
  }, []);

  // Fetch Event Data
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
        setEventData(prev => ({
          ...prev,
          ...copiedEvent,
          allowed_formats: normalizeStringArray(copiedEvent?.allowed_formats),
          queue_types: Array.isArray(copiedEvent?.queue_types) ? copiedEvent!.queue_types : [],
          crate_id: copiedEvent?.crate_id || null,
          title: copiedEvent?.title ? `${copiedEvent.title} (Copy)` : '',
          is_recurring: false
        }));
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
            allowed_formats: normalizeStringArray(dbEvent.allowed_formats),
            queue_types: Array.isArray(dbEvent.queue_types)
              ? dbEvent.queue_types
              : dbEvent.queue_type ? [dbEvent.queue_type] : [],
            crate_id: dbEvent.crate_id || null,
            
            is_recurring: dbEvent.is_recurring || false,
            recurrence_pattern: dbEvent.recurrence_pattern || 'weekly',
            recurrence_interval: dbEvent.recurrence_interval || 1,
            recurrence_end_date: dbEvent.recurrence_end_date || '',
            date: isTBA ? '9999-12-31' : dbEvent.date,
            is_featured_grid: !!dbEvent.is_featured_grid,
            is_featured_upnext: !!dbEvent.is_featured_upnext,
            featured_priority: dbEvent.featured_priority ?? null,
          });
          
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
            : name === 'crate_id'
              ? (value === '' ? null : parseInt(value))
              : value,
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
      const formats = [...prev.allowed_formats];
      if (checked) return { ...prev, allowed_formats: [...formats, format] };
      return { ...prev, allowed_formats: formats.filter((f) => f !== format) };
    });
  };

  const handleQueueTypeChange = (queueType: string, checked: boolean) => {
    setEventData((prev) => {
      const types = [...prev.queue_types];
      if (checked) return { ...prev, queue_types: [...types, queueType] };
      return { ...prev, queue_types: types.filter((t) => t !== queueType) };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const isTBA = !eventData.date || eventData.date === '' || eventData.date === '9999-12-31';
      
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
        crate_id: eventData.crate_id || null, 
        
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
        is_featured_grid: !!eventData.is_featured_grid,
        is_featured_upnext: !!eventData.is_featured_upnext,
        featured_priority: eventData.featured_priority ?? null,
      };

      console.log('Submitting payload:', payload);

      // Handle Updates (Single, Future, Series)
      if (id && (isParentEvent || isPartOfSeries)) {
        if (editMode === 'single') {
           const singlePayload = { ...payload, is_recurring: false, recurrence_pattern: null, recurrence_interval: null, recurrence_end_date: null, parent_event_id: null };
           await supabase.from('events').update(singlePayload).eq('id', id);
        } else if (editMode === 'future') {
           const parentId = eventData.parent_event_id || id;
           await supabase.from('events').update(payload).or(`id.eq.${id},parent_event_id.eq.${parentId}`).gte('date', eventData.date);
        } else {
           const parentId = eventData.parent_event_id || id;
           await supabase.from('events').update(payload).or(`id.eq.${parentId},parent_event_id.eq.${parentId}`);
        }
      } else if (!isTBA && eventData.is_recurring && !id) {
        // Create Recurring
        const { data: savedEvent, error } = await supabase.from('events').insert([payload]).select().single();
        if (error) throw error;
        
        const recurringEvents = generateRecurringEvents({ ...eventData, id: savedEvent.id });
        const eventsToInsert = recurringEvents.slice(1).map(e => ({
          ...e,
          date: e.date,
          allowed_formats: `{${e.allowed_formats.map(f => f.trim()).join(',')}}`,
          queue_types: eventData.has_queue && eventData.queue_types.length > 0 ? `{${eventData.queue_types.join(',')}}` : null,
          crate_id: eventData.crate_id || null,
          parent_event_id: savedEvent.id,
          recurrence_pattern: null,
          recurrence_interval: null,
          recurrence_end_date: null,
        }));
        
        if (eventsToInsert.length > 0) {
          await supabase.from('events').insert(eventsToInsert);
        }
      } else {
        // Create/Update Single
        if (id) {
          const { error } = await supabase.from('events').update(payload).eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('events').insert([payload]);
          if (error) throw error;
        }
      }

      router.push('/admin/manage-events');
    } catch (error: unknown) {
      console.error('Save error:', error);
      alert('Failed to save event. Check console for details.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-8 p-8 bg-white text-black border border-gray-200 rounded-lg shadow-sm">
      <h2 className="text-2xl font-bold mb-6">{id ? 'Edit Event' : 'New Event'}</h2>

      {/* Series Editing Options */}
      {(isParentEvent || isPartOfSeries) && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <h3 className="font-bold text-yellow-800 mb-2">📅 Editing Recurring Event</h3>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="editMode" 
                value="single" 
                checked={editMode === 'single'} 
                onChange={(e) => setEditMode(e.target.value as 'all' | 'future' | 'single')} 
              />
              <span>Edit this event only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="editMode" 
                value="future" 
                checked={editMode === 'future'} 
                onChange={(e) => setEditMode(e.target.value as 'all' | 'future' | 'single')} 
              />
              <span>Edit this and future events</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="editMode" 
                value="all" 
                checked={editMode === 'all'} 
                onChange={(e) => setEditMode(e.target.value as 'all' | 'future' | 'single')} 
              />
              <span>Edit all events in series</span>
            </label>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            name="title"
            value={eventData.title}
            onChange={handleChange}
            placeholder="Title"
            required
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <input
            name="date"
            type="date"
            value={eventData.date === '9999-12-31' ? '' : eventData.date}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded mb-1"
          />
          <small className="text-gray-500">Leave empty for &ldquo;Date To Be Announced&rdquo;</small>
        </div>

        <input
          name="time"
          value={eventData.time}
          onChange={handleChange}
          placeholder="Time (e.g., 3:00 PM - 6:00 PM)"
          className="w-full p-2 border border-gray-300 rounded"
        />
        <input
          name="location"
          value={eventData.location}
          onChange={handleChange}
          placeholder="Location"
          className="w-full p-2 border border-gray-300 rounded"
        />
        <input
          name="image_url"
          value={eventData.image_url}
          onChange={handleChange}
          placeholder="Image URL"
          className="w-full p-2 border border-gray-300 rounded"
        />
        
        {/* CRATE SELECTION (Replacing Tags) */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
          <label className="block text-sm font-bold text-gray-700 mb-2">Limit Requests to Crate (Optional)</label>
          <select 
            name="crate_id" 
            value={eventData.crate_id || ''} 
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded bg-white"
          >
            <option value="">-- Allow Entire Collection --</option>
            {crates.map(crate => (
              <option key={crate.id} value={crate.id}>
                {crate.icon} {crate.name}
              </option>
            ))}
          </select>
          <small className="block mt-1 text-gray-500 text-xs">
            If selected, attendees can only see/request songs from this Crate.
          </small>
        </div>

        {/* ALLOWED FORMATS */}
        <div className="p-4 border border-gray-200 rounded-md">
          <label className="block text-sm font-bold text-gray-700 mb-2">Allowed Formats</label>
          <div className="grid grid-cols-2 gap-2">
            {formatList.map((format) => (
              <label key={format} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={eventData.allowed_formats.includes(format)}
                  onChange={(e) => handleFormatChange(format, e.target.checked)}
                />
                {format}
              </label>
            ))}
          </div>
        </div>

        <textarea
          name="info"
          value={eventData.info}
          onChange={handleChange}
          placeholder="Event Info"
          className="w-full p-2 border border-gray-300 rounded h-24"
        />
        <input
          name="info_url"
          value={eventData.info_url || ''}
          onChange={handleChange}
          placeholder="Event Info URL (optional)"
          className="w-full p-2 border border-gray-300 rounded"
        />

        {/* RECURRING LOGIC */}
        {eventData.date && eventData.date !== '9999-12-31' && !isPartOfSeries && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-md">
            <label className="flex items-center gap-2 mb-2 font-bold">
              <input
                type="checkbox"
                name="is_recurring"
                checked={eventData.is_recurring}
                onChange={handleCheckboxChange}
              />
              Recurring Event
            </label>

            {eventData.is_recurring && (
              <div className="ml-6 space-y-3">
                <div className="flex gap-2">
                  <select
                    name="recurrence_pattern"
                    value={eventData.recurrence_pattern}
                    onChange={handleChange}
                    className="p-1 border rounded"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <input
                    type="number"
                    name="recurrence_interval"
                    min="1"
                    value={eventData.recurrence_interval}
                    onChange={handleChange}
                    className="p-1 border rounded w-16"
                  />
                  <span className="self-center text-sm text-gray-600">Interval</span>
                </div>
                <div>
                  <label className="block text-sm text-gray-700">End Date:</label>
                  <input
                    type="date"
                    name="recurrence_end_date"
                    value={eventData.recurrence_end_date}
                    onChange={handleChange}
                    className="p-1 border rounded"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* QUEUE LOGIC */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <label className="flex items-center gap-2 mb-2 font-bold">
            <input
              type="checkbox"
              name="has_queue"
              checked={eventData.has_queue}
              onChange={handleCheckboxChange}
            />
            Enable Request Queue
          </label>

          {eventData.has_queue && (
            <div className="ml-6 flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={eventData.queue_types.includes('side')}
                  onChange={(e) => handleQueueTypeChange('side', e.target.checked)}
                />
                📀 By Side (A/B)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={eventData.queue_types.includes('track')}
                  onChange={(e) => handleQueueTypeChange('track', e.target.checked)}
                />
                🎵 By Track
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={eventData.queue_types.includes('album')}
                  onChange={(e) => handleQueueTypeChange('album', e.target.checked)}
                />
                💿 By Album
              </label>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded hover:bg-blue-700 transition-colors"
        >
          {eventData.date && eventData.date !== '9999-12-31' && eventData.is_recurring && !id ? 'Create Recurring Events' : 'Save Event'}
        </button>
      </form>
    </div>
  );
}
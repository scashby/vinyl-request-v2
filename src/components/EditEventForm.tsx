// src/components/EditEventForm.tsx
// Full implementation restoring UI sections

"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from 'src/lib/supabaseClient';
import type { Crate } from 'src/types/crate';
import {
  defaultEventTypeConfig,
  type EventSubtypeDefaults,
  type EventTypeConfigState,
} from 'src/lib/eventTypeConfig';

const formatList = ['Vinyl', 'Cassettes', 'CD', '45s', '8-Track'];
const EVENT_TYPE_SETTINGS_KEY = 'event_type_config';

const EVENT_TYPE_TAG_PREFIX = 'event_type:';
const EVENT_SUBTYPE_TAG_PREFIX = 'event_subtype:';

interface EventData {
  event_type: string;
  event_subtype: string;
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
  allowed_tags?: string[] | string | null;
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

function getTagValue(tags: string[], prefix: string): string {
  const match = tags.find((tag) => tag.startsWith(prefix));
  return match ? match.replace(prefix, '') : '';
}

function buildTag(prefix: string, value?: string) {
  if (!value) return null;
  return `${prefix}${value}`;
}

export default function EditEventForm() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  
  const [crates, setCrates] = useState<Crate[]>([]);
  const [editMode, setEditMode] = useState<'all' | 'future' | 'single'>('all');
  const [isPartOfSeries, setIsPartOfSeries] = useState(false);
  const [isParentEvent, setIsParentEvent] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [eventTypeConfig, setEventTypeConfig] = useState<EventTypeConfigState>(defaultEventTypeConfig);
  
  const [eventData, setEventData] = useState<EventData>({
    event_type: '',
    event_subtype: '',
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

  const selectedSubtypeDefaults = eventTypeConfig.types
    .find((option) => option.id === eventData.event_type)
    ?.subtypes?.find((item) => item.id === eventData.event_subtype)?.defaults;

  const enabledFields = selectedSubtypeDefaults?.enabled_fields?.length
    ? selectedSubtypeDefaults.enabled_fields
    : ['date', 'time', 'location', 'image_url', 'info', 'info_url', 'queue', 'recurrence', 'crate', 'formats'];

  const isFieldEnabled = (field: string) => enabledFields.includes(field);
  const showDate = isFieldEnabled('date');
  const showTime = isFieldEnabled('time');
  const showLocation = isFieldEnabled('location');
  const showInfo = isFieldEnabled('info');
  const showInfoUrl = isFieldEnabled('info_url');

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

  useEffect(() => {
    const fetchEventTypeConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', EVENT_TYPE_SETTINGS_KEY)
          .single();

        if (error) {
          const errorStatus = 'status' in error ? error.status : null;
          if (error.code !== 'PGRST116' && errorStatus !== 404) {
            console.error('Error loading event type config:', error);
          }
          return;
        }

        if (data?.value) {
          setEventTypeConfig(JSON.parse(data.value));
        }
      } catch (err) {
        console.error('Error loading event type config:', err);
      }
    };

    fetchEventTypeConfig();
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
        const normalizedTags = normalizeStringArray(copiedEvent?.allowed_tags);
        setEventData(prev => ({
          ...prev,
          ...copiedEvent,
          event_type: getTagValue(normalizedTags, EVENT_TYPE_TAG_PREFIX),
          event_subtype: getTagValue(normalizedTags, EVENT_SUBTYPE_TAG_PREFIX),
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
          const normalizedTags = normalizeStringArray(dbEvent.allowed_tags);
          
          setEventData({
            ...eventData,
            ...dbEvent,
            event_type: getTagValue(normalizedTags, EVENT_TYPE_TAG_PREFIX),
            event_subtype: getTagValue(normalizedTags, EVENT_SUBTYPE_TAG_PREFIX),
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
      ...(name === 'event_type' ? { event_subtype: '' } : {}),
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

  const applySubtypeDefaults = (defaults?: EventSubtypeDefaults) => {
    if (!defaults) return;
    const enabledFields = defaults.enabled_fields?.length
      ? defaults.enabled_fields
      : ['date', 'time', 'location', 'image_url', 'info', 'info_url', 'queue', 'recurrence', 'crate', 'formats'];
    setEventData((prev) => ({
      ...prev,
      ...(enabledFields.includes('info') && defaults.info ? { info: defaults.info } : {}),
      ...(enabledFields.includes('info_url') && defaults.info_url ? { info_url: defaults.info_url } : {}),
      ...(enabledFields.includes('time') && defaults.time ? { time: defaults.time } : {}),
      ...(enabledFields.includes('location') && defaults.location ? { location: defaults.location } : {}),
      ...(enabledFields.includes('image_url') && defaults.image_url ? { image_url: defaults.image_url } : {}),
      ...(enabledFields.includes('queue') && typeof defaults.has_queue === 'boolean'
        ? { has_queue: defaults.has_queue }
        : {}),
      ...(enabledFields.includes('queue') && defaults.queue_types ? { queue_types: defaults.queue_types } : {}),
      ...(enabledFields.includes('recurrence') && typeof defaults.is_recurring === 'boolean'
        ? { is_recurring: defaults.is_recurring }
        : {}),
      ...(enabledFields.includes('recurrence') && defaults.recurrence_pattern
        ? { recurrence_pattern: defaults.recurrence_pattern }
        : {}),
      ...(enabledFields.includes('recurrence') && defaults.recurrence_interval
        ? { recurrence_interval: defaults.recurrence_interval }
        : {}),
    }));
  };

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setUploadingImage(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `event-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-images')
          .getPublicUrl(filePath);

        setEventData((prev) => ({
          ...prev,
          image_url: publicUrl,
        }));
      } catch (error) {
        console.error('Error uploading event image:', error);
        alert('Failed to upload image. Please try again.');
      } finally {
        setUploadingImage(false);
      }
    };

    input.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const isTBA = !eventData.date || eventData.date === '' || eventData.date === '9999-12-31';
      const allowedTags = [
        buildTag(EVENT_TYPE_TAG_PREFIX, eventData.event_type),
        buildTag(EVENT_SUBTYPE_TAG_PREFIX, eventData.event_subtype),
      ].filter(Boolean) as string[];
      
      const payload: Record<string, unknown> = {
        allowed_tags: allowedTags.length > 0 ? allowedTags : null,
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
    <div className="max-w-5xl mx-auto my-8 p-6 md:p-10 bg-white text-black border border-gray-200 rounded-2xl shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold">{id ? 'Edit Event' : 'Create Event'}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Build events with richer details, featured placement, and queue settings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Drafting
          </span>
        </div>
      </div>

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

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="p-5 border border-gray-200 rounded-2xl bg-gray-50/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Event type</h3>
              <p className="text-sm text-gray-500">Choose the type of event to unlock presets and visibility rules.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Event category</label>
              <select
                name="event_type"
                value={eventData.event_type}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Select a category</option>
                {eventTypeConfig.types.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {eventData.event_type && (
                <p className="text-xs text-gray-500 mt-2">
                  {eventTypeConfig.types.find((option) => option.id === eventData.event_type)?.description}
                </p>
              )}
            </div>
            {eventTypeConfig.types.find((option) => option.id === eventData.event_type)?.subtypes && (
              <div>
                <label className="text-sm font-medium text-gray-700">Event subtype</label>
                <select
                  name="event_subtype"
                  value={eventData.event_subtype}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                >
                  <option value="">Select a subtype</option>
                  {(eventTypeConfig.types.find((option) => option.id === eventData.event_type)?.subtypes || []).map(
                    (option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}
            {eventData.event_type && eventData.event_subtype && (
              <div>
                <label className="text-sm font-medium text-gray-700">Defaults</label>
                <button
                  type="button"
                  onClick={() => {
                    const subtype = eventTypeConfig.types
                      .find((option) => option.id === eventData.event_type)
                      ?.subtypes?.find((item) => item.id === eventData.event_subtype);
                    applySubtypeDefaults(subtype?.defaults);
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-200 transition-colors"
                >
                  Apply subtype defaults
                </button>
              </div>
            )}
            {eventData.event_type === 'private-dj' && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-700">
                Private DJ events will display as <strong>Private Event</strong> on the public events page.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Core details</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Event title</label>
                  <input
                    name="title"
                    value={eventData.title}
                    onChange={handleChange}
                    placeholder="Title"
                    required
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
                  />
                </div>
                {(showDate || showTime) && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {showDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Date</label>
                        <input
                          name="date"
                          type="date"
                          value={eventData.date === '9999-12-31' ? '' : eventData.date}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
                        />
                        <p className="text-xs text-gray-500 mt-2">Leave empty for “Date To Be Announced.”</p>
                      </div>
                    )}
                    {showTime && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Time</label>
                        <input
                          name="time"
                          value={eventData.time}
                          onChange={handleChange}
                          placeholder="3:00 PM - 6:00 PM"
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
                        />
                      </div>
                    )}
                  </div>
                )}
                {showLocation && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Location</label>
                    <input
                      name="location"
                      value={eventData.location}
                      onChange={handleChange}
                      placeholder="Venue or address"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
                    />
                    {eventData.location && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventData.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Search in Google Maps
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Description &amp; links</h3>
              <div className="space-y-4">
                {showInfo && (
                  <textarea
                    name="info"
                    value={eventData.info}
                    onChange={handleChange}
                    placeholder="Event description, lineup, cover, or quick notes."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm min-h-[120px]"
                  />
                )}
                {showInfoUrl && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Primary event link</label>
                    <input
                      name="info_url"
                      value={eventData.info_url || ''}
                      onChange={handleChange}
                      placeholder="https://facebook.com/events/..."
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Add a Facebook event link or external landing page here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {isFieldEnabled('image_url') && (
              <div className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Event media</h3>
              <div className="flex flex-col gap-4">
                <div className="relative w-full aspect-[4/3] rounded-xl border border-dashed border-gray-300 bg-gray-50 overflow-hidden">
                  {eventData.image_url ? (
                    <Image
                      src={eventData.image_url}
                      alt="Event"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
                      Upload a featured image
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleImageUpload}
                    disabled={uploadingImage}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {uploadingImage ? 'Uploading…' : 'Upload image'}
                  </button>
                  <input
                    name="image_url"
                    value={eventData.image_url}
                    onChange={handleChange}
                    placeholder="Paste image URL"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
                    disabled={!isFieldEnabled('image_url')}
                  />
                </div>
              </div>
              </div>
            )}

            <div className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Featured placement</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="is_featured_grid"
                    checked={!!eventData.is_featured_grid}
                    onChange={handleCheckboxChange}
                    className="h-4 w-4"
                  />
                  Show in Featured Grid
                </label>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Featured priority</label>
                  <input
                    type="number"
                    name="featured_priority"
                    value={eventData.featured_priority ?? ''}
                    onChange={handleChange}
                    placeholder="1"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CRATE SELECTION (Replacing Tags) */}
        {isFieldEnabled('crate') && (
          <section className="p-5 border border-gray-200 rounded-2xl bg-gray-50/40">
            <label className="block text-sm font-bold text-gray-700 mb-2">Limit Requests to Crate (Optional)</label>
            <select 
              name="crate_id" 
              value={eventData.crate_id || ''} 
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">-- Allow Entire Collection --</option>
              {crates.map(crate => (
                <option key={crate.id} value={crate.id}>
                  {crate.icon} {crate.name}
                </option>
              ))}
            </select>
            <small className="block mt-2 text-gray-500 text-xs">
              If selected, attendees can only see/request songs from this Crate.
            </small>
          </section>
        )}

        {/* ALLOWED FORMATS */}
        {isFieldEnabled('formats') && (
          <section className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-2">Allowed Formats</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {formatList.map((format) => (
                <label key={format} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={eventData.allowed_formats.includes(format)}
                    onChange={(e) => handleFormatChange(format, e.target.checked)}
                    className="h-4 w-4"
                  />
                  {format}
                </label>
              ))}
            </div>
          </section>
        )}

        {/* RECURRING LOGIC */}
        {isFieldEnabled('recurrence') && eventData.date && eventData.date !== '9999-12-31' && !isPartOfSeries && (
          <section className="p-5 bg-purple-50 border border-purple-200 rounded-2xl">
            <label className="flex items-center gap-2 mb-4 font-bold text-purple-800">
              <input
                type="checkbox"
                name="is_recurring"
                checked={eventData.is_recurring}
                onChange={handleCheckboxChange}
                className="h-4 w-4"
              />
              Recurring Event
            </label>

            {eventData.is_recurring && (
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    name="recurrence_pattern"
                    value={eventData.recurrence_pattern}
                    onChange={handleChange}
                    className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm shadow-sm"
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
                    className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm shadow-sm w-20"
                  />
                  <span className="text-sm text-purple-700">Interval</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-purple-700 mb-1">Series end date</label>
                  <input
                    type="date"
                    name="recurrence_end_date"
                    value={eventData.recurrence_end_date}
                    onChange={handleChange}
                    className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm shadow-sm"
                  />
                </div>
              </div>
            )}
          </section>
        )}
        
        {/* QUEUE LOGIC */}
        {isFieldEnabled('queue') && (
          <section className="p-5 bg-blue-50 border border-blue-200 rounded-2xl">
          <label className="flex items-center gap-2 mb-4 font-bold text-blue-800">
            <input
              type="checkbox"
              name="has_queue"
              checked={eventData.has_queue}
              onChange={handleCheckboxChange}
              className="h-4 w-4"
            />
            Enable Request Queue
          </label>

          {eventData.has_queue && (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-blue-900">
                <input
                  type="checkbox"
                  checked={eventData.queue_types.includes('side')}
                  onChange={(e) => handleQueueTypeChange('side', e.target.checked)}
                  className="h-4 w-4"
                />
                📀 By Side (A/B)
              </label>
              <label className="flex items-center gap-2 text-sm text-blue-900">
                <input
                  type="checkbox"
                  checked={eventData.queue_types.includes('track')}
                  onChange={(e) => handleQueueTypeChange('track', e.target.checked)}
                  className="h-4 w-4"
                />
                🎵 By Track
              </label>
              <label className="flex items-center gap-2 text-sm text-blue-900">
                <input
                  type="checkbox"
                  checked={eventData.queue_types.includes('album')}
                  onChange={(e) => handleQueueTypeChange('album', e.target.checked)}
                  className="h-4 w-4"
                />
                💿 By Album
              </label>
            </div>
          )}
          </section>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white font-bold py-3 px-4 shadow-lg hover:from-blue-700 hover:to-indigo-800 transition-colors"
        >
          {eventData.date && eventData.date !== '9999-12-31' && eventData.is_recurring && !id ? 'Create Recurring Events' : 'Save Event'}
        </button>
      </form>
    </div>
  );
}

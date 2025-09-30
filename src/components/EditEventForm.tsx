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

/** Remove the `id` field while keeping types happy (and ESLint clean). */
function withoutId<T extends { id?: unknown }>(obj: T): Omit<T, 'id'> {
  const { id, ...rest } = obj;
  void id; // mark as used to satisfy no-unused-vars
  return rest as Omit<T, 'id'>;
}

// Utility function to generate recurring events
function generateRecurringEvents(baseEvent: EventData & { id?: number }): Omit<EventData, 'id'>[] {
  const events: Omit<EventData, 'id'>[] = [];
  
  if (!baseEvent.is_recurring || !baseEvent.recurrence_end_date || baseEvent.is_tba) {
    return [withoutId(baseEvent)];
  }

  const startDate = new Date(baseEvent.date);
  const endDate = new Date(baseEvent.recurrence_end_date);
  const pattern = baseEvent.recurrence_pattern;
  const interval = baseEvent.recurrence_interval || 1;

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const eventForDate: Omit<EventData, 'id'> = {
      ...withoutId(baseEvent),
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
        break;
    }
  }

  return events;
}

export default function EditEventForm() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();

  const [eventData, setEventData] = useState<EventData>({
    title: "",
    date: "",
    time: "",
    location: "",
    image_url: "",
    info: "",
    info_url: "",
    has_queue: false,
    allowed_formats: [],
    is_recurring: false,
    recurrence_pattern: "weekly",
    recurrence_interval: 1,
    recurrence_end_date: "",
    is_tba: false,
  });

  useEffect(() => {
    async function fetchEvent() {
      if (id) {
        const { data } = await supabase.from("events").select("*").eq("id", id).single();
        if (data) {
          setEventData({
            ...data,
            is_tba: data.date === "9999-12-31",
          });
        }
      }
    }
    fetchEvent();
  }, [id]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setEventData((prev) => ({ ...prev, [name]: (e.target.type === 'number') ? Number(value) : value }));
  }

  function handleCheckboxChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, checked } = e.target;
    setEventData((prev) => ({ ...prev, [name]: checked }));
  }

  function handleFormatChange(format: string, checked: boolean) {
    setEventData((prev) => {
      const formats = new Set(prev.allowed_formats);
      if (checked) formats.add(format);
      else formats.delete(format);
      return { ...prev, allowed_formats: Array.from(formats) };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = { ...eventData, date: eventData.is_tba ? "9999-12-31" : eventData.date };

    if (eventData.is_recurring) {
      // Recurring events
      const events = generateRecurringEvents({ ...payload, id: id ? parseInt(id) : undefined });
      
      if (id) {
        const { data: existingChildren } = await supabase
          .from('events')
          .select('id, date')
          .eq('parent_event_id', parseInt(id));

        const existingDates = new Map((existingChildren || []).map(c => [c.date, c.id]));
        const newDates = events.map(ev => ev.date);

        // Upsert all new dates
        for (const ev of events) {
          if (existingDates.has(ev.date)) {
            await supabase
              .from('events')
              .update(ev)
              .eq('id', existingDates.get(ev.date));
          } else {
            await supabase.from('events').insert({ ...ev, parent_event_id: parseInt(id) });
          }
        }

        // Cancel children outside the new range
        for (const child of existingChildren || []) {
          if (!newDates.includes(child.date)) {
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
      } else {
        const { data: parent, error } = await supabase.from('events').insert(payload).select().single();
        if (error) {
          console.error("Error creating parent:", error);
          return;
        }
        const parentId = parent.id;
        for (const ev of events) {
          await supabase.from('events').insert({ ...ev, parent_event_id: parentId });
        }
      }
    } else {
      // Single event (including TBA) or non-recurring update
      let result;

      // Cancel any existing children not matching the single date
      try {
        if (id) {
          const { data: existingChildrenForSingle } = await supabase
            .from('events')
            .select('id, date')
            .eq('parent_event_id', parseInt(id));

          if (existingChildrenForSingle && existingChildrenForSingle.length) {
            const targetDate = payload.date;
            for (const child of existingChildrenForSingle) {
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
      } catch { /* ignore child-cancel fallback errors */ }

      if (id) {
        result = await supabase.from('events').update(payload).eq('id', id);
      } else {
        result = await supabase.from('events').insert(payload);
      }

      if (result.error) {
        console.error("Error saving single event:", result.error);
      }
    }

    router.push("/admin/manage-events");
  }

  return (
    <div>
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
          Upload image
        </a>
        <textarea
          name="info"
          value={eventData.info}
          onChange={handleChange}
          placeholder="Info"
          style={{ display: 'block', width: '100%', height: '6rem', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <input
          name="info_url"
          value={eventData.info_url}
          onChange={handleChange}
          placeholder="Info URL"
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
          <div>
            <label>
              Pattern:
              <select
                name="recurrence_pattern"
                value={eventData.recurrence_pattern}
                onChange={handleChange}
                style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            <label>
              Interval:
              <input
                name="recurrence_interval"
                type="number"
                value={eventData.recurrence_interval}
                onChange={handleChange}
                required
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </label>

            <label>
              End Date:
              <input
                name="recurrence_end_date"
                type="date"
                value={eventData.recurrence_end_date}
                onChange={handleChange}
                required
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </label>
          </div>
        )}

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

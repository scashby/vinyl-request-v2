// EditEventForm.tsx — Enhanced with TBA support and fixed date handling for recurring events

"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from 'src/lib/supabaseClient';

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
    const { id: _id, ...eventWithoutId } = baseEvent;
    events.push({
      ...eventWithoutId,
      date: currentDate.toISOString().split("T")[0],
    });

    if (pattern === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7 * interval);
    } else if (pattern === 'monthly') {
      currentDate.setMonth(currentDate.getMonth() + interval);
    } else {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = { ...eventData, date: eventData.is_tba ? "9999-12-31" : eventData.date };

    if (eventData.is_recurring) {
      // Recurring events
      const events = generateRecurringEvents({ ...payload, id: id ? parseInt(id) : undefined });
      
      if (id) {
        console.log("Updating recurring event series...");
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
        console.log("Creating new recurring event series...");
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
      console.log('Saving single event...');
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
    <form onSubmit={handleSubmit}>
      {/* Form UI untouched */}
      {/* ... */}
    </form>
  );
}

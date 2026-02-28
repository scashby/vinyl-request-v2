"use client";

import { useMemo, useState } from "react";
import EditEventForm from "src/components/EditEventForm";

type EventRow = {
  id: number;
  title: string;
  date: string | null;
  time?: string | null;
  location?: string | null;
};

type GameEventSelectProps = {
  events: EventRow[];
  eventId: number | null;
  setEventId: (eventId: number | null) => void;
  label?: string;
};

const CREATE_EVENT_OPTION = "__create_new_event__";

export default function GameEventSelect(props: GameEventSelectProps) {
  const {
    events,
    eventId,
    setEventId,
    label = "Event (optional)",
  } = props;

  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [localEvents, setLocalEvents] = useState<EventRow[]>([]);

  const mergedEvents = useMemo(() => {
    const byId = new Map<number, EventRow>();
    for (const event of events) byId.set(event.id, event);
    for (const event of localEvents) byId.set(event.id, event);

    return Array.from(byId.values()).sort((a, b) => {
      const byDate = (b.date ?? "").localeCompare(a.date ?? "");
      if (byDate !== 0) return byDate;
      return b.id - a.id;
    });
  }, [events, localEvents]);

  return (
    <>
      <label className="text-sm">
        {label}
        <select
          className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
          value={eventId ?? ""}
          onChange={(e) => {
            const selected = e.target.value;
            if (selected === CREATE_EVENT_OPTION) {
              setShowCreateEventModal(true);
              return;
            }
            setEventId(Number(selected) || null);
          }}
        >
          <option value="">No linked event</option>
          <option value={CREATE_EVENT_OPTION}>+ Create New Event...</option>
          {mergedEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {event.date ? `${event.date} - ${event.title}` : event.title}
            </option>
          ))}
        </select>
      </label>

      {showCreateEventModal ? (
        <>
          <div className="fixed inset-0 z-[60000] bg-black/70" onClick={() => setShowCreateEventModal(false)} />
          <div className="fixed inset-0 z-[60001] flex items-center justify-center p-4">
            <div className="w-full max-w-6xl">
              <EditEventForm
                mode="modal"
                onCancel={() => setShowCreateEventModal(false)}
                onSaved={(createdEvent) => {
                  const normalizedEvent: EventRow = {
                    id: createdEvent.id,
                    title: createdEvent.title,
                    date: createdEvent.date,
                  };
                  setLocalEvents((current) => [normalizedEvent, ...current.filter((event) => event.id !== normalizedEvent.id)]);
                  setEventId(normalizedEvent.id);
                  setShowCreateEventModal(false);
                }}
              />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

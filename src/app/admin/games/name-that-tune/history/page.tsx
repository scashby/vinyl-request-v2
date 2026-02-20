"use client";

import { useEffect, useState } from "react";

type EventRow = {
  id: number;
  title: string;
  date: string;
};

type HistoryRow = {
  id: number;
  event_id: number | null;
  event_title: string | null;
  session_code: string;
  title: string;
  status: string;
  teams: number;
  calls_asked: number;
  calls_scored: number;
  created_at: string;
};

export default function NameThatTuneHistoryPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);

  const load = async (eventFilter: number | null) => {
    const [eventRes, historyRes] = await Promise.all([
      fetch("/api/games/name-that-tune/events"),
      fetch(`/api/games/name-that-tune/sessions/history${eventFilter ? `?eventId=${eventFilter}` : ""}`),
    ]);

    if (eventRes.ok) {
      const payload = await eventRes.json();
      setEvents(payload.data ?? []);
    }

    if (historyRes.ok) {
      const payload = await historyRes.json();
      setRows(payload.data ?? []);
    }
  };

  useEffect(() => {
    load(eventId);
  }, [eventId]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#141414,#0a0a0a)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-stone-700 bg-black/50 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-rose-200">Name That Tune History</h1>
          <div className="flex items-center gap-2">
            <select className="rounded border border-stone-700 bg-stone-950 px-3 py-1 text-sm" value={eventId ?? ""} onChange={(e) => setEventId(Number(e.target.value) || null)}>
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.date} - {event.title}</option>
              ))}
            </select>
            <button onClick={() => load(eventId)} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-stone-400">No session history yet.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {rows.map((row) => (
              <div key={row.id} className="rounded border border-stone-700 bg-stone-950/70 p-3">
                <p>{new Date(row.created_at).toLocaleString()} · {row.session_code} · {row.title}</p>
                <p className="text-stone-400">Event: {row.event_title ?? "(none)"} · Teams: {row.teams} · Asked: {row.calls_asked} · Scored: {row.calls_scored} · Status: {row.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

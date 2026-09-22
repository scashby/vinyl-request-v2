// src/components/admin/EventStatusModal.tsx
// Postpone or cancel an event — one event, the rest of a recurring series, or
// the whole series — without deleting anything. Setting the status back to
// "Scheduled" clears the stamp and the note again.
//
// This lives beside the event list rather than inside EditEventForm because
// calling off a night is a one-field decision that usually applies to a range
// of a series, not an edit of that night's details.

"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import { Button } from 'components/ui/Button';
import {
  EVENT_STATUSES,
  eventStatusLabel,
  getEventStatusMeta,
  normalizeEventStatus,
  type EventStatus,
} from 'src/lib/eventStatus';

export type StatusTargetEvent = {
  id: number;
  title: string;
  date: string;
  status?: string | null;
  status_note?: string | null;
  is_recurring?: boolean;
  parent_event_id?: number | null;
};

type SeriesEvent = {
  id: number;
  title: string;
  date: string;
  status: EventStatus;
};

type Scope = 'single' | 'future' | 'series';

const SCOPE_LABELS: Record<Scope, string> = {
  single: 'Just this event',
  future: 'This event and every later one in the series',
  series: 'Every event in the series',
};

export default function EventStatusModal({
  event,
  onClose,
  onSaved,
}: {
  event: StatusTargetEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<EventStatus>(normalizeEventStatus(event.status));
  const [note, setNote] = useState(event.status_note ?? '');
  const [scope, setScope] = useState<Scope>('single');
  const [seriesEvents, setSeriesEvents] = useState<SeriesEvent[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partOfSeries = !!(event.is_recurring || event.parent_event_id);
  const parentId = event.parent_event_id || event.id;

  useEffect(() => {
    if (!partOfSeries) return;
    let active = true;
    setLoadingSeries(true);
    (async () => {
      const { data, error: seriesError } = await supabase
        .from('events')
        .select('id, title, date, status')
        .or(`id.eq.${parentId},parent_event_id.eq.${parentId}`)
        .order('date', { ascending: true });
      if (!active) return;
      if (seriesError) {
        setError(`Could not load the series: ${seriesError.message}`);
      } else {
        setSeriesEvents(
          (data || []).map((row) => ({
            id: row.id,
            title: row.title,
            date: row.date,
            status: normalizeEventStatus((row as { status?: string | null }).status),
          }))
        );
      }
      setLoadingSeries(false);
    })();
    return () => {
      active = false;
    };
  }, [partOfSeries, parentId]);

  const targetIds = (): number[] => {
    if (!partOfSeries || scope === 'single') return [event.id];
    if (seriesEvents.length === 0) return [event.id];
    if (scope === 'series') return seriesEvents.map((e) => e.id);
    return seriesEvents.filter((e) => e.date >= event.date).map((e) => e.id);
  };

  const affected = targetIds();

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const trimmedNote = note.trim();
      const { error: updateError } = await supabase
        .from('events')
        .update({
          status,
          // A note only describes a call-off, so returning an event to the
          // schedule clears it rather than leaving stale copy behind.
          status_note: status === 'scheduled' ? null : trimmedNote || null,
          status_changed_at: new Date().toISOString(),
        })
        .in('id', affected);
      if (updateError) throw updateError;
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error saving status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-xl font-bold text-gray-900">Event status</h3>
        <p className="mt-1 text-sm text-gray-500">
          {event.title} <span className="text-gray-400">– {event.date}</span>
        </p>

        <div className="mt-5 space-y-2">
          {EVENT_STATUSES.map((value) => {
            const meta = getEventStatusMeta(value);
            return (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ${
                  status === value ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="event-status"
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                  className="h-4 w-4"
                />
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider"
                  style={{ background: meta.accent, color: meta.accentInk }}
                >
                  {eventStatusLabel(value)}
                </span>
                <span className="text-sm text-gray-600">
                  {value === 'scheduled'
                    ? 'Shows normally.'
                    : `Stamps the event artwork ${eventStatusLabel(value).toUpperCase()}.`}
                </span>
              </label>
            );
          })}
        </div>

        {status !== 'scheduled' && (
          <div className="mt-5">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="status-note">
              Note for the event page <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="status-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={getEventStatusMeta(status).shortNotice}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        )}

        {partOfSeries && (
          <div className="mt-5">
            <div className="text-sm font-semibold text-gray-700">Apply to</div>
            {loadingSeries ? (
              <div className="mt-2 text-sm text-gray-400">Loading series&hellip;</div>
            ) : (
              <div className="mt-2 space-y-2">
                {(Object.keys(SCOPE_LABELS) as Scope[]).map((value) => (
                  <label key={value} className="flex items-center gap-3 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="status-scope"
                      value={value}
                      checked={scope === value}
                      onChange={() => setScope(value)}
                      className="h-4 w-4"
                    />
                    {SCOPE_LABELS[value]}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">
            {affected.length === 1
              ? 'Updates this event.'
              : `Updates ${affected.length} events.`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || loadingSeries}>
              {saving ? 'Saving…' : 'Save status'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

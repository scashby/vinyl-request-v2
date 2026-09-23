// src/components/EventStatusStamp.tsx
// The public-facing marks for an event that has been postponed or cancelled:
// a stamp laid over the event artwork, a text badge for the card layouts that
// have no artwork, and a full-width notice for the event detail page.
//
// All three read from src/lib/eventStatus.ts, so the wording and colours of a
// status are defined once.

import {
  formatStatusNewDate,
  getEventStatusMeta,
  isEventCalledOff,
  type EventStatus,
} from 'src/lib/eventStatus';

// Overlay for an image container. The container must already be
// `position: relative; overflow: hidden` — every event image wrapper on the
// site is, for its own rounded-corner/crop styling.
export function EventStatusStamp({
  status,
  className = '',
}: {
  status: EventStatus;
  className?: string;
}) {
  if (!isEventCalledOff(status)) return null;
  const meta = getEventStatusMeta(status);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 flex items-center justify-center p-[6%] ${className}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: meta.scrim,
          backdropFilter: meta.scrimFilter,
          WebkitBackdropFilter: meta.scrimFilter,
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative stamp art sized as a percentage of its container; next/image adds nothing here */}
      <img
        src={meta.stampSrc}
        alt=""
        // A white halo, not a drop shadow: the stamp sits on a lightened
        // photo, where a dark shadow just muddies the edges again.
        className="relative w-full max-w-full [filter:drop-shadow(0_0_3px_rgba(255,255,255,0.95))_drop-shadow(0_1px_6px_rgba(255,255,255,0.8))]"
      />
    </div>
  );
}

// Text equivalent for the card layouts that show no artwork (home page strip,
// "Just Announced" rail), where a stamp would have nothing to sit on.
export function EventStatusBadge({
  status,
  className = '',
}: {
  status: EventStatus;
  className?: string;
}) {
  if (!isEventCalledOff(status)) return null;
  const meta = getEventStatusMeta(status);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${className}`}
      style={{ background: meta.accent, color: meta.accentInk }}
    >
      {meta.label}
    </span>
  );
}

// The announced replacement date, for the card layouts that show a date.
// Renders nothing until a new date has actually been set, which is the
// difference between "postponed, date unknown" and "postponed, moved to X".
export function EventNewDateChip({
  status,
  newDate,
  className = '',
}: {
  status: EventStatus;
  newDate?: string | null;
  className?: string;
}) {
  if (status !== 'postponed') return null;
  const label = formatStatusNewDate(newDate, 'compact');
  if (!label) return null;
  const meta = getEventStatusMeta('postponed');

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${className}`}
      style={{ background: meta.accent, color: meta.accentInk }}
    >
      New date: {label}
    </span>
  );
}

// Banner for the event detail page, carrying the optional admin note.
export function EventStatusNotice({
  status,
  note,
  newDate,
  className = '',
}: {
  status: EventStatus;
  note?: string | null;
  newDate?: string | null;
  className?: string;
}) {
  if (!isEventCalledOff(status)) return null;
  const meta = getEventStatusMeta(status);
  const newDateLabel = status === 'postponed' ? formatStatusNewDate(newDate, 'long') : '';

  return (
    <div
      className={`rounded-2xl px-5 py-4 ${className}`}
      style={{ background: meta.accent, color: meta.accentInk }}
      role="status"
    >
      <div className="text-lg font-black uppercase tracking-wide">{meta.label}</div>
      {newDateLabel && (
        <div className="mt-1 text-base font-black">New date: {newDateLabel}</div>
      )}
      <div className="mt-1 text-sm font-medium opacity-95">
        {note?.trim() ? note : newDateLabel ? '' : meta.shortNotice}
      </div>
    </div>
  );
}

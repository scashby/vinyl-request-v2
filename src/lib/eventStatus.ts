// src/lib/eventStatus.ts
// Single source of truth for an event's lifecycle status. An event that is
// called off is never deleted — it keeps its page, its date and its artwork,
// and every public surface stamps it POSTPONED or CANCELLED instead.
//
// The status lives in events.status (see sql/add-events-status.sql), which is
// constrained to exactly these three values at the database level. Rows that
// predate the column, and any value the constraint somehow let through, fall
// back to "scheduled" — the public site must never render a stamp it can't
// explain.

export const EVENT_STATUSES = ['scheduled', 'postponed', 'cancelled'] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const DEFAULT_EVENT_STATUS: EventStatus = 'scheduled';

type EventStatusMeta = {
  label: string;
  // Short line shown under the title on list/detail surfaces. The stamp art
  // already says "new date coming soon" for postponed, so this stays terse.
  shortNotice: string;
  // Overlay artwork laid over the event image. Swapping the stamp art is a
  // one-line change here — drop a replacement in public/images/status/ and
  // point this at it. Whatever it points at must have a transparent
  // background: the stamp sits directly on the event photo.
  stampSrc: string;
  // Scrim painted between the photo and the stamp so the stamp reads on
  // busy artwork.
  scrim: string;
  // Hex accents for badges/banners, kept out of Tailwind classes so the same
  // values drive both the light admin UI and the themed public pages.
  accent: string;
  accentInk: string;
};

const META: Record<EventStatus, EventStatusMeta> = {
  scheduled: {
    label: 'Scheduled',
    shortNotice: '',
    stampSrc: '',
    scrim: 'transparent',
    accent: '#16a34a',
    accentInk: '#ffffff',
  },
  postponed: {
    label: 'Postponed',
    shortNotice: 'Postponed — new date coming soon',
    stampSrc: '/images/status/postponed.png',
    scrim: 'rgba(8, 12, 20, 0.45)',
    accent: '#0b6cb1',
    accentInk: '#ffffff',
  },
  cancelled: {
    label: 'Cancelled',
    shortNotice: 'This event has been cancelled',
    stampSrc: '/images/status/cancelled.png',
    scrim: 'rgba(8, 12, 20, 0.55)',
    accent: '#e02a2a',
    accentInk: '#ffffff',
  },
};

export function normalizeEventStatus(value: unknown): EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(value as string)
    ? (value as EventStatus)
    : DEFAULT_EVENT_STATUS;
}

export function getEventStatusMeta(status: EventStatus): EventStatusMeta {
  return META[status];
}

// True when the event is no longer happening as listed — i.e. when it should
// carry a stamp. Callers use this rather than comparing to 'scheduled' so a
// future fourth status slots in without hunting down every comparison.
export function isEventCalledOff(status: EventStatus): boolean {
  return status !== 'scheduled';
}

export function eventStatusLabel(status: EventStatus): string {
  return META[status].label;
}

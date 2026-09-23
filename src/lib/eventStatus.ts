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
  // Wash painted between the photo and the stamp. It lightens the artwork
  // rather than darkening it, so the stamp's own colour is what carries the
  // contrast. Kept light enough that the photo is still legible underneath —
  // a flat white veil strong enough to work on dark art erases light art.
  scrim: string;
  // Paired with the wash: desaturates and brightens whatever is behind it, so
  // busy or dark artwork fades back without the veil having to do it alone.
  scrimFilter: string;
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
    scrimFilter: 'none',
    accent: '#16a34a',
    accentInk: '#ffffff',
  },
  postponed: {
    label: 'Postponed',
    shortNotice: 'Postponed — new date coming soon',
    stampSrc: '/images/status/postponed.png',
    scrim: 'rgba(255, 255, 255, 0.34)',
    scrimFilter: 'saturate(0.45) brightness(1.14)',
    accent: '#0b6cb1',
    accentInk: '#ffffff',
  },
  cancelled: {
    label: 'Cancelled',
    shortNotice: 'This event has been cancelled',
    stampSrc: '/images/status/cancelled.png',
    scrim: 'rgba(255, 255, 255, 0.38)',
    scrimFilter: 'saturate(0.4) brightness(1.16)',
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

// A stored 'YYYY-MM-DD' rendered for display. Parsed as local midnight, the
// way every other date on the site is, so it can't slip a day in a western
// timezone. The TBA sentinel and anything unparseable render as nothing —
// callers treat an empty string as "no new date announced".
export function formatStatusNewDate(
  value: string | null | undefined,
  style: 'compact' | 'medium' | 'long' = 'compact'
): string {
  if (!value || value === '9999-12-31') return '';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  if (style === 'long') {
    return parsed.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  const short = parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  // 'compact' feeds chips and date badges, which are uppercase everywhere on
  // the site; 'medium' reads inside a sentence, where shouting looks wrong.
  return style === 'medium' ? short : short.toUpperCase();
}

export function eventStatusLabel(status: EventStatus): string {
  return META[status].label;
}

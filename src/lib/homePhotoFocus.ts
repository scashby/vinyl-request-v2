// src/lib/homePhotoFocus.ts
//
// Pan + zoom framing for the two homepage photo slots (Hero, Game Deck)
// ONLY. This is deliberately its own, standalone module — it shares
// nothing with src/lib/imageCrop.ts (the events crop-rectangle system).
// That sharing is what caused a real bug: a change made for the
// homepage tool silently broke a live event's crop because both went
// through the same parsing/rendering code. Keeping these fully separate
// means a change here can never reach an event page, and vice versa.
//
// Model: an anchor point (x/y, % of the photo) plus a zoom factor,
// rendered via CSS object-position + transform: scale() with a matching
// transform-origin. This is valid at any zoom, including below 1x, where
// it correctly reveals the slot's own background around the smaller
// photo (real letterboxing) — unlike a crop-rectangle model, which can
// never represent "smaller than the frame" because no rectangle can be
// bigger than its own source image.

import type { CSSProperties } from "react";

export type PhotoFocus = { x: number; y: number; zoom: number };

// Centered, zoom 1 — the photo's own "cover" framing for whatever slot
// it's placed in, before any pan or zoom adjustment.
export const DEFAULT_PHOTO_FOCUS: PhotoFocus = { x: 50, y: 50, zoom: 1 };

// 0.6 (not lower) keeps zoom-out genuinely useful — a photo can still
// shrink enough to show real letterboxing — without shrinking so far
// that it reads as a rendering bug rather than a deliberate framing.
export const MIN_PHOTO_ZOOM = 0.6;
export const MAX_PHOTO_ZOOM = 3;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_PHOTO_ZOOM, Math.max(MIN_PHOTO_ZOOM, value));
}

export function clampPhotoFocus(focus: PhotoFocus): PhotoFocus {
  return {
    x: clampPercent(focus.x),
    y: clampPercent(focus.y),
    zoom: clampZoom(focus.zoom),
  };
}

// homepage_sections.data is a jsonb column, so a slot's photo_focus
// arrives as a raw object (never a tag string) — but it could still be
// absent (a photo added before this tool existed) or malformed. Treat
// anything that isn't a complete, valid PhotoFocus as unset rather than
// partially trusting a stray field.
export function coercePhotoFocus(value: unknown): PhotoFocus {
  if (
    value &&
    typeof value === "object" &&
    Number.isFinite((value as PhotoFocus).x) &&
    Number.isFinite((value as PhotoFocus).y) &&
    Number.isFinite((value as PhotoFocus).zoom)
  ) {
    return clampPhotoFocus(value as PhotoFocus);
  }
  return DEFAULT_PHOTO_FOCUS;
}

// object-position places the anchor point at zoom 1 (the photo's normal
// cover-fit framing); transform: scale(), anchored at that same point via
// transform-origin, zooms in or out from there. Use with a plain <img
// className="object-cover">, not next/image's fill mode, so the
// transform-origin percentages stay exact.
export function photoFocusStyle(focus: unknown): CSSProperties {
  const f = coercePhotoFocus(focus);
  return {
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom !== 1 ? `scale(${f.zoom})` : undefined,
    transformOrigin: `${f.x}% ${f.y}%`,
  };
}

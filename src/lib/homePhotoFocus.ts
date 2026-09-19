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
// transform-origin, on top of an object-fit: contain baseline — NOT
// cover. That distinction matters: cover always crops whichever axis
// doesn't match the slot's aspect ratio, even at zoom 1 before the
// person has touched anything, which silently cuts off part of a
// photo or logo they never chose to crop. contain shows the whole
// photo, fit inside the slot (with letterboxing on the mismatched
// axis) as the default, and cropping only happens once you
// deliberately zoom in past that point — the way Instagram/Facebook's
// crop tools behave. Zooming in from zoom 1 grows the image until it
// covers the slot and then keeps cropping in tighter; zooming out
// shrinks the already-fully-visible image further within the slot.

import type { CSSProperties } from "react";

export type PhotoFocus = { x: number; y: number; zoom: number };

// Centered, zoom 1 — the whole photo, fit inside its slot, before any
// pan or zoom adjustment. Nothing is cropped until you zoom in.
export const DEFAULT_PHOTO_FOCUS: PhotoFocus = { x: 50, y: 50, zoom: 1 };

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

// objectFit is set here (not left to a className) so there is exactly
// one source of truth for how the photo fits — a className that
// disagreed with this is what let the old cover-based bug hide in
// plain sight. object-position places the anchor point at zoom 1 (the
// whole photo, fit inside the slot); transform: scale(), anchored at
// that same point via transform-origin, zooms in or out from there.
// Use with a plain <img>, not next/image's fill mode, so the
// transform-origin percentages stay exact.
export function photoFocusStyle(focus: unknown): CSSProperties {
  const f = coercePhotoFocus(focus);
  return {
    objectFit: "contain",
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom !== 1 ? `scale(${f.zoom})` : undefined,
    transformOrigin: `${f.x}% ${f.y}%`,
  };
}

// src/lib/dialoguesPostFocus.ts
//
// Pan + zoom framing for individual Dialogues blog post card images ONLY.
// Deliberately its own, standalone module — shares nothing with
// src/lib/imageCrop.ts (events) or src/lib/homePhotoFocus.ts (Hero/Game
// Deck), so a change made for one can never reach the others.
//
// Blog post photos are real photography in a fixed-aspect card grid, not
// logos/graphics — cropping to fill (cover) is the expected, normal look
// here, unlike Hero/Game Deck where cover-by-default silently cut off part
// of a logo. This gives a drag-to-reposition + zoom-to-crop-in control on
// top of that cover baseline, keyed per post (by a stable hash of its
// permalink, since WordPress/Substack posts don't have a fixed slug set
// known ahead of time) and stored in admin_settings.

import type { CSSProperties } from "react";

export type PostFocus = { x: number; y: number; zoom: number };

export const DEFAULT_POST_FOCUS: PostFocus = { x: 50, y: 50, zoom: 1 };

// Real zoom in AND out, same as every other crop tool in this codebase —
// confirmed explicitly, more than once. The crop frame (bordered, white)
// is the visible area; the dimmed stage around it is the "bleed" — the
// part of the photo that's cropped off, not displayed — and zooming out
// is what lets you see how much of the photo sits in that bleed area
// before deciding how to frame it. Do not narrow this range based on a
// guess about what "bleed" means; ask if it's ever unclear again.
export const MIN_POST_ZOOM = 0.6;
export const MAX_POST_ZOOM = 3;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_POST_ZOOM, Math.max(MIN_POST_ZOOM, value));
}

export function clampPostFocus(focus: PostFocus): PostFocus {
  return {
    x: clampPercent(focus.x),
    y: clampPercent(focus.y),
    zoom: clampZoom(focus.zoom),
  };
}

export function coercePostFocus(value: unknown): PostFocus {
  if (
    value &&
    typeof value === "object" &&
    Number.isFinite((value as PostFocus).x) &&
    Number.isFinite((value as PostFocus).y) &&
    Number.isFinite((value as PostFocus).zoom)
  ) {
    return clampPostFocus(value as PostFocus);
  }
  return DEFAULT_POST_FOCUS;
}

// A stable, short, filesystem/key-safe id derived from a post's permalink,
// used as the admin_settings key — post links don't change once published.
export function keyForPostLink(link: string): string {
  let hash = 0;
  for (let i = 0; i < link.length; i++) {
    hash = (hash * 31 + link.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

// object-fit: cover baseline (this is real photography in a fixed card
// grid, not a logo — filling the frame is the expected look), with
// object-position + transform: scale() for pan/zoom on top, anchored at
// the same point via transform-origin so zooming doesn't drift the anchor.
export function postFocusStyle(focus: unknown): CSSProperties {
  const f = coercePostFocus(focus);
  return {
    objectFit: "cover",
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom !== 1 ? `scale(${f.zoom})` : undefined,
    transformOrigin: `${f.x}% ${f.y}%`,
  };
}

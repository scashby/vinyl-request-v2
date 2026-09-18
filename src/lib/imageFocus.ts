// src/lib/imageFocus.ts
// Single source of truth for the event image focal-point/zoom system: the
// tag encoding, parsing, and the CSS it produces. Previously this logic
// (constants, parse/build, clamping) was hand-duplicated across
// EditEventForm.tsx, events-page/page.tsx, and event-detail/[id]/page.tsx —
// three near-identical copies that had already drifted slightly from each
// other. Consolidated here so admin (which writes the tag) and every public
// render site (which reads it) share one implementation and can't drift.

import type { CSSProperties } from "react";

export const IMAGE_FOCUS_COVER_TAG_PREFIX = "image_focus_cover:";
export const IMAGE_FOCUS_SQUARE_TAG_PREFIX = "image_focus_square:";

const MIN_ZOOM = 100;
const MAX_ZOOM = 300;

export type ImageFocusPoint = { x: number; y: number; zoom: number };

export const DEFAULT_IMAGE_FOCUS: ImageFocusPoint = { x: 50, y: 50, zoom: 100 };

export function clampFocusPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function clampFocusZoom(value: number): number {
  if (!Number.isFinite(value)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value)));
}

export function clampImageFocus(focus: ImageFocusPoint): ImageFocusPoint {
  return {
    x: clampFocusPercent(focus.x),
    y: clampFocusPercent(focus.y),
    zoom: clampFocusZoom(focus.zoom),
  };
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value.replace(/[{}]/g, "").split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

// The stored tag is "<prefix><x>:<y>" (pre-zoom) or "<prefix><x>:<y>:<zoom>"
// (current). Tags written before zoom existed have no third segment, which
// parses here as zoom = 100 (no zoom) — visually identical to how they
// already rendered, so old events don't change on read.
export function parseImageFocusTag(tags: string[], prefix: string): ImageFocusPoint {
  const match = tags.find((tag) => tag.startsWith(prefix));
  if (!match) return DEFAULT_IMAGE_FOCUS;

  const [xRaw, yRaw, zoomRaw] = match.slice(prefix.length).split(":");
  return clampImageFocus({
    x: Number.parseFloat(xRaw ?? "50"),
    y: Number.parseFloat(yRaw ?? "50"),
    zoom: zoomRaw === undefined ? MIN_ZOOM : Number.parseFloat(zoomRaw),
  });
}

// Convenience wrapper for the public render sites, which hold allowed_tags
// as `unknown` (it comes back from Supabase as string[] or a Postgres array
// literal string depending on the query path).
export function getImageFocusFromTags(tagsValue: unknown, prefix: string): ImageFocusPoint {
  return parseImageFocusTag(normalizeTags(tagsValue), prefix);
}

export function buildImageFocusTag(prefix: string, focus: ImageFocusPoint): string {
  const clamped = clampImageFocus(focus);
  return `${prefix}${clamped.x}:${clamped.y}:${clamped.zoom}`;
}

// The CSS for actually rendering a focus point: object-position places the
// anchor within the natural object-fit: cover crop; scale + matching
// transform-origin zooms further into that same anchor without disturbing
// it. Shared by the admin picker's live preview and every public placement
// so "what you see while editing" and "what ships" can never diverge.
export function imageFocusStyle(focus: ImageFocusPoint): CSSProperties {
  const clamped = clampImageFocus(focus);
  return {
    objectPosition: `${clamped.x}% ${clamped.y}%`,
    transform: clamped.zoom !== 100 ? `scale(${clamped.zoom / 100})` : undefined,
    transformOrigin: `${clamped.x}% ${clamped.y}%`,
  };
}

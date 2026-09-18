// src/lib/imageCrop.ts
// Single source of truth for the event/homepage image crop system: a
// pan + zoom transform (focal point + scale), not a crop rectangle.
//
// A crop-rectangle model (a sub-region selection of the source image) was
// tried first and rejected: it structurally cannot represent "zoom out
// past the point where the photo fully covers the frame" — there is no
// rectangle you can select that's *bigger* than the source image. Real
// apps (Instagram, Facebook, Twitter, LinkedIn) don't hit that wall
// because they don't store a rectangle at all — they store where the
// photo is centered and how far it's scaled, exactly like this. Scaling
// an already-covering image down via a plain CSS transform is always
// valid at any factor; it just reveals the frame's own background around
// the photo (real letterboxing), which is the actual, intended way to see
// "more than fills the frame."
//
// Editing goes through a dedicated modal
// (src/components/admin/ImageCropModal.tsx): drag the photo to pan,
// scroll/slider to zoom in either direction. The rendered frame in that
// modal uses the exact same imageFocusStyle() as every public render
// site, so there is nothing to translate between "what you see while
// editing" and "what ships."

import type { CSSProperties } from "react";

export const IMAGE_FOCUS_COVER_TAG_PREFIX = "image_focus_cover:";
export const IMAGE_FOCUS_SQUARE_TAG_PREFIX = "image_focus_square:";

export type ImageFocus = { x: number; y: number; zoom: number };

// Centered, zoom 1 — the photo's own "cover" baseline for whatever frame
// it's placed in, anchored at the image's center. Zooming below 1 reveals
// the frame's background around the photo; above 1 crops in tighter.
export const DEFAULT_IMAGE_FOCUS: ImageFocus = { x: 50, y: 50, zoom: 1 };

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;

export function clampFocusPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

export function clampFocusZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function clampImageFocus(focus: ImageFocus): ImageFocus {
  return {
    x: clampFocusPercent(focus.x),
    y: clampFocusPercent(focus.y),
    zoom: clampFocusZoom(focus.zoom),
  };
}

// Homepage sections store photo_crop as a raw object in a jsonb column
// (not a tag string), so a photo cropped before this pan+zoom model
// existed still has the old {x,y,width,height} shape sitting in the DB.
// Reusing its x/y as a center point would silently misframe the photo, so
// treat anything that isn't a complete, valid ImageFocus as unset rather
// than partially trusting it.
export function coerceImageFocus(value: unknown): ImageFocus {
  if (
    value &&
    typeof value === "object" &&
    Number.isFinite((value as ImageFocus).x) &&
    Number.isFinite((value as ImageFocus).y) &&
    Number.isFinite((value as ImageFocus).zoom)
  ) {
    return clampImageFocus(value as ImageFocus);
  }
  return DEFAULT_IMAGE_FOCUS;
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value.replace(/[{}]/g, "").split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

// Tag shape: "<prefix><x>:<y>:<zoom>". Events tagged before this model
// existed (the earlier crop-rectangle format, "<prefix>x:y:width:height")
// parse as "not set" — the centered, zoom-1 default — rather than guessing
// an equivalent from a fundamentally different representation.
export function parseImageFocusTag(tags: string[], prefix: string): ImageFocus {
  const match = tags.find((tag) => tag.startsWith(prefix));
  if (!match) return DEFAULT_IMAGE_FOCUS;

  const parts = match.slice(prefix.length).split(":").map(Number.parseFloat);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return DEFAULT_IMAGE_FOCUS;

  const [x, y, zoom] = parts;
  return clampImageFocus({ x, y, zoom });
}

// Convenience wrapper for the public render sites, which hold allowed_tags
// as `unknown` (comes back from Supabase as string[] or a Postgres array
// literal string depending on the query path).
export function getImageFocusFromTags(tagsValue: unknown, prefix: string): ImageFocus {
  return parseImageFocusTag(normalizeTags(tagsValue), prefix);
}

export function buildImageFocusTag(prefix: string, focus: ImageFocus): string {
  const f = clampImageFocus(focus);
  const round = (n: number) => Math.round(n * 100) / 100;
  return `${prefix}${round(f.x)}:${round(f.y)}:${round(f.zoom)}`;
}

// object-position places the anchor point at zoom 1 (the photo's normal
// cover-fit baseline); transform: scale(), anchored at that same point
// via transform-origin, zooms in or out from there. Scaling below 1 is a
// completely ordinary CSS operation — it reveals the frame's own
// background around the now-smaller photo, which is exactly the
// letterboxing a real "zoom out" should show. Used with a plain <img
// className="object-cover">, not next/image's fill mode, so the
// transform-origin math stays exact.
export function imageFocusStyle(focus: ImageFocus): CSSProperties {
  const f = coerceImageFocus(focus);
  return {
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom !== 1 ? `scale(${f.zoom})` : undefined,
    transformOrigin: `${f.x}% ${f.y}%`,
  };
}

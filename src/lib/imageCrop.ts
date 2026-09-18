// src/lib/imageCrop.ts
// Single source of truth for the event image crop system: real crop
// rectangles (x/y/width/height as percentages of the source image, not an
// approximated anchor point + zoom factor), the tag encoding that stores
// them, and the CSS to render a stored rectangle.
//
// Editing goes through react-easy-crop, opened from a dedicated modal
// (src/components/admin/EventImageCropModal.tsx) — the same
// pan-the-whole-photo, zoom-in, aspect-locked crop interaction
// Instagram/Facebook/Twitter/LinkedIn all use. Its own percentage-based
// crop output (onCropComplete's first argument, and
// initialCroppedAreaPercentages for reloading a saved crop) is exactly
// the ImageCropRect shape stored here — no lossy conversion in either
// direction.

import type { CSSProperties } from "react";

export const IMAGE_FOCUS_COVER_TAG_PREFIX = "image_focus_cover:";
export const IMAGE_FOCUS_SQUARE_TAG_PREFIX = "image_focus_square:";

export type ImageCropRect = { x: number; y: number; width: number; height: number };

// The whole image, uncropped — the "nothing set yet" sentinel. It's the
// image's own full frame, which usually has a different aspect ratio than
// whatever fixed aspect (16:9, 1:1, ...) a crop tool locks to, so it's
// never meaningful to seed a Cropper's initialCroppedAreaPercentages with
// this — see isDefaultCrop().
export const DEFAULT_IMAGE_CROP: ImageCropRect = { x: 0, y: 0, width: 100, height: 100 };

// True when no real crop has been saved yet. A Cropper locked to a fixed
// aspect ratio can't be seeded with "the whole image" as its initial crop
// unless the source image happens to already be that exact aspect ratio —
// forcing it to reconcile an aspect-incompatible 100%-of-image rectangle
// against a locked aspect produces a broken initial pan position (the
// image renders offset, overflowing its container). Skip seeding entirely
// in this case and let the library compute its own correct default for
// the locked aspect instead.
export function isDefaultCrop(crop: ImageCropRect): boolean {
  return crop.x === DEFAULT_IMAGE_CROP.x
    && crop.y === DEFAULT_IMAGE_CROP.y
    && crop.width === DEFAULT_IMAGE_CROP.width
    && crop.height === DEFAULT_IMAGE_CROP.height;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function clampCropRect(crop: ImageCropRect): ImageCropRect {
  const x = clampPercent(crop.x);
  const y = clampPercent(crop.y);
  return {
    x,
    y,
    width: Math.min(100 - x, Math.max(1, crop.width)),
    height: Math.min(100 - y, Math.max(1, crop.height)),
  };
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value.replace(/[{}]/g, "").split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

// Tag shape: "<prefix><x>:<y>:<width>:<height>", all percentages. Events
// tagged before this crop-rectangle model existed (an anchor-point, or
// anchor-point + zoom, format from earlier iterations) parse as "no crop
// set" — the full image — the same as an event that's never been cropped,
// rather than guessing at an equivalent rectangle from a different model.
export function parseImageCropTag(tags: string[], prefix: string): ImageCropRect {
  const match = tags.find((tag) => tag.startsWith(prefix));
  if (!match) return DEFAULT_IMAGE_CROP;

  const parts = match.slice(prefix.length).split(":").map(Number.parseFloat);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return DEFAULT_IMAGE_CROP;

  const [x, y, width, height] = parts;
  return clampCropRect({ x, y, width, height });
}

// Convenience wrapper for the public render sites, which hold allowed_tags
// as `unknown` (comes back from Supabase as string[] or a Postgres array
// literal string depending on the query path).
export function getImageCropFromTags(tagsValue: unknown, prefix: string): ImageCropRect {
  return parseImageCropTag(normalizeTags(tagsValue), prefix);
}

export function buildImageCropTag(prefix: string, crop: ImageCropRect): string {
  const c = clampCropRect(crop);
  const round = (n: number) => Math.round(n * 100) / 100;
  return `${prefix}${round(c.x)}:${round(c.y)}:${round(c.width)}:${round(c.height)}`;
}

// Renders a stored crop rectangle so it exactly fills its container: the
// image is scaled up so the cropped rectangle alone equals 100% of the
// container, then shifted so that rectangle's top-left corner lands at the
// container's origin. object-fit/object-position can only express a single
// anchor point at a fixed "cover" scale — never an arbitrary rectangle —
// which is why this renders a plain absolutely-positioned <img> rather
// than next/image's `fill` mode. The wrapping element needs
// `position: relative; overflow: hidden` (every call site already has
// this for its own card/rounded-corner styling).
export function cropRectImageStyle(crop: ImageCropRect): CSSProperties {
  const c = clampCropRect(crop);
  const x0 = c.x / 100;
  const y0 = c.y / 100;
  const w0 = c.width / 100;
  const h0 = c.height / 100;

  return {
    position: "absolute",
    left: `${-(x0 / w0) * 100}%`,
    top: `${-(y0 / h0) * 100}%`,
    width: `${100 / w0}%`,
    height: `${100 / h0}%`,
    maxWidth: "none",
  };
}

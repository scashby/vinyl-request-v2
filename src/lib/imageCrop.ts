// src/lib/imageCrop.ts
// Single source of truth for the event image crop system: real crop
// rectangles (x/y/width/height as percentages of the source image, not an
// approximated anchor point + zoom factor), the tag encoding that stores
// them, and the CSS to render a stored rectangle.
//
// A crop rectangle is allowed to extend PAST the edges of the image
// (negative x/y, width/height over 100). That is what "zoomed out" means
// here: the display area is bigger than the image, so the whole image
// shows with margin around it. A poster or logo that should be seen whole
// is a completely normal thing to want, so the rectangle is never clamped
// back inside the image — only to sane outer limits.
//
// Editing goes through src/components/admin/EventImageCropModal.tsx, which
// draws the photo once at one scale under a display-area overlay. It works
// in pan + zoom terms internally (see cropFocusToRect / cropRectToFocus)
// and saves the rectangle those produce, so the stored tag format is
// unchanged and crops saved by every earlier version of the tool keep
// meaning exactly what they always meant.

import type { CSSProperties } from "react";

export const IMAGE_FOCUS_COVER_TAG_PREFIX = "image_focus_cover:";
export const IMAGE_FOCUS_SQUARE_TAG_PREFIX = "image_focus_square:";

export type ImageCropRect = { x: number; y: number; width: number; height: number };

// The whole image, uncropped — the "nothing set yet" sentinel.
export const DEFAULT_IMAGE_CROP: ImageCropRect = { x: 0, y: 0, width: 100, height: 100 };

// True when no real crop has been saved yet, in which case the editor
// opens on its own default framing (the image centred, scaled to fill the
// display area) rather than trying to reconcile an aspect-incompatible
// "100% of the image" rectangle against a locked aspect ratio.
export function isDefaultCrop(crop: ImageCropRect): boolean {
  return crop.x === DEFAULT_IMAGE_CROP.x
    && crop.y === DEFAULT_IMAGE_CROP.y
    && crop.width === DEFAULT_IMAGE_CROP.width
    && crop.height === DEFAULT_IMAGE_CROP.height;
}

// Outer limits only. A rectangle inside the image (everything the older
// zoom-in-only tool could produce) passes through untouched; a rectangle
// that overhangs the image — the zoomed-out case — is preserved too.
const CROP_LIMIT = 1000;

function clampCropRect(crop: ImageCropRect): ImageCropRect {
  const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
  const limit = (value: number) => Math.min(CROP_LIMIT, Math.max(-CROP_LIMIT, value));
  const size = (value: number) => Math.min(CROP_LIMIT, Math.max(0.5, value));

  return {
    x: limit(finite(crop.x, 0)),
    y: limit(finite(crop.y, 0)),
    width: size(finite(crop.width, 100)),
    height: size(finite(crop.height, 100)),
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
// image is scaled so the cropped rectangle alone equals 100% of the
// container, then shifted so that rectangle's top-left corner lands at the
// container's origin. When the rectangle overhangs the image (zoomed out)
// this lands the image smaller than the container, inset by the overhang,
// with the container's own background showing around it.
// object-fit/object-position can only express a single anchor point at a
// fixed "cover" scale — never an arbitrary rectangle — which is why this
// renders a plain absolutely-positioned <img> rather than next/image's
// `fill` mode. The wrapping element needs `position: relative;
// overflow: hidden` (every call site already has this for its own
// card/rounded-corner styling).
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

// ---------------------------------------------------------------------------
// Pan + zoom, the terms the editor works in
// ---------------------------------------------------------------------------

// zoom 1 = the image exactly fills the display area (cover). Above 1 it is
// bigger than the display area and gets cropped; below 1 it is smaller,
// and sits whole inside the display area with margin around it. x/y place
// the image across whatever slack is left over, in percent, the way
// object-position does — 50/50 is centred at any zoom.
export type CropFocus = { x: number; y: number; zoom: number };

export const DEFAULT_CROP_FOCUS: CropFocus = { x: 50, y: 50, zoom: 1 };

export type Box = { width: number; height: number };

// The slider is symmetric in log space so 1x — the default — sits exactly
// in the middle of the track, with zoom-out to its left and zoom-in to its
// right. 3x out / 3x in covers almost everything; for an image whose shape
// is extreme against the target aspect (a tall poster in a 16:9 frame),
// both ends stretch together so the whole image can always be zoomed out
// to fit with room to spare, and the handle still starts centred.
const BASE_ZOOM_FACTOR = 3;

function coverScale(box: Box, natural: Box): number {
  return Math.max(box.width / natural.width, box.height / natural.height);
}

// The zoom at which the entire image just fits inside the display area.
function containZoom(box: Box, natural: Box): number {
  const contain = Math.min(box.width / natural.width, box.height / natural.height);
  return contain / coverScale(box, natural);
}

export function cropZoomFactor(box: Box | null, natural: Box | null): number {
  if (!box || !natural || !natural.width || !natural.height || !box.width || !box.height) {
    return BASE_ZOOM_FACTOR;
  }
  const fitsWholeImage = containZoom(box, natural);
  // 0.8 so the far end of the slider is past "just fits", not exactly on it.
  return Math.max(BASE_ZOOM_FACTOR, 1 / (fitsWholeImage * 0.8));
}

export function clampCropFocus(focus: CropFocus, factor: number): CropFocus {
  const percent = (value: number) => (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50);
  const zoom = Number.isFinite(focus.zoom) ? focus.zoom : 1;
  return {
    x: percent(focus.x),
    y: percent(focus.y),
    zoom: Math.min(factor, Math.max(1 / factor, zoom)),
  };
}

// Where to draw the image inside the display area, in pixels. The editor
// positions a raw <img> with exactly this, which is why what it shows and
// what cropRectImageStyle() later renders are the same framing.
// An axis with under half a pixel of play has no meaningful pan position:
// the image edge-to-edge fills the display area on that axis. Rounding a
// stored percentage can leave a hair of slack there, and dividing by it
// throws the pan to an edge, so treat it as none at all.
export function hasSlack(slack: number): boolean {
  return Math.abs(slack) >= 0.5;
}

export function cropImageGeometry(
  focus: CropFocus,
  box: Box,
  natural: Box
): { left: number; top: number; width: number; height: number } {
  const scale = coverScale(box, natural) * focus.zoom;
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    width,
    height,
    left: ((focus.x / 100) * (box.width - width)),
    top: ((focus.y / 100) * (box.height - height)),
  };
}

// Editor framing -> the rectangle that gets stored. The display area is
// the crop; express it as a percentage of the image, which is allowed to
// come out negative / over 100 when the image is smaller than the display
// area.
export function cropFocusToRect(focus: CropFocus, box: Box, natural: Box): ImageCropRect {
  const g = cropImageGeometry(focus, box, natural);
  if (!g.width || !g.height) return DEFAULT_IMAGE_CROP;
  return clampCropRect({
    x: (-g.left / g.width) * 100,
    y: (-g.top / g.height) * 100,
    width: (box.width / g.width) * 100,
    height: (box.height / g.height) * 100,
  });
}

// A stored rectangle -> the editor's framing, so reopening the tool lands
// on exactly the crop that is live, whether it was saved by this tool or
// by the zoom-in-only one that came before it.
export function cropRectToFocus(crop: ImageCropRect, box: Box, natural: Box): CropFocus {
  const factor = cropZoomFactor(box, natural);
  if (isDefaultCrop(crop) || !crop.width || !crop.height) return DEFAULT_CROP_FOCUS;

  const scale = coverScale(box, natural);
  const zoomWidth = box.width / (natural.width * scale * (crop.width / 100));
  const zoomHeight = box.height / (natural.height * scale * (crop.height / 100));

  // These are identical for any rectangle shaped like the display area —
  // every crop an aspect-locked tool saves. They differ only for a legacy
  // rectangle of some other shape, which the public pages stretch to fit
  // and which therefore has no exact equivalent here; take the zoom that
  // keeps everything it showed on screen rather than cutting part of it
  // away on reopen.
  const zoom = Math.min(zoomWidth, zoomHeight);

  const drawnWidth = natural.width * scale * zoom;
  const drawnHeight = natural.height * scale * zoom;

  // Line the middle of the stored rectangle up with the middle of the
  // display area. For a rectangle of the display area's own shape that
  // reproduces the saved framing exactly, pixel for pixel.
  const left = box.width / 2 - ((crop.x + crop.width / 2) / 100) * drawnWidth;
  const top = box.height / 2 - ((crop.y + crop.height / 2) / 100) * drawnHeight;
  const slackX = box.width - drawnWidth;
  const slackY = box.height - drawnHeight;

  return clampCropFocus({
    x: hasSlack(slackX) ? (left / slackX) * 100 : 50,
    y: hasSlack(slackY) ? (top / slackY) * 100 : 50,
    zoom,
  }, factor);
}

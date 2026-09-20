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

// Where to draw the photo inside a box of a given size. Cover is the
// baseline — at zoom 1 the photo exactly fills the box — and zoom scales
// the whole photo from there, up (tighter crop) or down (the photo sits
// smaller than the box, letterboxed, which is a legitimate choice for a
// poster you want shown whole). x/y place it across whatever slack that
// leaves, the same way object-position does.
//
// This is deliberately the ONLY place this geometry is defined. It used
// to be a CSS-only object-fit: cover + transform: scale(), but that crops
// to cover BEFORE the scale applies, so below zoom 1 it shrank an
// already-cropped photo instead of revealing the rest of it — the editor
// and the live card then disagreed about what a saved crop meant.
export function postImageGeometry(
  focus: unknown,
  box: { width: number; height: number },
  natural: { width: number; height: number }
): { left: number; top: number; width: number; height: number } {
  const f = coercePostFocus(focus);
  const coverScale = Math.max(box.width / natural.width, box.height / natural.height);
  const width = natural.width * coverScale * f.zoom;
  const height = natural.height * coverScale * f.zoom;
  return {
    width,
    height,
    left: (f.x / 100) * (box.width - width),
    top: (f.y / 100) * (box.height - height),
  };
}

export function postImageStyle(
  focus: unknown,
  box: { width: number; height: number } | null,
  natural: { width: number; height: number } | null
): CSSProperties {
  if (!box || !natural || !natural.width || !natural.height) return { visibility: "hidden" };
  const g = postImageGeometry(focus, box, natural);
  return {
    position: "absolute",
    left: g.left,
    top: g.top,
    width: g.width,
    height: g.height,
    maxWidth: "none",
  };
}

// src/components/admin/HomePhotoCropModal.tsx
//
// Pan/zoom editor for the two homepage photo slots (Hero, Game Deck)
// ONLY. Deliberately standalone — no imports from src/lib/imageCrop.ts
// or the events crop modal, and nothing here is imported by anything
// event-related. See src/lib/homePhotoFocus.ts for why: sharing code
// between the homepage tool and the events tool previously let a change
// meant for one silently break the other.
//
// Drag the photo to pan, scroll or use the slider to zoom in or out.
// The frame here renders with the exact same photoFocusStyle() the
// public homepage uses, so there's nothing to translate between what's
// selected here and what ships. The frame sits inset within a larger,
// dimmed "stage" showing the rest of the photo — the part that's
// currently cropped out — so pan/zoom position relative to the photo's
// edges is visible instead of guessed at.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPhotoFocus,
  coercePhotoFocus,
  DEFAULT_PHOTO_FOCUS,
  MAX_PHOTO_ZOOM,
  MIN_PHOTO_ZOOM,
  photoFocusStyle,
  type PhotoFocus,
} from "src/lib/homePhotoFocus";

type Props = {
  imageUrl: string;
  initialFocus: unknown;
  aspectClassName: string;
  title: string;
  onSave: (focus: PhotoFocus) => void;
  onClose: () => void;
};

// The crop frame sits inset within a slightly larger "stage" that shares
// its aspect ratio (equal insets on every side preserve that), so the
// parts of the photo currently cropped out are still visible — dimmed,
// via the frame's own giant-spread box-shadow — instead of simply gone.
const FRAME_INSET_STYLE = { inset: "15%" };

export default function HomePhotoCropModal({
  imageUrl,
  initialFocus,
  aspectClassName,
  title,
  onSave,
  onClose,
}: Props) {
  const [focus, setFocus] = useState<PhotoFocus>(() => coercePhotoFocus(initialFocus));
  const [isDragging, setIsDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; origin: PhotoFocus } | null>(null);
  const latestFocusRef = useRef(focus);
  latestFocusRef.current = focus;

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const frame = frameRef.current;
    const drag = dragState.current;
    if (!frame || !drag) return;

    // Screen-pixel drag distance is converted to the photo's own percentage
    // space, scaled by the zoom at drag-start: at higher zoom the photo is
    // larger on screen, so the same pixel drag should move the anchor a
    // smaller percentage of the photo (and vice versa below 1x), keeping
    // the point under the cursor feeling anchored while dragging.
    const rect = frame.getBoundingClientRect();
    const dxPercent = (((e.clientX - drag.startX) / rect.width) * 100) / drag.origin.zoom;
    const dyPercent = (((e.clientY - drag.startY) / rect.height) * 100) / drag.origin.zoom;

    setFocus(clampPhotoFocus({
      x: drag.origin.x - dxPercent,
      y: drag.origin.y - dyPercent,
      zoom: drag.origin.zoom,
    }));
  }, []);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
    dragState.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }, [handlePointerMove]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, origin: focus };
    setIsDragging(true);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
  };

  // A JSX onWheel handler can't reliably preventDefault (React's root
  // listener is passive), so bind a real, non-passive listener directly
  // to the frame instead.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      setFocus(clampPhotoFocus({ ...latestFocusRef.current, zoom: latestFocusRef.current.zoom - e.deltaY * 0.002 }));
    };

    frame.addEventListener("wheel", onWheelNative, { passive: false });
    return () => frame.removeEventListener("wheel", onWheelNative);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gray-900/60" onClick={onClose} />

      <div className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* The outer box is the "stage" — bigger than the actual crop
              frame (FRAME_INSET_STYLE insets it) so the parts of the photo
              currently cropped OUT are still visible, dimmed, around it —
              the only way to actually see how close a pan/zoom is to the
              visible frame's edges instead of guessing. */}
          <div className={`relative w-full ${aspectClassName} overflow-hidden rounded-lg bg-gray-100 select-none touch-none`}>
            <div className="absolute overflow-visible pointer-events-none" style={FRAME_INSET_STYLE}>
              {/* eslint-disable-next-line @next/next/no-img-element -- transform-origin math needs a raw img, which next/image's fill mode can't express exactly */}
              <img
                src={imageUrl}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 h-full w-full"
                style={photoFocusStyle(focus)}
              />
            </div>
            <div
              ref={frameRef}
              onPointerDown={handlePointerDown}
              className={`absolute overflow-hidden rounded border-2 border-white bg-gray-100 shadow-[0_0_0_9999px_rgba(17,24,39,0.6)] ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              style={FRAME_INSET_STYLE}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- transform-origin math needs a raw img, which next/image's fill mode can't express exactly */}
              <img
                src={imageUrl}
                alt={`${title} preview`}
                draggable={false}
                className="absolute inset-0 h-full w-full pointer-events-none"
                style={photoFocusStyle(focus)}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-gray-500 shrink-0">Zoom</span>
            <input
              type="range"
              min={MIN_PHOTO_ZOOM}
              max={MAX_PHOTO_ZOOM}
              step={0.05}
              value={focus.zoom}
              onChange={(e) => setFocus(clampPhotoFocus({ ...focus, zoom: Number.parseFloat(e.target.value) }))}
              className="w-full"
              aria-label={`${title} zoom`}
            />
            <span className="text-xs text-gray-500 shrink-0 w-9 text-right">{focus.zoom.toFixed(2)}x</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">Drag to pan &middot; scroll or drag the slider to zoom</p>
            <button
              type="button"
              onClick={() => setFocus(DEFAULT_PHOTO_FOCUS)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(focus);
              onClose();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

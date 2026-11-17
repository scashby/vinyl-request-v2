// src/components/admin/EventImageCropModal.tsx
//
// Crop editor for an event's cover (16:9) and square (1:1) images.
//
// One photo, drawn once, at one scale. Drag it to reposition, use the
// slider to make it bigger or smaller. On top sits a single overlay: the
// clear rectangle is exactly the area that will be displayed on the page,
// and the transparent light grey covers everything that will fall outside
// it. The photo is never clipped to that rectangle and never drawn twice.
//
// Geometry is computed here rather than left to object-fit, so the photo
// can be SMALLER than the display area — the whole point for a poster or
// logo that has to be seen whole. It reproduces exactly what
// cropRectImageStyle() renders on the public pages, and saves the same
// crop-rectangle tag format the tool has always saved.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampCropFocus,
  cropFocusToRect,
  cropImageGeometry,
  cropRectToFocus,
  cropZoomFactor,
  DEFAULT_CROP_FOCUS,
  hasSlack,
  type Box,
  type CropFocus,
  type ImageCropRect,
} from "src/lib/imageCrop";

type Props = {
  imageUrl: string;
  initialCrop: ImageCropRect;
  aspect: number;
  title: string;
  onSave: (crop: ImageCropRect) => void;
  onClose: () => void;
};

// The display area is inset within a larger stage, so the parts of the
// photo that fall outside it stay visible instead of being cut away.
const DISPLAY_AREA_INSET = "14%";

// The stage is as tall as its target aspect makes it, so a 1:1 crop at the
// modal's full width came out as tall as the modal is wide — taller than a
// laptop window, which pushed Cancel/Save off the bottom of the screen with
// nothing to scroll. Cap the stage in viewport height and let its width
// follow, so the whole modal fits without the aspect ratio being squashed.
const STAGE_MAX_VH = 52;

export default function EventImageCropModal({
  imageUrl,
  initialCrop,
  aspect,
  title,
  onSave,
  onClose,
}: Props) {
  const [focus, setFocus] = useState<CropFocus>(DEFAULT_CROP_FOCUS);
  const [isDragging, setIsDragging] = useState(false);
  const [displayArea, setDisplayArea] = useState<Box | null>(null);
  const [natural, setNatural] = useState<Box | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const displayAreaRef = useRef<HTMLDivElement | null>(null);
  const seededRef = useRef(false);

  const factor = cropZoomFactor(displayArea, natural);
  const factorRef = useRef(factor);
  factorRef.current = factor;

  useEffect(() => {
    const el = displayAreaRef.current;
    if (!el) return;
    const measure = () => setDisplayArea({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Seed from the saved crop once the measurements it has to be expressed
  // against are known — not before, and only once, so it can't stomp on
  // edits made afterwards (a resize re-fires the observer).
  useEffect(() => {
    if (seededRef.current || !displayArea || !natural) return;
    seededRef.current = true;
    setFocus(cropRectToFocus(initialCrop, displayArea, natural));
  }, [displayArea, natural, initialCrop]);

  const drawn = displayArea && natural ? cropImageGeometry(focus, displayArea, natural) : null;

  const dragState = useRef<{
    pointerX: number;
    pointerY: number;
    left: number;
    top: number;
    slackX: number;
    slackY: number;
  } | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = dragState.current;
    if (!drag) return;

    const left = drag.left + (e.clientX - drag.pointerX);
    const top = drag.top + (e.clientY - drag.pointerY);

    setFocus((current) =>
      clampCropFocus({
        ...current,
        x: hasSlack(drag.slackX) ? (left / drag.slackX) * 100 : current.x,
        y: hasSlack(drag.slackY) ? (top / drag.slackY) * 100 : current.y,
      }, factorRef.current)
    );
  }, []);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
    dragState.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }, [handlePointerMove]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawn || !displayArea) return;
    e.preventDefault();
    dragState.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      left: drawn.left,
      top: drawn.top,
      slackX: displayArea.width - drawn.width,
      slackY: displayArea.height - drawn.height,
    };
    setIsDragging(true);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
  };

  // A JSX onWheel handler can't reliably preventDefault (React's root
  // listener is passive), so bind a real, non-passive listener instead.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setFocus((current) =>
        clampCropFocus({ ...current, zoom: current.zoom * Math.exp(-e.deltaY * 0.002) }, factorRef.current)
      );
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // The slider runs on the exponent, not the zoom itself, so 1x — where
  // every crop starts — sits dead centre: left of it makes the image
  // smaller, right of it makes it bigger.
  const sliderValue = Math.log(focus.zoom) / Math.log(factor);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60" onClick={onClose} />

      <div className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
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

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {/* Equal insets on every side keep the display area the same
              shape as the stage, so the stage carries the target aspect. */}
          <div
            ref={stageRef}
            onPointerDown={handlePointerDown}
            className={`relative mx-auto overflow-hidden rounded-lg bg-gray-100 select-none touch-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{ aspectRatio: String(aspect), width: `min(100%, ${(STAGE_MAX_VH * aspect).toFixed(2)}vh)` }}
          >
            <div ref={displayAreaRef} className="absolute" style={{ inset: DISPLAY_AREA_INSET }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- explicit pixel geometry, which next/image's own sizing would override */}
              <img
                src={imageUrl}
                alt={`${title} preview`}
                draggable={false}
                onLoad={(e) =>
                  setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
                }
                className="absolute pointer-events-none"
                style={
                  drawn
                    ? { left: drawn.left, top: drawn.top, width: drawn.width, height: drawn.height, maxWidth: "none" }
                    : { visibility: "hidden" }
                }
              />
            </div>
            <div
              className="absolute pointer-events-none rounded-sm"
              style={{
                inset: DISPLAY_AREA_INSET,
                boxShadow:
                  "inset 0 0 0 2px rgba(31, 41, 55, 0.85), 0 0 0 9999px rgba(249, 250, 251, 0.72)",
              }}
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="w-10 shrink-0 text-sm text-gray-600">Zoom</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={sliderValue}
              onChange={(e) =>
                setFocus((current) =>
                  clampCropFocus(
                    { ...current, zoom: Math.pow(factor, Number.parseFloat(e.target.value)) },
                    factor
                  )
                )
              }
              className="w-full"
              aria-label={`${title} zoom`}
            />
            <span className="w-11 shrink-0 text-right text-xs text-gray-500">{focus.zoom.toFixed(2)}x</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Inside the box is what shows on the page &middot; drag to reposition &middot; scroll to zoom
            </p>
            <button
              type="button"
              onClick={() => setFocus(DEFAULT_CROP_FOCUS)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-4">
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
              onSave(displayArea && natural ? cropFocusToRect(focus, displayArea, natural) : initialCrop);
              onClose();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Save crop
          </button>
        </div>
      </div>
    </div>
  );
}

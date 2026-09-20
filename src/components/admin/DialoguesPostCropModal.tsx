// src/components/admin/DialoguesPostCropModal.tsx
//
// Crop editor for a single Dialogues blog post's card image.
//
// One photo, drawn once, at one scale. Drag it to reposition, use the
// slider to make it bigger or smaller. On top sits a single overlay: the
// clear rectangle is exactly the area that will be displayed on the page,
// and the transparent grey covers everything that will fall outside it.
// The photo is never clipped to that rectangle and never drawn twice.
//
// Geometry is computed here rather than left to object-fit so the photo
// can extend past the display area into the grey. It reproduces exactly
// what postFocusStyle() renders on the public pages: cover-fit base scale,
// positioned by x/y as a percentage of the overflow, scaled by zoom.
//
// Standalone on purpose — shares nothing with src/lib/imageCrop.ts (events)
// or src/lib/homePhotoFocus.ts (Hero/Game Deck).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPostFocus,
  coercePostFocus,
  DEFAULT_POST_FOCUS,
  MAX_POST_ZOOM,
  MIN_POST_ZOOM,
  postImageGeometry,
  type PostFocus,
} from "src/lib/dialoguesPostFocus";

type Props = {
  imageUrl: string;
  title: string;
  initialFocus: unknown;
  onSave: (focus: PostFocus) => void | Promise<void>;
  onClose: () => void;
};

const DISPLAY_AREA_INSET = "15%";

type Size = { w: number; h: number };

export default function DialoguesPostCropModal({ imageUrl, title, initialFocus, onSave, onClose }: Props) {
  const [focus, setFocus] = useState<PostFocus>(() => coercePostFocus(initialFocus));
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayArea, setDisplayArea] = useState<Size | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const displayAreaRef = useRef<HTMLDivElement | null>(null);
  const focusRef = useRef(focus);
  focusRef.current = focus;

  useEffect(() => {
    const el = displayAreaRef.current;
    if (!el) return;
    const measure = () => setDisplayArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Exactly the geometry every public render site draws with, so the
  // display area below is literally what ships.
  const drawn =
    displayArea && natural
      ? postImageGeometry(focus, { width: displayArea.w, height: displayArea.h }, { width: natural.w, height: natural.h })
      : null;

  const dragState = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number } | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = dragState.current;
    const area = displayAreaRef.current;
    const size = natural;
    if (!drag || !area || !size) return;

    const w = area.clientWidth;
    const h = area.clientHeight;
    const current = postImageGeometry(focusRef.current, { width: w, height: h }, { width: size.w, height: size.h });
    const nextSlackX = w - current.width;
    const nextSlackY = h - current.height;

    const nextOffsetX = drag.offsetX + (e.clientX - drag.pointerX);
    const nextOffsetY = drag.offsetY + (e.clientY - drag.pointerY);

    setFocus((current) =>
      clampPostFocus({
        ...current,
        x: nextSlackX === 0 ? current.x : (nextOffsetX / nextSlackX) * 100,
        y: nextSlackY === 0 ? current.y : (nextOffsetY / nextSlackY) * 100,
      })
    );
  }, [natural]);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
    dragState.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }, [handlePointerMove]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawn) return;
    e.preventDefault();
    dragState.current = { pointerX: e.clientX, pointerY: e.clientY, offsetX: drawn.left, offsetY: drawn.top };
    setIsDragging(true);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setFocus((current) => clampPostFocus({ ...current, zoom: current.zoom - e.deltaY * 0.002 }));
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

  const save = async () => {
    setSaving(true);
    await onSave(focus);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gray-900/60" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">Crop: {title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          <div
            ref={stageRef}
            onPointerDown={handlePointerDown}
            className={`relative w-full aspect-[4/3] overflow-hidden rounded-lg bg-gray-100 select-none touch-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <div ref={displayAreaRef} className="absolute" style={{ inset: DISPLAY_AREA_INSET }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- explicit pixel geometry, which next/image's own sizing would override */}
              <img
                src={imageUrl}
                alt={`${title} preview`}
                draggable={false}
                onLoad={(e) =>
                  setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
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
              className="absolute pointer-events-none rounded-sm border-2 border-white"
              style={{ inset: DISPLAY_AREA_INSET, boxShadow: "0 0 0 9999px rgba(17, 24, 39, 0.45)" }}
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-gray-500 shrink-0">Size</span>
            <input
              type="range"
              min={MIN_POST_ZOOM}
              max={MAX_POST_ZOOM}
              step={0.05}
              value={focus.zoom}
              onChange={(e) => setFocus(clampPostFocus({ ...focus, zoom: Number.parseFloat(e.target.value) }))}
              className="w-full"
              aria-label={`${title} size`}
            />
            <span className="text-xs text-gray-500 shrink-0 w-9 text-right">{focus.zoom.toFixed(2)}x</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Inside the box is what shows on the page &middot; drag to reposition
            </p>
            <button
              type="button"
              onClick={() => setFocus(DEFAULT_POST_FOCUS)}
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
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

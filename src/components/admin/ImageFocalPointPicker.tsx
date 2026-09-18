// src/components/admin/ImageFocalPointPicker.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  clampFocusPercent,
  clampFocusZoom,
  DEFAULT_IMAGE_FOCUS,
  imageFocusStyle,
  type ImageFocusPoint,
} from "src/lib/imageFocus";

export type { ImageFocusPoint };

type Props = {
  imageUrl: string;
  value: ImageFocusPoint;
  onChange: (point: ImageFocusPoint) => void;
  aspectClassName: string;
  label: string;
  usedOn: string;
};

// A real crop control shows the whole photo and a boundary on it — what's
// inside the boundary ships, what's outside is excluded — and lets you move
// that boundary and zoom it, the way Instagram/Facebook/Twitter/LinkedIn all
// do. The crop WINDOW below is drawn at the site's actual target aspect
// ratio and is exactly the pixels imageFocusStyle() (src/lib/imageFocus.ts)
// will render on the live site — the STAGE around it is purely visual
// overflow, so you can see and grab the part of the photo currently getting
// cropped away, dimmed outside the window. Drag anywhere in the stage to
// pan, scroll or use the slider to zoom the window in.
export default function ImageFocalPointPicker({
  imageUrl,
  value,
  onChange,
  aspectClassName,
  label,
  usedOn,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; origin: ImageFocusPoint } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // React's root event listener for "wheel" is registered passive, so
  // e.preventDefault() inside a JSX onWheel prop is a no-op (and warns) —
  // it can't stop the page from scrolling while zooming. Bind a real,
  // non-passive listener directly to the stage instead, the same way drag
  // already goes through raw window listeners rather than JSX props.
  const latestRef = useRef({ value, onChange });
  latestRef.current = { value, onChange };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const { value: currentValue, onChange: currentOnChange } = latestRef.current;
      currentOnChange({ ...currentValue, zoom: clampFocusZoom(currentValue.zoom - e.deltaY * 0.2) });
    };

    stage.addEventListener("wheel", onWheelNative, { passive: false });
    return () => stage.removeEventListener("wheel", onWheelNative);
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const cropWindow = windowRef.current;
      const drag = dragState.current;
      if (!cropWindow || !drag) return;

      // Panning distance is relative to the crop window (not the wider
      // stage), scaled down by the current zoom — at 2x zoom the image is
      // twice as large, so the same screen-pixel drag should move the
      // anchor half as far in the underlying image's coordinate space to
      // keep the pan speed feeling consistent under the cursor.
      const rect = cropWindow.getBoundingClientRect();
      const zoomFactor = drag.origin.zoom / 100;
      const dxPercent = (((e.clientX - drag.startX) / rect.width) * 100) / zoomFactor;
      const dyPercent = (((e.clientY - drag.startY) / rect.height) * 100) / zoomFactor;

      onChange({
        x: clampFocusPercent(drag.origin.x - dxPercent),
        y: clampFocusPercent(drag.origin.y - dyPercent),
        zoom: drag.origin.zoom,
      });
    },
    [onChange]
  );

  const stopDragging = useCallback(() => {
    setIsDragging(false);
    dragState.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }, [handlePointerMove]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, origin: value };
    setIsDragging(true);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-500">Used on: {usedOn}</p>
      </div>

      {/* Stage: shows extra photo beyond the crop window so you can see —
          and grab — what's currently being cropped away. Hard-clipped at
          its own edge; nothing outside the stage is ever visible. */}
      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        className={`relative w-full ${aspectClassName} rounded-lg overflow-hidden bg-gray-900 select-none touch-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* Photo layer: sized/positioned exactly as it would be for the
            crop window alone — object-fit: cover is computed relative to
            THIS div's bounds, so it's pixel-for-pixel the same crop math
            imageFocusStyle() applies on the live site. It's a full sibling
            of the mask below (not nested inside it), so its natural
            overflow beyond the window paints where the mask can dim it,
            instead of being clipped away unseen. */}
        <div ref={windowRef} className="absolute inset-[14%]">
          <Image
            src={imageUrl}
            alt={`${label} preview`}
            fill
            draggable={false}
            className="object-cover pointer-events-none"
            style={imageFocusStyle(value)}
            unoptimized
          />
        </div>

        {/* Mask layer: same inset as the photo layer, painted on top.
            box-shadow only paints outside its own box, so the window
            itself stays a clear cutout onto the photo while everything
            around it — the part actually being cropped away — dims. */}
        <div
          className="absolute inset-[14%] pointer-events-none"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.9), 0 0 0 9999px rgba(17,24,39,0.65)",
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-500 shrink-0">Zoom</span>
        <input
          type="range"
          min={100}
          max={300}
          step={5}
          value={value.zoom}
          onChange={(e) => onChange({ ...value, zoom: clampFocusZoom(Number.parseInt(e.target.value, 10)) })}
          className="w-full"
          aria-label={`${label} zoom`}
        />
        <span className="text-[11px] text-gray-500 shrink-0 w-8 text-right">
          {(value.zoom / 100).toFixed(1)}x
        </span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-500">
          Drag to pan, scroll to zoom &middot; {value.x}%, {value.y}%
        </p>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_IMAGE_FOCUS)}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

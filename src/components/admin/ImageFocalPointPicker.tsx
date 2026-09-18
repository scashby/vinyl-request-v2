// src/components/admin/ImageFocalPointPicker.tsx
"use client";

import { useCallback, useRef, useState } from "react";
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

// Drag-to-pan + zoom focal point picker — the same pan/zoom-within-a-fixed-
// frame pattern Instagram/Facebook/LinkedIn use for profile and cover
// photos. The frame you edit *is* the crop that actually renders on the
// site: imageFocusStyle() (src/lib/imageFocus.ts) produces the exact same
// object-position/transform this preview uses, so there's nothing to
// translate between "what you see here" and "what ships."
export default function ImageFocalPointPicker({
  imageUrl,
  value,
  onChange,
  aspectClassName,
  label,
  usedOn,
}: Props) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; origin: ImageFocusPoint } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const frame = frameRef.current;
      const drag = dragState.current;
      if (!frame || !drag) return;

      // Panning distance is relative to the frame, scaled down by the
      // current zoom — at 2x zoom the image is twice as large, so the same
      // screen-pixel drag should move the anchor half as far in the
      // underlying image's coordinate space to keep the pan speed feeling
      // consistent under the cursor.
      const rect = frame.getBoundingClientRect();
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

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    onChange({ ...value, zoom: clampFocusZoom(value.zoom - e.deltaY * 0.2) });
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-500">Used on: {usedOn}</p>
      </div>
      <div
        ref={frameRef}
        onPointerDown={handlePointerDown}
        onWheel={handleWheel}
        className={`relative w-full ${aspectClassName} rounded-lg overflow-hidden border border-gray-300 select-none touch-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
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

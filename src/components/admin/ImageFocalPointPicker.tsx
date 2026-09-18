// src/components/admin/ImageFocalPointPicker.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";

export type ImageFocusPoint = { x: number; y: number };

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

type Props = {
  imageUrl: string;
  value: ImageFocusPoint;
  onChange: (point: ImageFocusPoint) => void;
  aspectClassName: string;
  label: string;
  usedOn: string;
};

// Drag-to-reposition focal point picker. Grab the photo and move it, the
// same way Facebook/LinkedIn cover-photo repositioning works — no sliders,
// no separate "preview" to interpret, the frame you drag *is* the crop
// that will actually render on the site (same object-fit: cover +
// object-position math used everywhere this focus point is consumed).
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

      const rect = frame.getBoundingClientRect();
      const dxPercent = ((e.clientX - drag.startX) / rect.width) * 100;
      const dyPercent = ((e.clientY - drag.startY) / rect.height) * 100;

      onChange({
        x: clamp(Math.round(drag.origin.x - dxPercent)),
        y: clamp(Math.round(drag.origin.y - dyPercent)),
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
      <div
        ref={frameRef}
        onPointerDown={handlePointerDown}
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
          style={{ objectPosition: `${value.x}% ${value.y}%` }}
          unoptimized
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-500">
          Drag the photo to reposition &middot; {value.x}%, {value.y}%
        </p>
        <button
          type="button"
          onClick={() => onChange({ x: 50, y: 50 })}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
        >
          Reset to center
        </button>
      </div>
    </div>
  );
}

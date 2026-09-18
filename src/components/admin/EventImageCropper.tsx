// src/components/admin/EventImageCropper.tsx
"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { DEFAULT_IMAGE_CROP, type ImageCropRect } from "src/lib/imageCrop";

type Props = {
  imageUrl: string;
  value: ImageCropRect;
  onChange: (crop: ImageCropRect) => void;
  aspect: number;
  aspectClassName: string;
  label: string;
  usedOn: string;
};

// react-easy-crop is already the crop tool this codebase uses elsewhere
// (src/app/edit-collection/enrichment/CropRotateModal.tsx) — the same
// pan-the-whole-photo, zoom-in, aspect-locked-window interaction
// Instagram/Facebook/Twitter/LinkedIn all use. This wraps it for events,
// which need two independent crops of the same source photo (16:9 for the
// Up Next card, 1:1 for the grid/thumbnails), reading/writing the
// percentage-based crop rectangle in src/lib/imageCrop.ts.
export default function EventImageCropper({
  imageUrl,
  value,
  onChange,
  aspect,
  aspectClassName,
  label,
  usedOn,
}: Props) {
  // react-easy-crop's initialCroppedAreaPercentages is a mount-time seed,
  // not a controlled prop — it must never change after mount. onCropComplete
  // reports back through the same `value`/`onChange` pair this component
  // receives, so re-passing the live `value` prop here would feed the
  // Cropper's own output back in as a new "initial" crop on every render,
  // which the Cropper reads as a real crop change, which fires
  // onCropComplete again — an infinite update loop. Snapshot it once.
  const [initialCrop] = useState(value);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const handleCropComplete = (croppedAreaPercentages: Area) => {
    onChange({
      x: croppedAreaPercentages.x,
      y: croppedAreaPercentages.y,
      width: croppedAreaPercentages.width,
      height: croppedAreaPercentages.height,
    });
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    onChange(DEFAULT_IMAGE_CROP);
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-500">Used on: {usedOn}</p>
      </div>
      <div className={`relative w-full ${aspectClassName} bg-gray-900 rounded-lg overflow-hidden`}>
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          objectFit="contain"
          initialCroppedAreaPercentages={initialCrop}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-500 shrink-0">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number.parseFloat(e.target.value))}
          className="w-full"
          aria-label={`${label} zoom`}
        />
        <span className="text-[11px] text-gray-500 shrink-0 w-8 text-right">
          {zoom.toFixed(1)}x
        </span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-500">Drag to pan, scroll to zoom</p>
        <button
          type="button"
          onClick={handleReset}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

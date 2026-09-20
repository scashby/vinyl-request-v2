// src/components/admin/EventImageCropModal.tsx
"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { isDefaultCrop, type ImageCropRect } from "src/lib/imageCrop";

type Props = {
  imageUrl: string;
  initialCrop: ImageCropRect;
  aspect: number;
  title: string;
  onSave: (crop: ImageCropRect) => void;
  onClose: () => void;
};

export default function EventImageCropModal({
  imageUrl,
  initialCrop,
  aspect,
  title,
  onSave,
  onClose,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [result, setResult] = useState<ImageCropRect>(initialCrop);

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

      <div className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
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

        <div className="relative h-[420px] w-full overflow-hidden bg-gray-100">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            objectFit="contain"
            initialCroppedAreaPercentages={isDefaultCrop(initialCrop) ? undefined : initialCrop}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(croppedAreaPercentages: Area) =>
              setResult({
                x: croppedAreaPercentages.x,
                y: croppedAreaPercentages.y,
                width: croppedAreaPercentages.width,
                height: croppedAreaPercentages.height,
              })
            }
          />
        </div>

        <div className="space-y-4 px-6 py-4">
          <label className="flex items-center gap-3 text-sm text-gray-600">
            <span className="w-10 shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number.parseFloat(e.target.value))}
              className="w-full"
            />
          </label>

          <div className="flex justify-end gap-2">
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
                onSave(result);
                onClose();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Save crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

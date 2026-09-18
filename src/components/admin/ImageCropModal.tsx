// src/components/admin/ImageCropModal.tsx
//
// Generic crop modal — a dedicated screen for cropping one image to one
// locked aspect ratio, opened on an explicit "Edit crop" click. Used
// anywhere in the admin an uploaded photo needs to be positioned within a
// fixed-aspect slot: event images (EditEventForm) and homepage photos
// (admin/edit-home). Holds no event- or homepage-specific logic itself —
// callers own the data (an ImageCropRect) and where it's stored.
"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { isDefaultCrop, type ImageCropRect } from "src/lib/imageCrop";

// zoom must stay >= 1. react-easy-crop's crop-percentage math (see
// limitArea() in the library) assumes the crop window is always fully
// covered by the image; below the zoom where that stops being true for a
// given aspect mismatch, it silently clamps the reported crop to a
// degenerate {x:0,y:0,width:100,height:100} instead of erroring — which
// looks fine while dragging in the modal but saves garbage. Confirmed by
// direct reproduction: zoom 0.5 on a portrait photo in this app's
// landscape Game Deck slot saved exactly that degenerate rectangle,
// silently discarding whatever crop had actually been dragged into view.
// There is no min-zoom value below 1 that's safe for every image/aspect
// combination, so 1 — "the crop window is always full of image, never
// invalid" — is the only correct floor.
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type Props = {
  imageUrl: string;
  initialCrop: ImageCropRect;
  aspect: number;
  title: string;
  onSave: (crop: ImageCropRect) => void;
  onClose: () => void;
};

export default function ImageCropModal({
  imageUrl,
  initialCrop,
  aspect,
  title,
  onSave,
  onClose,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  // Starting at the floor (1x) meant the slider could only ever go one
  // direction (in) — starting at the midpoint gives room to move either
  // way from the first interaction. Only matters for a fresh/default
  // crop: when initialCroppedAreaPercentages (below) has a real saved
  // crop to restore, react-easy-crop corrects this placeholder to the
  // zoom that actually matches it via its own onZoomChange call on mount.
  const [zoom, setZoom] = useState((MIN_ZOOM + MAX_ZOOM) / 2);
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
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
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
              min={MIN_ZOOM}
              max={MAX_ZOOM}
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

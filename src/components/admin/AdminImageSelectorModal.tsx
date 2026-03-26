"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { Button } from "components/ui/Button";
import {
  listAdminImageAssets,
  uploadAdminImage,
} from "src/lib/adminImageLibrary";
import type { AdminImageAsset, AdminImageKind } from "src/lib/adminImageLibraryTypes";

type AdminImageSelectorModalProps = {
  isOpen: boolean;
  imageKind: AdminImageKind;
  title: string;
  selectedUrl?: string | null;
  onClose: () => void;
  onSelect: (publicUrl: string) => void;
};

export default function AdminImageSelectorModal({
  isOpen,
  imageKind,
  title,
  selectedUrl,
  onClose,
  onSelect,
}: AdminImageSelectorModalProps) {
  const [assets, setAssets] = useState<AdminImageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AdminImageAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void listAdminImageAssets(imageKind)
      .then((nextAssets) => {
        if (!cancelled) setAssets(nextAssets);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load images.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [imageKind, isOpen]);

  useEffect(() => {
    if (!isOpen) setPreviewAsset(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const payload = await uploadAdminImage(imageKind, file);
      setAssets((current) => [payload.asset, ...current.filter((asset) => asset.publicUrl !== payload.publicUrl)]);
      onSelect(payload.publicUrl);
      onClose();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative z-[121] flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">
              Browse reusable assets or upload a new image directly into this library.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div className="text-sm text-gray-500">
            {loading ? "Loading image library..." : `${assets.length} active image${assets.length === 1 ? "" : "s"}`}
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload new image"}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && assets.length === 0 && !error && (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
              <p className="text-base font-semibold text-gray-700">No images available yet.</p>
              <p className="mt-2 text-sm text-gray-500">
                Upload one here and it will be ready for reuse across the admin UI.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => {
              const isSelected = selectedUrl === asset.publicUrl;
              return (
                <article
                  key={`${asset.imageKind}:${asset.publicUrl}`}
                  className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition ${
                    isSelected ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"
                  }`}
                >
                  <button
                    type="button"
                    className="relative block aspect-[4/3] w-full bg-gray-100"
                    onClick={() => setPreviewAsset(asset)}
                  >
                    <Image
                      src={asset.publicUrl}
                      alt={asset.label}
                      fill
                      unoptimized
                      className={asset.imageKind === "venueLogo" ? "object-contain p-5" : "object-cover"}
                    />
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                      Preview
                    </span>
                  </button>
                  <div className="space-y-3 px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                        {asset.sourceType === "supabase" ? "Supabase" : "External"}
                      </span>
                      {asset.usage.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                          Used {asset.usage.length}x
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="truncate text-sm font-semibold text-gray-900">{asset.label}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{asset.publicUrl}</p>
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => {
                        onSelect(asset.publicUrl);
                        onClose();
                      }}
                    >
                      {isSelected ? "Selected" : "Use this image"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {previewAsset && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => setPreviewAsset(null)} />
          <div className="relative z-[131] w-full max-w-6xl overflow-hidden rounded-2xl bg-black">
            <button
              type="button"
              onClick={() => setPreviewAsset(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-gray-900"
            >
              Close
            </button>
            <div className="relative h-[80vh] w-full">
              <Image
                src={previewAsset.publicUrl}
                alt={previewAsset.label}
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

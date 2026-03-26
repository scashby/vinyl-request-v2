"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "components/ui/Button";
import { Container } from "components/ui/Container";
import {
  deleteAdminImageAsset,
  listAdminImageAssets,
  updateAdminImageAsset,
  uploadAdminImage,
} from "src/lib/adminImageLibrary";
import type { AdminImageAsset, AdminImageKind } from "src/lib/adminImageLibraryTypes";

const IMAGE_KIND_OPTIONS: Array<{ value: AdminImageKind; label: string; description: string }> = [
  {
    value: "eventImage",
    label: "Event Images",
    description: "Featured event artwork reused across event pages and templates.",
  },
  {
    value: "venueLogo",
    label: "Venue Logos",
    description: "Venue marks used in event and game screens.",
  },
];

export default function AdminImageLibraryPage() {
  const [imageKind, setImageKind] = useState<AdminImageKind>("eventImage");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [assets, setAssets] = useState<AdminImageAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AdminImageAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextAssets = await listAdminImageAssets(imageKind, { includeArchived });
      setAssets(nextAssets);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load image library.");
    } finally {
      setLoading(false);
    }
  }, [imageKind, includeArchived]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const activeCount = assets.filter((asset) => !asset.archived).length;
  const archivedCount = assets.filter((asset) => asset.archived).length;

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setMutatingKey("upload");
      setError(null);
      await uploadAdminImage(imageKind, file);
      await loadAssets();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload image.");
    } finally {
      setMutatingKey(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleArchiveToggle = async (asset: AdminImageAsset) => {
    try {
      setMutatingKey(asset.publicUrl);
      setError(null);
      await updateAdminImageAsset(
        {
          imageKind: asset.imageKind,
          publicUrl: asset.publicUrl,
          storagePath: asset.storagePath,
          sourceType: asset.sourceType,
          label: asset.label,
        },
        !asset.archived
      );
      await loadAssets();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to update image.");
    } finally {
      setMutatingKey(null);
    }
  };

  const handleDelete = async (asset: AdminImageAsset) => {
    if (!asset.storagePath || asset.sourceType !== "supabase") return;
    if (!confirm(`Delete ${asset.label} from storage permanently? This cannot be undone.`)) return;

    try {
      setMutatingKey(asset.publicUrl);
      setError(null);
      await deleteAdminImageAsset({
        imageKind: asset.imageKind,
        publicUrl: asset.publicUrl,
        storagePath: asset.storagePath,
        sourceType: asset.sourceType,
        label: asset.label,
      });
      await loadAssets();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete image.");
    } finally {
      setMutatingKey(null);
    }
  };

  return (
    <Container size="lg" className="min-h-screen py-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/manage-events" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Back to Events
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Image Library</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Upload reusable artwork before records exist, archive images out of future selections, and permanently delete unused managed assets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
            disabled={mutatingKey === "upload"}
          >
            {mutatingKey === "upload" ? "Uploading..." : "Upload image"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Asset type</p>
          <div className="mt-3 space-y-2">
            {IMAGE_KIND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setImageKind(option.value)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  option.value === imageKind
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                <p className="mt-1 text-xs text-gray-500">{option.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-800">Current view</p>
            <p className="mt-2">{activeCount} active</p>
            <p>{archivedCount} archived</p>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{IMAGE_KIND_OPTIONS.find((option) => option.value === imageKind)?.label}</h2>
              <p className="text-sm text-gray-500">Archived images stay in the library but no longer appear in selectors.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                className="h-4 w-4"
              />
              Show archived
            </label>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center text-sm text-gray-500">
              Loading images...
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
              <p className="text-base font-semibold text-gray-700">No images found.</p>
              <p className="mt-2 text-sm text-gray-500">Upload one now and it will be available for selection immediately.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assets.map((asset) => {
                const disabled = mutatingKey === asset.publicUrl;
                return (
                  <article
                    key={`${asset.imageKind}:${asset.publicUrl}`}
                    className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
                      asset.archived ? "border-amber-200 bg-amber-50/30" : "border-gray-200"
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
                          {asset.sourceType === "supabase" ? "Managed Supabase" : "External URL"}
                        </span>
                        {asset.archived && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                            Archived
                          </span>
                        )}
                        {asset.usage.length > 0 && (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                            {asset.usage.length} use{asset.usage.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="truncate text-sm font-semibold text-gray-900">{asset.label}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{asset.publicUrl}</p>
                      </div>

                      {asset.usage.length > 0 && (
                        <div className="rounded-2xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          {asset.usage.map((usage) => (
                            <div key={`${usage.usageType}:${usage.label}`}>{usage.label}</div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={disabled}
                          onClick={() => void handleArchiveToggle(asset)}
                        >
                          {asset.archived ? "Restore" : "Archive"}
                        </Button>
                        {asset.sourceType === "supabase" && asset.storagePath && (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={disabled || asset.usage.length > 0}
                            onClick={() => void handleDelete(asset)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {previewAsset && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => setPreviewAsset(null)} />
          <div className="relative z-[141] w-full max-w-6xl overflow-hidden rounded-2xl bg-black">
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
    </Container>
  );
}

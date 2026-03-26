import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Database } from "types/supabase";
import {
  ADMIN_IMAGE_KINDS,
  type AdminImageAsset,
  type AdminImageKind,
  type AdminImageSourceType,
  type AdminImageUsage,
} from "src/lib/adminImageLibraryTypes";
import {
  defaultEventTypeConfig,
  type EventSubtypeConfig,
  type EventTypeConfig,
  type EventTypeConfigState,
  mergeEventTypeConfig,
} from "src/lib/eventTypeConfig";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

type ImageAssetRow = Database["public"]["Tables"]["image_assets"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];

type ImageKindConfig = {
  bucketName: string;
  prefix: string;
  label: string;
  eventField: "image_url" | "venue_logo_url";
};

type AssetIdentity = {
  imageKind: AdminImageKind;
  publicUrl: string;
  storagePath?: string | null;
  sourceType?: AdminImageSourceType;
  label?: string | null;
};

const IMAGE_KIND_CONFIG: Record<AdminImageKind, ImageKindConfig> = {
  eventImage: {
    bucketName: "event-images",
    prefix: "event-images",
    label: "Event image",
    eventField: "image_url",
  },
  venueLogo: {
    bucketName: "venue-logos",
    prefix: "venue-logos",
    label: "Venue logo",
    eventField: "venue_logo_url",
  },
};

type StorageListItem = {
  name: string;
  created_at?: string;
  updated_at?: string;
  id?: string;
};

type UsageMap = Map<string, AdminImageUsage[]>;

export function isAdminImageKind(value: unknown): value is AdminImageKind {
  return typeof value === "string" && ADMIN_IMAGE_KINDS.includes(value as AdminImageKind);
}

export async function requireAdminUser(request: NextRequest) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) {
    throw new Error("Unauthorized");
  }

  const authClient = supabaseServer(authHeader);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return user;
}

function getKindConfig(imageKind: AdminImageKind): ImageKindConfig {
  return IMAGE_KIND_CONFIG[imageKind];
}

function getFileExtension(file: File): string {
  const fromName = file.name.trim().split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;

  const fromMime = file.type.split("/").pop()?.toLowerCase();
  if (!fromMime) return "bin";
  if (fromMime === "jpeg") return "jpg";
  return fromMime.replace(/[^a-z0-9]+/g, "") || "bin";
}

function buildObjectPath(imageKind: AdminImageKind, file: File) {
  const config = getKindConfig(imageKind);
  const fileExt = getFileExtension(file);
  return `${config.prefix}/${Date.now()}-${randomUUID().slice(0, 8)}.${fileExt}`;
}

function createUsageKey(imageKind: AdminImageKind, publicUrl: string) {
  return `${imageKind}::${publicUrl}`;
}

function normalizeUrl(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPublicUrl(imageKind: AdminImageKind, storagePath: string) {
  return supabaseAdmin.storage.from(getKindConfig(imageKind).bucketName).getPublicUrl(storagePath).data.publicUrl;
}

function tryParseStoragePath(imageKind: AdminImageKind, publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${getKindConfig(imageKind).bucketName}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const encodedPath = url.pathname.slice(markerIndex + marker.length);
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

async function fetchImageAssetRows(imageKind: AdminImageKind) {
  const { data, error } = await supabaseAdmin
    .from("image_assets")
    .select("*")
    .eq("image_kind", imageKind)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ImageAssetRow[];
}

async function fetchStorageAssets(imageKind: AdminImageKind) {
  const config = getKindConfig(imageKind);
  const { data, error } = await supabaseAdmin.storage.from(config.bucketName).list(config.prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "desc" },
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as StorageListItem[])
    .filter((item) => item.name && !item.name.endsWith("/"))
    .map((item) => {
      const storagePath = `${config.prefix}/${item.name}`;
      const publicUrl = getPublicUrl(imageKind, storagePath);
      return {
        publicUrl,
        storagePath,
        label: item.name,
        createdAt: item.created_at ?? null,
        updatedAt: item.updated_at ?? null,
      };
    });
}

async function fetchEventImageUsages() {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, title, image_url, venue_logo_url")
    .order("date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Pick<EventRow, "id" | "title" | "image_url" | "venue_logo_url">[];
}

async function fetchEventTypeConfig() {
  const { data, error } = await supabaseAdmin
    .from("admin_settings")
    .select("value")
    .eq("key", "event_type_config")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.value) return defaultEventTypeConfig;

  try {
    const parsed = JSON.parse(data.value) as EventTypeConfigState;
    return mergeEventTypeConfig(defaultEventTypeConfig, parsed);
  } catch {
    return defaultEventTypeConfig;
  }
}

function addUsage(map: UsageMap, imageKind: AdminImageKind, publicUrl: string, usage: AdminImageUsage) {
  const key = createUsageKey(imageKind, publicUrl);
  const existing = map.get(key) ?? [];
  existing.push(usage);
  map.set(key, existing);
}

function collectEventTypeUsage(
  map: UsageMap,
  imageKind: AdminImageKind,
  typeConfig: EventTypeConfig,
  subtypeConfig?: EventSubtypeConfig
) {
  const defaults = subtypeConfig?.defaults ?? typeConfig.defaults;
  const publicUrl = normalizeUrl(
    imageKind === "eventImage" ? defaults?.image_url : defaults?.venue_logo_url
  );
  if (!publicUrl) return;

  const baseLabel = typeConfig.label || typeConfig.id || "Untitled type";
  if (subtypeConfig) {
    addUsage(map, imageKind, publicUrl, {
      usageType: "eventSubtype",
      label: `${baseLabel} / ${subtypeConfig.label || subtypeConfig.id || "Untitled subtype"}`,
      href: "/admin/event-types",
    });
    return;
  }

  addUsage(map, imageKind, publicUrl, {
    usageType: "eventType",
    label: baseLabel,
    href: "/admin/event-types",
  });
}

async function buildUsageMap() {
  const [events, eventTypeConfig] = await Promise.all([fetchEventImageUsages(), fetchEventTypeConfig()]);
  const usageMap: UsageMap = new Map();

  for (const event of events) {
    const eventImageUrl = normalizeUrl(event.image_url);
    if (eventImageUrl) {
      addUsage(usageMap, "eventImage", eventImageUrl, {
        usageType: "event",
        label: event.title,
        href: `/admin/manage-events/edit?id=${event.id}`,
      });
    }

    const venueLogoUrl = normalizeUrl(event.venue_logo_url);
    if (venueLogoUrl) {
      addUsage(usageMap, "venueLogo", venueLogoUrl, {
        usageType: "event",
        label: event.title,
        href: `/admin/manage-events/edit?id=${event.id}`,
      });
    }
  }

  for (const typeConfig of eventTypeConfig.types) {
    collectEventTypeUsage(usageMap, "eventImage", typeConfig);
    collectEventTypeUsage(usageMap, "venueLogo", typeConfig);
    for (const subtypeConfig of typeConfig.subtypes ?? []) {
      collectEventTypeUsage(usageMap, "eventImage", typeConfig, subtypeConfig);
      collectEventTypeUsage(usageMap, "venueLogo", typeConfig, subtypeConfig);
    }
  }

  return usageMap;
}

function mapRowToAsset(row: ImageAssetRow, usageMap: UsageMap): AdminImageAsset {
  return {
    imageKind: row.image_kind as AdminImageKind,
    sourceType: row.source_type as AdminImageSourceType,
    publicUrl: row.public_url,
    storagePath: row.storage_path,
    bucketName: row.bucket_name,
    label: row.label ?? row.storage_path?.split("/").pop() ?? row.public_url,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usage: usageMap.get(createUsageKey(row.image_kind as AdminImageKind, row.public_url)) ?? [],
    isManaged: row.source_type === "supabase" || !!row.storage_path,
  };
}

function buildStorageAsset(
  imageKind: AdminImageKind,
  item: {
    publicUrl: string;
    storagePath: string;
    label: string;
    createdAt: string | null;
    updatedAt: string | null;
  },
  override?: ImageAssetRow,
  usageMap?: UsageMap
): AdminImageAsset {
  return {
    imageKind,
    sourceType: "supabase",
    publicUrl: item.publicUrl,
    storagePath: item.storagePath,
    bucketName: getKindConfig(imageKind).bucketName,
    label: override?.label ?? item.label,
    archived: override?.archived ?? false,
    createdAt: override?.created_at ?? item.createdAt,
    updatedAt: override?.updated_at ?? item.updatedAt,
    usage: usageMap?.get(createUsageKey(imageKind, item.publicUrl)) ?? [],
    isManaged: true,
  };
}

function buildDiscoveredAsset(
  imageKind: AdminImageKind,
  publicUrl: string,
  usageMap: UsageMap,
  override?: ImageAssetRow
): AdminImageAsset {
  const storagePath = override?.storage_path ?? tryParseStoragePath(imageKind, publicUrl);
  const sourceType = override?.source_type
    ? (override.source_type as AdminImageSourceType)
    : storagePath
      ? "supabase"
      : "external";

  return {
    imageKind,
    sourceType,
    publicUrl,
    storagePath,
    bucketName: sourceType === "supabase" ? getKindConfig(imageKind).bucketName : override?.bucket_name ?? null,
    label: override?.label ?? storagePath?.split("/").pop() ?? publicUrl,
    archived: override?.archived ?? false,
    createdAt: override?.created_at ?? null,
    updatedAt: override?.updated_at ?? null,
    usage: usageMap.get(createUsageKey(imageKind, publicUrl)) ?? [],
    isManaged: sourceType === "supabase",
  };
}

export async function listImageAssets(imageKind: AdminImageKind, includeArchived = false) {
  const [rows, storageAssets, usageMap] = await Promise.all([
    fetchImageAssetRows(imageKind),
    fetchStorageAssets(imageKind),
    buildUsageMap(),
  ]);

  const rowByPublicUrl = new Map(rows.map((row) => [row.public_url, row]));
  const rowByStoragePath = new Map(rows.filter((row) => row.storage_path).map((row) => [row.storage_path as string, row]));
  const combined = new Map<string, AdminImageAsset>();

  for (const storageAsset of storageAssets) {
    const override = rowByStoragePath.get(storageAsset.storagePath) ?? rowByPublicUrl.get(storageAsset.publicUrl);
    combined.set(storageAsset.publicUrl, buildStorageAsset(imageKind, storageAsset, override, usageMap));
  }

  for (const [key] of usageMap) {
    const [usageImageKind, publicUrl] = key.split("::");
    if (usageImageKind !== imageKind || combined.has(publicUrl)) continue;
    combined.set(publicUrl, buildDiscoveredAsset(imageKind, publicUrl, usageMap, rowByPublicUrl.get(publicUrl)));
  }

  for (const row of rows) {
    if (combined.has(row.public_url)) continue;
    combined.set(row.public_url, mapRowToAsset(row, usageMap));
  }

  const assets = Array.from(combined.values())
    .filter((asset) => includeArchived || !asset.archived)
    .sort((left, right) => {
      const rightTime = right.updatedAt ?? right.createdAt ?? "";
      const leftTime = left.updatedAt ?? left.createdAt ?? "";
      return rightTime.localeCompare(leftTime);
    });

  return assets;
}

async function upsertImageAssetRow(identity: AssetIdentity & { archived?: boolean; bucketName?: string | null }) {
  const row = {
    image_kind: identity.imageKind,
    source_type: identity.sourceType ?? (identity.storagePath ? "supabase" : "external"),
    public_url: identity.publicUrl,
    storage_path: identity.storagePath ?? null,
    bucket_name: identity.bucketName ?? (identity.storagePath ? getKindConfig(identity.imageKind).bucketName : null),
    label: identity.label ?? identity.storagePath?.split("/").pop() ?? null,
    archived: identity.archived ?? false,
  };

  const { error } = await supabaseAdmin
    .from("image_assets")
    .upsert(row, { onConflict: "image_kind,public_url" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadImageAsset(imageKind: AdminImageKind, file: File) {
  const objectPath = buildObjectPath(imageKind, file);
  const config = getKindConfig(imageKind);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(config.bucketName)
    .upload(objectPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw new Error(uploadError.message || `Failed to upload ${config.label.toLowerCase()}`);
  }

  const publicUrl = getPublicUrl(imageKind, objectPath);
  await upsertImageAssetRow({
    imageKind,
    publicUrl,
    storagePath: objectPath,
    sourceType: "supabase",
    label: file.name,
    bucketName: config.bucketName,
    archived: false,
  });

  const assets = await listImageAssets(imageKind, true);
  const asset = assets.find((item) => item.publicUrl === publicUrl);
  if (!asset) {
    throw new Error("Upload succeeded but the image asset could not be loaded.");
  }

  return {
    path: objectPath,
    publicUrl,
    asset,
  };
}

export async function setImageAssetArchived(identity: AssetIdentity, archived: boolean) {
  await upsertImageAssetRow({
    ...identity,
    archived,
    bucketName: identity.storagePath ? getKindConfig(identity.imageKind).bucketName : null,
  });

  const assets = await listImageAssets(identity.imageKind, true);
  const asset = assets.find((item) => item.publicUrl === identity.publicUrl);
  if (!asset) {
    throw new Error("Image asset could not be loaded after update.");
  }

  return asset;
}

export async function deleteImageAsset(identity: AssetIdentity) {
  const assets = await listImageAssets(identity.imageKind, true);
  const asset = assets.find((item) => item.publicUrl === identity.publicUrl);

  if (!asset) {
    throw new Error("Image asset not found.");
  }
  if (asset.sourceType !== "supabase" || !asset.storagePath) {
    throw new Error("Only managed Supabase images can be permanently deleted.");
  }
  if (asset.usage.length > 0) {
    throw new Error("This image is still in use. Archive it first or remove existing references before deleting.");
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from(getKindConfig(identity.imageKind).bucketName)
    .remove([asset.storagePath]);

  if (removeError) {
    throw new Error(removeError.message || "Failed to delete image from storage.");
  }

  const { error } = await supabaseAdmin
    .from("image_assets")
    .delete()
    .eq("image_kind", identity.imageKind)
    .eq("public_url", identity.publicUrl);

  if (error) {
    throw new Error(error.message);
  }
}

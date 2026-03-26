import { supabase } from "src/lib/supabaseClient";
import type { AdminImageAsset, AdminImageKind, AdminImageSourceType } from "src/lib/adminImageLibraryTypes";

export type ListAdminImageAssetsOptions = {
  includeArchived?: boolean;
};

type UploadAdminImageResult = {
  path: string;
  publicUrl: string;
  asset: AdminImageAsset;
};

type AssetMutationIdentity = {
  imageKind: AdminImageKind;
  publicUrl: string;
  storagePath?: string | null;
  sourceType?: AdminImageSourceType;
  label?: string | null;
};

type AssetMutationResult = {
  ok: true;
  asset: AdminImageAsset;
};

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Your admin session has expired. Sign in again and retry.");
  }

  return accessToken;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload && "error" in payload && payload.error ? payload.error : `Request failed (${response.status}).`);
  }

  return payload as T;
}

export async function listAdminImageAssets(
  imageKind: AdminImageKind,
  options: ListAdminImageAssetsOptions = {}
): Promise<AdminImageAsset[]> {
  const accessToken = await getAccessToken();
  const params = new URLSearchParams({ imageKind });
  if (options.includeArchived) params.set("includeArchived", "true");

  const response = await fetch(`/api/admin/image-library?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await parseJsonResponse<{ assets: AdminImageAsset[] }>(response);
  return payload.assets;
}

export async function uploadAdminImage(
  imageKind: AdminImageKind,
  file: File
): Promise<UploadAdminImageResult> {
  const accessToken = await getAccessToken();
  const formData = new FormData();
  formData.append("imageKind", imageKind);
  formData.append("file", file);
  formData.append("filename", file.name);

  const response = await fetch("/api/admin/image-library", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  return parseJsonResponse<UploadAdminImageResult>(response);
}

export async function updateAdminImageAsset(
  identity: AssetMutationIdentity,
  archived: boolean
): Promise<AdminImageAsset> {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/admin/image-library", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...identity, archived }),
  });

  const payload = await parseJsonResponse<AssetMutationResult>(response);
  return payload.asset;
}

export async function deleteAdminImageAsset(identity: AssetMutationIdentity): Promise<void> {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/admin/image-library", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(identity),
  });

  await parseJsonResponse<{ ok: true }>(response);
}

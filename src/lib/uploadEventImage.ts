import { supabase } from "src/lib/supabaseClient";

type UploadEventImageResult = {
  path: string;
  publicUrl: string;
};

export async function uploadEventImage(file: File): Promise<UploadEventImageResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Your admin session has expired. Sign in again and retry the upload.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", file.name);

  const response = await fetch("/api/admin/event-images", {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; path?: string; publicUrl?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || `Failed to upload image (${response.status}).`);
  }

  if (!payload?.publicUrl || !payload.path) {
    throw new Error("Upload succeeded but the image URL was not returned.");
  }

  return {
    path: payload.path,
    publicUrl: payload.publicUrl,
  };
}

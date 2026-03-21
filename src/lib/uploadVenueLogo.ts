import { supabase } from "src/lib/supabaseClient";

type UploadVenueLogoResult = {
  path: string;
  publicUrl: string;
};

export async function uploadVenueLogo(file: File): Promise<UploadVenueLogoResult> {
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

  const response = await fetch("/api/admin/venue-logos", {
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
    throw new Error(payload?.error || `Failed to upload venue logo (${response.status}).`);
  }

  if (!payload?.publicUrl || !payload.path) {
    throw new Error("Upload succeeded but the venue logo URL was not returned.");
  }

  return {
    path: payload.path,
    publicUrl: payload.publicUrl,
  };
}

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

export const runtime = "nodejs";

const VENUE_LOGO_BUCKET = "venue-logos";

function getFileExtension(file: File): string {
  const fromName = file.name.trim().split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;

  const fromMime = file.type.split("/").pop()?.toLowerCase();
  if (!fromMime) return "bin";
  if (fromMime === "jpeg") return "jpg";
  return fromMime.replace(/[^a-z0-9]+/g, "") || "bin";
}

export async function POST(request: NextRequest) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authClient = supabaseServer(authHeader);
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 });
  }

  const fileExt = getFileExtension(file);
  const objectPath = `venue-logos/${Date.now()}-${randomUUID().slice(0, 8)}.${fileExt}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(VENUE_LOGO_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    console.error("Error uploading venue logo:", uploadError);
    return NextResponse.json(
      { error: uploadError.message || "Failed to upload venue logo" },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(VENUE_LOGO_BUCKET).getPublicUrl(objectPath);

  return NextResponse.json(
    {
      path: objectPath,
      publicUrl,
    },
    { status: 200 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

export const runtime = "nodejs";

const ALLOWED_BUCKETS = new Set(["album-images", "playlist-covers", "event-images", "venue-logos"]);

export async function POST(request: NextRequest) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseServer(authHeader).auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { bucket?: string; path?: string };
  try {
    body = await request.json() as { bucket?: string; path?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { bucket, path } = body;
  if (typeof bucket !== "string" || !ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }
  if (typeof path !== "string" || !path.trim()) {
    return NextResponse.json({ error: "No path provided" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.storage.from(bucket).remove([path.trim()]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

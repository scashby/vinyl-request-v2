import { NextRequest, NextResponse } from "next/server";
import { syncSessionPlaylistMetadata } from "src/lib/playlistMetadataSync";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  try {
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
    const result = await syncSessionPlaylistMetadata("name-that-tune", sessionId, { dryRun });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refresh metadata" },
      { status: 500 }
    );
  }
}

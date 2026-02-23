import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import type { LibraryRecordingResponse } from "src/lib/library/types";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ recordingId: string }> }) {
  try {
    const { recordingId } = await context.params;
    const id = Number(recordingId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid recordingId" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("recordings")
      .select("id, title, track_artist, lyrics, lyrics_url, credits")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Recording not found" }, { status: 404 });
    }

    const payload: LibraryRecordingResponse = {
      ok: true,
      recording: {
        id: data.id,
        title: data.title ?? null,
        track_artist: data.track_artist ?? null,
        lyrics: data.lyrics ?? null,
        lyrics_url: data.lyrics_url ?? null,
        credits: data.credits ?? null,
      },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load recording";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


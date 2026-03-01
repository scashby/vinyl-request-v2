import { NextRequest, NextResponse } from "next/server";
import { getSampleDetectiveDb } from "src/lib/sampleDetectiveDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getSampleDetectiveDb();
  const { data, error } = await db
    .from("sd_session_calls")
    .select(
      "id, session_id, round_number, call_index, source_label, sampled_artist, sampled_title, source_artist, source_title, release_year, sample_timestamp, host_notes, status, asked_at, revealed_at, scored_at, created_at"
    )
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

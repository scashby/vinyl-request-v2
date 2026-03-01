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
    .select("call_index, round_number, sampled_artist, sampled_title, source_artist, source_title, source_label, sample_timestamp, host_notes")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    call_index: row.call_index,
    round_number: row.round_number,
    artist: row.sampled_artist,
    title: row.sampled_title,
    source_label: row.source_label,
    detail: [
      `Source: ${row.source_artist} - ${row.source_title}`,
      row.sample_timestamp ? `Sample ts: ${row.sample_timestamp}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    host_notes: row.host_notes,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

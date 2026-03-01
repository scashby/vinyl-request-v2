import { NextRequest, NextResponse } from "next/server";
import { getDecadeDashDb } from "src/lib/decadeDashDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getDecadeDashDb();
  const { data, error } = await db
    .from("dd_session_calls")
    .select("call_index, round_number, artist, title, release_year, decade_start, source_label, host_notes")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    call_index: row.call_index,
    round_number: row.round_number,
    artist: row.artist,
    title: row.title,
    source_label: row.source_label,
    detail: [row.release_year ? `Year: ${row.release_year}` : null, row.decade_start ? `Decade: ${row.decade_start}s` : null]
      .filter(Boolean)
      .join(" | ") || null,
    host_notes: row.host_notes,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

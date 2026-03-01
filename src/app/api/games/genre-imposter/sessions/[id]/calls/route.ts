import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getGenreImposterDb();
  const { data, error } = await db
    .from("gi_session_calls")
    .select("round_number, call_index, play_order, artist, title, source_label, record_label, fits_category, is_imposter, host_notes")
    .eq("session_id", sessionId)
    .order("round_number", { ascending: true })
    .order("play_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row, index) => ({
    call_index: index + 1,
    round_number: row.round_number,
    artist: row.artist,
    title: row.title,
    source_label: row.source_label,
    detail: [
      row.record_label ? `Label: ${row.record_label}` : null,
      row.is_imposter ? "Imposter track" : null,
      row.fits_category ? "Fits category" : null,
      `Slot ${row.call_index}`,
    ]
      .filter(Boolean)
      .join(" | "),
    host_notes: row.host_notes,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

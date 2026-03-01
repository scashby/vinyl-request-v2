import { NextRequest, NextResponse } from "next/server";
import { getBackToBackConnectionDb } from "src/lib/backToBackConnectionDb";

export const runtime = "nodejs";

type CallRow = {
  id: number;
  call_index: number;
  round_number: number;
  track_a_artist: string;
  track_a_title: string;
  track_a_source_label: string | null;
  track_a_release_year: number | null;
  track_b_artist: string;
  track_b_title: string;
  track_b_source_label: string | null;
  track_b_release_year: number | null;
  accepted_connection: string;
  accepted_detail: string | null;
  host_notes: string | null;
  status: "pending" | "played_track_a" | "played_track_b" | "discussion" | "revealed" | "scored" | "skipped";
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getBackToBackConnectionDb();
  const { data, error } = await db
    .from("b2bc_session_calls")
    .select(
      "id, call_index, round_number, track_a_artist, track_a_title, track_a_source_label, track_a_release_year, track_b_artist, track_b_title, track_b_source_label, track_b_release_year, accepted_connection, accepted_detail, host_notes, status"
    )
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as CallRow[]).map((row) => {
    const sourceLabel = [row.track_a_source_label, row.track_b_source_label].filter(Boolean).join(" | ") || null;
    return {
      ...row,
      artist: `${row.track_a_artist} -> ${row.track_b_artist}`,
      title: `${row.track_a_title} -> ${row.track_b_title}`,
      source_label: sourceLabel,
      detail: [row.accepted_connection, row.accepted_detail].filter(Boolean).join(" | ") || null,
    };
  });

  return NextResponse.json({ data: rows }, { status: 200 });
}

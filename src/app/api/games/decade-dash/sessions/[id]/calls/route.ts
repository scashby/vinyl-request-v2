import { NextRequest, NextResponse } from "next/server";
import { getDecadeDashDb } from "src/lib/decadeDashDb";

export const runtime = "nodejs";

type CallRow = {
  id: number;
  call_index: number;
  round_number: number;
  artist: string | null;
  title: string | null;
  release_year: number | null;
  decade_start: number;
  accepted_adjacent_decades: unknown;
  source_label: string | null;
  host_notes: string | null;
  status: "pending" | "asked" | "locked" | "revealed" | "scored" | "skipped";
  asked_at: string | null;
  revealed_at: string | null;
  scored_at: string | null;
};

function normalizeDecadeList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry))
        .map((entry) => Math.floor(entry / 10) * 10)
        .filter((entry) => entry >= 1950 && entry <= 2030)
    )
  );
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getDecadeDashDb();
  const { data, error } = await db
    .from("dd_session_calls")
    .select(
      "id, call_index, round_number, artist, title, release_year, decade_start, accepted_adjacent_decades, source_label, host_notes, status, asked_at, revealed_at, scored_at"
    )
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as CallRow[]).map((row) => ({
    id: row.id,
    call_index: row.call_index,
    round_number: row.round_number,
    artist: row.artist,
    title: row.title,
    source_label: row.source_label,
    release_year: row.release_year,
    decade_start: row.decade_start,
    accepted_adjacent_decades: normalizeDecadeList(row.accepted_adjacent_decades),
    detail: [row.release_year ? `Year: ${row.release_year}` : null, row.decade_start ? `Decade: ${row.decade_start}s` : null]
      .filter(Boolean)
      .join(" | ") || null,
    host_notes: row.host_notes,
    status: row.status,
    asked_at: row.asked_at,
    revealed_at: row.revealed_at,
    scored_at: row.scored_at,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

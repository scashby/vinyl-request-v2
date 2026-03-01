import { NextRequest, NextResponse } from "next/server";
import { getArtistAliasDb } from "src/lib/artistAliasDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getArtistAliasDb();
  const { data, error } = await db
    .from("aa_session_calls")
    .select("call_index, round_number, artist_name, source_label, clue_era, clue_collaborator, clue_label_region, host_notes")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    call_index: row.call_index,
    round_number: row.round_number,
    artist: row.artist_name,
    title: "",
    source_label: row.source_label,
    detail: `Era: ${row.clue_era} | Collaborator: ${row.clue_collaborator} | Label/Region: ${row.clue_label_region}`,
    host_notes: row.host_notes,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

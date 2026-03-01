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
    .select(
      "id, session_id, round_number, call_index, source_label, artist_name, accepted_aliases, clue_era, clue_collaborator, clue_label_region, audio_clue_source, host_notes, status, stage_revealed, asked_at, revealed_at, scored_at, created_at"
    )
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    session_id: row.session_id,
    call_index: row.call_index,
    round_number: row.round_number,
    status: row.status,
    stage_revealed: row.stage_revealed,
    asked_at: row.asked_at,
    revealed_at: row.revealed_at,
    scored_at: row.scored_at,
    created_at: row.created_at,
    artist_name: row.artist_name,
    accepted_aliases: row.accepted_aliases ?? [],
    clue_era: row.clue_era,
    clue_collaborator: row.clue_collaborator,
    clue_label_region: row.clue_label_region,
    audio_clue_source: row.audio_clue_source,
    artist: row.artist_name,
    title: "",
    source_label: row.source_label,
    detail: `Era: ${row.clue_era} | Collaborator: ${row.clue_collaborator} | Label/Region: ${row.clue_label_region}`,
    host_notes: row.host_notes,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getBracketBattleDb();
  const { data, error } = await db
    .from("bb_session_entries")
    .select("seed, entry_label, artist, title, source_label")
    .eq("session_id", sessionId)
    .order("seed", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row) => ({
    call_index: row.seed,
    round_number: null,
    artist: row.artist,
    title: row.title ?? row.entry_label,
    source_label: row.source_label,
    detail: `Seed ${row.seed}: ${row.entry_label}`,
    host_notes: null,
  }));

  return NextResponse.json({ data: rows }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

type VoteBody = {
  tallies?: Array<{
    winner_entry_id: number;
    vote_count: number;
  }>;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchupId: string }> }
) {
  const { id, matchupId } = await params;
  const sessionId = Number(id);
  const parsedMatchupId = Number(matchupId);
  if (!Number.isFinite(sessionId) || !Number.isFinite(parsedMatchupId)) {
    return NextResponse.json({ error: "Invalid session or matchup id" }, { status: 400 });
  }

  const body = (await request.json()) as VoteBody;
  const tallies = Array.isArray(body.tallies) ? body.tallies : [];
  if (tallies.length === 0) {
    return NextResponse.json({ error: "tallies are required" }, { status: 400 });
  }

  const rows = tallies.map((tally) => ({
    session_id: sessionId,
    matchup_id: parsedMatchupId,
    winner_entry_id: Number(tally.winner_entry_id),
    vote_count: Math.max(0, Number(tally.vote_count ?? 0)),
    captured_at: new Date().toISOString(),
  }));

  if (rows.some((row) => !Number.isFinite(row.winner_entry_id))) {
    return NextResponse.json({ error: "Invalid winner_entry_id in tallies" }, { status: 400 });
  }

  const db = getBracketBattleDb();
  const { error } = await db
    .from("bb_matchup_vote_tallies")
    .upsert(rows, { onConflict: "matchup_id,winner_entry_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getDecadeDashDb } from "src/lib/decadeDashDb";

export const runtime = "nodejs";

type TeamRow = {
  id: number;
  team_name: string;
  table_label: string | null;
  active: boolean;
};

type ScoreRow = {
  team_id: number;
  call_id: number;
  awarded_points: number;
  exact_match: boolean;
  adjacent_match: boolean;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getDecadeDashDb();
  const [{ data: teams, error: teamsError }, { data: scores, error: scoresError }] = await Promise.all([
    db
      .from("dd_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("dd_team_scores")
      .select("team_id, call_id, awarded_points, exact_match, adjacent_match")
      .eq("session_id", sessionId),
  ]);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });

  const totals = new Map<number, { points: number; exactHits: number; adjacentHits: number; scoredCalls: Set<number> }>();
  for (const row of (scores ?? []) as ScoreRow[]) {
    const entry = totals.get(row.team_id) ?? {
      points: 0,
      exactHits: 0,
      adjacentHits: 0,
      scoredCalls: new Set<number>(),
    };

    entry.points += row.awarded_points ?? 0;
    if (row.exact_match) entry.exactHits += 1;
    if (row.adjacent_match) entry.adjacentHits += 1;
    entry.scoredCalls.add(row.call_id);
    totals.set(row.team_id, entry);
  }

  const leaderboard = ((teams ?? []) as TeamRow[])
    .filter((team) => team.active)
    .map((team) => {
      const total = totals.get(team.id);
      return {
        team_id: team.id,
        team_name: team.team_name,
        table_label: team.table_label,
        total_points: total?.points ?? 0,
        exact_hits: total?.exactHits ?? 0,
        adjacent_hits: total?.adjacentHits ?? 0,
        scored_calls: total?.scoredCalls.size ?? 0,
      };
    })
    .sort((a, b) => {
      const pointDelta = b.total_points - a.total_points;
      if (pointDelta !== 0) return pointDelta;
      const exactDelta = b.exact_hits - a.exact_hits;
      if (exactDelta !== 0) return exactDelta;
      const adjacentDelta = b.adjacent_hits - a.adjacent_hits;
      if (adjacentDelta !== 0) return adjacentDelta;
      return a.team_name.localeCompare(b.team_name);
    });

  return NextResponse.json({ data: leaderboard }, { status: 200 });
}

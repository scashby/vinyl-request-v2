import { NextRequest, NextResponse } from "next/server";
import { getLyricGapRelayDb } from "src/lib/lyricGapRelayDb";

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
  close_match: boolean;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getLyricGapRelayDb();

  const [{ data: teams, error: teamsError }, { data: scores, error: scoresError }] = await Promise.all([
    db
      .from("lgr_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("lgr_team_scores")
      .select("team_id, call_id, awarded_points, exact_match, close_match")
      .eq("session_id", sessionId),
  ]);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });

  const totals = new Map<number, {
    points: number;
    exactHits: number;
    closeHits: number;
    perfectCalls: number;
    scoredCalls: Set<number>;
  }>();

  for (const row of (scores ?? []) as ScoreRow[]) {
    const entry = totals.get(row.team_id) ?? {
      points: 0,
      exactHits: 0,
      closeHits: 0,
      perfectCalls: 0,
      scoredCalls: new Set<number>(),
    };

    entry.points += row.awarded_points ?? 0;
    if (row.exact_match) {
      entry.exactHits += 1;
      entry.perfectCalls += 1;
    }
    if (row.close_match) entry.closeHits += 1;
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
        close_hits: total?.closeHits ?? 0,
        perfect_calls: total?.perfectCalls ?? 0,
        scored_calls: total?.scoredCalls.size ?? 0,
      };
    })
    .sort((a, b) => {
      const pointsDelta = b.total_points - a.total_points;
      if (pointsDelta !== 0) return pointsDelta;
      const exactDelta = b.exact_hits - a.exact_hits;
      if (exactDelta !== 0) return exactDelta;
      const closeDelta = b.close_hits - a.close_hits;
      if (closeDelta !== 0) return closeDelta;
      return a.team_name.localeCompare(b.team_name);
    });

  return NextResponse.json({ data: leaderboard }, { status: 200 });
}

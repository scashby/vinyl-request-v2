import { NextRequest, NextResponse } from "next/server";
import { getOriginalOrCoverDb } from "src/lib/originalOrCoverDb";

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
  call_correct: boolean;
  artist_bonus_awarded: boolean;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getOriginalOrCoverDb();

  const [{ data: teams, error: teamsError }, { data: scores, error: scoresError }] = await Promise.all([
    db
      .from("ooc_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("ooc_team_scores")
      .select("team_id, call_id, awarded_points, call_correct, artist_bonus_awarded")
      .eq("session_id", sessionId),
  ]);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });

  const totals = new Map<
    number,
    {
      points: number;
      correctCalls: number;
      artistBonusHits: number;
      scoredCalls: Set<number>;
    }
  >();

  for (const row of (scores ?? []) as ScoreRow[]) {
    const entry = totals.get(row.team_id) ?? {
      points: 0,
      correctCalls: 0,
      artistBonusHits: 0,
      scoredCalls: new Set<number>(),
    };

    entry.points += row.awarded_points ?? 0;
    if (row.call_correct) entry.correctCalls += 1;
    if (row.artist_bonus_awarded) entry.artistBonusHits += 1;
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
        correct_calls: total?.correctCalls ?? 0,
        artist_bonus_hits: total?.artistBonusHits ?? 0,
        scored_calls: total?.scoredCalls.size ?? 0,
      };
    })
    .sort((a, b) => {
      const pointsDelta = b.total_points - a.total_points;
      if (pointsDelta !== 0) return pointsDelta;
      const correctDelta = b.correct_calls - a.correct_calls;
      if (correctDelta !== 0) return correctDelta;
      const bonusDelta = b.artist_bonus_hits - a.artist_bonus_hits;
      if (bonusDelta !== 0) return bonusDelta;
      return a.team_name.localeCompare(b.team_name);
    });

  return NextResponse.json({ data: leaderboard }, { status: 200 });
}

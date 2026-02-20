import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

export const runtime = "nodejs";

type TeamRow = { id: number; team_name: string; table_label: string | null; active: boolean };
type ScoreRow = { team_id: number; awarded_points: number; correct: boolean; call_id: number };

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getTriviaDb();

  const [{ data: teams, error: teamsError }, { data: scores, error: scoresError }] = await Promise.all([
    db
      .from("trivia_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("trivia_team_scores")
      .select("team_id, awarded_points, correct, call_id")
      .eq("session_id", sessionId),
  ]);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });

  const totals = new Map<number, { points: number; correct: number; scoredCalls: Set<number> }>();

  for (const row of (scores ?? []) as ScoreRow[]) {
    const entry = totals.get(row.team_id) ?? { points: 0, correct: 0, scoredCalls: new Set<number>() };
    entry.points += row.awarded_points ?? 0;
    if (row.correct) entry.correct += 1;
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
        correct_answers: total?.correct ?? 0,
        scored_calls: total?.scoredCalls.size ?? 0,
      };
    })
    .sort((a, b) => b.total_points - a.total_points || b.correct_answers - a.correct_answers || a.team_name.localeCompare(b.team_name));

  return NextResponse.json({ data: leaderboard }, { status: 200 });
}

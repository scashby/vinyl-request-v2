import { NextRequest, NextResponse } from "next/server";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

type TeamRow = {
  id: number;
  team_name: string;
  active: boolean;
};

type ScoreRow = {
  team_id: number;
  total_points: number;
  tie_break_points: number;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBracketBattleDb();
  const [{ data: teams, error: teamError }, { data: scores, error: scoreError }] = await Promise.all([
    db.from("bb_session_teams").select("id, team_name, active").eq("session_id", sessionId).eq("active", true),
    db.from("bb_team_scores").select("team_id, total_points, tie_break_points").eq("session_id", sessionId),
  ]);

  if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 });
  if (scoreError) return NextResponse.json({ error: scoreError.message }, { status: 500 });

  const typedTeams = (teams ?? []) as TeamRow[];
  const scoreByTeamId = new Map<number, ScoreRow>(((scores ?? []) as ScoreRow[]).map((score) => [score.team_id, score]));

  const data = typedTeams
    .map((team) => ({
      team_id: team.id,
      team_name: team.team_name,
      total_points: scoreByTeamId.get(team.id)?.total_points ?? 0,
      tie_break_points: scoreByTeamId.get(team.id)?.tie_break_points ?? 0,
    }))
    .sort((left, right) => {
      if (right.total_points !== left.total_points) return right.total_points - left.total_points;
      if (right.tie_break_points !== left.tie_break_points) return right.tie_break_points - left.tie_break_points;
      return left.team_name.localeCompare(right.team_name);
    });

  return NextResponse.json({ data }, { status: 200 });
}
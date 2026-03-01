import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";

export const runtime = "nodejs";

type TeamRow = {
  id: number;
  team_name: string;
  table_label: string | null;
  active: boolean;
};

type PickRow = {
  team_id: number;
  round_id: number;
  awarded_points: number;
  imposter_correct: boolean;
  reason_correct: boolean;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getGenreImposterDb();

  const [{ data: teams, error: teamsError }, { data: picks, error: picksError }] = await Promise.all([
    db
      .from("gi_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("gi_round_team_picks")
      .select("team_id, round_id, awarded_points, imposter_correct, reason_correct")
      .eq("session_id", sessionId),
  ]);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (picksError) return NextResponse.json({ error: picksError.message }, { status: 500 });

  const totals = new Map<number, { points: number; imposterHits: number; reasonBonusHits: number; roundsScored: Set<number> }>();

  for (const row of (picks ?? []) as PickRow[]) {
    const entry = totals.get(row.team_id) ?? {
      points: 0,
      imposterHits: 0,
      reasonBonusHits: 0,
      roundsScored: new Set<number>(),
    };

    entry.points += row.awarded_points ?? 0;
    if (row.imposter_correct) entry.imposterHits += 1;
    if (row.reason_correct) entry.reasonBonusHits += 1;
    entry.roundsScored.add(row.round_id);
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
        imposter_hits: total?.imposterHits ?? 0,
        reason_bonus_hits: total?.reasonBonusHits ?? 0,
        rounds_scored: total?.roundsScored.size ?? 0,
      };
    })
    .sort((a, b) => {
      const pointsDelta = b.total_points - a.total_points;
      if (pointsDelta !== 0) return pointsDelta;

      const imposterDelta = b.imposter_hits - a.imposter_hits;
      if (imposterDelta !== 0) return imposterDelta;

      const reasonDelta = b.reason_bonus_hits - a.reason_bonus_hits;
      if (reasonDelta !== 0) return reasonDelta;

      return a.team_name.localeCompare(b.team_name);
    });

  return NextResponse.json({ data: leaderboard }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getWrongLyricChallengeDb } from "src/lib/wrongLyricChallengeDb";

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
  lyric_correct: boolean;
  song_bonus_awarded: boolean;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getWrongLyricChallengeDb();

  const [{ data: teams, error: teamsError }, { data: scores, error: scoresError }] = await Promise.all([
    db
      .from("wlc_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("wlc_team_scores")
      .select("team_id, call_id, awarded_points, lyric_correct, song_bonus_awarded")
      .eq("session_id", sessionId),
  ]);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });

  const totals = new Map<number, {
    points: number;
    lyricHits: number;
    bonusHits: number;
    scoredCalls: Set<number>;
  }>();

  for (const row of (scores ?? []) as ScoreRow[]) {
    const entry = totals.get(row.team_id) ?? {
      points: 0,
      lyricHits: 0,
      bonusHits: 0,
      scoredCalls: new Set<number>(),
    };

    entry.points += row.awarded_points ?? 0;
    if (row.lyric_correct) entry.lyricHits += 1;
    if (row.song_bonus_awarded) entry.bonusHits += 1;
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
        lyric_hits: total?.lyricHits ?? 0,
        bonus_hits: total?.bonusHits ?? 0,
        scored_calls: total?.scoredCalls.size ?? 0,
      };
    })
    .sort((a, b) => {
      const pointsDelta = b.total_points - a.total_points;
      if (pointsDelta !== 0) return pointsDelta;
      const lyricDelta = b.lyric_hits - a.lyric_hits;
      if (lyricDelta !== 0) return lyricDelta;
      const bonusDelta = b.bonus_hits - a.bonus_hits;
      if (bonusDelta !== 0) return bonusDelta;
      return a.team_name.localeCompare(b.team_name);
    });

  return NextResponse.json({ data: leaderboard }, { status: 200 });
}

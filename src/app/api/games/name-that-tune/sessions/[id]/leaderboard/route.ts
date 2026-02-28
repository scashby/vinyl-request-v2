import { NextRequest, NextResponse } from "next/server";
import { getNameThatTuneDb } from "src/lib/nameThatTuneDb";

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
  artist_correct: boolean;
  title_correct: boolean;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getNameThatTuneDb();

  const [{ data: teams, error: teamsError }, { data: scores, error: scoresError }] = await Promise.all([
    db
      .from("ntt_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("ntt_team_scores")
      .select("team_id, call_id, awarded_points, artist_correct, title_correct")
      .eq("session_id", sessionId),
  ]);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });

  const totals = new Map<number, {
    points: number;
    artistHits: number;
    titleHits: number;
    perfectCalls: number;
    scoredCalls: Set<number>;
  }>();

  for (const row of (scores ?? []) as ScoreRow[]) {
    const entry = totals.get(row.team_id) ?? {
      points: 0,
      artistHits: 0,
      titleHits: 0,
      perfectCalls: 0,
      scoredCalls: new Set<number>(),
    };

    entry.points += row.awarded_points ?? 0;
    if (row.artist_correct) entry.artistHits += 1;
    if (row.title_correct) entry.titleHits += 1;
    if (row.artist_correct && row.title_correct) entry.perfectCalls += 1;
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
        artist_hits: total?.artistHits ?? 0,
        title_hits: total?.titleHits ?? 0,
        perfect_calls: total?.perfectCalls ?? 0,
        scored_calls: total?.scoredCalls.size ?? 0,
      };
    })
    .sort((a, b) => {
      const pointsDelta = b.total_points - a.total_points;
      if (pointsDelta !== 0) return pointsDelta;
      const perfectDelta = b.perfect_calls - a.perfect_calls;
      if (perfectDelta !== 0) return perfectDelta;
      const hitsDelta = (b.artist_hits + b.title_hits) - (a.artist_hits + a.title_hits);
      if (hitsDelta !== 0) return hitsDelta;
      return a.team_name.localeCompare(b.team_name);
    });

  return NextResponse.json({ data: leaderboard }, { status: 200 });
}

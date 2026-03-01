import { NextRequest, NextResponse } from "next/server";
import { getSampleDetectiveDb } from "src/lib/sampleDetectiveDb";

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
  pair_correct: boolean;
  both_artists_named: boolean;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getSampleDetectiveDb();

  const [{ data: teams, error: teamsError }, { data: scores, error: scoresError }] = await Promise.all([
    db
      .from("sd_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("sd_team_scores")
      .select("team_id, call_id, awarded_points, pair_correct, both_artists_named")
      .eq("session_id", sessionId),
  ]);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });

  const totals = new Map<
    number,
    { points: number; pairHits: number; bothArtistsHits: number; scoredCalls: Set<number> }
  >();

  for (const row of (scores ?? []) as ScoreRow[]) {
    const entry = totals.get(row.team_id) ?? {
      points: 0,
      pairHits: 0,
      bothArtistsHits: 0,
      scoredCalls: new Set<number>(),
    };

    entry.points += row.awarded_points ?? 0;
    if (row.pair_correct) entry.pairHits += 1;
    if (row.both_artists_named) entry.bothArtistsHits += 1;
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
        pair_hits: total?.pairHits ?? 0,
        both_artists_hits: total?.bothArtistsHits ?? 0,
        scored_calls: total?.scoredCalls.size ?? 0,
      };
    })
    .sort((a, b) => {
      const pointsDelta = b.total_points - a.total_points;
      if (pointsDelta !== 0) return pointsDelta;
      const pairDelta = b.pair_hits - a.pair_hits;
      if (pairDelta !== 0) return pairDelta;
      const artistDelta = b.both_artists_hits - a.both_artists_hits;
      if (artistDelta !== 0) return artistDelta;
      return a.team_name.localeCompare(b.team_name);
    });

  return NextResponse.json({ data: leaderboard }, { status: 200 });
}

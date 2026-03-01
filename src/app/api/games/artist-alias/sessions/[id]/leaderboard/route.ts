import { NextRequest, NextResponse } from "next/server";
import { getArtistAliasDb } from "src/lib/artistAliasDb";

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
  guessed_at_stage: number | null;
  used_audio_clue: boolean;
  exact_match: boolean;
  awarded_points: number;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getArtistAliasDb();

  const [{ data: teams, error: teamsError }, { data: scores, error: scoresError }] = await Promise.all([
    db
      .from("aa_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("aa_team_scores")
      .select("team_id, call_id, guessed_at_stage, used_audio_clue, exact_match, awarded_points")
      .eq("session_id", sessionId),
  ]);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });

  const totals = new Map<
    number,
    {
      points: number;
      exactHits: number;
      stage1Hits: number;
      stage2Hits: number;
      stage3Hits: number;
      audioClueUses: number;
      scoredCalls: Set<number>;
    }
  >();

  for (const row of (scores ?? []) as ScoreRow[]) {
    const entry = totals.get(row.team_id) ?? {
      points: 0,
      exactHits: 0,
      stage1Hits: 0,
      stage2Hits: 0,
      stage3Hits: 0,
      audioClueUses: 0,
      scoredCalls: new Set<number>(),
    };

    entry.points += row.awarded_points ?? 0;
    if (row.exact_match) entry.exactHits += 1;
    if (row.guessed_at_stage === 1) entry.stage1Hits += 1;
    if (row.guessed_at_stage === 2) entry.stage2Hits += 1;
    if (row.guessed_at_stage === 3) entry.stage3Hits += 1;
    if (row.used_audio_clue) entry.audioClueUses += 1;
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
        stage_1_hits: total?.stage1Hits ?? 0,
        stage_2_hits: total?.stage2Hits ?? 0,
        stage_3_hits: total?.stage3Hits ?? 0,
        audio_clue_uses: total?.audioClueUses ?? 0,
        scored_calls: total?.scoredCalls.size ?? 0,
      };
    })
    .sort((a, b) => {
      const pointsDelta = b.total_points - a.total_points;
      if (pointsDelta !== 0) return pointsDelta;
      const exactDelta = b.exact_hits - a.exact_hits;
      if (exactDelta !== 0) return exactDelta;
      const earlyDelta = b.stage_1_hits - a.stage_1_hits;
      if (earlyDelta !== 0) return earlyDelta;
      return a.team_name.localeCompare(b.team_name);
    });

  return NextResponse.json({ data: leaderboard }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

type MatchupRow = {
  id: number;
  session_id: number;
  round_number: number;
  matchup_index: number;
  status: "pending" | "active" | "voting_locked" | "scored" | "skipped";
  higher_seed_entry_id: number | null;
  lower_seed_entry_id: number | null;
};

type SessionRow = {
  id: number;
  scoring_model: "round_weighted" | "flat_per_hit";
};

type PickRow = {
  team_id: number;
  picked_entry_id: number;
};

type ScoreAggregate = {
  team_id: number;
  total_points: number;
  tie_break_points: number;
};

type Body = {
  action?: "open" | "lock" | "resolve" | "skip";
  winner_entry_id?: number | null;
  notes?: string | null;
};

function pointsForRound(scoringModel: SessionRow["scoring_model"], roundNumber: number): number {
  if (scoringModel === "flat_per_hit") return 1;
  return Math.max(1, Math.pow(2, roundNumber - 1));
}

async function refreshTeamScores(db: ReturnType<typeof getBracketBattleDb>, sessionId: number) {
  const { data: picks, error: picksError } = await db
    .from("bb_bracket_picks")
    .select("team_id, points_awarded")
    .eq("session_id", sessionId);

  if (picksError) throw new Error(picksError.message);

  const byTeam = new Map<number, ScoreAggregate>();
  for (const row of (picks ?? []) as Array<{ team_id: number; points_awarded: number }>) {
    const current = byTeam.get(row.team_id) ?? { team_id: row.team_id, total_points: 0, tie_break_points: 0 };
    current.total_points += Number(row.points_awarded ?? 0);
    byTeam.set(row.team_id, current);
  }

  const { data: teams, error: teamError } = await db
    .from("bb_session_teams")
    .select("id")
    .eq("session_id", sessionId)
    .eq("active", true);
  if (teamError) throw new Error(teamError.message);

  const rows = ((teams ?? []) as Array<{ id: number }>).map((team) => {
    const totals = byTeam.get(team.id) ?? { team_id: team.id, total_points: 0, tie_break_points: 0 };
    return {
      session_id: sessionId,
      team_id: team.id,
      total_points: totals.total_points,
      tie_break_points: totals.tie_break_points,
      updated_at: new Date().toISOString(),
    };
  });

  if (rows.length > 0) {
    const { error: scoreError } = await db.from("bb_team_scores").upsert(rows, { onConflict: "session_id,team_id" });
    if (scoreError) throw new Error(scoreError.message);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchupId: string }> }
) {
  const { id, matchupId } = await params;
  const sessionId = Number(id);
  const parsedMatchupId = Number(matchupId);
  if (!Number.isFinite(sessionId) || !Number.isFinite(parsedMatchupId)) {
    return NextResponse.json({ error: "Invalid session or matchup id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const action = body.action ?? "open";

  const db = getBracketBattleDb();
  const [{ data: matchup, error: matchupError }, { data: session, error: sessionError }] = await Promise.all([
    db
      .from("bb_session_matchups")
      .select("id, session_id, round_number, matchup_index, status, higher_seed_entry_id, lower_seed_entry_id")
      .eq("id", parsedMatchupId)
      .eq("session_id", sessionId)
      .maybeSingle(),
    db.from("bb_sessions").select("id, scoring_model").eq("id", sessionId).maybeSingle(),
  ]);

  if (matchupError) return NextResponse.json({ error: matchupError.message }, { status: 500 });
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!matchup) return NextResponse.json({ error: "Matchup not found" }, { status: 404 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedMatchup = matchup as MatchupRow;
  const typedSession = session as SessionRow;
  const now = new Date().toISOString();

  if (action === "open") {
    const { error } = await db
      .from("bb_session_matchups")
      .update({ status: "active", opened_at: now, notes: body.notes ?? null })
      .eq("id", parsedMatchupId)
      .eq("session_id", sessionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await db
      .from("bb_sessions")
      .update({ status: "running", current_round: typedMatchup.round_number, current_matchup_index: typedMatchup.matchup_index })
      .eq("id", sessionId);

    return NextResponse.json({ ok: true, action }, { status: 200 });
  }

  if (action === "lock") {
    const { error } = await db
      .from("bb_session_matchups")
      .update({ status: "voting_locked", voting_locked_at: now, notes: body.notes ?? null })
      .eq("id", parsedMatchupId)
      .eq("session_id", sessionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action }, { status: 200 });
  }

  if (action === "skip") {
    const { error } = await db
      .from("bb_session_matchups")
      .update({ status: "skipped", notes: body.notes ?? null })
      .eq("id", parsedMatchupId)
      .eq("session_id", sessionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action }, { status: 200 });
  }

  if (action === "resolve") {
    const winnerEntryId = Number(body.winner_entry_id);
    if (!Number.isFinite(winnerEntryId)) {
      return NextResponse.json({ error: "winner_entry_id is required for resolve" }, { status: 400 });
    }
    if (winnerEntryId !== typedMatchup.higher_seed_entry_id && winnerEntryId !== typedMatchup.lower_seed_entry_id) {
      return NextResponse.json({ error: "winner_entry_id must match one of the matchup entries" }, { status: 400 });
    }

    const { error: matchupUpdateError } = await db
      .from("bb_session_matchups")
      .update({
        winner_entry_id: winnerEntryId,
        status: "scored",
        winner_confirmed_at: now,
        notes: body.notes ?? null,
      })
      .eq("id", parsedMatchupId)
      .eq("session_id", sessionId);
    if (matchupUpdateError) return NextResponse.json({ error: matchupUpdateError.message }, { status: 500 });

    const { data: picks, error: picksError } = await db
      .from("bb_bracket_picks")
      .select("team_id, picked_entry_id")
      .eq("session_id", sessionId)
      .eq("matchup_id", parsedMatchupId);
    if (picksError) return NextResponse.json({ error: picksError.message }, { status: 500 });

    const matchupPoints = pointsForRound(typedSession.scoring_model, typedMatchup.round_number);
    const scoredPicks = ((picks ?? []) as PickRow[]).map((pick) => ({
      session_id: sessionId,
      team_id: pick.team_id,
      matchup_id: parsedMatchupId,
      picked_entry_id: pick.picked_entry_id,
      is_correct: pick.picked_entry_id === winnerEntryId,
      points_awarded: pick.picked_entry_id === winnerEntryId ? matchupPoints : 0,
      resolved_at: now,
    }));

    if (scoredPicks.length > 0) {
      const { error: pickUpdateError } = await db.from("bb_bracket_picks").upsert(scoredPicks, { onConflict: "team_id,matchup_id" });
      if (pickUpdateError) return NextResponse.json({ error: pickUpdateError.message }, { status: 500 });
    }

    try {
      await refreshTeamScores(db, sessionId);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to refresh team scores" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, action, winner_entry_id: winnerEntryId }, { status: 200 });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

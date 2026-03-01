import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";
import { normalizeReasonMatch } from "src/lib/genreImposterEngine";

export const runtime = "nodejs";

type ScoreBody = {
  round_number?: number;
  awards?: Array<{
    team_id: number;
    reason_correct?: boolean;
    reason_text?: string | null;
  }>;
  scored_by?: string;
};

type SessionRow = {
  id: number;
  round_count: number;
  reason_mode: "host_judged" | "strict_key";
  imposter_points: number;
  reason_bonus_points: number;
};

type RoundRow = {
  id: number;
  round_number: number;
  reason_key: string | null;
};

type PickRow = {
  id: number;
  team_id: number;
  picked_call_id: number;
  reason_text: string | null;
};

type ScoreAggregateRow = {
  team_id: number;
  awarded_points: number;
  imposter_correct: boolean;
  reason_correct: boolean;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as ScoreBody;
  const roundNumber = Number(body.round_number);
  if (!Number.isFinite(roundNumber) || roundNumber <= 0) {
    return NextResponse.json({ error: "round_number is required" }, { status: 400 });
  }

  const db = getGenreImposterDb();

  const { data: session, error: sessionError } = await db
    .from("gi_sessions")
    .select("id, round_count, reason_mode, imposter_points, reason_bonus_points")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;

  const { data: round, error: roundError } = await db
    .from("gi_session_rounds")
    .select("id, round_number, reason_key")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 });
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const typedRound = round as RoundRow;

  const [{ data: imposterCall, error: imposterError }, { data: picks, error: picksError }] = await Promise.all([
    db
      .from("gi_session_calls")
      .select("id")
      .eq("session_id", sessionId)
      .eq("round_number", roundNumber)
      .eq("is_imposter", true)
      .maybeSingle(),
    db
      .from("gi_round_team_picks")
      .select("id, team_id, picked_call_id, reason_text")
      .eq("session_id", sessionId)
      .eq("round_id", typedRound.id),
  ]);

  if (imposterError) return NextResponse.json({ error: imposterError.message }, { status: 500 });
  if (!imposterCall) return NextResponse.json({ error: "Imposter call not found for this round" }, { status: 409 });

  if (picksError) return NextResponse.json({ error: picksError.message }, { status: 500 });

  const roundPicks = (picks ?? []) as PickRow[];
  if (roundPicks.length === 0) {
    return NextResponse.json({ error: "No picks logged for this round" }, { status: 409 });
  }

  const awardsByTeam = new Map<number, { reason_correct?: boolean; reason_text?: string | null }>(
    (Array.isArray(body.awards) ? body.awards : []).map((award) => [
      Number(award.team_id),
      {
        reason_correct: typeof award.reason_correct === "boolean" ? award.reason_correct : undefined,
        reason_text: award.reason_text ?? null,
      },
    ])
  );

  const imposterCallId = Number(imposterCall.id);
  const now = new Date().toISOString();

  const pickUpdates = roundPicks.map((pick) => {
    const award = awardsByTeam.get(pick.team_id);
    const reasonText = typeof award?.reason_text === "string" ? award.reason_text : pick.reason_text;
    const imposterCorrect = pick.picked_call_id === imposterCallId;

    const reasonCorrect =
      imposterCorrect &&
      normalizeReasonMatch({
        reasonMode: typedSession.reason_mode,
        reasonText,
        reasonKey: typedRound.reason_key,
        explicitReasonCorrect: award?.reason_correct,
      });

    const points = (imposterCorrect ? typedSession.imposter_points : 0) + (reasonCorrect ? typedSession.reason_bonus_points : 0);

    return {
      id: pick.id,
      team_id: pick.team_id,
      reason_text: reasonText ?? null,
      imposter_correct: imposterCorrect,
      reason_correct: reasonCorrect,
      awarded_points: points,
      resolved_at: now,
      scored_by: body.scored_by ?? "host",
    };
  });

  for (const update of pickUpdates) {
    const { error: pickUpdateError } = await db
      .from("gi_round_team_picks")
      .update({
        reason_text: update.reason_text,
        imposter_correct: update.imposter_correct,
        reason_correct: update.reason_correct,
        awarded_points: update.awarded_points,
        resolved_at: update.resolved_at,
        scored_by: update.scored_by,
      })
      .eq("id", update.id);

    if (pickUpdateError) return NextResponse.json({ error: pickUpdateError.message }, { status: 500 });
  }

  await db
    .from("gi_session_calls")
    .update({ status: "scored", revealed_at: now })
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber);

  await db
    .from("gi_session_rounds")
    .update({ status: "closed", closed_at: now })
    .eq("id", typedRound.id);

  const { data: allScores, error: allScoresError } = await db
    .from("gi_round_team_picks")
    .select("team_id, awarded_points, imposter_correct, reason_correct")
    .eq("session_id", sessionId)
    .not("resolved_at", "is", null);

  if (allScoresError) return NextResponse.json({ error: allScoresError.message }, { status: 500 });

  const aggregateByTeam = new Map<number, { total_points: number; imposter_hits: number; reason_bonus_hits: number }>();

  for (const row of (allScores ?? []) as ScoreAggregateRow[]) {
    const aggregate = aggregateByTeam.get(row.team_id) ?? {
      total_points: 0,
      imposter_hits: 0,
      reason_bonus_hits: 0,
    };

    aggregate.total_points += row.awarded_points ?? 0;
    if (row.imposter_correct) aggregate.imposter_hits += 1;
    if (row.reason_correct) aggregate.reason_bonus_hits += 1;

    aggregateByTeam.set(row.team_id, aggregate);
  }

  await db.from("gi_team_scores").delete().eq("session_id", sessionId);

  if (aggregateByTeam.size > 0) {
    const scoreRows = Array.from(aggregateByTeam.entries()).map(([teamId, aggregate]) => ({
      session_id: sessionId,
      team_id: teamId,
      total_points: aggregate.total_points,
      imposter_hits: aggregate.imposter_hits,
      reason_bonus_hits: aggregate.reason_bonus_hits,
      updated_at: now,
    }));

    const { error: scoresInsertError } = await db.from("gi_team_scores").insert(scoreRows);
    if (scoresInsertError) return NextResponse.json({ error: scoresInsertError.message }, { status: 500 });
  }

  const sessionPatch: Record<string, unknown> = {
    current_round: roundNumber,
    current_call_index: 3,
    countdown_started_at: now,
    paused_at: null,
    paused_remaining_seconds: null,
  };

  if (roundNumber >= typedSession.round_count) {
    sessionPatch.status = "completed";
    sessionPatch.ended_at = now;
  } else {
    sessionPatch.status = "running";
    sessionPatch.ended_at = null;
  }

  const { error: sessionUpdateError } = await db.from("gi_sessions").update(sessionPatch).eq("id", sessionId);
  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, scored_picks: pickUpdates.length }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getCrateCategoriesDb } from "src/lib/crateCategoriesDb";

type ScoreBody = {
  round_id?: number;
  awards?: Array<{
    team_id: number;
    awarded_points?: number;
    guess_summary?: string;
    rationale?: string;
    notes?: string;
  }>;
  scored_by?: string;
};

type RoundRow = {
  id: number;
  session_id: number;
  round_number: number;
  points_correct: number;
};

export const runtime = "nodejs";

function clampAwardedPoints(points: number): number {
  return Math.max(0, Math.min(5, points));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as ScoreBody;
  const roundId = Number(body.round_id);
  if (!Number.isFinite(roundId)) return NextResponse.json({ error: "round_id is required" }, { status: 400 });

  const awards = Array.isArray(body.awards) ? body.awards : [];
  if (awards.length === 0) return NextResponse.json({ error: "awards are required" }, { status: 400 });

  const db = getCrateCategoriesDb();
  const { data: round, error: roundError } = await db
    .from("ccat_session_rounds")
    .select("id, session_id, round_number, points_correct")
    .eq("id", roundId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 });
  if (!round) return NextResponse.json({ error: "Round not found for session" }, { status: 404 });

  const typedRound = round as RoundRow;
  const now = new Date().toISOString();

  const rows = awards.map((award) => {
    const parsedPoints = Number(award.awarded_points);

    return {
      session_id: sessionId,
      round_id: typedRound.id,
      team_id: Number(award.team_id),
      awarded_points: Number.isFinite(parsedPoints)
        ? clampAwardedPoints(parsedPoints)
        : clampAwardedPoints(typedRound.points_correct),
      guess_summary: award.guess_summary?.trim() || null,
      rationale: award.rationale?.trim() || null,
      scored_by: body.scored_by ?? "host",
      notes: award.notes?.trim() || null,
      scored_at: now,
    };
  });

  if (rows.some((row) => !Number.isFinite(row.team_id))) {
    return NextResponse.json({ error: "Invalid team_id in awards" }, { status: 400 });
  }

  const { error: upsertError } = await db
    .from("ccat_round_scores")
    .upsert(rows, { onConflict: "session_id,round_id,team_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { error: roundUpdateError } = await db
    .from("ccat_session_rounds")
    .update({
      status: "closed",
      closed_at: now,
    })
    .eq("id", typedRound.id)
    .eq("session_id", sessionId);

  if (roundUpdateError) return NextResponse.json({ error: roundUpdateError.message }, { status: 500 });

  const { error: callUpdateError } = await db
    .from("ccat_session_calls")
    .update({
      status: "scored",
      scored_at: now,
    })
    .eq("session_id", sessionId)
    .eq("round_number", typedRound.round_number)
    .neq("status", "skipped");

  if (callUpdateError) return NextResponse.json({ error: callUpdateError.message }, { status: 500 });

  const { data: remainingRounds, error: remainingError } = await db
    .from("ccat_session_rounds")
    .select("id")
    .eq("session_id", sessionId)
    .neq("status", "closed")
    .limit(1);

  if (remainingError) return NextResponse.json({ error: remainingError.message }, { status: 500 });

  if ((remainingRounds ?? []).length === 0) {
    const { error: sessionUpdateError } = await db
      .from("ccat_sessions")
      .update({
        status: "completed",
        ended_at: now,
      })
      .eq("id", sessionId);

    if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

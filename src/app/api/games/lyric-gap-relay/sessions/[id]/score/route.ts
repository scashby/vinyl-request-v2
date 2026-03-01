import { NextRequest, NextResponse } from "next/server";
import { getLyricGapRelayDb } from "src/lib/lyricGapRelayDb";

export const runtime = "nodejs";

type ScoreBody = {
  call_id?: number;
  awards?: Array<{
    team_id: number;
    exact_match?: boolean;
    close_match?: boolean;
    awarded_points?: number;
    notes?: string;
  }>;
  scored_by?: string;
};

type CallRow = {
  id: number;
  session_id: number;
  round_number: number;
};

function getDefaultAwardedPoints(exactMatch: boolean, closeMatch: boolean): number {
  if (exactMatch) return 2;
  if (closeMatch) return 1;
  return 0;
}

function clampAwardedPoints(points: number): number {
  return Math.max(0, Math.min(2, points));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as ScoreBody;
  const callId = Number(body.call_id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "call_id is required" }, { status: 400 });

  const awards = Array.isArray(body.awards) ? body.awards : [];
  if (awards.length === 0) return NextResponse.json({ error: "awards are required" }, { status: 400 });

  const db = getLyricGapRelayDb();
  const { data: call, error: callError } = await db
    .from("lgr_session_calls")
    .select("id, session_id, round_number")
    .eq("id", callId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });

  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  const rows = awards.map((award) => {
    const exactMatch = Boolean(award.exact_match);
    const closeMatch = exactMatch ? false : Boolean(award.close_match);
    const defaultPoints = getDefaultAwardedPoints(exactMatch, closeMatch);
    const providedPoints = Number(award.awarded_points);

    return {
      session_id: sessionId,
      team_id: Number(award.team_id),
      call_id: callId,
      exact_match: exactMatch,
      close_match: closeMatch,
      awarded_points: Number.isFinite(providedPoints)
        ? clampAwardedPoints(providedPoints)
        : defaultPoints,
      scored_by: body.scored_by ?? "host",
      notes: award.notes ?? null,
      scored_at: now,
    };
  });

  if (rows.some((row) => !Number.isFinite(row.team_id))) {
    return NextResponse.json({ error: "Invalid team_id in awards" }, { status: 400 });
  }

  const { error: upsertError } = await db
    .from("lgr_team_scores")
    .upsert(rows, { onConflict: "session_id,team_id,call_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const [{ error: callUpdateError }, { error: roundCloseError }] = await Promise.all([
    db
      .from("lgr_session_calls")
      .update({
        status: "scored",
        scored_at: now,
        answer_revealed_at: now,
      })
      .eq("id", typedCall.id)
      .eq("session_id", sessionId),
    db
      .from("lgr_session_rounds")
      .update({ status: "closed", closed_at: now })
      .eq("session_id", sessionId)
      .eq("round_number", typedCall.round_number)
      .in("status", ["pending", "active"]),
  ]);

  if (callUpdateError) return NextResponse.json({ error: callUpdateError.message }, { status: 500 });
  if (roundCloseError) return NextResponse.json({ error: roundCloseError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

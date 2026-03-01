import { NextRequest, NextResponse } from "next/server";
import { getBackToBackConnectionDb } from "src/lib/backToBackConnectionDb";

export const runtime = "nodejs";

type ScoreBody = {
  call_id?: number;
  awards?: Array<{
    team_id: number;
    guessed_connection?: string;
    guessed_detail?: string;
    connection_correct?: boolean;
    detail_correct?: boolean;
    awarded_points?: number;
    notes?: string;
  }>;
  scored_by?: string;
};

type CallRow = {
  id: number;
  session_id: number;
};

type SessionPointsRow = {
  connection_points: number;
  detail_bonus_points: number;
};

function clampAwardedPoints(points: number, maxPoints: number): number {
  return Math.max(0, Math.min(maxPoints, points));
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

  const db = getBackToBackConnectionDb();
  const [{ data: call, error: callError }, { data: sessionPoints, error: sessionError }] = await Promise.all([
    db.from("b2bc_session_calls").select("id, session_id").eq("id", callId).eq("session_id", sessionId).maybeSingle(),
    db.from("b2bc_sessions").select("connection_points, detail_bonus_points").eq("id", sessionId).maybeSingle(),
  ]);

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!sessionPoints) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedCall = call as CallRow;
  const typedSessionPoints = sessionPoints as SessionPointsRow;
  const maxPoints = typedSessionPoints.connection_points + typedSessionPoints.detail_bonus_points;
  const now = new Date().toISOString();

  const rows = awards.map((award) => {
    const connectionCorrect = Boolean(award.connection_correct);
    const detailCorrect = Boolean(award.detail_correct);
    const defaultPoints =
      (connectionCorrect ? typedSessionPoints.connection_points : 0) +
      (detailCorrect ? typedSessionPoints.detail_bonus_points : 0);
    const providedPoints = Number(award.awarded_points);

    return {
      session_id: sessionId,
      team_id: Number(award.team_id),
      call_id: callId,
      guessed_connection: award.guessed_connection?.trim() || null,
      guessed_detail: award.guessed_detail?.trim() || null,
      connection_correct: connectionCorrect,
      detail_correct: detailCorrect,
      awarded_points: Number.isFinite(providedPoints)
        ? clampAwardedPoints(providedPoints, maxPoints)
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
    .from("b2bc_team_scores")
    .upsert(rows, { onConflict: "session_id,team_id,call_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { error: callUpdateError } = await db
    .from("b2bc_session_calls")
    .update({
      status: "scored",
      revealed_at: now,
      scored_at: now,
    })
    .eq("id", typedCall.id)
    .eq("session_id", sessionId);

  if (callUpdateError) return NextResponse.json({ error: callUpdateError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

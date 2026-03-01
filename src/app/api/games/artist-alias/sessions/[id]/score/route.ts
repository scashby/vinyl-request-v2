import { NextRequest, NextResponse } from "next/server";
import { getArtistAliasDb } from "src/lib/artistAliasDb";

export const runtime = "nodejs";

type ScoreBody = {
  call_id?: number;
  awards?: Array<{
    team_id: number;
    guessed_artist?: string;
    guessed_at_stage?: number;
    used_audio_clue?: boolean;
    exact_match?: boolean;
    awarded_points?: number;
    notes?: string;
  }>;
  scored_by?: string;
};

type CallRow = {
  id: number;
  session_id: number;
  stage_revealed: number;
};

type SessionRow = {
  id: number;
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
};

function clampAwardedPoints(points: number): number {
  return Math.max(0, Math.min(5, Math.trunc(points)));
}

function normalizeStage(stage: unknown): number | null {
  const value = Number(stage);
  if (!Number.isFinite(value)) return null;
  const normalized = Math.trunc(value);
  if (normalized < 1 || normalized > 3) return null;
  return normalized;
}

function defaultPointsForStage(session: SessionRow, stage: number | null, exactMatch: boolean): number {
  if (!exactMatch || !stage) return 0;
  if (stage === 1) return session.stage_one_points;
  if (stage === 2) return session.stage_two_points;
  return session.final_reveal_points;
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

  const db = getArtistAliasDb();

  const [{ data: session, error: sessionError }, { data: call, error: callError }] = await Promise.all([
    db
      .from("aa_sessions")
      .select("id, stage_one_points, stage_two_points, final_reveal_points")
      .eq("id", sessionId)
      .maybeSingle(),
    db
      .from("aa_session_calls")
      .select("id, session_id, stage_revealed")
      .eq("id", callId)
      .eq("session_id", sessionId)
      .maybeSingle(),
  ]);

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });

  const typedSession = session as SessionRow;
  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  let maxAwardStage = 0;
  const rows = awards.map((award) => {
    const teamId = Number(award.team_id);
    const guessedAtStage = normalizeStage(award.guessed_at_stage);
    const exactMatch = Boolean(award.exact_match);

    const parsedPoints = Number(award.awarded_points);
    const defaultPoints = defaultPointsForStage(typedSession, guessedAtStage, exactMatch);
    const awardedPoints = Number.isFinite(parsedPoints) ? clampAwardedPoints(parsedPoints) : defaultPoints;

    if (guessedAtStage && guessedAtStage > maxAwardStage) maxAwardStage = guessedAtStage;

    return {
      session_id: sessionId,
      team_id: teamId,
      call_id: callId,
      guessed_artist: award.guessed_artist?.trim() || null,
      guessed_at_stage: guessedAtStage,
      used_audio_clue: Boolean(award.used_audio_clue),
      exact_match: exactMatch,
      awarded_points: awardedPoints,
      scored_by: body.scored_by ?? "host",
      notes: award.notes?.trim() || null,
      scored_at: now,
    };
  });

  if (rows.some((row) => !Number.isFinite(row.team_id))) {
    return NextResponse.json({ error: "Invalid team_id in awards" }, { status: 400 });
  }

  const { error: upsertError } = await db
    .from("aa_team_scores")
    .upsert(rows, { onConflict: "session_id,team_id,call_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { error: callUpdateError } = await db
    .from("aa_session_calls")
    .update({
      status: "scored",
      stage_revealed: Math.max(typedCall.stage_revealed ?? 0, maxAwardStage),
      scored_at: now,
    })
    .eq("id", typedCall.id)
    .eq("session_id", sessionId);

  if (callUpdateError) return NextResponse.json({ error: callUpdateError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

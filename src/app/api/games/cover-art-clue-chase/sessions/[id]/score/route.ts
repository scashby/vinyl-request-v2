import { NextRequest, NextResponse } from "next/server";
import { getCoverArtClueChaseDb } from "src/lib/coverArtClueChaseDb";

type ScoreBody = {
  call_id?: number;
  awards?: Array<{
    team_id: number;
    guessed_artist?: string;
    guessed_title?: string;
    guessed_at_stage?: number;
    used_audio_clue?: boolean;
    exact_match?: boolean;
    awarded_points?: number;
    notes?: string;
  }>;
  scored_by?: string;
};

type SessionRow = {
  id: number;
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
  stage_revealed: number;
};

type TeamRow = {
  id: number;
  session_id: number;
};

function clampStage(stage: number | undefined, fallback: number): number {
  const value = Number(stage);
  if (!Number.isFinite(value)) return Math.max(1, Math.min(3, fallback));
  return Math.max(1, Math.min(3, value));
}

function clampPoints(points: number): number {
  return Math.max(0, Math.min(5, points));
}

function getDefaultPoints(session: SessionRow, exactMatch: boolean, stage: number): number {
  if (!exactMatch) return 0;
  if (stage <= 1) return session.stage_one_points;
  if (stage === 2) return session.stage_two_points;
  return session.final_reveal_points;
}

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as ScoreBody;
  const callId = Number(body.call_id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "call_id is required" }, { status: 400 });

  const awards = Array.isArray(body.awards) ? body.awards : [];
  if (awards.length === 0) return NextResponse.json({ error: "awards are required" }, { status: 400 });

  const db = getCoverArtClueChaseDb();

  const { data: session, error: sessionError } = await db
    .from("cacc_sessions")
    .select("id, stage_one_points, stage_two_points, final_reveal_points")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: call, error: callError } = await db
    .from("cacc_session_calls")
    .select("id, session_id, call_index, stage_revealed")
    .eq("id", callId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });

  const teamIds = Array.from(new Set(awards.map((award) => Number(award.team_id))));
  if (teamIds.some((teamId) => !Number.isFinite(teamId))) {
    return NextResponse.json({ error: "Invalid team_id in awards" }, { status: 400 });
  }

  const { data: teams, error: teamsError } = await db
    .from("cacc_session_teams")
    .select("id, session_id")
    .eq("session_id", sessionId)
    .in("id", teamIds);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });

  const validTeamIds = new Set((teams ?? []).map((team) => (team as TeamRow).id));
  if (teamIds.some((teamId) => !validTeamIds.has(teamId))) {
    return NextResponse.json({ error: "One or more awards refer to teams outside this session" }, { status: 400 });
  }

  const typedSession = session as SessionRow;
  const typedCall = call as CallRow;
  const now = new Date().toISOString();
  const fallbackStage = Math.max(1, typedCall.stage_revealed || 3);

  const rows = awards.map((award) => {
    const exactMatch = Boolean(award.exact_match);
    const guessedAtStage = clampStage(award.guessed_at_stage, fallbackStage);
    const defaultPoints = getDefaultPoints(typedSession, exactMatch, guessedAtStage);
    const providedPoints = Number(award.awarded_points);

    return {
      session_id: sessionId,
      team_id: Number(award.team_id),
      call_id: callId,
      guessed_artist: award.guessed_artist?.trim() || null,
      guessed_title: award.guessed_title?.trim() || null,
      guessed_at_stage: guessedAtStage,
      used_audio_clue: Boolean(award.used_audio_clue),
      exact_match: exactMatch,
      awarded_points: Number.isFinite(providedPoints) ? clampPoints(providedPoints) : defaultPoints,
      scored_by: body.scored_by ?? "host",
      notes: award.notes?.trim() || null,
      scored_at: now,
    };
  });

  const { error: upsertError } = await db
    .from("cacc_team_scores")
    .upsert(rows, { onConflict: "session_id,team_id,call_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { error: callUpdateError } = await db
    .from("cacc_session_calls")
    .update({
      status: "scored",
      scored_at: now,
    })
    .eq("id", typedCall.id)
    .eq("session_id", sessionId);

  if (callUpdateError) return NextResponse.json({ error: callUpdateError.message }, { status: 500 });

  await db.from("cacc_session_events").insert({
    session_id: sessionId,
    event_type: "call_scored",
    payload: {
      call_id: typedCall.id,
      call_index: typedCall.call_index,
      awards_count: rows.length,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

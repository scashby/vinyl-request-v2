import { NextRequest, NextResponse } from "next/server";
import { getWrongLyricChallengeDb } from "src/lib/wrongLyricChallengeDb";

export const runtime = "nodejs";

type ScoreBody = {
  call_id?: number;
  awards?: Array<{
    team_id: number;
    guessed_option?: number;
    guessed_artist?: string;
    guessed_title?: string;
    lyric_correct?: boolean;
    song_bonus_awarded?: boolean;
    awarded_points?: number;
    notes?: string;
  }>;
  scored_by?: string;
};

type CallRow = {
  id: number;
  session_id: number;
};

type SessionRuleRow = {
  id: number;
  lyric_points: number;
  song_bonus_enabled: boolean;
  song_bonus_points: number;
};

function clampAwardedPoints(points: number): number {
  return Math.max(0, Math.min(5, points));
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

  const db = getWrongLyricChallengeDb();
  const [{ data: call, error: callError }, { data: sessionRules, error: sessionError }] = await Promise.all([
    db
      .from("wlc_session_calls")
      .select("id, session_id")
      .eq("id", callId)
      .eq("session_id", sessionId)
      .maybeSingle(),
    db
      .from("wlc_sessions")
      .select("id, lyric_points, song_bonus_enabled, song_bonus_points")
      .eq("id", sessionId)
      .maybeSingle(),
  ]);

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!sessionRules) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedCall = call as CallRow;
  const typedRules = sessionRules as SessionRuleRow;
  const now = new Date().toISOString();

  const rows = awards.map((award) => {
    const lyricCorrect = Boolean(award.lyric_correct);
    const bonusEligible = Boolean(award.song_bonus_awarded) && typedRules.song_bonus_enabled && lyricCorrect;

    const defaultPoints =
      (lyricCorrect ? typedRules.lyric_points : 0) +
      (bonusEligible ? typedRules.song_bonus_points : 0);

    const providedPoints = Number(award.awarded_points);
    const guessedOption = Number(award.guessed_option);

    return {
      session_id: sessionId,
      team_id: Number(award.team_id),
      call_id: callId,
      guessed_option: Number.isFinite(guessedOption) ? Math.max(1, Math.min(4, guessedOption)) : null,
      guessed_artist: award.guessed_artist?.trim() || null,
      guessed_title: award.guessed_title?.trim() || null,
      lyric_correct: lyricCorrect,
      song_bonus_awarded: bonusEligible,
      awarded_points: Number.isFinite(providedPoints)
        ? clampAwardedPoints(providedPoints)
        : clampAwardedPoints(defaultPoints),
      scored_by: body.scored_by ?? "host",
      notes: award.notes?.trim() || null,
      scored_at: now,
    };
  });

  if (rows.some((row) => !Number.isFinite(row.team_id))) {
    return NextResponse.json({ error: "Invalid team_id in awards" }, { status: 400 });
  }

  const { error: upsertError } = await db
    .from("wlc_team_scores")
    .upsert(rows, { onConflict: "session_id,team_id,call_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { error: callUpdateError } = await db
    .from("wlc_session_calls")
    .update({
      status: "scored",
      scored_at: now,
      revealed_at: now,
    })
    .eq("id", typedCall.id)
    .eq("session_id", sessionId);

  if (callUpdateError) return NextResponse.json({ error: callUpdateError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

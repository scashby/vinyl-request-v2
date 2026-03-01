import { NextRequest, NextResponse } from "next/server";
import { getSampleDetectiveDb } from "src/lib/sampleDetectiveDb";

export const runtime = "nodejs";

type ScoreBody = {
  call_id?: number;
  awards?: Array<{
    team_id: number;
    pair_correct?: boolean;
    both_artists_named?: boolean;
    awarded_points?: number;
    guessed_sampled_artist?: string;
    guessed_sampled_title?: string;
    guessed_source_artist?: string;
    guessed_source_title?: string;
    notes?: string;
  }>;
  scored_by?: string;
};

type SessionScoringRow = {
  points_correct_pair: number;
  bonus_both_artists_points: number;
};

type CallRow = {
  id: number;
  session_id: number;
};

function clampAwardedPoints(points: number): number {
  return Math.max(0, Math.min(5, points));
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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

  const db = getSampleDetectiveDb();
  const [{ data: session, error: sessionError }, { data: call, error: callError }] = await Promise.all([
    db
      .from("sd_sessions")
      .select("points_correct_pair, bonus_both_artists_points")
      .eq("id", sessionId)
      .maybeSingle(),
    db
      .from("sd_session_calls")
      .select("id, session_id")
      .eq("id", callId)
      .eq("session_id", sessionId)
      .maybeSingle(),
  ]);

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });

  const typedSession = session as SessionScoringRow;
  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  const rows = awards.map((award) => {
    const pairCorrect = Boolean(award.pair_correct);
    const bothArtistsNamed = pairCorrect && Boolean(award.both_artists_named);
    const defaultPoints = pairCorrect
      ? typedSession.points_correct_pair + (bothArtistsNamed ? typedSession.bonus_both_artists_points : 0)
      : 0;
    const providedPoints = Number(award.awarded_points);

    return {
      session_id: sessionId,
      team_id: Number(award.team_id),
      call_id: callId,
      guessed_sampled_artist: cleanText(award.guessed_sampled_artist),
      guessed_sampled_title: cleanText(award.guessed_sampled_title),
      guessed_source_artist: cleanText(award.guessed_source_artist),
      guessed_source_title: cleanText(award.guessed_source_title),
      pair_correct: pairCorrect,
      both_artists_named: bothArtistsNamed,
      awarded_points: Number.isFinite(providedPoints)
        ? clampAwardedPoints(providedPoints)
        : clampAwardedPoints(defaultPoints),
      scored_by: body.scored_by ?? "host",
      notes: cleanText(award.notes),
      scored_at: now,
    };
  });

  if (rows.some((row) => !Number.isFinite(row.team_id))) {
    return NextResponse.json({ error: "Invalid team_id in awards" }, { status: 400 });
  }

  const { error: upsertError } = await db
    .from("sd_team_scores")
    .upsert(rows, { onConflict: "session_id,team_id,call_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { error: callUpdateError } = await db
    .from("sd_session_calls")
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

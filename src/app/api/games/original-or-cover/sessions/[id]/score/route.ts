import { NextRequest, NextResponse } from "next/server";
import { getOriginalOrCoverDb } from "src/lib/originalOrCoverDb";

export const runtime = "nodejs";

type ScoreBody = {
  call_id?: number;
  awards?: Array<{
    team_id: number;
    called_original?: boolean | null;
    named_original_artist?: string;
    awarded_points?: number;
    notes?: string;
  }>;
  scored_by?: string;
};

type SessionRow = {
  id: number;
  points_correct_call: number;
  bonus_original_artist_points: number;
};

type CallRow = {
  id: number;
  session_id: number;
  original_artist: string;
  alt_accept_original_artist: string | null;
  is_cover: boolean;
};

function canonicalizeArtistName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArtistAliases(call: CallRow): Set<string> {
  const values = [call.original_artist, call.alt_accept_original_artist]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(/[;,|]/).map((part) => part.trim()))
    .filter(Boolean)
    .map(canonicalizeArtistName)
    .filter(Boolean);

  return new Set(values);
}

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

  const db = getOriginalOrCoverDb();
  const { data: session, error: sessionError } = await db
    .from("ooc_sessions")
    .select("id, points_correct_call, bonus_original_artist_points")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: call, error: callError } = await db
    .from("ooc_session_calls")
    .select("id, session_id, original_artist, alt_accept_original_artist, is_cover")
    .eq("id", callId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });

  const typedSession = session as SessionRow;
  const typedCall = call as CallRow;
  const acceptedArtistNames = normalizeArtistAliases(typedCall);
  const correctOriginalAnswer = !typedCall.is_cover;
  const now = new Date().toISOString();

  const rows = awards.map((award) => {
    const calledOriginal = typeof award.called_original === "boolean" ? award.called_original : null;
    const normalizedGuess = canonicalizeArtistName(award.named_original_artist?.trim() ?? "");

    const callCorrect = calledOriginal !== null && calledOriginal === correctOriginalAnswer;
    const artistBonusAwarded =
      callCorrect &&
      normalizedGuess.length > 0 &&
      acceptedArtistNames.has(normalizedGuess);

    const defaultPoints =
      (callCorrect ? typedSession.points_correct_call : 0) +
      (artistBonusAwarded ? typedSession.bonus_original_artist_points : 0);

    const providedPoints = Number(award.awarded_points);

    return {
      session_id: sessionId,
      team_id: Number(award.team_id),
      call_id: callId,
      called_original: calledOriginal,
      named_original_artist: award.named_original_artist?.trim() || null,
      call_correct: callCorrect,
      artist_bonus_awarded: artistBonusAwarded,
      awarded_points: Number.isFinite(providedPoints)
        ? clampAwardedPoints(providedPoints)
        : clampAwardedPoints(defaultPoints),
      scored_by: body.scored_by ?? "host",
      notes: award.notes ?? null,
      scored_at: now,
    };
  });

  if (rows.some((row) => !Number.isFinite(row.team_id))) {
    return NextResponse.json({ error: "Invalid team_id in awards" }, { status: 400 });
  }

  const { error: upsertError } = await db
    .from("ooc_team_scores")
    .upsert(rows, { onConflict: "session_id,team_id,call_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { error: callUpdateError } = await db
    .from("ooc_session_calls")
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

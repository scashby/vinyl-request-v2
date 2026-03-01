import { NextRequest, NextResponse } from "next/server";
import { getDecadeDashDb } from "src/lib/decadeDashDb";

export const runtime = "nodejs";

type ScoreBody = {
  call_id?: number;
  awards?: Array<{
    team_id: number;
    selected_decade?: number;
    awarded_points?: number;
    notes?: string;
  }>;
  scored_by?: string;
};

type CallRow = {
  id: number;
  session_id: number;
  decade_start: number;
  accepted_adjacent_decades: unknown;
};

type SessionRow = {
  id: number;
  adjacent_scoring_enabled: boolean;
  exact_points: number;
  adjacent_points: number;
};

function normalizeDecade(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const decade = Math.floor(numeric / 10) * 10;
  if (decade < 1950 || decade > 2030) return null;
  return decade;
}

function normalizeDecadeList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => normalizeDecade(entry)).filter((entry): entry is number => Number.isFinite(entry)))
  );
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

  const db = getDecadeDashDb();

  const [{ data: session, error: sessionError }, { data: call, error: callError }] = await Promise.all([
    db
      .from("dd_sessions")
      .select("id, adjacent_scoring_enabled, exact_points, adjacent_points")
      .eq("id", sessionId)
      .maybeSingle(),
    db
      .from("dd_session_calls")
      .select("id, session_id, decade_start, accepted_adjacent_decades")
      .eq("id", callId)
      .eq("session_id", sessionId)
      .maybeSingle(),
  ]);

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (!call) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });

  const typedSession = session as SessionRow;
  const typedCall = call as CallRow;
  const acceptedAdjacents = normalizeDecadeList(typedCall.accepted_adjacent_decades);
  const now = new Date().toISOString();

  const rows = awards.map((award) => {
    const selectedDecade = normalizeDecade(award.selected_decade);
    const exactMatch = selectedDecade !== null && selectedDecade === typedCall.decade_start;
    const adjacentMatch =
      selectedDecade !== null &&
      !exactMatch &&
      typedSession.adjacent_scoring_enabled &&
      acceptedAdjacents.includes(selectedDecade);
    const defaultPoints = exactMatch
      ? typedSession.exact_points
      : adjacentMatch
        ? typedSession.adjacent_points
        : 0;
    const providedPoints = Number(award.awarded_points);

    return {
      session_id: sessionId,
      team_id: Number(award.team_id),
      call_id: callId,
      selected_decade: selectedDecade,
      exact_match: exactMatch,
      adjacent_match: adjacentMatch,
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
    .from("dd_team_scores")
    .upsert(rows, { onConflict: "session_id,team_id,call_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { error: callUpdateError } = await db
    .from("dd_session_calls")
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

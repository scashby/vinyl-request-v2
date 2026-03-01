import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";

export const runtime = "nodejs";

type PicksBody = {
  round_number?: number;
  picks?: Array<{
    team_id: number;
    picked_call_id?: number;
    picked_call_index?: number;
    reason_text?: string | null;
  }>;
};

type RoundRow = {
  id: number;
  round_number: number;
};

type CallRow = {
  id: number;
  call_index: number;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const roundNumber = Number(request.nextUrl.searchParams.get("roundNumber"));

  const db = getGenreImposterDb();

  let query = db
    .from("gi_round_team_picks")
    .select("id, session_id, round_id, team_id, picked_call_id, reason_text, imposter_correct, reason_correct, awarded_points, scored_by, locked_at, resolved_at, created_at")
    .eq("session_id", sessionId)
    .order("round_id", { ascending: true })
    .order("team_id", { ascending: true });

  if (Number.isFinite(roundNumber) && roundNumber > 0) {
    const { data: round } = await db
      .from("gi_session_rounds")
      .select("id")
      .eq("session_id", sessionId)
      .eq("round_number", roundNumber)
      .maybeSingle();

    if (!round) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    query = query.eq("round_id", round.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const body = (await request.json()) as PicksBody;
  const roundNumber = Number(body.round_number);
  if (!Number.isFinite(roundNumber) || roundNumber <= 0) {
    return NextResponse.json({ error: "round_number is required" }, { status: 400 });
  }

  const picks = Array.isArray(body.picks) ? body.picks : [];
  if (picks.length === 0) {
    return NextResponse.json({ error: "picks are required" }, { status: 400 });
  }

  const db = getGenreImposterDb();

  const { data: round, error: roundError } = await db
    .from("gi_session_rounds")
    .select("id, round_number")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 });
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const typedRound = round as RoundRow;

  const { data: calls, error: callsError } = await db
    .from("gi_session_calls")
    .select("id, call_index")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber);

  if (callsError) return NextResponse.json({ error: callsError.message }, { status: 500 });

  const callIdByIndex = new Map<number, number>(
    ((calls ?? []) as CallRow[]).map((call) => [call.call_index, call.id])
  );
  const validCallIds = new Set<number>(((calls ?? []) as CallRow[]).map((call) => call.id));

  const now = new Date().toISOString();

  const rows = picks.map((pick) => {
    const teamId = Number(pick.team_id);
    const pickedCallIdRaw = Number(pick.picked_call_id);
    const pickedCallIndexRaw = Number(pick.picked_call_index);

    const pickedCallId = Number.isFinite(pickedCallIdRaw)
      ? pickedCallIdRaw
      : Number.isFinite(pickedCallIndexRaw)
        ? (callIdByIndex.get(pickedCallIndexRaw) ?? NaN)
        : NaN;

    return {
      session_id: sessionId,
      round_id: typedRound.id,
      team_id: teamId,
      picked_call_id: pickedCallId,
      reason_text: pick.reason_text?.trim() || null,
      locked_at: now,
    };
  });

  if (rows.some((row) => !Number.isFinite(row.team_id) || !Number.isFinite(row.picked_call_id) || !validCallIds.has(row.picked_call_id))) {
    return NextResponse.json({ error: "Each pick must include a valid team_id and picked_call_id/picked_call_index for this round" }, { status: 400 });
  }

  const { error: upsertError } = await db
    .from("gi_round_team_picks")
    .upsert(rows, { onConflict: "round_id,team_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  await db
    .from("gi_session_rounds")
    .update({ status: "active", opened_at: now })
    .eq("id", typedRound.id);

  return NextResponse.json({ ok: true, picks_saved: rows.length }, { status: 200 });
}

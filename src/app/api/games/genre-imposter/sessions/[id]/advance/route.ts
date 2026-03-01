import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  current_round: number;
  current_call_index: number;
  round_count: number;
  started_at: string | null;
  status: "pending" | "running" | "paused" | "completed";
};

type CallRow = {
  id: number;
  round_number: number;
  call_index: number;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getGenreImposterDb();
  const { data: session, error: sessionError } = await db
    .from("gi_sessions")
    .select("id, current_round, current_call_index, round_count, started_at, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  if (typedSession.status === "completed") {
    return NextResponse.json({ error: "Session already completed" }, { status: 409 });
  }

  let nextRound = typedSession.current_round;
  let nextCallIndex = typedSession.current_call_index + 1;
  if (nextCallIndex > 3) {
    nextRound += 1;
    nextCallIndex = 1;
  }

  const now = new Date().toISOString();

  if (nextRound > typedSession.round_count) {
    await db
      .from("gi_sessions")
      .update({
        status: "completed",
        ended_at: now,
        paused_at: null,
        paused_remaining_seconds: null,
      })
      .eq("id", sessionId);

    return NextResponse.json({ ok: true, completed: true }, { status: 200 });
  }

  const { data: nextCall, error: callError } = await db
    .from("gi_session_calls")
    .select("id, round_number, call_index")
    .eq("session_id", sessionId)
    .eq("round_number", nextRound)
    .eq("call_index", nextCallIndex)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!nextCall) {
    return NextResponse.json({ error: `No call found for round ${nextRound}, slot ${nextCallIndex}` }, { status: 409 });
  }

  const typedCall = nextCall as CallRow;

  const { error: callUpdateError } = await db
    .from("gi_session_calls")
    .update({ status: "played", played_at: now })
    .eq("id", typedCall.id)
    .eq("session_id", sessionId);

  if (callUpdateError) return NextResponse.json({ error: callUpdateError.message }, { status: 500 });

  if (nextRound > typedSession.current_round) {
    await db
      .from("gi_session_rounds")
      .update({ status: "closed", closed_at: now })
      .eq("session_id", sessionId)
      .eq("round_number", typedSession.current_round);
  }

  await db
    .from("gi_session_rounds")
    .update({ status: "active", opened_at: now })
    .eq("session_id", sessionId)
    .eq("round_number", nextRound);

  const { error: updateSessionError } = await db
    .from("gi_sessions")
    .update({
      current_round: nextRound,
      current_call_index: nextCallIndex,
      status: "running",
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      ended_at: null,
      started_at: typedSession.started_at ?? now,
    })
    .eq("id", sessionId);

  if (updateSessionError) return NextResponse.json({ error: updateSessionError.message }, { status: 500 });

  return NextResponse.json(
    {
      ok: true,
      completed: false,
      current_round: nextRound,
      current_call_index: nextCallIndex,
    },
    { status: 200 }
  );
}

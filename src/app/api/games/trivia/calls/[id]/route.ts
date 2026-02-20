import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

export const runtime = "nodejs";

type CallPatchBody = {
  status?: "pending" | "asked" | "answer_revealed" | "scored" | "skipped";
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
  round_number: number;
};

type SessionRow = {
  id: number;
  started_at: string | null;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const callId = Number(id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const body = (await request.json()) as CallPatchBody;
  if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const db = getTriviaDb();
  const { data: call, error: callError } = await db
    .from("trivia_session_calls")
    .select("id, session_id, call_index, round_number")
    .eq("id", callId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = { status: body.status };
  if (body.status === "asked") patch.asked_at = now;
  if (body.status === "answer_revealed") patch.answer_revealed_at = now;
  if (body.status === "scored") patch.scored_at = now;

  const { error } = await db.from("trivia_session_calls").update(patch).eq("id", callId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status === "asked") {
    const { data: session } = await db.from("trivia_sessions").select("id, started_at").eq("id", typedCall.session_id).maybeSingle();
    const typedSession = session as SessionRow | null;

    await db
      .from("trivia_sessions")
      .update({
        current_call_index: typedCall.call_index,
        current_round: typedCall.round_number,
        status: "running",
        countdown_started_at: now,
        paused_at: null,
        paused_remaining_seconds: null,
        started_at: typedSession?.started_at ?? now,
      })
      .eq("id", typedCall.session_id);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

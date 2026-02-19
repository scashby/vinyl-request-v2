import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

type SessionRow = { id: number; current_call_index: number; started_at: string | null };
type CallRow = { id: number; call_index: number };

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBingoDb();
  const { data: session } = await db
    .from("bingo_sessions")
    .select("id, current_call_index, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const typedSession = session as SessionRow;

  if (typedSession.current_call_index > 0) {
    const { data: current } = await db
      .from("bingo_session_calls")
      .select("id")
      .eq("session_id", sessionId)
      .eq("call_index", typedSession.current_call_index)
      .maybeSingle();

    if (current?.id) {
      await db
        .from("bingo_session_calls")
        .update({ status: "skipped", completed_at: new Date().toISOString() })
        .eq("id", current.id);
    }
  }

  const nextIndex = typedSession.current_call_index + 1;
  const { data: nextCall } = await db
    .from("bingo_session_calls")
    .select("id, call_index")
    .eq("session_id", sessionId)
    .eq("call_index", nextIndex)
    .maybeSingle();

  if (!nextCall) return NextResponse.json({ error: "No more calls available" }, { status: 409 });

  const typedCall = nextCall as CallRow;
  const now = new Date().toISOString();

  await db.from("bingo_session_calls").update({ status: "called", called_at: now }).eq("id", typedCall.id);
  await db
    .from("bingo_sessions")
    .update({
      current_call_index: typedCall.call_index,
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      status: "running",
      started_at: typedSession.started_at ?? now,
    })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true }, { status: 200 });
}

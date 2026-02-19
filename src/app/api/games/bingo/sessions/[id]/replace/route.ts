import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if ((session.current_call_index ?? 0) > 0) {
    const { data: current } = await db
      .from("bingo_session_calls")
      .select("id")
      .eq("session_id", sessionId)
      .eq("call_index", session.current_call_index)
      .maybeSingle();

    if (current?.id) {
      await db
        .from("bingo_session_calls")
        .update({ status: "skipped", completed_at: new Date().toISOString() })
        .eq("id", current.id);
    }
  }

  const { data: replacement } = await db
    .from("bingo_session_calls")
    .select("id, call_index")
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .order("call_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!replacement) return NextResponse.json({ error: "No replacement call available" }, { status: 409 });

  const now = new Date().toISOString();
  await db.from("bingo_session_calls").update({ status: "called", called_at: now }).eq("id", replacement.id);
  await db
    .from("bingo_sessions")
    .update({
      current_call_index: replacement.call_index,
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      status: "running",
      started_at: session.started_at ?? now,
    })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true, current_call_index: replacement.call_index }, { status: 200 });
}

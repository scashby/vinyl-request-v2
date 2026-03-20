import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBingoDb();
  const now = new Date().toISOString();

  const { error: callsError } = await db
    .from("bingo_session_calls")
    .update({
      status: "pending",
      called_at: null,
      completed_at: null,
    })
    .eq("session_id", sessionId);

  if (callsError) return NextResponse.json({ error: callsError.message }, { status: 500 });

  const { error: sessionError } = await db
    .from("bingo_sessions")
    .update({
      status: "pending",
      current_call_index: 0,
      current_round: 1,
      started_at: null,
      ended_at: null,
      paused_at: null,
      paused_remaining_seconds: null,
      countdown_started_at: now,
      transport_queue_call_ids: [],
      call_reveal_at: null,
      bingo_overlay: "none",
      next_game_scheduled_at: null,
      next_game_rules_text: null,
    })
    .eq("id", sessionId);

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

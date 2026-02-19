import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  seconds_to_next_call: number;
  paused_remaining_seconds: number | null;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBingoDb();
  const { data: session, error } = await db
    .from("bingo_sessions")
    .select("id, seconds_to_next_call, paused_remaining_seconds")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typed = session as SessionRow;
  const remaining = typed.paused_remaining_seconds ?? typed.seconds_to_next_call;
  const offsetMs = Math.max(0, (typed.seconds_to_next_call - remaining) * 1000);
  const countdownStartedAt = new Date(Date.now() - offsetMs).toISOString();

  const { error: updateError } = await db
    .from("bingo_sessions")
    .update({
      status: "running",
      paused_at: null,
      paused_remaining_seconds: null,
      countdown_started_at: countdownStartedAt,
    })
    .eq("id", sessionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

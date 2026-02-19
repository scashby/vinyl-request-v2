import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { computeRemainingSeconds } from "src/lib/bingoEngine";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  seconds_to_next_call: number;
  countdown_started_at: string | null;
  paused_at: string | null;
  paused_remaining_seconds: number | null;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBingoDb();
  const { data: session, error } = await db
    .from("bingo_sessions")
    .select("id, seconds_to_next_call, countdown_started_at, paused_at, paused_remaining_seconds")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typed = session as SessionRow;
  const remaining = computeRemainingSeconds(typed);
  const now = new Date().toISOString();

  const { error: updateError } = await db
    .from("bingo_sessions")
    .update({ status: "paused", paused_at: now, paused_remaining_seconds: remaining })
    .eq("id", sessionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true, seconds_to_next_call: remaining }, { status: 200 });
}

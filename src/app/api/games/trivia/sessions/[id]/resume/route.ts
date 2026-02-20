import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  paused_remaining_seconds: number | null;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getTriviaDb();
  const { data: session, error } = await db
    .from("trivia_sessions")
    .select("id, paused_remaining_seconds")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typed = session as SessionRow;
  const seconds = Math.max(1, typed.paused_remaining_seconds ?? 1);
  const now = new Date();
  const countdownStart = new Date(now.getTime() - Math.max(0, (seconds - 1) * 1000)).toISOString();

  await db
    .from("trivia_sessions")
    .update({
      status: "running",
      paused_at: null,
      paused_remaining_seconds: null,
      countdown_started_at: countdownStart,
    })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true }, { status: 200 });
}

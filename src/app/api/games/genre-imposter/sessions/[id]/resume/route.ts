import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  target_gap_seconds: number;
  paused_remaining_seconds: number | null;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getGenreImposterDb();
  const { data: session, error } = await db
    .from("gi_sessions")
    .select("id, target_gap_seconds, paused_remaining_seconds")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typed = session as SessionRow;
  const remaining = Math.max(1, typed.paused_remaining_seconds ?? typed.target_gap_seconds ?? 1);

  const elapsed = Math.max(0, typed.target_gap_seconds - remaining);
  const countdownStart = new Date(Date.now() - elapsed * 1000).toISOString();

  await db
    .from("gi_sessions")
    .update({
      status: "running",
      paused_at: null,
      paused_remaining_seconds: null,
      countdown_started_at: countdownStart,
    })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true }, { status: 200 });
}

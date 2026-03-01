import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";
import { computeGenreImposterRemainingSeconds } from "src/lib/genreImposterEngine";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  status: "pending" | "running" | "paused" | "completed";
  target_gap_seconds: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getGenreImposterDb();
  const { data: session, error } = await db
    .from("gi_sessions")
    .select("id, status, target_gap_seconds, countdown_started_at, paused_remaining_seconds")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typed = session as SessionRow;
  const remaining = computeGenreImposterRemainingSeconds(typed);
  const now = new Date().toISOString();

  await db
    .from("gi_sessions")
    .update({
      status: "paused",
      paused_at: now,
      paused_remaining_seconds: remaining,
    })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true, paused_remaining_seconds: remaining }, { status: 200 });
}

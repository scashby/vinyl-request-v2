import { NextRequest, NextResponse } from "next/server";
import { getCrateCategoriesDb } from "src/lib/crateCategoriesDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  status: "pending" | "running" | "paused" | "completed";
  target_gap_seconds: number;
  paused_remaining_seconds: number | null;
  started_at: string | null;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getCrateCategoriesDb();
  const { data: session, error } = await db
    .from("ccat_sessions")
    .select("id, status, target_gap_seconds, paused_remaining_seconds, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typed = session as SessionRow;
  if (typed.status === "completed") {
    return NextResponse.json({ error: "Session already completed" }, { status: 409 });
  }

  const seconds = Math.max(1, typed.paused_remaining_seconds ?? typed.target_gap_seconds);
  const now = new Date();
  const nowIso = now.toISOString();
  const countdownStart = new Date(now.getTime() - Math.max(0, (seconds - 1) * 1000)).toISOString();

  const { error: updateError } = await db
    .from("ccat_sessions")
    .update({
      status: "running",
      paused_at: null,
      paused_remaining_seconds: null,
      countdown_started_at: countdownStart,
      started_at: typed.started_at ?? nowIso,
    })
    .eq("id", sessionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

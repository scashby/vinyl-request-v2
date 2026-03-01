import { NextRequest, NextResponse } from "next/server";
import { getCrateCategoriesDb } from "src/lib/crateCategoriesDb";
import { computeCrateCategoriesRemainingSeconds } from "src/lib/crateCategoriesEngine";

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

  const db = getCrateCategoriesDb();
  const { data: session, error } = await db
    .from("ccat_sessions")
    .select("id, status, target_gap_seconds, countdown_started_at, paused_remaining_seconds")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typed = session as SessionRow;
  if (typed.status === "completed") {
    return NextResponse.json({ error: "Session already completed" }, { status: 409 });
  }

  const remaining = computeCrateCategoriesRemainingSeconds(typed);
  const now = new Date().toISOString();

  const { error: updateError } = await db
    .from("ccat_sessions")
    .update({
      status: "paused",
      paused_at: now,
      paused_remaining_seconds: remaining,
    })
    .eq("id", sessionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, paused_remaining_seconds: remaining }, { status: 200 });
}

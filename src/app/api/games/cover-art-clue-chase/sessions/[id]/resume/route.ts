import { NextRequest, NextResponse } from "next/server";
import { getCoverArtClueChaseDb } from "src/lib/coverArtClueChaseDb";

type SessionRow = {
  id: number;
  status: "pending" | "running" | "paused" | "completed";
  started_at: string | null;
};

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getCoverArtClueChaseDb();
  const { data: session, error } = await db
    .from("cacc_sessions")
    .select("id, status, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typed = session as SessionRow;
  if (typed.status === "completed") return NextResponse.json({ error: "Session already completed" }, { status: 409 });

  const now = new Date().toISOString();
  const { error: updateError } = await db
    .from("cacc_sessions")
    .update({ status: "running", started_at: typed.started_at ?? now })
    .eq("id", sessionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await db.from("cacc_session_events").insert({
    session_id: sessionId,
    event_type: "session_resumed",
    payload: null,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

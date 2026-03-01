import { NextRequest, NextResponse } from "next/server";
import { getNeedleDropRouletteDb } from "src/lib/needleDropRouletteDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  status: "pending" | "running" | "paused" | "completed";
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getNeedleDropRouletteDb();
  const { data: session, error } = await db.from("ndr_sessions").select("id, status").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typed = session as SessionRow;
  if (typed.status === "completed") return NextResponse.json({ error: "Session already completed" }, { status: 409 });

  const { error: updateError } = await db.from("ndr_sessions").update({ status: "paused" }).eq("id", sessionId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

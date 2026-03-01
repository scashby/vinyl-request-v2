import { NextRequest, NextResponse } from "next/server";
import { getBackToBackConnectionDb } from "src/lib/backToBackConnectionDb";

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getBackToBackConnectionDb();
  const { error } = await db
    .from("b2bc_sessions")
    .update({ status: "paused" })
    .eq("id", sessionId)
    .neq("status", "completed");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

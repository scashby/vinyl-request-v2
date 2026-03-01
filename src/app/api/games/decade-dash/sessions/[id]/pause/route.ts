import { NextRequest, NextResponse } from "next/server";
import { getDecadeDashDb } from "src/lib/decadeDashDb";

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getDecadeDashDb();
  const { error } = await db
    .from("dd_sessions")
    .update({
      status: "paused",
    })
    .eq("id", sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { getRoundCardPreview } from "src/lib/bingoCratePrint";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; round: string }> }
) {
  const { id, round } = await params;
  const sessionId = Number(id);
  const roundNumber = Number(round);

  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }
  if (!Number.isFinite(roundNumber) || roundNumber < 1) {
    return NextResponse.json({ error: "Invalid round number" }, { status: 400 });
  }

  const db = getBingoDb();
  try {
    const data = await getRoundCardPreview(db, sessionId, Math.floor(roundNumber));
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build round card preview";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { countWinningCards } from "src/lib/bingoGameModel";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const roundParam = request.nextUrl.searchParams.get("round");
  const round = roundParam ? Number(roundParam) : undefined;

  try {
    const result = await countWinningCards(getBingoDb(), sessionId, round);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to count winning cards";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

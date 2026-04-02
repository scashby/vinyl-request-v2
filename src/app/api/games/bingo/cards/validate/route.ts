import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { validateCardByIdentifier } from "src/lib/bingoGameModel";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionId = Number(request.nextUrl.searchParams.get("sessionId"));
  const cardIdentifier = String(request.nextUrl.searchParams.get("cardIdentifier") ?? "").trim();
  const roundParam = request.nextUrl.searchParams.get("round");
  const round = roundParam ? Number(roundParam) : undefined;

  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  if (!cardIdentifier) {
    return NextResponse.json({ error: "cardIdentifier is required" }, { status: 400 });
  }

  try {
    const result = await validateCardByIdentifier(getBingoDb(), sessionId, cardIdentifier, round);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to validate card";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
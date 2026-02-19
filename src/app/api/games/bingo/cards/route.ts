import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionId = Number(request.nextUrl.searchParams.get("sessionId"));
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const db = getBingoDb();
  const { data, error } = await db
    .from("bingo_cards")
    .select("id, session_id, card_number, has_free_space, grid, created_at")
    .eq("session_id", sessionId)
    .order("card_number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

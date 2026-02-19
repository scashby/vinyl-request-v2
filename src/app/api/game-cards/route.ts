import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionId = Number(request.nextUrl.searchParams.get("sessionId"));

  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("game_cards")
    .select("id, session_id, card_number, has_free_space, grid, created_at")
    .eq("session_id", sessionId)
    .order("card_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const id = Number(sessionId);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid sessionId." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("game_cards")
    .select("*")
    .eq("session_id", id)
    .order("card_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

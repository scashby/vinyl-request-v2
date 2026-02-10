import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  const id = Number(context.params.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid pick id." }, { status: 400 });
  }

  let payload: { calledAt?: string | null } = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const { data, error } = await supabaseAdmin
    .from("game_session_picks")
    .update({ called_at: payload.calledAt ?? new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

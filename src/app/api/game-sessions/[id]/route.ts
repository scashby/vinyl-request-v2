import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  const id = Number(context.params.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("game_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  const { data: picks, error: picksError } = await supabaseAdmin
    .from("game_session_picks")
    .select(
      "id, pick_index, called_at, game_template_items ( id, title, artist )"
    )
    .eq("session_id", id)
    .order("pick_index", { ascending: true });

  if (picksError) {
    return NextResponse.json({ error: picksError.message }, { status: 500 });
  }

  return NextResponse.json({ data: { session, picks } }, { status: 200 });
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  const id = Number(context.params.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  let payload: { status?: string } = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const updates: Record<string, string | null> = {};
  if (payload.status) {
    updates.status = payload.status;
    if (payload.status === "active") {
      updates.started_at = new Date().toISOString();
    }
    if (payload.status === "finished") {
      updates.ended_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabaseAdmin
    .from("game_sessions")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

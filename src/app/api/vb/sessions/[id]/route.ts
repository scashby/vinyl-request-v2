import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin as any;
  const { id } = await context.params;
  const sessionId = Number(id);

  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const { data, error } = await db
    .from("vb_sessions")
    .select("id, event_id, template_id, session_code, variant, bingo_target, card_count, round_count, current_round, seconds_to_next_call, current_call_index, paused_at, status, created_at, started_at, ended_at, vb_templates ( id, name )")
    .eq("id", sessionId)
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });

  return NextResponse.json({ data }, { status: 200 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin as any;
  const { id } = await context.params;
  const sessionId = Number(id);

  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    patch.status = body.status;
    if (body.status === "active") {
      patch.started_at = new Date().toISOString();
      patch.paused_at = null;
    }
    if (body.status === "paused") {
      patch.paused_at = new Date().toISOString();
    }
    if (body.status === "completed") {
      patch.ended_at = new Date().toISOString();
    }
  }

  if (typeof body.current_call_index === "number") patch.current_call_index = body.current_call_index;
  if (typeof body.current_round === "number") patch.current_round = body.current_round;
  if (typeof body.seconds_to_next_call === "number") patch.seconds_to_next_call = body.seconds_to_next_call;

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("vb_sessions").update(patch).eq("id", sessionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data, error } = await db
    .from("vb_sessions")
    .select("id, event_id, template_id, session_code, variant, bingo_target, card_count, round_count, current_round, seconds_to_next_call, current_call_index, paused_at, status, created_at, started_at, ended_at, vb_templates ( id, name )")
    .eq("id", sessionId)
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });

  return NextResponse.json({ data }, { status: 200 });
}

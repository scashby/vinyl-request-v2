import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin as any;
  const { id } = await context.params;
  const callId = Number(id);

  if (!Number.isFinite(callId)) {
    return NextResponse.json({ error: "Invalid call id" }, { status: 400 });
  }

  const body = (await request.json()) as { status?: string };
  const status = body.status === "played" ? "played" : "pending";
  const calledAt = status === "played" ? new Date().toISOString() : null;

  const { error } = await db
    .from("vb_session_calls")
    .update({ status, called_at: calledAt })
    .eq("id", callId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

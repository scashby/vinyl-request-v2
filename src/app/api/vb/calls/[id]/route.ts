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
  const allowed = new Set(["pending", "prep_started", "called", "played", "skipped", "completed"]);
  const status = allowed.has(String(body.status)) ? String(body.status) : "pending";
  const now = new Date().toISOString();

  const patch: Record<string, string | null> = { status };
  if (status === "prep_started") patch.prep_started_at = now;
  if (status === "called" || status === "played") patch.called_at = now;
  if (status === "completed" || status === "played" || status === "skipped") patch.completed_at = now;
  if (status === "pending") {
    patch.prep_started_at = null;
    patch.called_at = null;
    patch.completed_at = null;
  }

  const { error } = await db.from("vb_session_calls").update(patch).eq("id", callId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const pickId = Number(params.id);

  if (!Number.isFinite(pickId)) {
    return NextResponse.json({ error: "Invalid pick id." }, { status: 400 });
  }

  const body = (await request.json()) as { status?: string };
  const updatePayload: { called_at?: string | null } = {};

  if (body.status === "played") {
    updatePayload.called_at = new Date().toISOString();
  }

  if (body.status === "pending") {
    updatePayload.called_at = null;
  }

  const { error } = await supabaseAdmin.from("game_session_picks").update(updatePayload).eq("id", pickId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getArtistAliasDb } from "src/lib/artistAliasDb";

export const runtime = "nodejs";

type CallPatchBody = {
  status?: "pending" | "stage_1" | "stage_2" | "final_reveal" | "scored" | "skipped";
  stage_revealed?: number;
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
  round_number: number;
  stage_revealed: number;
};

type SessionRow = {
  id: number;
  started_at: string | null;
};

function clampStage(value: number): number {
  return Math.max(0, Math.min(3, Math.trunc(value)));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const callId = Number(id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const body = (await request.json()) as CallPatchBody;
  const hasStatus = typeof body.status === "string";
  const hasStage = Number.isFinite(Number(body.stage_revealed));

  if (!hasStatus && !hasStage) {
    return NextResponse.json({ error: "status or stage_revealed is required" }, { status: 400 });
  }

  const db = getArtistAliasDb();
  const { data: call, error: callError } = await db
    .from("aa_session_calls")
    .select("id, session_id, call_index, round_number, stage_revealed")
    .eq("id", callId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  let nextStage = clampStage(typedCall.stage_revealed ?? 0);
  if (hasStage) nextStage = clampStage(Number(body.stage_revealed));

  const patch: Record<string, unknown> = {};
  if (hasStatus) {
    patch.status = body.status;
  }

  switch (body.status) {
    case "stage_1":
      nextStage = Math.max(nextStage, 1);
      patch.asked_at = now;
      break;
    case "stage_2":
      nextStage = Math.max(nextStage, 2);
      patch.revealed_at = now;
      break;
    case "final_reveal":
      nextStage = 3;
      patch.revealed_at = now;
      break;
    case "scored":
      patch.scored_at = now;
      break;
    case "skipped":
      patch.scored_at = now;
      break;
    default:
      break;
  }

  patch.stage_revealed = nextStage;

  const { error: patchError } = await db.from("aa_session_calls").update(patch).eq("id", callId);
  if (patchError) return NextResponse.json({ error: patchError.message }, { status: 500 });

  if (body.status === "stage_1") {
    const { data: session } = await db
      .from("aa_sessions")
      .select("id, started_at")
      .eq("id", typedCall.session_id)
      .maybeSingle();
    const typedSession = session as SessionRow | null;

    const { error: sessionUpdateError } = await db
      .from("aa_sessions")
      .update({
        current_call_index: typedCall.call_index,
        current_round: typedCall.round_number,
        status: "running",
        started_at: typedSession?.started_at ?? now,
        ended_at: null,
      })
      .eq("id", typedCall.session_id);

    if (sessionUpdateError) {
      return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

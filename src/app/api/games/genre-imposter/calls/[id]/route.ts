import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";

export const runtime = "nodejs";

type CallPatchBody = {
  status?: "pending" | "cued" | "played" | "revealed" | "scored" | "skipped";
};

type CallRow = {
  id: number;
  session_id: number;
  round_number: number;
  call_index: number;
};

type SessionRow = {
  id: number;
  started_at: string | null;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const callId = Number(id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const body = (await request.json()) as CallPatchBody;
  if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const db = getGenreImposterDb();
  const { data: call, error: callError } = await db
    .from("gi_session_calls")
    .select("id, session_id, round_number, call_index")
    .eq("id", callId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = { status: body.status };
  if (body.status === "cued") patch.cued_at = now;
  if (body.status === "played") patch.played_at = now;
  if (body.status === "revealed" || body.status === "scored") patch.revealed_at = now;

  const { error: patchError } = await db.from("gi_session_calls").update(patch).eq("id", callId);
  if (patchError) return NextResponse.json({ error: patchError.message }, { status: 500 });

  if (body.status === "played") {
    const { data: session } = await db
      .from("gi_sessions")
      .select("id, started_at")
      .eq("id", typedCall.session_id)
      .maybeSingle();
    const typedSession = session as SessionRow | null;

    const { error: sessionUpdateError } = await db
      .from("gi_sessions")
      .update({
        current_round: typedCall.round_number,
        current_call_index: typedCall.call_index,
        status: "running",
        countdown_started_at: now,
        paused_at: null,
        paused_remaining_seconds: null,
        ended_at: null,
        started_at: typedSession?.started_at ?? now,
      })
      .eq("id", typedCall.session_id);

    if (sessionUpdateError) {
      return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });
    }

    await db
      .from("gi_session_rounds")
      .update({ status: "active", opened_at: now })
      .eq("session_id", typedCall.session_id)
      .eq("round_number", typedCall.round_number);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

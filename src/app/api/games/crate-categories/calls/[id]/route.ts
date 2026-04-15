import { NextRequest, NextResponse } from "next/server";
import { getCrateCategoriesDb } from "src/lib/crateCategoriesDb";

export const runtime = "nodejs";

type CallPatchBody = {
  status?: "pending" | "playing" | "revealed" | "scored" | "skipped";
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
  round_number: number;
};

type SessionRow = {
  id: number;
  started_at: string | null;
};

type RoundCompletionRow = {
  status: "pending" | "playing" | "revealed" | "scored" | "skipped";
};

type CcatCallPatch = {
  status?: "pending" | "playing" | "revealed" | "scored" | "skipped";
  asked_at?: string | null;
  revealed_at?: string | null;
  scored_at?: string | null;
};

type CcatSessionPatch = {
  current_call_index?: number;
  current_round?: number;
  status?: "pending" | "running" | "paused" | "completed";
  countdown_started_at?: string | null;
  paused_at?: string | null;
  paused_remaining_seconds?: number | null;
  ended_at?: string | null;
  started_at?: string | null;
};

type CcatRoundPatch = {
  status?: "pending" | "active" | "closed";
  opened_at?: string | null;
  closed_at?: string | null;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const callId = Number(id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const body = (await request.json()) as CallPatchBody;
  if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const db = getCrateCategoriesDb();
  const { data: call, error: callError } = await db
    .from("ccat_session_calls")
    .select("id, session_id, call_index, round_number")
    .eq("id", callId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  const patch: CcatCallPatch = { status: body.status };
  if (body.status === "playing") patch.asked_at = now;
  if (body.status === "revealed") patch.revealed_at = now;
  if (body.status === "scored") patch.scored_at = now;

  const { error: patchError } = await db.from("ccat_session_calls").update(patch).eq("id", callId);
  if (patchError) return NextResponse.json({ error: patchError.message }, { status: 500 });

  if (body.status === "playing") {
    const { data: session } = await db
      .from("ccat_sessions")
      .select("id, started_at")
      .eq("id", typedCall.session_id)
      .maybeSingle();
    const typedSession = session as SessionRow | null;

    const sessionUpdate: CcatSessionPatch = {
      current_call_index: typedCall.call_index,
      current_round: typedCall.round_number,
      status: "running" as const,
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      ended_at: null,
      started_at: typedSession?.started_at ?? now,
    };
    const { error: sessionUpdateError } = await db
      .from("ccat_sessions")
      .update(sessionUpdate)
      .eq("id", typedCall.session_id);

    if (sessionUpdateError) {
      return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });
    }

    const roundUpdate: CcatRoundPatch = {
      status: "active" as const,
      opened_at: now,
    };
    const { error: roundUpdateError } = await db
      .from("ccat_session_rounds")
      .update(roundUpdate)
      .eq("session_id", typedCall.session_id)
      .eq("round_number", typedCall.round_number);

    if (roundUpdateError) {
      return NextResponse.json({ error: roundUpdateError.message }, { status: 500 });
    }
  }

  if (body.status === "scored" || body.status === "skipped") {
    const { data: roundCalls, error: roundCallsError } = await db
      .from("ccat_session_calls")
      .select("status")
      .eq("session_id", typedCall.session_id)
      .eq("round_number", typedCall.round_number);

    if (roundCallsError) return NextResponse.json({ error: roundCallsError.message }, { status: 500 });

    const allClosed = ((roundCalls ?? []) as RoundCompletionRow[]).every(
      (row) => row.status === "scored" || row.status === "skipped"
    );

    if (allClosed) {
      const closedRoundUpdate: CcatRoundPatch = {
        status: "closed" as const,
        closed_at: now,
      };
      const { error: roundUpdateError } = await db
        .from("ccat_session_rounds")
        .update(closedRoundUpdate)
        .eq("session_id", typedCall.session_id)
        .eq("round_number", typedCall.round_number);

      if (roundUpdateError) {
        return NextResponse.json({ error: roundUpdateError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

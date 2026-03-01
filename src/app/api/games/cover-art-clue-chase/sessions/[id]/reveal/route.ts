import { NextRequest, NextResponse } from "next/server";
import { getCoverArtClueChaseDb } from "src/lib/coverArtClueChaseDb";

type RevealBody = {
  call_id?: number;
  stage?: number;
  use_audio_clue?: boolean;
};

type SessionRow = {
  id: number;
  current_call_index: number;
  audio_clue_enabled: boolean;
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
  stage_revealed: number;
};

function stageToStatus(stage: number) {
  if (stage <= 1) return "stage_1";
  if (stage === 2) return "stage_2";
  return "final_reveal";
}

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as RevealBody;
  const db = getCoverArtClueChaseDb();

  const { data: session, error: sessionError } = await db
    .from("cacc_sessions")
    .select("id, current_call_index, audio_clue_enabled")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  const callId = Number(body.call_id);

  let callQuery = db
    .from("cacc_session_calls")
    .select("id, session_id, call_index, stage_revealed")
    .eq("session_id", sessionId);

  if (Number.isFinite(callId)) {
    callQuery = callQuery.eq("id", callId);
  } else if (typedSession.current_call_index > 0) {
    callQuery = callQuery.eq("call_index", typedSession.current_call_index);
  } else {
    return NextResponse.json({ error: "No active call. Start or advance first." }, { status: 409 });
  }

  const { data: call, error: callError } = await callQuery.maybeSingle();
  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });

  const typedCall = call as CallRow;
  const requestedStage = Number(body.stage);
  const fallbackStage = typedCall.stage_revealed > 0 ? typedCall.stage_revealed + 1 : 1;
  const targetStage = Math.max(1, Math.min(3, Number.isFinite(requestedStage) ? requestedStage : fallbackStage));
  const now = new Date().toISOString();

  const { error: updateError } = await db
    .from("cacc_session_calls")
    .update({
      status: stageToStatus(targetStage),
      stage_revealed: targetStage,
      revealed_at: now,
    })
    .eq("id", typedCall.id)
    .eq("session_id", sessionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await db.from("cacc_session_events").insert({
    session_id: sessionId,
    event_type: "call_revealed",
    payload: {
      call_id: typedCall.id,
      call_index: typedCall.call_index,
      stage: targetStage,
      use_audio_clue: Boolean(body.use_audio_clue) && typedSession.audio_clue_enabled,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      call_id: typedCall.id,
      call_index: typedCall.call_index,
      stage_revealed: targetStage,
      status: stageToStatus(targetStage),
    },
    { status: 200 }
  );
}

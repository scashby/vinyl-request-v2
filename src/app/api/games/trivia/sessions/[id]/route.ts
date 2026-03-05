import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { computeTriviaRemainingSeconds } from "src/lib/triviaEngine";
import { computeTransportQueueIds, type TransportQueueEvent } from "src/lib/transportQueue";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  deck_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  questions_per_round: number;
  tie_breaker_count: number;
  score_mode: string;
  question_categories: string[];
  difficulty_easy_target: number;
  difficulty_medium_target: number;
  difficulty_hard_target: number;
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
  target_gap_seconds: number;
  current_round: number;
  current_call_index: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
  paused_at: string | null;
  show_title: boolean;
  show_rounds: boolean;
  show_question_counter: boolean;
  show_leaderboard: boolean;
  show_cue_hints: boolean;
  max_teams: number | null;
  slips_batch_size: number | null;
  status: "pending" | "running" | "paused" | "completed";
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

type EventRow = { id: number; title: string; date: string; time: string | null; location: string | null };
type PlaylistRow = { id: number; name: string };
type SessionEventRow = {
  payload: { call_id?: unknown } | null;
};

type TransportEventRow = {
  event_type: string;
  payload: { call_id?: unknown; after_call_id?: unknown } | null;
};

const DONE_STATUSES = new Set(["asked", "answer_revealed", "scored", "skipped"]);

function parseSessionId(id: string) {
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return null;
  return sessionId;
}

function parseEventCallId(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getTriviaDb();
  const { data, error } = await db.from("trivia_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const [{ data: event }, { data: playlist }, { data: calls }, { data: cueEvent }, { data: pullEvent }, { data: promoteEvents }, { data: transportEvents }] = await Promise.all([
    session.event_id
      ? db.from("events").select("id, title, date, time, location").eq("id", session.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    session.playlist_id
      ? dbAny.from("collection_playlists").select("id, name").eq("id", session.playlist_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("trivia_session_calls")
      .select("id, call_index, status, is_tiebreaker, prep_status")
      .eq("session_id", sessionId),
    db
      .from("trivia_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "cue_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("trivia_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "pull_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("trivia_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "pull_promote")
      .order("id", { ascending: false })
      .limit(100),
    db
      .from("trivia_session_events")
      .select("event_type, payload")
      .eq("session_id", sessionId)
      .in("event_type", ["cue_set", "pull_set", "pull_promote", "call_set"])
      .order("id", { ascending: true })
      .limit(5000),
  ]);

  let prepReadyMain = 0;
  let prepReadyTie = 0;
  let prepTotalMain = 0;
  let prepTotalTie = 0;
  for (const call of (calls ?? []) as Array<{ id: number; is_tiebreaker: boolean; prep_status: string }>) {
    if (call.is_tiebreaker) {
      prepTotalTie += 1;
      if (call.prep_status === "ready") prepReadyTie += 1;
    } else {
      prepTotalMain += 1;
      if (call.prep_status === "ready") prepReadyMain += 1;
    }
  }
  const prepCompletionRatio = prepTotalMain > 0 ? prepReadyMain / prepTotalMain : 0;

  const typedCueEvent = (cueEvent ?? null) as SessionEventRow | null;
  const typedPullEvent = (pullEvent ?? null) as SessionEventRow | null;
  const cueCallId = parseEventCallId(typedCueEvent?.payload?.call_id);
  const pullCallId = parseEventCallId(typedPullEvent?.payload?.call_id);

  const promotedCallIds: number[] = [];
  const seenPromoted = new Set<number>();
  for (const row of (promoteEvents ?? []) as SessionEventRow[]) {
    const promotedCallId = parseEventCallId(row?.payload?.call_id);
    if (!promotedCallId || seenPromoted.has(promotedCallId)) continue;
    seenPromoted.add(promotedCallId);
    promotedCallIds.push(promotedCallId);
  }

  const queueIds = computeTransportQueueIds(
    ((calls ?? []) as Array<{ id: number; call_index: number; status: string }>).map((call) => ({
      id: call.id,
      order: call.call_index,
      status: call.status,
    })),
    ((transportEvents ?? []) as TransportEventRow[]).map(
      (row): TransportQueueEvent => ({
        eventType: row.event_type,
        callId: parseEventCallId(row.payload?.call_id) ?? null,
        afterCallId: parseEventCallId(row.payload?.after_call_id),
      })
    ),
    {
      currentOrder: session.current_call_index,
      doneStatuses: DONE_STATUSES,
    }
  );

  return NextResponse.json(
    {
      ...session,
      event: (event ?? null) as EventRow | null,
      playlist: (playlist ?? null) as PlaylistRow | null,
      remaining_seconds: computeTriviaRemainingSeconds(session),
      total_questions: session.round_count * session.questions_per_round,
      tie_breaker_total: session.tie_breaker_count,
      prep_ready_main: prepReadyMain,
      prep_ready_tiebreakers: prepReadyTie,
      prep_total_main: prepTotalMain,
      prep_total_tiebreakers: prepTotalTie,
      prep_completion_ratio: prepCompletionRatio,
      cue_call_id: cueCallId,
      pull_call_id: pullCallId,
      promoted_call_ids: promotedCallIds,
      transport_queue_call_ids: queueIds,
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as Record<string, unknown>;

  const allowedFields = new Set([
    "title",
    "deck_id",
    "current_round",
    "current_call_index",
    "tie_breaker_count",
    "show_title",
    "show_rounds",
    "show_question_counter",
    "show_leaderboard",
    "show_cue_hints",
    "status",
    "countdown_started_at",
    "paused_remaining_seconds",
    "paused_at",
    "started_at",
    "ended_at",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key)));

  const db = getTriviaDb();
  const { error } = await db.from("trivia_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

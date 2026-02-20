import { NextRequest, NextResponse } from "next/server";
import { getNeedleDropRouletteDb } from "src/lib/needleDropRouletteDb";
import { generateNeedleDropRouletteSessionCode } from "src/lib/needleDropRouletteSessionCode";

export const runtime = "nodejs";

type CreateSessionBody = {
  event_id?: number | null;
  title?: string;
  round_count?: number;
  answer_mode?: "slips" | "whiteboard" | "mixed";
  snippet_seconds?: number;
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_round?: boolean;
  show_scoreboard?: boolean;
  team_names?: string[];
  calls?: Array<{
    artist: string;
    title: string;
    source_label?: string;
    snippet_duration_seconds?: number;
    host_notes?: string;
  }>;
};

type SessionListRow = {
  id: number;
  event_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  answer_mode: "slips" | "whiteboard" | "mixed";
  snippet_seconds: number;
  status: string;
  current_round: number;
  created_at: string;
};

type EventRow = { id: number; title: string };

function normalizeTeamNames(teamNames: string[] | undefined): string[] {
  const names = (teamNames ?? []).map((name) => name.trim()).filter(Boolean);
  return Array.from(new Set(names));
}

function normalizeRoundCount(value: number | undefined) {
  return Math.min(12, Math.max(8, Number(value ?? 10)));
}

function normalizeSnippetSeconds(value: number | undefined) {
  return Math.min(10, Math.max(5, Number(value ?? 7)));
}

function normalizeCalls(
  calls: CreateSessionBody["calls"],
  roundCount: number,
  defaultSnippetSeconds: number
): Array<{
  artist: string;
  title: string;
  source_label: string | null;
  snippet_duration_seconds: number;
  host_notes: string | null;
}> {
  const parsed = (calls ?? [])
    .map((call) => ({
      artist: call.artist.trim(),
      title: call.title.trim(),
      source_label: call.source_label?.trim() || null,
      snippet_duration_seconds: Math.min(10, Math.max(5, Number(call.snippet_duration_seconds ?? defaultSnippetSeconds))),
      host_notes: call.host_notes?.trim() || null,
    }))
    .filter((call) => call.artist && call.title);

  if (parsed.length === 0) return [];
  return parsed.slice(0, roundCount);
}

function getRoundName(roundNumber: number, totalRounds: number): string {
  if (roundNumber === totalRounds) return "Final Round";
  return `Round ${roundNumber}`;
}

async function generateUniqueSessionCode() {
  const db = getNeedleDropRouletteDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateNeedleDropRouletteSessionCode();
    const { data } = await db.from("ndr_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

export async function GET(request: NextRequest) {
  const db = getNeedleDropRouletteDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("ndr_sessions")
    .select("id, event_id, session_code, title, round_count, answer_mode, snippet_seconds, status, current_round, created_at")
    .order("created_at", { ascending: false });

  if (eventId) query = query.eq("event_id", Number(eventId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions = (data ?? []) as SessionListRow[];
  const eventIds = Array.from(new Set(sessions.map((row) => row.event_id).filter((value): value is number => Number.isFinite(value))));

  const { data: events } = eventIds.length
    ? await db.from("events").select("id, title").in("id", eventIds)
    : { data: [] as EventRow[] };

  const eventsById = new Map<number, EventRow>(((events ?? []) as EventRow[]).map((row) => [row.id, row]));

  const sessionIds = sessions.map((session) => session.id);
  const { data: calls } = sessionIds.length
    ? await db.from("ndr_session_calls").select("session_id").in("session_id", sessionIds)
    : { data: [] as Array<{ session_id: number }> };

  const callCountBySession = new Map<number, number>();
  for (const row of (calls ?? []) as Array<{ session_id: number }>) {
    callCountBySession.set(row.session_id, (callCountBySession.get(row.session_id) ?? 0) + 1);
  }

  return NextResponse.json(
    {
      data: sessions.map((row) => ({
        ...row,
        event_title: row.event_id ? eventsById.get(row.event_id)?.title ?? null : null,
        calls_total: callCountBySession.get(row.id) ?? 0,
      })),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = getNeedleDropRouletteDb();
    const body = (await request.json()) as CreateSessionBody;

    const roundCount = normalizeRoundCount(body.round_count);
    const snippetSeconds = normalizeSnippetSeconds(body.snippet_seconds);
    const removeResleeveSeconds = Math.max(0, Number(body.remove_resleeve_seconds ?? 20));
    const findRecordSeconds = Math.max(0, Number(body.find_record_seconds ?? 12));
    const cueSeconds = Math.max(0, Number(body.cue_seconds ?? 12));
    const hostBufferSeconds = Math.max(0, Number(body.host_buffer_seconds ?? 10));
    const targetGapSeconds = removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds;

    const teamNames = normalizeTeamNames(body.team_names);
    if (teamNames.length < 2) {
      return NextResponse.json({ error: "At least 2 team names are required" }, { status: 400 });
    }

    const calls = normalizeCalls(body.calls, roundCount, snippetSeconds);
    if (calls.length < roundCount) {
      return NextResponse.json({ error: `Add at least ${roundCount} calls` }, { status: 400 });
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("ndr_sessions")
      .insert({
        event_id: body.event_id ?? null,
        session_code: code,
        title: (body.title ?? "Needle Drop Roulette Session").trim() || "Needle Drop Roulette Session",
        round_count: roundCount,
        answer_mode: body.answer_mode ?? "slips",
        snippet_seconds: snippetSeconds,
        remove_resleeve_seconds: removeResleeveSeconds,
        find_record_seconds: findRecordSeconds,
        cue_seconds: cueSeconds,
        host_buffer_seconds: hostBufferSeconds,
        target_gap_seconds: targetGapSeconds,
        current_round: 1,
        current_call_index: 0,
        show_title: body.show_title ?? true,
        show_round: body.show_round ?? true,
        show_scoreboard: body.show_scoreboard ?? true,
        status: "pending",
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      const { error: teamError } = await db.from("ndr_session_teams").insert(
        teamNames.map((name) => ({
          session_id: session.id,
          team_name: name,
          active: true,
        }))
      );
      if (teamError) throw new Error(teamError.message);

      const { error: roundError } = await db.from("ndr_session_rounds").insert(
        Array.from({ length: roundCount }, (_, index) => ({
          session_id: session.id,
          round_number: index + 1,
          round_name: getRoundName(index + 1, roundCount),
          expected_calls: 1,
          status: index === 0 ? ("active" as const) : ("pending" as const),
        }))
      );
      if (roundError) throw new Error(roundError.message);

      const { error: callError } = await db.from("ndr_session_calls").insert(
        calls.map((call, index) => ({
          session_id: session.id,
          round_number: index + 1,
          call_index: index + 1,
          source_label: call.source_label,
          artist_answer: call.artist,
          title_answer: call.title,
          snippet_start_seconds: 0,
          snippet_duration_seconds: call.snippet_duration_seconds,
          host_notes: call.host_notes,
          status: "pending" as const,
        }))
      );
      if (callError) throw new Error(callError.message);
    } catch (error) {
      await db.from("ndr_sessions").delete().eq("id", session.id);
      const message = error instanceof Error ? error.message : "Failed to create related rows";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ id: session.id, session_code: session.session_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

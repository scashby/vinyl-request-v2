import { NextRequest, NextResponse } from "next/server";
import { getSampleDetectiveDb } from "src/lib/sampleDetectiveDb";
import { generateSampleDetectiveSessionCode } from "src/lib/sampleDetectiveSessionCode";

export const runtime = "nodejs";

type CreateSessionBody = {
  event_id?: number | null;
  title?: string;
  round_count?: number;
  points_correct_pair?: number;
  bonus_both_artists_points?: number;
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_round?: boolean;
  show_scoreboard?: boolean;
  show_scoring_hint?: boolean;
  team_names?: string[];
  calls?: Array<{
    sampled_artist: string;
    sampled_title: string;
    source_artist: string;
    source_title: string;
    release_year?: number | null;
    sample_timestamp?: string;
    source_label?: string;
    host_notes?: string;
  }>;
};

type SessionListRow = {
  id: number;
  event_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
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
  return Math.min(10, Math.max(6, Number(value ?? 8)));
}

function normalizeCalls(calls: CreateSessionBody["calls"], roundCount: number) {
  const parsed = (calls ?? [])
    .map((call) => ({
      sampled_artist: call.sampled_artist.trim(),
      sampled_title: call.sampled_title.trim(),
      source_artist: call.source_artist.trim(),
      source_title: call.source_title.trim(),
      release_year: Number.isFinite(Number(call.release_year)) ? Number(call.release_year) : null,
      sample_timestamp: call.sample_timestamp?.trim() || null,
      source_label: call.source_label?.trim() || null,
      host_notes: call.host_notes?.trim() || null,
    }))
    .filter((call) => call.sampled_artist && call.sampled_title && call.source_artist && call.source_title);

  if (parsed.length === 0) return [];
  return parsed.slice(0, roundCount);
}

async function generateUniqueSessionCode() {
  const db = getSampleDetectiveDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateSampleDetectiveSessionCode();
    const { data } = await db.from("sd_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

export async function GET(request: NextRequest) {
  const db = getSampleDetectiveDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("sd_sessions")
    .select("id, event_id, session_code, title, round_count, status, current_round, created_at")
    .order("created_at", { ascending: false });

  if (eventId) query = query.eq("event_id", Number(eventId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions = (data ?? []) as SessionListRow[];
  const eventIds = Array.from(
    new Set(sessions.map((row) => row.event_id).filter((value): value is number => Number.isFinite(value)))
  );

  const { data: events } = eventIds.length
    ? await db.from("events").select("id, title").in("id", eventIds)
    : { data: [] as EventRow[] };

  const eventsById = new Map<number, EventRow>(((events ?? []) as EventRow[]).map((row) => [row.id, row]));

  const sessionIds = sessions.map((session) => session.id);
  const [{ data: calls }, { data: scores }] = await Promise.all([
    sessionIds.length
      ? db.from("sd_session_calls").select("session_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number }> }),
    sessionIds.length
      ? db.from("sd_team_scores").select("session_id, call_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number; call_id: number }> }),
  ]);

  const callCountBySession = new Map<number, number>();
  for (const row of (calls ?? []) as Array<{ session_id: number }>) {
    callCountBySession.set(row.session_id, (callCountBySession.get(row.session_id) ?? 0) + 1);
  }

  const scoredCallsBySession = new Map<number, Set<number>>();
  for (const row of (scores ?? []) as Array<{ session_id: number; call_id: number }>) {
    const set = scoredCallsBySession.get(row.session_id) ?? new Set<number>();
    set.add(row.call_id);
    scoredCallsBySession.set(row.session_id, set);
  }

  return NextResponse.json(
    {
      data: sessions.map((row) => ({
        ...row,
        event_title: row.event_id ? eventsById.get(row.event_id)?.title ?? null : null,
        calls_total: callCountBySession.get(row.id) ?? 0,
        calls_scored: scoredCallsBySession.get(row.id)?.size ?? 0,
      })),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = getSampleDetectiveDb();
    const body = (await request.json()) as CreateSessionBody;

    const roundCount = normalizeRoundCount(body.round_count);
    const removeResleeveSeconds = Math.max(0, Number(body.remove_resleeve_seconds ?? 20));
    const findRecordSeconds = Math.max(0, Number(body.find_record_seconds ?? 12));
    const cueSeconds = Math.max(0, Number(body.cue_seconds ?? 12));
    const hostBufferSeconds = Math.max(0, Number(body.host_buffer_seconds ?? 10));
    const targetGapSeconds = removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds;

    const teamNames = normalizeTeamNames(body.team_names);
    if (teamNames.length < 2) {
      return NextResponse.json({ error: "At least 2 team names are required" }, { status: 400 });
    }

    const calls = normalizeCalls(body.calls, roundCount);
    if (calls.length < roundCount) {
      return NextResponse.json({ error: `Add at least ${roundCount} sample calls` }, { status: 400 });
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("sd_sessions")
      .insert({
        event_id: body.event_id ?? null,
        session_code: code,
        title: (body.title ?? "Sample Detective Session").trim() || "Sample Detective Session",
        round_count: roundCount,
        points_correct_pair: Math.min(5, Math.max(0, Number(body.points_correct_pair ?? 2))),
        bonus_both_artists_points: Math.min(3, Math.max(0, Number(body.bonus_both_artists_points ?? 1))),
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
        show_scoring_hint: body.show_scoring_hint ?? true,
        status: "pending",
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      const { error: teamError } = await db.from("sd_session_teams").insert(
        teamNames.map((name) => ({
          session_id: session.id,
          team_name: name,
          active: true,
        }))
      );
      if (teamError) throw new Error(teamError.message);

      const { error: roundError } = await db.from("sd_session_rounds").insert(
        Array.from({ length: roundCount }).map((_, index) => ({
          session_id: session.id,
          round_number: index + 1,
          round_title: `Round ${index + 1}`,
          status: "pending" as const,
        }))
      );
      if (roundError) throw new Error(roundError.message);

      const { error: callError } = await db.from("sd_session_calls").insert(
        calls.slice(0, roundCount).map((call, index) => ({
          session_id: session.id,
          round_number: index + 1,
          call_index: index + 1,
          sampled_artist: call.sampled_artist,
          sampled_title: call.sampled_title,
          source_artist: call.source_artist,
          source_title: call.source_title,
          release_year: call.release_year,
          sample_timestamp: call.sample_timestamp,
          source_label: call.source_label,
          host_notes: call.host_notes,
          status: "pending" as const,
        }))
      );
      if (callError) throw new Error(callError.message);
    } catch (error) {
      await db.from("sd_sessions").delete().eq("id", session.id);
      throw error;
    }

    return NextResponse.json({ id: session.id, session_code: session.session_code }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    );
  }
}

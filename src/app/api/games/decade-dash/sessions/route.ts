import { NextRequest, NextResponse } from "next/server";
import { getDecadeDashDb } from "src/lib/decadeDashDb";
import { generateDecadeDashSessionCode } from "src/lib/decadeDashSessionCode";

export const runtime = "nodejs";

type CreateSessionBody = {
  event_id?: number | null;
  title?: string;
  round_count?: number;
  adjacent_scoring_enabled?: boolean;
  exact_points?: number;
  adjacent_points?: number;
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
    artist?: string;
    title?: string;
    release_year?: number | null;
    decade_start?: number;
    source_label?: string;
    accepted_adjacent_decades?: number[];
    host_notes?: string;
  }>;
};

type SessionListRow = {
  id: number;
  event_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  adjacent_scoring_enabled: boolean;
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
  return Math.min(20, Math.max(12, Number(value ?? 14)));
}

function normalizeDecadeStart(value: number | undefined | null) {
  const numeric = Number(value ?? NaN);
  if (!Number.isFinite(numeric)) return null;
  const floored = Math.floor(numeric / 10) * 10;
  if (floored < 1950 || floored > 2030) return null;
  return floored;
}

function normalizeCalls(calls: CreateSessionBody["calls"], roundCount: number) {
  const parsed = (calls ?? [])
    .map((call) => {
      const decadeStart = normalizeDecadeStart(call.decade_start ?? call.release_year ?? null);
      if (!decadeStart) return null;

      const adjacentCandidates = [decadeStart - 10, decadeStart + 10].filter(
        (decade) => decade >= 1950 && decade <= 2030
      );
      const acceptedAdjacents = Array.from(
        new Set(
          (call.accepted_adjacent_decades ?? adjacentCandidates)
            .map((decade) => normalizeDecadeStart(decade))
            .filter((decade): decade is number => Number.isFinite(decade))
        )
      ).filter((decade) => Math.abs(decade - decadeStart) === 10);

      return {
        artist: call.artist?.trim() || null,
        title: call.title?.trim() || null,
        release_year: Number.isFinite(Number(call.release_year)) ? Number(call.release_year) : null,
        decade_start: decadeStart,
        source_label: call.source_label?.trim() || null,
        accepted_adjacent_decades: acceptedAdjacents,
        host_notes: call.host_notes?.trim() || null,
      };
    })
    .filter((call): call is NonNullable<typeof call> => Boolean(call));

  if (parsed.length === 0) return [];
  return parsed.slice(0, roundCount);
}

async function generateUniqueSessionCode() {
  const db = getDecadeDashDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateDecadeDashSessionCode();
    const { data } = await db.from("dd_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

export async function GET(request: NextRequest) {
  const db = getDecadeDashDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("dd_sessions")
    .select("id, event_id, session_code, title, round_count, adjacent_scoring_enabled, status, current_round, created_at")
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
      ? db.from("dd_session_calls").select("session_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number }> }),
    sessionIds.length
      ? db.from("dd_team_scores").select("session_id, call_id").in("session_id", sessionIds)
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
    const db = getDecadeDashDb();
    const body = (await request.json()) as CreateSessionBody;

    const roundCount = normalizeRoundCount(body.round_count);
    const removeResleeveSeconds = Math.max(0, Number(body.remove_resleeve_seconds ?? 20));
    const findRecordSeconds = Math.max(0, Number(body.find_record_seconds ?? 12));
    const cueSeconds = Math.max(0, Number(body.cue_seconds ?? 12));
    const hostBufferSeconds = Math.max(0, Number(body.host_buffer_seconds ?? 10));
    const targetGapSeconds = removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds;

    const adjacentScoringEnabled = body.adjacent_scoring_enabled ?? true;
    const exactPoints = Math.min(2, Math.max(0, Number(body.exact_points ?? 2)));
    const adjacentPoints = Math.min(1, Math.max(0, Number(body.adjacent_points ?? 1)));

    const teamNames = normalizeTeamNames(body.team_names);
    if (teamNames.length < 2) {
      return NextResponse.json({ error: "At least 2 team names are required" }, { status: 400 });
    }

    const calls = normalizeCalls(body.calls, roundCount);
    if (calls.length < roundCount) {
      return NextResponse.json({ error: `Add at least ${roundCount} decade calls` }, { status: 400 });
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("dd_sessions")
      .insert({
        event_id: body.event_id ?? null,
        session_code: code,
        title: (body.title ?? "Decade Dash Session").trim() || "Decade Dash Session",
        round_count: roundCount,
        adjacent_scoring_enabled: adjacentScoringEnabled,
        exact_points: exactPoints,
        adjacent_points: adjacentPoints,
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
      const { error: teamError } = await db.from("dd_session_teams").insert(
        teamNames.map((name) => ({
          session_id: session.id,
          team_name: name,
          active: true,
        }))
      );
      if (teamError) throw new Error(teamError.message);

      const { error: roundError } = await db.from("dd_session_rounds").insert(
        Array.from({ length: roundCount }).map((_, index) => ({
          session_id: session.id,
          round_number: index + 1,
          round_title: `Round ${index + 1}`,
          status: index === 0 ? ("active" as const) : ("pending" as const),
        }))
      );
      if (roundError) throw new Error(roundError.message);

      const { error: callError } = await db.from("dd_session_calls").insert(
        calls.slice(0, roundCount).map((call, index) => ({
          session_id: session.id,
          round_number: index + 1,
          call_index: index + 1,
          source_label: call.source_label,
          artist: call.artist,
          title: call.title,
          release_year: call.release_year,
          decade_start: call.decade_start,
          accepted_adjacent_decades: call.accepted_adjacent_decades,
          host_notes: call.host_notes,
          status: "pending" as const,
        }))
      );
      if (callError) throw new Error(callError.message);
    } catch (error) {
      await db.from("dd_sessions").delete().eq("id", session.id);
      const message = error instanceof Error ? error.message : "Failed to create related rows";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ id: session.id, session_code: session.session_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

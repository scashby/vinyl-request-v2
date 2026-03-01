import { NextRequest, NextResponse } from "next/server";
import { getBackToBackConnectionDb } from "src/lib/backToBackConnectionDb";
import { generateBackToBackConnectionSessionCode } from "src/lib/backToBackConnectionSessionCode";

export const runtime = "nodejs";

type CreateSessionBody = {
  event_id?: number | null;
  playlist_id?: number;
  title?: string;
  round_count?: number;
  connection_points?: number;
  detail_bonus_points?: number;
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_round?: boolean;
  show_scoreboard?: boolean;
  show_connection_prompt?: boolean;
  team_names?: string[];
  calls?: Array<{
    track_a_artist: string;
    track_a_title: string;
    track_a_release_year?: number | null;
    track_a_source_label?: string;
    track_b_artist: string;
    track_b_title: string;
    track_b_release_year?: number | null;
    track_b_source_label?: string;
    accepted_connection: string;
    accepted_detail?: string;
    host_notes?: string;
  }>;
};

type SessionListRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  connection_points: number;
  detail_bonus_points: number;
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
  return Math.min(14, Math.max(8, Number(value ?? 10)));
}

function normalizeCalls(calls: CreateSessionBody["calls"], roundCount: number) {
  const parsed = (calls ?? [])
    .map((call) => ({
      track_a_artist: call.track_a_artist.trim(),
      track_a_title: call.track_a_title.trim(),
      track_a_release_year: Number.isFinite(Number(call.track_a_release_year)) ? Number(call.track_a_release_year) : null,
      track_a_source_label: call.track_a_source_label?.trim() || null,
      track_b_artist: call.track_b_artist.trim(),
      track_b_title: call.track_b_title.trim(),
      track_b_release_year: Number.isFinite(Number(call.track_b_release_year)) ? Number(call.track_b_release_year) : null,
      track_b_source_label: call.track_b_source_label?.trim() || null,
      accepted_connection: call.accepted_connection.trim(),
      accepted_detail: call.accepted_detail?.trim() || null,
      host_notes: call.host_notes?.trim() || null,
    }))
    .filter(
      (call) =>
        call.track_a_artist &&
        call.track_a_title &&
        call.track_b_artist &&
        call.track_b_title &&
        call.accepted_connection
    );

  if (parsed.length === 0) return [];
  return parsed.slice(0, roundCount);
}

async function generateUniqueSessionCode() {
  const db = getBackToBackConnectionDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateBackToBackConnectionSessionCode();
    const { data } = await db.from("b2bc_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

export async function GET(request: NextRequest) {
  const db = getBackToBackConnectionDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("b2bc_sessions")
    .select(
      "id, event_id, playlist_id, session_code, title, round_count, connection_points, detail_bonus_points, status, current_round, created_at"
    )
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
      ? db.from("b2bc_session_calls").select("session_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number }> }),
    sessionIds.length
      ? db.from("b2bc_team_scores").select("session_id, call_id").in("session_id", sessionIds)
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
    const db = getBackToBackConnectionDb();
    const body = (await request.json()) as CreateSessionBody;
    const playlistId = Number(body.playlist_id);
    if (!Number.isFinite(playlistId) || playlistId <= 0) {
      return NextResponse.json({ error: "playlist_id is required" }, { status: 400 });
    }

    const roundCount = normalizeRoundCount(body.round_count);
    const removeResleeveSeconds = Math.max(0, Number(body.remove_resleeve_seconds ?? 20));
    const findRecordSeconds = Math.max(0, Number(body.find_record_seconds ?? 12));
    const cueSeconds = Math.max(0, Number(body.cue_seconds ?? 12));
    const hostBufferSeconds = Math.max(0, Number(body.host_buffer_seconds ?? 10));
    const targetGapSeconds = removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds;

    const connectionPoints = Math.min(3, Math.max(0, Number(body.connection_points ?? 2)));
    const detailBonusPoints = Math.min(2, Math.max(0, Number(body.detail_bonus_points ?? 1)));

    const teamNames = normalizeTeamNames(body.team_names);
    if (teamNames.length < 2) {
      return NextResponse.json({ error: "At least 2 team names are required" }, { status: 400 });
    }

    const calls = normalizeCalls(body.calls, roundCount);
    if (calls.length < roundCount) {
      return NextResponse.json({ error: `Add at least ${roundCount} back-to-back pairs` }, { status: 400 });
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("b2bc_sessions")
      .insert({
        event_id: body.event_id ?? null,
        playlist_id: playlistId,
        session_code: code,
        title: (body.title ?? "Back-to-Back Connection Session").trim() || "Back-to-Back Connection Session",
        round_count: roundCount,
        connection_points: connectionPoints,
        detail_bonus_points: detailBonusPoints,
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
        show_connection_prompt: body.show_connection_prompt ?? true,
        status: "pending",
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      const { error: teamError } = await db.from("b2bc_session_teams").insert(
        teamNames.map((name) => ({
          session_id: session.id,
          team_name: name,
          active: true,
        }))
      );
      if (teamError) throw new Error(teamError.message);

      const { error: roundError } = await db.from("b2bc_session_rounds").insert(
        Array.from({ length: roundCount }).map((_, index) => ({
          session_id: session.id,
          round_number: index + 1,
          round_title: `Round ${index + 1}`,
          status: index === 0 ? ("active" as const) : ("pending" as const),
        }))
      );
      if (roundError) throw new Error(roundError.message);

      const { error: callError } = await db.from("b2bc_session_calls").insert(
        calls.slice(0, roundCount).map((call, index) => ({
          session_id: session.id,
          round_number: index + 1,
          call_index: index + 1,
          track_a_artist: call.track_a_artist,
          track_a_title: call.track_a_title,
          track_a_release_year: call.track_a_release_year,
          track_a_source_label: call.track_a_source_label,
          track_b_artist: call.track_b_artist,
          track_b_title: call.track_b_title,
          track_b_release_year: call.track_b_release_year,
          track_b_source_label: call.track_b_source_label,
          accepted_connection: call.accepted_connection,
          accepted_detail: call.accepted_detail,
          host_notes: call.host_notes,
          status: "pending" as const,
        }))
      );
      if (callError) throw new Error(callError.message);
    } catch (error) {
      await db.from("b2bc_sessions").delete().eq("id", session.id);
      const message = error instanceof Error ? error.message : "Failed to create related rows";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ id: session.id, session_code: session.session_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getWrongLyricChallengeDb } from "src/lib/wrongLyricChallengeDb";
import { generateWrongLyricChallengeSessionCode } from "src/lib/wrongLyricChallengeSessionCode";

export const runtime = "nodejs";

type CreateSessionBody = {
  event_id?: number | null;
  playlist_id?: number | null;
  title?: string;
  round_count?: number;
  lyric_points?: number;
  song_bonus_enabled?: boolean;
  song_bonus_points?: number;
  option_count?: number;
  reveal_mode?: "host_reads" | "jumbotron_choices";
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_round?: boolean;
  show_scoreboard?: boolean;
  show_options?: boolean;
  team_names?: string[];
  calls?: Array<{
    artist: string;
    title: string;
    correct_lyric: string;
    decoy_lyric_1: string;
    decoy_lyric_2: string;
    decoy_lyric_3?: string;
    answer_slot?: number;
    source_label?: string;
    dj_cue_hint?: string;
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
  lyric_points: number;
  song_bonus_enabled: boolean;
  song_bonus_points: number;
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

function normalizeCalls(calls: CreateSessionBody["calls"], roundCount: number, optionCount: number) {
  const parsed = (calls ?? [])
    .map((call) => ({
      artist: call.artist.trim(),
      title: call.title.trim(),
      correct_lyric: call.correct_lyric.trim(),
      decoy_lyric_1: call.decoy_lyric_1.trim(),
      decoy_lyric_2: call.decoy_lyric_2.trim(),
      decoy_lyric_3: call.decoy_lyric_3?.trim() || null,
      answer_slot: Math.max(1, Math.min(4, Number(call.answer_slot ?? 1))),
      source_label: call.source_label?.trim() || null,
      dj_cue_hint: call.dj_cue_hint?.trim() || null,
      host_notes: call.host_notes?.trim() || null,
    }))
    .filter((call) => call.artist && call.title && call.correct_lyric && call.decoy_lyric_1 && call.decoy_lyric_2)
    .filter((call) => (optionCount === 3 ? true : Boolean(call.decoy_lyric_3)));

  if (parsed.length === 0) return [];
  return parsed.slice(0, roundCount);
}

async function generateUniqueSessionCode() {
  const db = getWrongLyricChallengeDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateWrongLyricChallengeSessionCode();
    const { data } = await db.from("wlc_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

export async function GET(request: NextRequest) {
  const db = getWrongLyricChallengeDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("wlc_sessions")
    .select("id, event_id, playlist_id, session_code, title, round_count, lyric_points, song_bonus_enabled, song_bonus_points, status, current_round, created_at")
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
  const { data: calls } = sessionIds.length
    ? await db.from("wlc_session_calls").select("session_id").in("session_id", sessionIds)
    : { data: [] as Array<{ session_id: number }> };

  const callCountBySession = new Map<number, number>();
  for (const call of (calls ?? []) as Array<{ session_id: number }>) {
    callCountBySession.set(call.session_id, (callCountBySession.get(call.session_id) ?? 0) + 1);
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
    const db = getWrongLyricChallengeDb();
    const body = (await request.json()) as CreateSessionBody;

    const roundCount = normalizeRoundCount(body.round_count);
    const lyricPoints = Math.max(0, Math.min(5, Number(body.lyric_points ?? 2)));
    const songBonusEnabled = Boolean(body.song_bonus_enabled ?? true);
    const songBonusPoints = Math.max(0, Math.min(3, Number(body.song_bonus_points ?? 1)));
    const optionCount = Number(body.option_count ?? 3) === 4 ? 4 : 3;

    const removeResleeveSeconds = Math.max(0, Number(body.remove_resleeve_seconds ?? 20));
    const findRecordSeconds = Math.max(0, Number(body.find_record_seconds ?? 12));
    const cueSeconds = Math.max(0, Number(body.cue_seconds ?? 12));
    const hostBufferSeconds = Math.max(0, Number(body.host_buffer_seconds ?? 10));
    const targetGapSeconds = removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds;

    const teamNames = normalizeTeamNames(body.team_names);
    if (teamNames.length < 2) {
      return NextResponse.json({ error: "At least 2 team names are required" }, { status: 400 });
    }

    const calls = normalizeCalls(body.calls, roundCount, optionCount);
    if (calls.length < roundCount) {
      return NextResponse.json({ error: `Add at least ${roundCount} lyric calls` }, { status: 400 });
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("wlc_sessions")
      .insert({
        event_id: body.event_id ?? null,
        playlist_id: body.playlist_id ?? null,
        session_code: code,
        title: (body.title ?? "Wrong Lyric Challenge Session").trim() || "Wrong Lyric Challenge Session",
        round_count: roundCount,
        lyric_points: lyricPoints,
        song_bonus_enabled: songBonusEnabled,
        song_bonus_points: songBonusPoints,
        option_count: optionCount,
        reveal_mode: body.reveal_mode ?? "host_reads",
        remove_resleeve_seconds: removeResleeveSeconds,
        find_record_seconds: findRecordSeconds,
        cue_seconds: cueSeconds,
        host_buffer_seconds: hostBufferSeconds,
        target_gap_seconds: targetGapSeconds,
        current_round: 1,
        current_call_index: 0,
        countdown_started_at: null,
        paused_remaining_seconds: null,
        paused_at: null,
        show_title: body.show_title ?? true,
        show_round: body.show_round ?? true,
        show_scoreboard: body.show_scoreboard ?? true,
        show_options: body.show_options ?? true,
        status: "pending",
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      const { error: teamError } = await db.from("wlc_session_teams").insert(
        teamNames.map((name) => ({
          session_id: session.id,
          team_name: name,
          active: true,
        }))
      );
      if (teamError) throw new Error(teamError.message);

      const { error: roundError } = await db.from("wlc_session_rounds").insert(
        Array.from({ length: roundCount }).map((_, index) => ({
          session_id: session.id,
          round_number: index + 1,
          round_title: `Round ${index + 1}`,
          status: "pending" as const,
        }))
      );
      if (roundError) throw new Error(roundError.message);

      const { error: callError } = await db.from("wlc_session_calls").insert(
        calls.slice(0, roundCount).map((call, index) => ({
          session_id: session.id,
          round_number: index + 1,
          call_index: index + 1,
          source_label: call.source_label,
          artist: call.artist,
          title: call.title,
          correct_lyric: call.correct_lyric,
          decoy_lyric_1: call.decoy_lyric_1,
          decoy_lyric_2: call.decoy_lyric_2,
          decoy_lyric_3: optionCount === 4 ? call.decoy_lyric_3 : null,
          answer_slot: call.answer_slot,
          dj_cue_hint: call.dj_cue_hint,
          host_notes: call.host_notes,
          status: "pending" as const,
        }))
      );
      if (callError) throw new Error(callError.message);
    } catch (error) {
      await db.from("wlc_sessions").delete().eq("id", session.id);
      const message = error instanceof Error ? error.message : "Failed to create related rows";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ id: session.id, session_code: session.session_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

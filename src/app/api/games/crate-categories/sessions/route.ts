import { NextRequest, NextResponse } from "next/server";
import { getCrateCategoriesDb } from "src/lib/crateCategoriesDb";
import { generateCrateCategoriesSessionCode } from "src/lib/crateCategoriesSessionCode";

export const runtime = "nodejs";

type PromptType = "identify-thread" | "odd-one-out" | "belongs-or-bust" | "decade-lock" | "mood-match";

type CreateSessionBody = {
  event_id?: number | null;
  playlist_id?: number | null;
  title?: string;
  round_count?: number;
  default_tracks_per_round?: number;
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_round?: boolean;
  show_prompt?: boolean;
  show_scoreboard?: boolean;
  team_names?: string[];
  rounds?: Array<{
    category_label: string;
    prompt_type: PromptType;
    tracks_in_round?: number;
    points_correct?: number;
    points_bonus?: number;
  }>;
  calls?: Array<{
    round_number: number;
    track_in_round: number;
    artist: string;
    title: string;
    release_year?: number | null;
    source_label?: string;
    crate_tag?: string;
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
  status: string;
  current_round: number;
  created_at: string;
};

type EventRow = { id: number; title: string };
type PlaylistRow = { id: number; name: string };

function normalizeTeamNames(teamNames: string[] | undefined): string[] {
  const names = (teamNames ?? []).map((name) => name.trim()).filter(Boolean);
  return Array.from(new Set(names));
}

function normalizeRoundCount(value: number | undefined) {
  return Math.min(8, Math.max(3, Number(value ?? 4)));
}

function normalizePromptType(value: string | undefined): PromptType {
  const allowed: PromptType[] = ["identify-thread", "odd-one-out", "belongs-or-bust", "decade-lock", "mood-match"];
  if (value && allowed.includes(value as PromptType)) return value as PromptType;
  return "identify-thread";
}

async function generateUniqueSessionCode() {
  const db = getCrateCategoriesDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateCrateCategoriesSessionCode();
    const { data } = await db.from("ccat_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

function buildFallbackRounds(roundCount: number, tracksPerRound: number) {
  return Array.from({ length: roundCount }).map((_, index) => ({
    round_number: index + 1,
    category_label: `Round ${index + 1}`,
    prompt_type: "identify-thread" as PromptType,
    tracks_in_round: tracksPerRound,
    points_correct: 2,
    points_bonus: 1,
  }));
}

function normalizeRounds(
  rounds: CreateSessionBody["rounds"],
  roundCount: number,
  tracksPerRound: number
): Array<{
  round_number: number;
  category_label: string;
  prompt_type: PromptType;
  tracks_in_round: number;
  points_correct: number;
  points_bonus: number;
}> {
  const parsed = (rounds ?? [])
    .map((round, index) => ({
      round_number: index + 1,
      category_label: round.category_label?.trim() || `Round ${index + 1}`,
      prompt_type: normalizePromptType(round.prompt_type),
      tracks_in_round: Math.min(5, Math.max(3, Number(round.tracks_in_round ?? tracksPerRound))),
      points_correct: Math.min(5, Math.max(0, Number(round.points_correct ?? 2))),
      points_bonus: Math.min(5, Math.max(0, Number(round.points_bonus ?? 1))),
    }))
    .slice(0, roundCount);

  if (parsed.length === 0) return buildFallbackRounds(roundCount, tracksPerRound);
  while (parsed.length < roundCount) {
    const nextRound = parsed.length + 1;
    parsed.push({
      round_number: nextRound,
      category_label: `Round ${nextRound}`,
      prompt_type: "identify-thread",
      tracks_in_round: tracksPerRound,
      points_correct: 2,
      points_bonus: 1,
    });
  }
  return parsed;
}

function normalizeCalls(
  calls: CreateSessionBody["calls"],
  rounds: Array<{ round_number: number; tracks_in_round: number }>
): Array<{
  round_number: number;
  call_index: number;
  track_in_round: number;
  artist: string;
  title: string;
  release_year: number | null;
  source_label: string | null;
  crate_tag: string | null;
  host_notes: string | null;
}> {
  const roundTrackMap = new Map<number, number>(rounds.map((row) => [row.round_number, row.tracks_in_round]));

  const parsed = (calls ?? [])
    .map((call) => ({
      round_number: Number(call.round_number),
      track_in_round: Number(call.track_in_round),
      artist: call.artist?.trim() || "",
      title: call.title?.trim() || "",
      release_year: Number.isFinite(Number(call.release_year)) ? Number(call.release_year) : null,
      source_label: call.source_label?.trim() || null,
      crate_tag: call.crate_tag?.trim() || null,
      host_notes: call.host_notes?.trim() || null,
    }))
    .filter((call) => {
      const tracksInRound = roundTrackMap.get(call.round_number);
      if (!tracksInRound) return false;
      return call.artist && call.title && call.track_in_round >= 1 && call.track_in_round <= tracksInRound;
    })
    .sort((a, b) => a.round_number - b.round_number || a.track_in_round - b.track_in_round);

  return parsed.map((call, index) => ({
    ...call,
    call_index: index + 1,
  }));
}

export async function GET(request: NextRequest) {
  const db = getCrateCategoriesDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("ccat_sessions")
    .select("id, event_id, playlist_id, session_code, title, round_count, status, current_round, created_at")
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
  const playlistIds = Array.from(
    new Set(sessions.map((row) => row.playlist_id).filter((value): value is number => Number.isFinite(value)))
  );
  const { data: playlists } = playlistIds.length
    ? await db.from("collection_playlists").select("id, name").in("id", playlistIds)
    : { data: [] as PlaylistRow[] };
  const playlistById = new Map<number, PlaylistRow>(
    ((playlists ?? []) as PlaylistRow[]).map((row) => [row.id, row])
  );

  const sessionIds = sessions.map((session) => session.id);
  const [{ data: rounds }, { data: scores }] = await Promise.all([
    sessionIds.length
      ? db.from("ccat_session_rounds").select("session_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number }> }),
    sessionIds.length
      ? db.from("ccat_round_scores").select("session_id, round_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number; round_id: number }> }),
  ]);

  const roundCountBySession = new Map<number, number>();
  for (const row of (rounds ?? []) as Array<{ session_id: number }>) {
    roundCountBySession.set(row.session_id, (roundCountBySession.get(row.session_id) ?? 0) + 1);
  }

  const scoredRoundsBySession = new Map<number, Set<number>>();
  for (const row of (scores ?? []) as Array<{ session_id: number; round_id: number }>) {
    const set = scoredRoundsBySession.get(row.session_id) ?? new Set<number>();
    set.add(row.round_id);
    scoredRoundsBySession.set(row.session_id, set);
  }

  return NextResponse.json(
    {
      data: sessions.map((row) => ({
        ...row,
        event_title: row.event_id ? eventsById.get(row.event_id)?.title ?? null : null,
        playlist_name: row.playlist_id ? playlistById.get(row.playlist_id)?.name ?? null : null,
        rounds_total: roundCountBySession.get(row.id) ?? 0,
        rounds_scored: scoredRoundsBySession.get(row.id)?.size ?? 0,
      })),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = getCrateCategoriesDb();
    const body = (await request.json()) as CreateSessionBody;
    const playlistId = Number(body.playlist_id);

    if (!Number.isFinite(playlistId)) {
      return NextResponse.json({ error: "playlist_id is required" }, { status: 400 });
    }

    const { data: playlist, error: playlistError } = await db
      .from("collection_playlists")
      .select("id")
      .eq("id", playlistId)
      .maybeSingle();

    if (playlistError) return NextResponse.json({ error: playlistError.message }, { status: 500 });
    if (!playlist) return NextResponse.json({ error: "Playlist not found" }, { status: 404 });

    const roundCount = normalizeRoundCount(body.round_count);
    const tracksPerRound = Math.min(5, Math.max(3, Number(body.default_tracks_per_round ?? 4)));
    const removeResleeveSeconds = Math.max(0, Number(body.remove_resleeve_seconds ?? 20));
    const findRecordSeconds = Math.max(0, Number(body.find_record_seconds ?? 12));
    const cueSeconds = Math.max(0, Number(body.cue_seconds ?? 12));
    const hostBufferSeconds = Math.max(0, Number(body.host_buffer_seconds ?? 12));
    const targetGapSeconds = removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds;

    const teamNames = normalizeTeamNames(body.team_names);
    if (teamNames.length < 2) {
      return NextResponse.json({ error: "At least 2 team names are required" }, { status: 400 });
    }

    const rounds = normalizeRounds(body.rounds, roundCount, tracksPerRound);
    const calls = normalizeCalls(body.calls, rounds);
    const requiredCalls = rounds.reduce((sum, round) => sum + round.tracks_in_round, 0);

    if (calls.length < requiredCalls) {
      return NextResponse.json(
        { error: `Add at least ${requiredCalls} track calls to cover all round slots` },
        { status: 400 }
      );
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("ccat_sessions")
      .insert({
        event_id: body.event_id ?? null,
        playlist_id: playlistId,
        session_code: code,
        title: (body.title ?? "Crate Categories Session").trim() || "Crate Categories Session",
        round_count: roundCount,
        default_tracks_per_round: tracksPerRound,
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
        show_prompt: body.show_prompt ?? true,
        show_scoreboard: body.show_scoreboard ?? true,
        status: "pending",
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      const { error: teamError } = await db.from("ccat_session_teams").insert(
        teamNames.map((name) => ({
          session_id: session.id,
          team_name: name,
          active: true,
        }))
      );
      if (teamError) throw new Error(teamError.message);

      const { data: roundRows, error: roundError } = await db
        .from("ccat_session_rounds")
        .insert(
          rounds.map((round) => ({
            session_id: session.id,
            round_number: round.round_number,
            category_label: round.category_label,
            prompt_type: round.prompt_type,
            tracks_in_round: round.tracks_in_round,
            points_correct: round.points_correct,
            points_bonus: round.points_bonus,
            status: round.round_number === 1 ? ("active" as const) : ("pending" as const),
          }))
        )
        .select("id");
      if (roundError) throw new Error(roundError.message);

      const insertedRounds = (roundRows ?? []).length;
      if (insertedRounds !== roundCount) throw new Error("Failed to create all rounds");

      const { error: callError } = await db.from("ccat_session_calls").insert(
        calls.slice(0, requiredCalls).map((call) => ({
          session_id: session.id,
          round_number: call.round_number,
          call_index: call.call_index,
          track_in_round: call.track_in_round,
          artist: call.artist,
          title: call.title,
          release_year: call.release_year,
          source_label: call.source_label,
          crate_tag: call.crate_tag,
          host_notes: call.host_notes,
          status: "pending" as const,
        }))
      );
      if (callError) throw new Error(callError.message);
    } catch (error) {
      await db.from("ccat_sessions").delete().eq("id", session.id);
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

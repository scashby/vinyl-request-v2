import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { generateTriviaSessionCode } from "src/lib/triviaSessionCode";
import { generateTriviaSessionCalls, type TriviaDifficulty, type TriviaScoreMode } from "src/lib/triviaEngine";
import { getBingoDb } from "src/lib/bingoDb";
import { getPlaylistTrackCount } from "src/lib/bingoEngine";

export const runtime = "nodejs";

type CreateSessionBody = {
  event_id?: number | null;
  playlist_id?: number;
  title?: string;
  round_count?: number;
  questions_per_round?: number;
  tie_breaker_count?: number;
  score_mode?: TriviaScoreMode;
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_rounds?: boolean;
  show_question_counter?: boolean;
  show_leaderboard?: boolean;
  categories?: string[];
  difficulty_targets?: Partial<Record<TriviaDifficulty, number>>;
  max_teams?: number | null;
  slips_batch_size?: number | null;
  team_names?: string[];
};

type SessionListRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  questions_per_round: number;
  tie_breaker_count: number;
  score_mode: TriviaScoreMode;
  current_round: number;
  status: string;
  created_at: string;
};

type EventRow = { id: number; title: string; date: string };
type PlaylistRow = { id: number; name: string };

function normalizeTeamNames(teamNames: string[] | undefined): string[] {
  const names = (teamNames ?? []).map((name) => name.trim()).filter(Boolean);
  return Array.from(new Set(names));
}

function normalizeCategories(values: string[] | undefined): string[] {
  const categories = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return categories.length > 0 ? categories : ["General Music", "Classic Rock", "Soul & Funk", "Hip-Hop", "80s"];
}

async function generateUniqueSessionCode() {
  const db = getTriviaDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateTriviaSessionCode();
    const { data } = await db.from("trivia_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

export async function GET(request: NextRequest) {
  const db = getTriviaDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("trivia_sessions")
    .select("id, event_id, playlist_id, session_code, title, round_count, questions_per_round, tie_breaker_count, score_mode, current_round, status, created_at")
    .order("created_at", { ascending: false });

  if (eventId) query = query.eq("event_id", Number(eventId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions = (data ?? []) as SessionListRow[];
  const eventIds = Array.from(new Set(sessions.map((row) => row.event_id).filter((value): value is number => Number.isFinite(value))));

  const { data: events } = eventIds.length
    ? await db.from("events").select("id, title, date").in("id", eventIds)
    : { data: [] as EventRow[] };
  const eventsById = new Map<number, EventRow>(((events ?? []) as EventRow[]).map((row) => [row.id, row]));

  const playlistIds = Array.from(
    new Set(sessions.map((row) => row.playlist_id).filter((value): value is number => Number.isFinite(value)))
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const { data: playlists } = playlistIds.length
    ? await dbAny.from("collection_playlists").select("id, name").in("id", playlistIds)
    : { data: [] as PlaylistRow[] };
  const playlistById = new Map<number, PlaylistRow>(((playlists ?? []) as PlaylistRow[]).map((row) => [row.id, row]));

  const sessionIds = sessions.map((session) => session.id);
  const { data: callRows } = sessionIds.length
    ? await db
      .from("trivia_session_calls")
      .select("session_id, is_tiebreaker, prep_status")
      .in("session_id", sessionIds)
    : { data: [] as Array<{ session_id: number; is_tiebreaker: boolean; prep_status: string }> };

  const prepBySession = new Map<number, {
    mainTotal: number;
    mainReady: number;
    tieTotal: number;
    tieReady: number;
  }>();
  for (const row of (callRows ?? []) as Array<{ session_id: number; is_tiebreaker: boolean; prep_status: string }>) {
    const current = prepBySession.get(row.session_id) ?? {
      mainTotal: 0,
      mainReady: 0,
      tieTotal: 0,
      tieReady: 0,
    };
    if (row.is_tiebreaker) {
      current.tieTotal += 1;
      if (row.prep_status === "ready") current.tieReady += 1;
    } else {
      current.mainTotal += 1;
      if (row.prep_status === "ready") current.mainReady += 1;
    }
    prepBySession.set(row.session_id, current);
  }

  return NextResponse.json(
    {
      data: sessions.map((row) => ({
        ...row,
        event_title: row.event_id ? eventsById.get(row.event_id)?.title ?? null : null,
        playlist_name: row.playlist_id ? playlistById.get(row.playlist_id)?.name ?? null : null,
        total_questions: row.round_count * row.questions_per_round,
        prep_main_ready: prepBySession.get(row.id)?.mainReady ?? 0,
        prep_main_total: prepBySession.get(row.id)?.mainTotal ?? 0,
        prep_tiebreaker_ready: prepBySession.get(row.id)?.tieReady ?? 0,
        prep_tiebreaker_total: prepBySession.get(row.id)?.tieTotal ?? 0,
      })),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = getTriviaDb();
    const body = (await request.json()) as CreateSessionBody;

    const playlistId = Number(body.playlist_id);
    if (!Number.isFinite(playlistId) || playlistId <= 0) {
      return NextResponse.json({ error: "playlist_id is required" }, { status: 400 });
    }

    const roundCount = Math.max(1, Number(body.round_count ?? 3));
    const questionsPerRound = Math.max(1, Number(body.questions_per_round ?? 5));
    const tieBreakerCount = Math.max(0, Number(body.tie_breaker_count ?? 2));
    const scoreMode = (body.score_mode ?? "difficulty_bonus_static") as TriviaScoreMode;
    const removeResleeveSeconds = Math.max(0, Number(body.remove_resleeve_seconds ?? 20));
    const findRecordSeconds = Math.max(0, Number(body.find_record_seconds ?? 12));
    const cueSeconds = Math.max(0, Number(body.cue_seconds ?? 12));
    const hostBufferSeconds = Math.max(0, Number(body.host_buffer_seconds ?? 8));
    const targetGapSeconds = removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds;

    const categories = normalizeCategories(body.categories);
    const teams = normalizeTeamNames(body.team_names);

    if (teams.length < 2) {
      return NextResponse.json({ error: "At least 2 teams are required" }, { status: 400 });
    }

    const requiredTracks = (roundCount * questionsPerRound) + tieBreakerCount;
    const playlistTrackCount = await getPlaylistTrackCount(getBingoDb(), playlistId);
    if (playlistTrackCount < requiredTracks) {
      return NextResponse.json(
        {
          error: `Selected playlist has ${playlistTrackCount} playable tracks. This setup needs at least ${requiredTracks}.`,
        },
        { status: 400 }
      );
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("trivia_sessions")
      .insert({
        event_id: body.event_id ?? null,
        playlist_id: playlistId,
        session_code: code,
        title: (body.title ?? "Music Trivia Session").trim() || "Music Trivia Session",
        round_count: roundCount,
        questions_per_round: questionsPerRound,
        tie_breaker_count: tieBreakerCount,
        score_mode: scoreMode,
        question_categories: categories,
        difficulty_easy_target: Math.max(0, Number(body.difficulty_targets?.easy ?? 2)),
        difficulty_medium_target: Math.max(0, Number(body.difficulty_targets?.medium ?? 2)),
        difficulty_hard_target: Math.max(0, Number(body.difficulty_targets?.hard ?? 1)),
        remove_resleeve_seconds: removeResleeveSeconds,
        find_record_seconds: findRecordSeconds,
        cue_seconds: cueSeconds,
        host_buffer_seconds: hostBufferSeconds,
        target_gap_seconds: targetGapSeconds,
        show_title: body.show_title ?? true,
        show_rounds: body.show_rounds ?? true,
        show_question_counter: body.show_question_counter ?? true,
        show_leaderboard: body.show_leaderboard ?? true,
        max_teams: body.max_teams ?? null,
        slips_batch_size: body.slips_batch_size ?? null,
        status: "pending",
        current_round: 1,
        current_call_index: 0,
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      const { error: teamsError } = await db.from("trivia_session_teams").insert(
        teams.map((teamName) => ({
          session_id: session.id,
          team_name: teamName,
          active: true,
        }))
      );
      if (teamsError) throw new Error(teamsError.message);

      await generateTriviaSessionCalls(db, {
        sessionId: session.id,
        playlistId,
        roundCount,
        questionsPerRound,
        tieBreakerCount,
        categories,
        scoreMode,
        difficultyTargets: {
          easy: Math.max(0, Number(body.difficulty_targets?.easy ?? 2)),
          medium: Math.max(0, Number(body.difficulty_targets?.medium ?? 2)),
          hard: Math.max(0, Number(body.difficulty_targets?.hard ?? 1)),
        },
      });
    } catch (error) {
      await db.from("trivia_sessions").delete().eq("id", session.id);
      const message = error instanceof Error ? error.message : "Failed to generate team/call data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ id: session.id, session_code: session.session_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getArtistAliasDb } from "src/lib/artistAliasDb";
import { generateArtistAliasSessionCode } from "src/lib/artistAliasSessionCode";

export const runtime = "nodejs";

type CreateSessionBody = {
  event_id?: number | null;
  title?: string;
  round_count?: number;
  stage_one_points?: number;
  stage_two_points?: number;
  final_reveal_points?: number;
  audio_clue_enabled?: boolean;
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_round?: boolean;
  show_scoreboard?: boolean;
  show_stage_hint?: boolean;
  team_names?: string[];
  calls?: Array<{
    artist_name: string;
    accepted_aliases?: string[];
    clue_era: string;
    clue_collaborator: string;
    clue_label_region: string;
    audio_clue_source?: string;
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
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
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

function normalizeAliases(aliases: string[] | undefined): string[] {
  return Array.from(new Set((aliases ?? []).map((alias) => alias.trim()).filter(Boolean)));
}

function normalizeCalls(calls: CreateSessionBody["calls"], roundCount: number) {
  const parsed = (calls ?? [])
    .map((call) => ({
      artist_name: call.artist_name?.trim() ?? "",
      accepted_aliases: normalizeAliases(call.accepted_aliases),
      clue_era: call.clue_era?.trim() ?? "",
      clue_collaborator: call.clue_collaborator?.trim() ?? "",
      clue_label_region: call.clue_label_region?.trim() ?? "",
      audio_clue_source: call.audio_clue_source?.trim() || null,
      source_label: call.source_label?.trim() || null,
      host_notes: call.host_notes?.trim() || null,
    }))
    .filter((call) => call.artist_name && call.clue_era && call.clue_collaborator && call.clue_label_region);

  if (parsed.length === 0) return [];
  return parsed.slice(0, roundCount);
}

async function generateUniqueSessionCode() {
  const db = getArtistAliasDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateArtistAliasSessionCode();
    const { data } = await db.from("aa_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

export async function GET(request: NextRequest) {
  const db = getArtistAliasDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("aa_sessions")
    .select("id, event_id, session_code, title, round_count, stage_one_points, stage_two_points, final_reveal_points, status, current_round, created_at")
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
  const [{ data: calls }, { data: scores }] = await Promise.all([
    sessionIds.length
      ? db.from("aa_session_calls").select("session_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number }> }),
    sessionIds.length
      ? db.from("aa_team_scores").select("session_id, call_id").in("session_id", sessionIds)
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
    const db = getArtistAliasDb();
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
      return NextResponse.json({ error: `Add at least ${roundCount} artist alias clue cards` }, { status: 400 });
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("aa_sessions")
      .insert({
        event_id: body.event_id ?? null,
        session_code: code,
        title: (body.title ?? "Artist Alias Session").trim() || "Artist Alias Session",
        round_count: roundCount,
        stage_one_points: Math.min(5, Math.max(0, Number(body.stage_one_points ?? 3))),
        stage_two_points: Math.min(5, Math.max(0, Number(body.stage_two_points ?? 2))),
        final_reveal_points: Math.min(5, Math.max(0, Number(body.final_reveal_points ?? 1))),
        audio_clue_enabled: body.audio_clue_enabled ?? true,
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
        show_stage_hint: body.show_stage_hint ?? true,
        status: "pending",
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      const { error: teamError } = await db.from("aa_session_teams").insert(
        teamNames.map((name) => ({
          session_id: session.id,
          team_name: name,
          active: true,
        }))
      );
      if (teamError) throw new Error(teamError.message);

      const { error: roundError } = await db.from("aa_session_rounds").insert(
        Array.from({ length: roundCount }).map((_, index) => ({
          session_id: session.id,
          round_number: index + 1,
          round_title: `Round ${index + 1}`,
          status: "pending" as const,
        }))
      );
      if (roundError) throw new Error(roundError.message);

      const { error: callError } = await db.from("aa_session_calls").insert(
        calls.slice(0, roundCount).map((call, index) => ({
          session_id: session.id,
          round_number: index + 1,
          call_index: index + 1,
          artist_name: call.artist_name,
          accepted_aliases: call.accepted_aliases,
          clue_era: call.clue_era,
          clue_collaborator: call.clue_collaborator,
          clue_label_region: call.clue_label_region,
          audio_clue_source: call.audio_clue_source,
          source_label: call.source_label,
          host_notes: call.host_notes,
          status: "pending" as const,
          stage_revealed: 0,
        }))
      );
      if (callError) throw new Error(callError.message);
    } catch (error) {
      await db.from("aa_sessions").delete().eq("id", session.id);
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

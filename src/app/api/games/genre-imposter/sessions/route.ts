import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";
import { generateGenreImposterSessionCode } from "src/lib/genreImposterSessionCode";

export const runtime = "nodejs";

type RoundDraft = {
  category_label: string;
  category_card_note?: string;
  reason_key?: string;
  imposter_call_index?: number;
  calls?: Array<{
    call_index?: number;
    play_order?: number;
    source_label?: string;
    artist?: string;
    title?: string;
    record_label?: string;
    host_notes?: string;
  }>;
};

type CreateSessionBody = {
  event_id?: number | null;
  title?: string;
  round_count?: number;
  reveal_mode?: "after_third_spin" | "immediate";
  reason_mode?: "host_judged" | "strict_key";
  imposter_points?: number;
  reason_bonus_points?: number;
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_round?: boolean;
  show_category?: boolean;
  show_scoreboard?: boolean;
  team_names?: string[];
  rounds?: RoundDraft[];
};

type SessionListRow = {
  id: number;
  event_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  reveal_mode: "after_third_spin" | "immediate";
  reason_mode: "host_judged" | "strict_key";
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
  return Math.min(15, Math.max(6, Number(value ?? 8)));
}

function normalizeRounds(rounds: RoundDraft[] | undefined, roundCount: number) {
  const source = (rounds ?? [])
    .map((round, index) => {
      const calls = Array.from({ length: 3 }, (_, callOffset) => {
        const provided = round.calls?.[callOffset] ?? {};
        const callIndex = callOffset + 1;
        return {
          call_index: callIndex,
          play_order: Number(provided.play_order ?? provided.call_index ?? callIndex),
          source_label: provided.source_label?.trim() || null,
          artist: provided.artist?.trim() || null,
          title: provided.title?.trim() || null,
          record_label: provided.record_label?.trim() || null,
          host_notes: provided.host_notes?.trim() || null,
        };
      });

      const imposterCallIndex = Math.min(3, Math.max(1, Number(round.imposter_call_index ?? 3)));

      return {
        round_number: index + 1,
        category_label: round.category_label?.trim() ?? "",
        category_card_note: round.category_card_note?.trim() || null,
        reason_key: round.reason_key?.trim() || null,
        imposter_call_index: imposterCallIndex,
        calls,
      };
    })
    .filter((round) => round.category_label);

  return source.slice(0, roundCount);
}

async function generateUniqueSessionCode() {
  const db = getGenreImposterDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateGenreImposterSessionCode();
    const { data } = await db.from("gi_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

export async function GET(request: NextRequest) {
  const db = getGenreImposterDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("gi_sessions")
    .select("id, event_id, session_code, title, round_count, reveal_mode, reason_mode, status, current_round, created_at")
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

  const [{ data: rounds }, { data: picks }] = await Promise.all([
    sessionIds.length ? db.from("gi_session_rounds").select("session_id").in("session_id", sessionIds) : Promise.resolve({ data: [] as Array<{ session_id: number }> }),
    sessionIds.length ? db.from("gi_round_team_picks").select("session_id").in("session_id", sessionIds) : Promise.resolve({ data: [] as Array<{ session_id: number }> }),
  ]);

  const roundsBySession = new Map<number, number>();
  for (const row of (rounds ?? []) as Array<{ session_id: number }>) {
    roundsBySession.set(row.session_id, (roundsBySession.get(row.session_id) ?? 0) + 1);
  }

  const picksBySession = new Map<number, number>();
  for (const row of (picks ?? []) as Array<{ session_id: number }>) {
    picksBySession.set(row.session_id, (picksBySession.get(row.session_id) ?? 0) + 1);
  }

  return NextResponse.json(
    {
      data: sessions.map((row) => ({
        ...row,
        event_title: row.event_id ? eventsById.get(row.event_id)?.title ?? null : null,
        rounds_total: roundsBySession.get(row.id) ?? 0,
        picks_logged: picksBySession.get(row.id) ?? 0,
      })),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = getGenreImposterDb();
    const body = (await request.json()) as CreateSessionBody;

    const roundCount = normalizeRoundCount(body.round_count);
    const removeResleeveSeconds = Math.max(0, Number(body.remove_resleeve_seconds ?? 20));
    const findRecordSeconds = Math.max(0, Number(body.find_record_seconds ?? 12));
    const cueSeconds = Math.max(0, Number(body.cue_seconds ?? 12));
    const hostBufferSeconds = Math.max(0, Number(body.host_buffer_seconds ?? 10));
    const targetGapSeconds = removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds;

    const imposterPoints = Math.min(5, Math.max(0, Number(body.imposter_points ?? 2)));
    const reasonBonusPoints = Math.min(3, Math.max(0, Number(body.reason_bonus_points ?? 1)));

    const teamNames = normalizeTeamNames(body.team_names);
    if (teamNames.length < 2) {
      return NextResponse.json({ error: "At least 2 team names are required" }, { status: 400 });
    }

    const rounds = normalizeRounds(body.rounds, roundCount);
    if (rounds.length < roundCount) {
      return NextResponse.json({ error: `Add at least ${roundCount} complete rounds` }, { status: 400 });
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("gi_sessions")
      .insert({
        event_id: body.event_id ?? null,
        session_code: code,
        title: (body.title ?? "Genre Imposter Session").trim() || "Genre Imposter Session",
        round_count: roundCount,
        reveal_mode: body.reveal_mode ?? "after_third_spin",
        reason_mode: body.reason_mode ?? "host_judged",
        imposter_points: imposterPoints,
        reason_bonus_points: reasonBonusPoints,
        remove_resleeve_seconds: removeResleeveSeconds,
        find_record_seconds: findRecordSeconds,
        cue_seconds: cueSeconds,
        host_buffer_seconds: hostBufferSeconds,
        target_gap_seconds: targetGapSeconds,
        current_round: 1,
        current_call_index: 0,
        show_title: body.show_title ?? true,
        show_round: body.show_round ?? true,
        show_category: body.show_category ?? true,
        show_scoreboard: body.show_scoreboard ?? true,
        status: "pending",
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      const { error: teamError } = await db.from("gi_session_teams").insert(
        teamNames.map((name) => ({
          session_id: session.id,
          team_name: name,
          active: true,
        }))
      );
      if (teamError) throw new Error(teamError.message);

      const { data: insertedRounds, error: roundError } = await db
        .from("gi_session_rounds")
        .insert(
          rounds.map((round, index) => ({
            session_id: session.id,
            round_number: index + 1,
            category_label: round.category_label,
            category_card_note: round.category_card_note,
            reason_key: round.reason_key,
            imposter_call_index: round.imposter_call_index,
            status: index === 0 ? ("active" as const) : ("pending" as const),
          }))
        )
        .select("id, round_number");

      if (roundError || !insertedRounds) throw new Error(roundError?.message ?? "Failed to insert rounds");

      const roundIdByNumber = new Map<number, number>(insertedRounds.map((round) => [round.round_number as number, round.id as number]));

      const callsToInsert = rounds.flatMap((round) => {
        const roundId = roundIdByNumber.get(round.round_number);
        if (!roundId) return [];

        return round.calls.map((call) => ({
          session_id: session.id,
          round_id: roundId,
          round_number: round.round_number,
          call_index: call.call_index,
          play_order: call.play_order,
          source_label: call.source_label,
          artist: call.artist,
          title: call.title,
          record_label: call.record_label,
          fits_category: call.call_index !== round.imposter_call_index,
          is_imposter: call.call_index === round.imposter_call_index,
          host_notes: call.host_notes,
          status: "pending" as const,
        }));
      });

      const { error: callError } = await db.from("gi_session_calls").insert(callsToInsert);
      if (callError) throw new Error(callError.message);
    } catch (error) {
      await db.from("gi_sessions").delete().eq("id", session.id);
      const message = error instanceof Error ? error.message : "Failed to create related rows";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ id: session.id, session_code: session.session_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

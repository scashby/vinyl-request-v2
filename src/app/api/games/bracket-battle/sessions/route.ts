import { NextRequest, NextResponse } from "next/server";
import { generateBracketBattleSessionCode } from "src/lib/bracketBattleSessionCode";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

type CreateSessionBody = {
  event_id?: number | null;
  playlist_id?: number | null;
  title?: string;
  bracket_size?: number;
  vote_method?: "hands" | "slips";
  scoring_model?: "round_weighted" | "flat_per_hit";
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_round?: boolean;
  show_bracket?: boolean;
  show_scoreboard?: boolean;
  team_names?: string[];
  entries?: Array<{
    seed?: number;
    entry_label: string;
    artist?: string;
    title?: string;
    source_label?: string;
  }>;
};

type SessionListRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  bracket_size: number;
  vote_method: "hands" | "slips";
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

function normalizeBracketSize(size: number | undefined): 4 | 8 | 16 {
  const value = Number(size ?? 8);
  if (value >= 16) return 16;
  if (value <= 4) return 4;
  return 8;
}

function normalizeEntries(
  entries: CreateSessionBody["entries"],
  bracketSize: number
): Array<{
  seed: number;
  entry_label: string;
  artist: string | null;
  title: string | null;
  source_label: string | null;
}> {
  const parsed = (entries ?? [])
    .map((entry, index) => ({
      seed: Number(entry.seed ?? index + 1),
      entry_label: entry.entry_label?.trim() ?? "",
      artist: entry.artist?.trim() || null,
      title: entry.title?.trim() || null,
      source_label: entry.source_label?.trim() || null,
    }))
    .filter((entry) => entry.seed > 0 && entry.entry_label);

  const dedupedBySeed = new Map<number, (typeof parsed)[number]>();
  for (const entry of parsed) {
    if (!dedupedBySeed.has(entry.seed)) dedupedBySeed.set(entry.seed, entry);
  }

  const normalized = Array.from(dedupedBySeed.values()).sort((a, b) => a.seed - b.seed);
  return normalized.slice(0, bracketSize);
}

function getRoundName(roundNumber: number, totalRounds: number): string {
  if (totalRounds === 2) return roundNumber === 1 ? "Semifinals" : "Final";
  if (totalRounds === 3) return roundNumber === 1 ? "Quarterfinals" : roundNumber === 2 ? "Semifinals" : "Final";
  if (totalRounds === 4) {
    if (roundNumber === 1) return "Round of 16";
    if (roundNumber === 2) return "Quarterfinals";
    if (roundNumber === 3) return "Semifinals";
    return "Final";
  }
  return `Round ${roundNumber}`;
}

async function generateUniqueSessionCode() {
  const db = getBracketBattleDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateBracketBattleSessionCode();
    const { data } = await db.from("bb_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

export async function GET(request: NextRequest) {
  const db = getBracketBattleDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("bb_sessions")
    .select("id, event_id, playlist_id, session_code, title, bracket_size, vote_method, status, current_round, created_at")
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
  const playlistIds = Array.from(
    new Set(sessions.map((row) => row.playlist_id).filter((value): value is number => Number.isFinite(value)))
  );
  const { data: playlists } = playlistIds.length
    ? await db.from("collection_playlists").select("id, name").in("id", playlistIds)
    : { data: [] as PlaylistRow[] };
  const playlistsById = new Map<number, PlaylistRow>(((playlists ?? []) as PlaylistRow[]).map((row) => [row.id, row]));

  const sessionIds = sessions.map((session) => session.id);
  const { data: matchups } = sessionIds.length
    ? await db.from("bb_session_matchups").select("session_id").in("session_id", sessionIds)
    : { data: [] as Array<{ session_id: number }> };

  const matchupCountBySession = new Map<number, number>();
  for (const row of (matchups ?? []) as Array<{ session_id: number }>) {
    matchupCountBySession.set(row.session_id, (matchupCountBySession.get(row.session_id) ?? 0) + 1);
  }

  return NextResponse.json(
    {
      data: sessions.map((row) => ({
        ...row,
        event_title: row.event_id ? eventsById.get(row.event_id)?.title ?? null : null,
        playlist_name: row.playlist_id ? playlistsById.get(row.playlist_id)?.name ?? null : null,
        matchups_total: matchupCountBySession.get(row.id) ?? 0,
      })),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = getBracketBattleDb();
    const body = (await request.json()) as CreateSessionBody;
    const playlistId = Number(body.playlist_id);

    if (!Number.isFinite(playlistId) || playlistId <= 0) {
      return NextResponse.json({ error: "playlist_id is required" }, { status: 400 });
    }

    const { data: playlist, error: playlistError } = await db
      .from("collection_playlists")
      .select("id")
      .eq("id", playlistId)
      .maybeSingle();

    if (playlistError) return NextResponse.json({ error: playlistError.message }, { status: 500 });
    if (!playlist) return NextResponse.json({ error: "Playlist not found" }, { status: 404 });

    const bracketSize = normalizeBracketSize(body.bracket_size);
    const removeResleeveSeconds = Math.max(0, Number(body.remove_resleeve_seconds ?? 20));
    const findRecordSeconds = Math.max(0, Number(body.find_record_seconds ?? 12));
    const cueSeconds = Math.max(0, Number(body.cue_seconds ?? 12));
    const hostBufferSeconds = Math.max(0, Number(body.host_buffer_seconds ?? 10));
    const targetGapSeconds = removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds;

    const teamNames = normalizeTeamNames(body.team_names);
    if (teamNames.length < 2) {
      return NextResponse.json({ error: "At least 2 team names are required" }, { status: 400 });
    }

    const entries = normalizeEntries(body.entries, bracketSize);
    if (entries.length < bracketSize) {
      return NextResponse.json({ error: `Add ${bracketSize} seeded entries for this bracket size` }, { status: 400 });
    }

    const expectedSeeds = Array.from({ length: bracketSize }, (_, idx) => idx + 1);
    const hasRequiredSeeds = expectedSeeds.every((seed) => entries.some((entry) => entry.seed === seed));
    if (!hasRequiredSeeds) {
      return NextResponse.json({ error: `Entries must include seeds 1 through ${bracketSize}` }, { status: 400 });
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("bb_sessions")
      .insert({
        event_id: body.event_id ?? null,
        playlist_id: playlistId,
        session_code: code,
        title: (body.title ?? "Bracket Battle Session").trim() || "Bracket Battle Session",
        bracket_size: bracketSize,
        vote_method: body.vote_method ?? "hands",
        scoring_model: body.scoring_model ?? "round_weighted",
        remove_resleeve_seconds: removeResleeveSeconds,
        find_record_seconds: findRecordSeconds,
        cue_seconds: cueSeconds,
        host_buffer_seconds: hostBufferSeconds,
        target_gap_seconds: targetGapSeconds,
        current_round: 1,
        current_matchup_index: 0,
        show_title: body.show_title ?? true,
        show_round: body.show_round ?? true,
        show_bracket: body.show_bracket ?? true,
        show_scoreboard: body.show_scoreboard ?? true,
        status: "pending",
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      const { data: insertedEntries, error: entryError } = await db
        .from("bb_session_entries")
        .insert(
          entries.map((entry) => ({
            session_id: session.id,
            seed: entry.seed,
            entry_label: entry.entry_label,
            artist: entry.artist,
            title: entry.title,
            source_label: entry.source_label,
          }))
        )
        .select("id, seed");
      if (entryError || !insertedEntries) throw new Error(entryError?.message ?? "Failed to create entries");

      const entriesBySeed = new Map<number, number>(insertedEntries.map((row) => [row.seed as number, row.id as number]));

      const { error: teamError } = await db.from("bb_session_teams").insert(
        teamNames.map((name) => ({
          session_id: session.id,
          team_name: name,
          active: true,
        }))
      );
      if (teamError) throw new Error(teamError.message);

      const totalRounds = Math.log2(bracketSize);
      const rounds = Array.from({ length: totalRounds }, (_, index) => {
        const roundNumber = index + 1;
        return {
          session_id: session.id,
          round_number: roundNumber,
          round_name: getRoundName(roundNumber, totalRounds),
          expected_matchups: bracketSize / Math.pow(2, roundNumber),
          status: roundNumber === 1 ? ("active" as const) : ("pending" as const),
        };
      });

      const { error: roundError } = await db.from("bb_session_rounds").insert(rounds);
      if (roundError) throw new Error(roundError.message);

      const firstRoundMatchups = Array.from({ length: bracketSize / 2 }, (_, index) => {
        const highSeed = index + 1;
        const lowSeed = bracketSize - index;
        return {
          session_id: session.id,
          round_number: 1,
          matchup_index: index + 1,
          higher_seed_entry_id: entriesBySeed.get(highSeed) ?? null,
          lower_seed_entry_id: entriesBySeed.get(lowSeed) ?? null,
          vote_method: body.vote_method ?? "hands",
          status: "pending" as const,
        };
      });

      const { error: matchupError } = await db.from("bb_session_matchups").insert(firstRoundMatchups);
      if (matchupError) throw new Error(matchupError.message);
    } catch (error) {
      await db.from("bb_sessions").delete().eq("id", session.id);
      const message = error instanceof Error ? error.message : "Failed to create related rows";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ id: session.id, session_code: session.session_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

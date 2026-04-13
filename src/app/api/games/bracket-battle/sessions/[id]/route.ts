import { NextRequest, NextResponse } from "next/server";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  bracket_size: number;
  vote_method: "hands" | "slips";
  scoring_model: "round_weighted" | "flat_per_hit";
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
  target_gap_seconds: number;
  current_round: number;
  current_matchup_index: number;
  show_title: boolean;
  show_logo: boolean;
  show_round: boolean;
  show_bracket: boolean;
  show_scoreboard: boolean;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  default_intermission_seconds: number;
  status: "pending" | "running" | "paused" | "completed";
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  venue_logo_url: string | null;
};
type PlaylistRow = { id: number; name: string };
type TeamRow = { id: number; team_name: string; active: boolean };
type EntryRow = {
  id: number;
  seed: number;
  entry_label: string;
  artist: string | null;
  title: string | null;
  source_label: string | null;
  active: boolean;
};
type RoundRow = {
  round_number: number;
  round_name: string;
  expected_matchups: number;
  status: "pending" | "active" | "closed";
};
type MatchupRow = {
  id: number;
  round_number: number;
  matchup_index: number;
  higher_seed_entry_id: number | null;
  lower_seed_entry_id: number | null;
  winner_entry_id: number | null;
  vote_method: "hands" | "slips";
  status: "pending" | "active" | "voting_locked" | "scored" | "skipped";
  opened_at: string | null;
  voting_locked_at: string | null;
  winner_confirmed_at: string | null;
  notes: string | null;
};
type ScoreRow = {
  team_id: number;
  total_points: number;
  tie_break_points: number;
};
type VoteTallyRow = {
  matchup_id: number;
  winner_entry_id: number;
  vote_count: number;
};

type OverlayEventRow = {
  payload: { mode: string; duration_seconds: number | null; started_at: string; ends_at: string | null } | null;
};

function parseSessionId(id: string) {
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return null;
  return sessionId;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBracketBattleDb();
  const { data, error } = await db.from("bb_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;

  const [
    { data: event },
    { data: playlist },
    { data: teams },
    { data: rounds },
    { data: entries },
    { data: matchups },
    { data: scores },
    { data: voteTallies },
  ] = await Promise.all([
    session.event_id
      ? db.from("events").select("id, title, date, time, location, venue_logo_url").eq("id", session.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    session.playlist_id
      ? db.from("collection_playlists").select("id, name").eq("id", session.playlist_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("bb_session_teams").select("id, team_name, active").eq("session_id", sessionId).order("team_name", { ascending: true }),
    db.from("bb_session_rounds").select("round_number, round_name, expected_matchups, status").eq("session_id", sessionId).order("round_number", { ascending: true }),
    db.from("bb_session_entries").select("id, seed, entry_label, artist, title, source_label, active").eq("session_id", sessionId).order("seed", { ascending: true }),
    db.from("bb_session_matchups").select("id, round_number, matchup_index, higher_seed_entry_id, lower_seed_entry_id, winner_entry_id, vote_method, status, opened_at, voting_locked_at, winner_confirmed_at, notes").eq("session_id", sessionId).order("round_number", { ascending: true }).order("matchup_index", { ascending: true }),
    db.from("bb_team_scores").select("team_id, total_points, tie_break_points").eq("session_id", sessionId),
    db.from("bb_matchup_vote_tallies").select("matchup_id, winner_entry_id, vote_count").eq("session_id", sessionId),
  ]);

  const typedTeams = (teams ?? []) as TeamRow[];
  const typedRounds = (rounds ?? []) as RoundRow[];
  const typedEntries = (entries ?? []) as EntryRow[];
  const typedMatchups = (matchups ?? []) as MatchupRow[];
  const typedScores = (scores ?? []) as ScoreRow[];
  const typedVoteTallies = (voteTallies ?? []) as VoteTallyRow[];

  const overlayResult = await db
    .from("bb_session_events")
    .select("payload")
    .eq("session_id", sessionId)
    .eq("event_type", "overlay_set")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const overlayEvent = overlayResult.data as OverlayEventRow | null;
  const overlayPayload = overlayEvent?.payload ?? null;
  const overlayMode = overlayPayload?.mode ?? "none";
  const overlayEndsAt = overlayPayload?.ends_at ? new Date(overlayPayload.ends_at) : null;
  const now = new Date();
  const hostOverlay = overlayMode !== "none" && (!overlayEndsAt || overlayEndsAt > now) ? overlayMode : "none";
  const hostOverlayRemainingSeconds =
    hostOverlay !== "none" && overlayEndsAt ? Math.max(0, Math.round((overlayEndsAt.getTime() - now.getTime()) / 1000)) : 0;

  const entryById = new Map<number, EntryRow>(typedEntries.map((entry) => [entry.id, entry]));
  const scoreByTeamId = new Map<number, ScoreRow>(typedScores.map((score) => [score.team_id, score]));
  const talliesByMatchupId = new Map<number, VoteTallyRow[]>();

  for (const tally of typedVoteTallies) {
    const currentTallies = talliesByMatchupId.get(tally.matchup_id) ?? [];
    currentTallies.push(tally);
    talliesByMatchupId.set(tally.matchup_id, currentTallies);
  }

  return NextResponse.json(
    {
      ...session,
      event: (event ?? null) as EventRow | null,
      playlist: (playlist ?? null) as PlaylistRow | null,
      host_overlay: hostOverlay,
      host_overlay_remaining_seconds: hostOverlayRemainingSeconds,
      teams_total: typedTeams.length,
      rounds_total: typedRounds.length,
      matchups_total: typedMatchups.length,
      teams: typedTeams,
      rounds: typedRounds,
      entries: typedEntries,
      matchups: typedMatchups.map((matchup) => ({
        ...matchup,
        higher_seed_entry: matchup.higher_seed_entry_id ? entryById.get(matchup.higher_seed_entry_id) ?? null : null,
        lower_seed_entry: matchup.lower_seed_entry_id ? entryById.get(matchup.lower_seed_entry_id) ?? null : null,
        winner_entry: matchup.winner_entry_id ? entryById.get(matchup.winner_entry_id) ?? null : null,
        tallies: (talliesByMatchupId.get(matchup.id) ?? []).map((tally) => ({
          winner_entry_id: tally.winner_entry_id,
          vote_count: tally.vote_count,
          winner_entry: entryById.get(tally.winner_entry_id) ?? null,
        })),
      })),
      leaderboard: typedTeams
        .map((team) => ({
          team_id: team.id,
          team_name: team.team_name,
          total_points: scoreByTeamId.get(team.id)?.total_points ?? 0,
          tie_break_points: scoreByTeamId.get(team.id)?.tie_break_points ?? 0,
        }))
        .sort((left, right) => {
          if (right.total_points !== left.total_points) return right.total_points - left.total_points;
          if (right.tie_break_points !== left.tie_break_points) return right.tie_break_points - left.tie_break_points;
          return left.team_name.localeCompare(right.team_name);
        }),
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as Record<string, unknown>;

  const allowedFields = new Set([
    "title",
    "event_id",
    "playlist_id",
    "current_round",
    "current_matchup_index",
    "show_title",
    "show_logo",
    "show_round",
    "show_bracket",
    "show_scoreboard",
    "welcome_heading_text",
    "welcome_message_text",
    "intermission_heading_text",
    "intermission_message_text",
    "thanks_heading_text",
    "thanks_subheading_text",
    "default_intermission_seconds",
    "status",
    "started_at",
    "ended_at",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key)));

  const db = getBracketBattleDb();
  const { error } = await db.from("bb_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

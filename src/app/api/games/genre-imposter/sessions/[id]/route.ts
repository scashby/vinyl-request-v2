import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";
import { computeGenreImposterRemainingSeconds } from "src/lib/genreImposterEngine";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  reveal_mode: "after_third_spin" | "immediate";
  reason_mode: "host_judged" | "strict_key";
  imposter_points: number;
  reason_bonus_points: number;
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
  target_gap_seconds: number;
  current_round: number;
  current_call_index: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
  paused_at: string | null;
  show_title: boolean;
  show_round: boolean;
  show_category: boolean;
  show_scoreboard: boolean;
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
};

type PlaylistRow = {
  id: number;
  name: string;
  track_count: number;
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

  const db = getGenreImposterDb();
  const playlistDb = getBingoDb();
  const { data, error } = await db.from("gi_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;

  const [{ data: event }, { data: playlist }, { data: teams }, { data: rounds }, { data: calls }, { data: scores }] = await Promise.all([
    session.event_id
      ? db.from("events").select("id, title, date, time, location").eq("id", session.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    session.playlist_id
      ? playlistDb
          .from("collection_playlists")
          .select("id, name, track_count")
          .eq("id", session.playlist_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("gi_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("gi_session_rounds")
      .select("id, round_number, category_label, category_card_note, reason_key, imposter_call_index, status, opened_at, closed_at")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: true }),
    db
      .from("gi_session_calls")
      .select("id, round_id, round_number, call_index, play_order, source_label, artist, title, record_label, fits_category, is_imposter, host_notes, status, cued_at, played_at, revealed_at")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: true })
      .order("play_order", { ascending: true }),
    db
      .from("gi_team_scores")
      .select("id, team_id, total_points, imposter_hits, reason_bonus_hits, updated_at")
      .eq("session_id", sessionId),
  ]);

  const currentRound = ((rounds ?? []) as Array<{ round_number: number }>).find(
    (round) => round.round_number === session.current_round
  );
  const currentRoundCalls = ((calls ?? []) as Array<{ round_number: number }>).filter(
    (call) => call.round_number === session.current_round
  );

  return NextResponse.json(
    {
      ...session,
      event: (event ?? null) as EventRow | null,
      playlist: (playlist ?? null) as PlaylistRow | null,
      teams: teams ?? [],
      rounds: rounds ?? [],
      calls: calls ?? [],
      scores: scores ?? [],
      remaining_seconds: computeGenreImposterRemainingSeconds(session),
      teams_total: (teams ?? []).length,
      rounds_total: (rounds ?? []).length,
      calls_total: (calls ?? []).length,
      scored_teams_total: (scores ?? []).length,
      current_round_detail: currentRound ?? null,
      current_round_calls: currentRoundCalls,
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
    "current_call_index",
    "show_title",
    "show_round",
    "show_category",
    "show_scoreboard",
    "status",
    "countdown_started_at",
    "paused_remaining_seconds",
    "paused_at",
    "started_at",
    "ended_at",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key)));

  const db = getGenreImposterDb();
  const { error } = await db.from("gi_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

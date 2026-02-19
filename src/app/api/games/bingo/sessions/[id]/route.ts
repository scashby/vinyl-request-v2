import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { computeRemainingSeconds } from "src/lib/bingoEngine";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number;
  session_code: string;
  game_mode: string;
  card_count: number;
  card_layout: string;
  card_label_mode: string;
  round_count: number;
  current_round: number;
  round_end_policy: string;
  tie_break_policy: string;
  pool_exhaustion_policy: string;
  seconds_to_next_call: number;
  sonos_output_delay_ms: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
  paused_at: string | null;
  current_call_index: number;
  recent_calls_limit: number;
  show_title: boolean;
  show_logo: boolean;
  show_rounds: boolean;
  show_countdown: boolean;
  status: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
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

  const db = getBingoDb();
  const { data, error } = await db
    .from("bingo_sessions")
    .select("id, event_id, playlist_id, session_code, game_mode, card_count, card_layout, card_label_mode, round_count, current_round, round_end_policy, tie_break_policy, pool_exhaustion_policy, seconds_to_next_call, sonos_output_delay_ms, countdown_started_at, paused_remaining_seconds, paused_at, current_call_index, recent_calls_limit, show_title, show_logo, show_rounds, show_countdown, status, created_at, started_at, ended_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;
  const { data: playlist } = await db
    .from("collection_playlists")
    .select("name")
    .eq("id", session.playlist_id)
    .maybeSingle();

  return NextResponse.json(
    {
      ...session,
      playlist_name: playlist?.name ?? "Unknown Playlist",
      seconds_to_next_call: computeRemainingSeconds(session),
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
    "current_round",
    "recent_calls_limit",
    "show_title",
    "show_logo",
    "show_rounds",
    "show_countdown",
    "status",
    "paused_at",
    "paused_remaining_seconds",
    "countdown_started_at",
    "current_call_index",
    "started_at",
    "ended_at",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key)));

  const db = getBingoDb();
  const { error } = await db.from("bingo_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

const DEFAULT_ROUND_COUNT = 3;
const DEFAULT_SECONDS_TO_NEXT_CALL = 45;
const DEFAULT_JUMBOTRON_SETTINGS = {
  recent_calls_limit: 5,
  show_title: true,
  show_logo: true,
  show_rounds: true,
  show_countdown: true,
};

async function getCurrentPickIndex(sessionId: number): Promise<number> {
  const { count } = await supabaseAdmin
    .from("game_session_picks")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .not("called_at", "is", null);

  return count ?? 0;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const sessionId = Number(params.id);

  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  const { data: session, error } = await supabaseAdmin
    .from("game_sessions")
    .select("*, game_templates ( id, name, description )")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: error?.message ?? "Session not found." }, { status: 404 });
  }

  const { data: picks, error: picksError } = await supabaseAdmin
    .from("game_session_picks")
    .select("id, pick_index, called_at, game_template_items ( id, title, artist )")
    .eq("session_id", sessionId)
    .order("pick_index", { ascending: true });

  if (picksError) {
    return NextResponse.json({ error: picksError.message }, { status: 500 });
  }

  const currentPickIndex = await getCurrentPickIndex(sessionId);

  const normalizedPicks = (picks ?? []).map((pick) => ({
    ...pick,
    status: pick.called_at ? "played" : "pending",
    column_letter: ["B", "I", "N", "G", "O"][pick.pick_index % 5],
    track_title: pick.game_template_items?.title ?? "",
    artist_name: pick.game_template_items?.artist ?? "",
    album_name: null,
  }));

  const payload = {
    ...session,
    current_pick_index: currentPickIndex,
    round_count: (session as Record<string, unknown>).round_count ?? DEFAULT_ROUND_COUNT,
    current_round: (session as Record<string, unknown>).current_round ?? 1,
    seconds_to_next_call:
      (session as Record<string, unknown>).seconds_to_next_call ?? DEFAULT_SECONDS_TO_NEXT_CALL,
    paused_at: (session as Record<string, unknown>).paused_at ?? null,
    jumbotron_settings: DEFAULT_JUMBOTRON_SETTINGS,
    picks: normalizedPicks,
  };

  return NextResponse.json({ data: payload }, { status: 200 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const sessionId = Number(params.id);

  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    patch.status = body.status;
    if (body.status === "active") {
      patch.started_at = new Date().toISOString();
      patch.paused_at = null;
    }
    if (body.status === "paused") {
      patch.paused_at = new Date().toISOString();
    }
    if (body.status === "completed") {
      patch.ended_at = new Date().toISOString();
    }
  }

  if (typeof body.current_round === "number") patch.current_round = body.current_round;
  if (typeof body.round_count === "number") patch.round_count = body.round_count;
  if (typeof body.seconds_to_next_call === "number") patch.seconds_to_next_call = body.seconds_to_next_call;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin.from("game_sessions").update(patch).eq("id", sessionId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data: session, error: refetchError } = await supabaseAdmin
    .from("game_sessions")
    .select("*, game_templates ( id, name, description )")
    .eq("id", sessionId)
    .single();

  if (refetchError || !session) {
    return NextResponse.json({ error: refetchError?.message ?? "Session not found." }, { status: 404 });
  }

  const currentPickIndex = await getCurrentPickIndex(sessionId);

  return NextResponse.json(
    {
      ...session,
      current_pick_index: currentPickIndex,
      round_count: (session as Record<string, unknown>).round_count ?? DEFAULT_ROUND_COUNT,
      current_round: (session as Record<string, unknown>).current_round ?? 1,
      seconds_to_next_call:
        (session as Record<string, unknown>).seconds_to_next_call ?? DEFAULT_SECONDS_TO_NEXT_CALL,
      paused_at: (session as Record<string, unknown>).paused_at ?? null,
      jumbotron_settings: DEFAULT_JUMBOTRON_SETTINGS,
    },
    { status: 200 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { buildCallOrder, buildCards, type VbTrack, type VbVariant } from "src/lib/vbEngine";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 5) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function parseVariant(value: unknown): VbVariant {
  const raw = String(value ?? "standard");
  return raw === "death" || raw === "blackout" ? raw : "standard";
}

export async function GET(request: NextRequest) {
  const db = supabaseAdmin as any;
  const eventId = request.nextUrl.searchParams.get("eventId");

  let q = db
    .from("vb_sessions")
    .select("id, event_id, template_id, session_code, variant, bingo_target, death_target, card_count, card_layout, card_label_mode, round_count, current_round, round_end_policy, tie_break_policy, pool_exhaustion_policy, seconds_to_next_call, current_call_index, paused_at, recent_calls_limit, show_title, show_logo, show_rounds, show_countdown, status, created_at")
    .order("created_at", { ascending: false });

  if (eventId) q = q.eq("event_id", Number(eventId));

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const db = supabaseAdmin as any;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const templateId = Number(body.template_id ?? body.templateId);
    if (!Number.isFinite(templateId)) {
      return NextResponse.json({ error: "template_id is required" }, { status: 400 });
    }

    const eventIdRaw = body.event_id ?? body.eventId;
    const eventId = eventIdRaw ? Number(eventIdRaw) : null;
    const variant = parseVariant(body.variant);
    const bingoTarget = String(body.bingo_target ?? body.bingoTarget ?? "single_line");
    const cardCount = Math.max(1, Number(body.card_count ?? body.cardCount ?? 40));
    const roundCount = Math.max(1, Number(body.round_count ?? body.roundCount ?? 3));
    const secondsToNextCall = Math.max(10, Number(body.seconds_to_next_call ?? body.secondsToNextCall ?? 45));
    const setlistMode = Boolean(body.setlist_mode ?? body.setlistMode ?? false);
    const deathTarget = String(body.death_target ?? body.deathTarget ?? "single_line");
    const cardLayout = String(body.card_layout ?? body.cardLayout ?? "2-up");
    const cardLabelMode = String(body.card_label_mode ?? body.cardLabelMode ?? "track_artist");
    const roundEndPolicy = String(body.round_end_policy ?? body.roundEndPolicy ?? "open_until_winner");
    const tieBreakPolicy = String(body.tie_break_policy ?? body.tieBreakPolicy ?? "one_song_playoff");
    const poolExhaustionPolicy = String(body.pool_exhaustion_policy ?? body.poolExhaustionPolicy ?? "declare_tie");
    const recentCallsLimit = Math.max(1, Number(body.recent_calls_limit ?? body.recentCallsLimit ?? 5));
    const showTitle = body.show_title === undefined ? true : Boolean(body.show_title);
    const showLogo = body.show_logo === undefined ? true : Boolean(body.show_logo);
    const showRounds = body.show_rounds === undefined ? true : Boolean(body.show_rounds);
    const showCountdown = body.show_countdown === undefined ? true : Boolean(body.show_countdown);

    const { data: templateTracks, error: tracksError } = await db
      .from("vb_template_tracks")
      .select("id, track_title, artist_name, album_name")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    if (tracksError) return NextResponse.json({ error: tracksError.message }, { status: 500 });

    const tracks = (templateTracks ?? []) as VbTrack[];
    if (tracks.length < 25) {
      return NextResponse.json({ error: "Template needs at least 25 tracks." }, { status: 400 });
    }

    const callOrder = buildCallOrder(tracks, setlistMode);
    const cards = buildCards(tracks, cardCount, variant);

    let code = randomCode();
    for (let i = 0; i < 4; i += 1) {
      const { data: existing } = await db.from("vb_sessions").select("id").eq("session_code", code).maybeSingle();
      if (!existing) break;
      code = randomCode();
    }

    const { data: inserted, error: sessionError } = await db
      .from("vb_sessions")
      .insert({
        event_id: Number.isFinite(eventId as number) ? eventId : null,
        template_id: templateId,
        session_code: code,
        variant,
        bingo_target: bingoTarget,
        death_target: deathTarget,
        card_count: cardCount,
        card_layout: cardLayout,
        card_label_mode: cardLabelMode,
        round_count: roundCount,
        current_round: 1,
        round_end_policy: roundEndPolicy,
        tie_break_policy: tieBreakPolicy,
        pool_exhaustion_policy: poolExhaustionPolicy,
        seconds_to_next_call: secondsToNextCall,
        current_call_index: 0,
        paused_at: null,
        recent_calls_limit: recentCallsLimit,
        show_title: showTitle,
        show_logo: showLogo,
        show_rounds: showRounds,
        show_countdown: showCountdown,
        status: "pending",
      })
      .select("id")
      .single();

    if (sessionError || !inserted) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    const callRows = callOrder.map((track, idx) => ({
      session_id: inserted.id,
      template_track_id: track.id,
      call_index: idx,
      status: "pending",
      called_at: null,
    }));

    const cardRows = cards.map((card) => ({
      session_id: inserted.id,
      card_number: card.index,
      has_free_space: variant === "standard",
      grid: card.cells,
    }));

    if (callRows.length > 0) {
      const { error } = await db.from("vb_session_calls").insert(callRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (cardRows.length > 0) {
      const { error } = await db.from("vb_cards").insert(cardRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: inserted.id, session_code: code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

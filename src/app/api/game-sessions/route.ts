import { NextRequest, NextResponse } from "next/server";
import { buildBingoCards, buildPickList, type BingoItem, type BingoVariant } from "src/lib/bingo";
import { generateGameCode } from "src/lib/gameCode";
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

function parseTemplateId(body: Record<string, unknown>) {
  const raw = body.templateId ?? body.game_template_id;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

function parseCardCount(body: Record<string, unknown>) {
  const raw = Number(body.cardCount ?? body.card_count ?? 40);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 40;
}

function parseVariant(body: Record<string, unknown>): BingoVariant {
  const raw = String(body.variant ?? "standard");
  if (raw === "blackout" || raw === "death" || raw === "standard") {
    return raw;
  }
  return "standard";
}

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = supabaseAdmin
    .from("game_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (eventId) {
    query = query.eq("event_id", Number(eventId));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = (data ?? []).map((session) => ({
    ...session,
    round_count: (session as Record<string, unknown>).round_count ?? DEFAULT_ROUND_COUNT,
    current_round: (session as Record<string, unknown>).current_round ?? 1,
    seconds_to_next_call:
      (session as Record<string, unknown>).seconds_to_next_call ?? DEFAULT_SECONDS_TO_NEXT_CALL,
    paused_at: (session as Record<string, unknown>).paused_at ?? null,
    jumbotron_settings: DEFAULT_JUMBOTRON_SETTINGS,
  }));

  return NextResponse.json({ data: enriched }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const templateId = parseTemplateId(body);

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required." }, { status: 400 });
    }

    const eventIdRaw = body.eventId ?? body.event_id;
    const eventId = eventIdRaw ? Number(eventIdRaw) : null;
    const cardCount = parseCardCount(body);
    const bingoTarget = String(body.bingoTarget ?? body.bingo_target ?? "one_line");
    const setlistMode = Boolean(body.setlistMode ?? body.setlist_mode ?? false);
    const variant = parseVariant(body);

    const { data: templateItems, error: templateError } = await supabaseAdmin
      .from("game_template_items")
      .select("id, title, artist")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    if (templateError) {
      return NextResponse.json({ error: templateError.message }, { status: 500 });
    }

    const items: BingoItem[] = (templateItems ?? []).map((item) => ({
      id: String(item.id),
      title: item.title,
      artist: item.artist,
    }));

    const pickList = buildPickList(items, setlistMode ? "setlist" : "shuffle");
    const cards = buildBingoCards(items, cardCount, variant);

    let gameCode = generateGameCode();
    for (let i = 0; i < 3; i += 1) {
      const { data: existing } = await supabaseAdmin
        .from("game_sessions")
        .select("id")
        .eq("game_code", gameCode)
        .maybeSingle();
      if (!existing) break;
      gameCode = generateGameCode();
    }

    const insertPayload = {
      event_id: Number.isFinite(eventId as number) ? eventId : null,
      template_id: templateId,
      game_code: gameCode,
      game_type: "music_bingo",
      variant,
      bingo_target: bingoTarget,
      card_count: cardCount,
      round_count: Number(body.round_count ?? DEFAULT_ROUND_COUNT),
      current_round: Number(body.current_round ?? 1),
      seconds_to_next_call: Number(body.seconds_to_next_call ?? DEFAULT_SECONDS_TO_NEXT_CALL),
      paused_at: null,
      setlist_mode: setlistMode,
      status: "pending",
    };

    let { data: createdSession, error: sessionError } = await supabaseAdmin
      .from("game_sessions")
      .insert(insertPayload)
      .select("id")
      .single();

    if (sessionError?.message?.includes("column")) {
      const fallbackPayload = {
        event_id: insertPayload.event_id,
        template_id: insertPayload.template_id,
        game_code: insertPayload.game_code,
        game_type: insertPayload.game_type,
        variant: insertPayload.variant,
        bingo_target: insertPayload.bingo_target,
        card_count: insertPayload.card_count,
        setlist_mode: insertPayload.setlist_mode,
        status: insertPayload.status,
      };

      const retry = await supabaseAdmin
        .from("game_sessions")
        .insert(fallbackPayload)
        .select("id")
        .single();

      createdSession = retry.data;
      sessionError = retry.error;
    }

    if (sessionError || !createdSession) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session." }, { status: 500 });
    }

    const pickRows = pickList.map((pick, index) => ({
      session_id: createdSession.id,
      template_item_id: Number(pick.id),
      pick_index: index,
      called_at: null,
    }));

    if (pickRows.length > 0) {
      const { error: picksError } = await supabaseAdmin.from("game_session_picks").insert(pickRows);
      if (picksError) {
        return NextResponse.json({ error: picksError.message }, { status: 500 });
      }
    }

    const cardRows = cards.map((card) => ({
      session_id: createdSession.id,
      card_number: card.index,
      has_free_space: variant === "standard",
      grid: card.cells,
    }));

    if (cardRows.length > 0) {
      const { error: cardsError } = await supabaseAdmin.from("game_cards").insert(cardRows);
      if (cardsError) {
        return NextResponse.json({ error: cardsError.message }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        id: createdSession.id,
        round_count: DEFAULT_ROUND_COUNT,
        current_round: 1,
        seconds_to_next_call: DEFAULT_SECONDS_TO_NEXT_CALL,
        jumbotron_settings: DEFAULT_JUMBOTRON_SETTINGS,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

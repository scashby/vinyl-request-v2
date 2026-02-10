import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { buildPickList, buildBingoCards, BingoItem } from "src/lib/bingo";
import { generateGameCode } from "src/lib/gameCode";

type CreateSessionPayload = {
  templateId: number;
  eventId?: number | null;
  variant?: string;
  bingoTarget?: string;
  cardCount?: number;
  setlistMode?: boolean;
};

const insertSession = async (payload: CreateSessionPayload, gameCode: string) => {
  return supabaseAdmin
    .from("game_sessions")
    .insert({
      event_id: payload.eventId ?? null,
      template_id: payload.templateId,
      game_code: gameCode,
      game_type: "music_bingo",
      variant: payload.variant ?? "standard",
      bingo_target: payload.bingoTarget ?? "one_line",
      card_count: payload.cardCount ?? 40,
      setlist_mode: Boolean(payload.setlistMode),
      status: "draft",
    })
    .select("*")
    .single();
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  let query = supabaseAdmin.from("game_sessions").select("*");
  if (eventId) {
    const id = Number(eventId);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid eventId." }, { status: 400 });
    }
    query = query.eq("event_id", id);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function POST(request: NextRequest) {
  let payload: CreateSessionPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload.templateId) {
    return NextResponse.json({ error: "templateId is required." }, { status: 400 });
  }

  let sessionInsert;
  let attempts = 0;

  while (attempts < 5) {
    const code = generateGameCode();
    const result = await insertSession(payload, code);
    if (!result.error) {
      sessionInsert = result;
      break;
    }

    if (!result.error?.message.includes("duplicate")) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    attempts += 1;
  }

  if (!sessionInsert?.data) {
    return NextResponse.json({ error: "Failed to create session." }, { status: 500 });
  }

  const { data: templateItems, error: itemsError } = await supabaseAdmin
    .from("game_template_items")
    .select("id, title, artist, sort_order")
    .eq("template_id", payload.templateId)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const items: BingoItem[] = (templateItems ?? []).map((item) => ({
    id: String(item.id),
    title: item.title,
    artist: item.artist,
  }));

  const pickList = buildPickList(items, payload.setlistMode ? "setlist" : "shuffle");

  const picksPayload = pickList.map((item, index) => ({
    session_id: sessionInsert.data.id,
    template_item_id: Number(item.id),
    pick_index: index + 1,
  }));

  const { error: picksError } = await supabaseAdmin
    .from("game_session_picks")
    .insert(picksPayload);

  if (picksError) {
    return NextResponse.json({ error: picksError.message }, { status: 500 });
  }

  const cards = buildBingoCards(items, payload.cardCount ?? 40, payload.variant === "standard" ? "standard" : payload.variant === "death" ? "death" : "blackout");
  const cardsPayload = cards.map((card) => ({
    session_id: sessionInsert.data.id,
    card_number: card.index,
    has_free_space: payload.variant === "standard",
    grid: card.cells,
  }));

  const { error: cardsError } = await supabaseAdmin
    .from("game_cards")
    .insert(cardsPayload);

  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: {
        session: sessionInsert.data,
        pickCount: pickList.length,
        cardCount: cards.length,
      },
    },
    { status: 201 }
  );
}

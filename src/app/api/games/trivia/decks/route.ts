import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb, type TriviaDatabase } from "src/lib/triviaDb";
import { TRIVIA_BANK_ENABLED, asString } from "src/lib/triviaBankApi";
import { generateTriviaDeckCode, type JsonValue } from "src/lib/triviaBank";
import { loadQuestionSnapshot } from "src/lib/triviaDeckSnapshots";

export const runtime = "nodejs";

type DeckItemBody = {
  item_index?: number;
  round_number?: number;
  is_tiebreaker?: boolean;
  question_id?: number | null;
  snapshot_payload?: JsonValue;
  locked?: boolean;
};

type CreateDeckBody = {
  title?: string;
  status?: "draft" | "ready" | "archived";
  event_id?: number | null;
  playlist_id?: number | null;
  build_mode?: "manual" | "hybrid" | "rule";
  rules_payload?: JsonValue;
  cooldown_days?: number;
  created_by?: string;
  items?: DeckItemBody[];
};

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function generateUniqueDeckCode() {
  const db = getTriviaDb();
  for (let i = 0; i < 20; i += 1) {
    const code = generateTriviaDeckCode();
    const { data } = await db.from("trivia_decks").select("id").eq("deck_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique deck code");
}

export async function GET(request: NextRequest) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const db = getTriviaDb();
  const params = request.nextUrl.searchParams;
  const rawStatus = asString(params.get("status")).toLowerCase();
  const status = rawStatus === "draft" || rawStatus === "ready" || rawStatus === "archived"
    ? rawStatus
    : "";
  const eventId = Number(params.get("eventId"));
  const limit = Math.min(200, parsePositiveInt(params.get("limit"), 50));
  const offset = Math.max(0, parsePositiveInt(params.get("offset"), 0));

  let query = db
    .from("trivia_decks")
    .select("id, deck_code, title, status, event_id, playlist_id, build_mode, rules_payload, cooldown_days, created_by, created_at, updated_at, locked_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) query = query.eq("status", status);
  if (Number.isFinite(eventId) && eventId > 0) query = query.eq("event_id", eventId);

  const { data: decks, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const deckIds = ((decks ?? []) as Array<{ id: number }>).map((row) => row.id);
  const { data: items } = deckIds.length
    ? await db
      .from("trivia_deck_items")
      .select("deck_id, id, locked")
      .in("deck_id", deckIds)
    : { data: [] as Array<{ deck_id: number; id: number; locked: boolean }> };

  const stats = new Map<number, { total: number; locked: number }>();
  for (const row of (items ?? []) as Array<{ deck_id: number; id: number; locked: boolean }>) {
    const current = stats.get(row.deck_id) ?? { total: 0, locked: 0 };
    current.total += 1;
    if (row.locked) current.locked += 1;
    stats.set(row.deck_id, current);
  }

  return NextResponse.json(
    {
      data: ((decks ?? []) as Array<Record<string, unknown>>).map((deck) => ({
        ...deck,
        item_total: stats.get(Number(deck.id))?.total ?? 0,
        item_locked_total: stats.get(Number(deck.id))?.locked ?? 0,
      })),
      total: count ?? 0,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  try {
    const db = getTriviaDb();
    const body = (await request.json()) as CreateDeckBody;

    const title = asString(body.title) || "Trivia Deck";
    const status = body.status === "ready" || body.status === "archived" ? body.status : "draft";
    const buildMode = body.build_mode === "manual" || body.build_mode === "rule" ? body.build_mode : "hybrid";
    const cooldownDays = Number.isFinite(Number(body.cooldown_days)) ? Math.max(0, Number(body.cooldown_days)) : 90;
    const deckCode = await generateUniqueDeckCode();
    const now = new Date().toISOString();

    const { data: deck, error: deckError } = await db
      .from("trivia_decks")
      .insert({
        deck_code: deckCode,
        title,
        status,
        event_id: Number.isFinite(Number(body.event_id)) ? Number(body.event_id) : null,
        playlist_id: Number.isFinite(Number(body.playlist_id)) ? Number(body.playlist_id) : null,
        build_mode: buildMode,
        rules_payload: body.rules_payload ?? {},
        cooldown_days: cooldownDays,
        created_by: asString(body.created_by) || "admin",
        created_at: now,
        updated_at: now,
        locked_at: status === "ready" ? now : null,
      })
      .select("id, deck_code")
      .single();
    if (deckError || !deck) return NextResponse.json({ error: deckError?.message ?? "Failed to create deck" }, { status: 500 });

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length > 0) {
      const rows: TriviaDatabase["public"]["Tables"]["trivia_deck_items"]["Insert"][] = [];
      let indexCounter = 1;

      for (const item of items) {
        const questionId = Number(item.question_id);
        const fallbackIndex = indexCounter;
        const itemIndex = Number.isFinite(Number(item.item_index)) ? Math.max(1, Number(item.item_index)) : fallbackIndex;
        const roundNumber = Number.isFinite(Number(item.round_number)) ? Math.max(1, Number(item.round_number)) : 1;
        const snapshotPayload =
          item.snapshot_payload ??
          (Number.isFinite(questionId) && questionId > 0
            ? await loadQuestionSnapshot(db, questionId)
            : null);
        if (!snapshotPayload) continue;

        rows.push({
          deck_id: deck.id,
          item_index: itemIndex,
          round_number: roundNumber,
          is_tiebreaker: Boolean(item.is_tiebreaker),
          question_id: Number.isFinite(questionId) && questionId > 0 ? questionId : null,
          snapshot_payload: snapshotPayload,
          locked: Boolean(item.locked),
          created_at: now,
          updated_at: now,
        });
        indexCounter += 1;
      }

      if (rows.length > 0) {
        const { error: itemsError } = await db.from("trivia_deck_items").insert(rows);
        if (itemsError) {
          await db.from("trivia_decks").delete().eq("id", deck.id);
          return NextResponse.json({ error: itemsError.message }, { status: 400 });
        }
      }
    }

    return NextResponse.json({ id: deck.id, deck_code: deck.deck_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

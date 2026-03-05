import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb, type TriviaDatabase } from "src/lib/triviaDb";
import { TRIVIA_BANK_ENABLED, asString } from "src/lib/triviaBankApi";
import { type JsonValue } from "src/lib/triviaBank";
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

type PatchDeckBody = {
  title?: string;
  status?: "draft" | "ready" | "archived";
  event_id?: number | null;
  playlist_id?: number | null;
  build_mode?: "manual" | "hybrid" | "rule";
  rules_payload?: JsonValue;
  cooldown_days?: number;
  updated_by?: string;
  replace_items?: boolean;
  items?: DeckItemBody[];
};

function parseDeckId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const { id } = await params;
  const deckId = parseDeckId(id);
  if (!deckId) return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });

  const db = getTriviaDb();
  const [{ data: deck, error: deckError }, { data: items, error: itemsError }] = await Promise.all([
    db
      .from("trivia_decks")
      .select("id, deck_code, title, status, event_id, playlist_id, build_mode, rules_payload, cooldown_days, created_by, created_at, updated_at, locked_at")
      .eq("id", deckId)
      .maybeSingle(),
    db
      .from("trivia_deck_items")
      .select("id, item_index, round_number, is_tiebreaker, question_id, snapshot_payload, locked, created_at, updated_at")
      .eq("deck_id", deckId)
      .order("item_index", { ascending: true }),
  ]);
  if (deckError) return NextResponse.json({ error: deckError.message }, { status: 500 });
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
  if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

  return NextResponse.json({ ...deck, items: items ?? [] }, { status: 200 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const { id } = await params;
  const deckId = parseDeckId(id);
  if (!deckId) return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });

  const body = (await request.json()) as PatchDeckBody;
  const db = getTriviaDb();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) patch.title = asString(body.title) || "Trivia Deck";
  if (body.status === "draft" || body.status === "ready" || body.status === "archived") patch.status = body.status;
  if (Object.prototype.hasOwnProperty.call(body, "event_id")) {
    patch.event_id = Number.isFinite(Number(body.event_id)) ? Number(body.event_id) : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "playlist_id")) {
    patch.playlist_id = Number.isFinite(Number(body.playlist_id)) ? Number(body.playlist_id) : null;
  }
  if (body.build_mode === "manual" || body.build_mode === "hybrid" || body.build_mode === "rule") patch.build_mode = body.build_mode;
  if (Object.prototype.hasOwnProperty.call(body, "rules_payload")) patch.rules_payload = body.rules_payload ?? {};
  if (Object.prototype.hasOwnProperty.call(body, "cooldown_days")) {
    patch.cooldown_days = Number.isFinite(Number(body.cooldown_days)) ? Math.max(0, Number(body.cooldown_days)) : 90;
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = now;
    if (patch.status === "ready") patch.locked_at = now;
    const { error } = await db.from("trivia_decks").update(patch).eq("id", deckId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.replace_items) {
    const { error: deleteError } = await db.from("trivia_deck_items").delete().eq("deck_id", deckId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (Array.isArray(body.items) && body.items.length > 0) {
    const rows: TriviaDatabase["public"]["Tables"]["trivia_deck_items"]["Insert"][] = [];
    let nextIndex = 1;

    for (const item of body.items) {
      const questionId = Number(item.question_id);
      const itemIndex = Number.isFinite(Number(item.item_index)) ? Math.max(1, Number(item.item_index)) : nextIndex;
      const roundNumber = Number.isFinite(Number(item.round_number)) ? Math.max(1, Number(item.round_number)) : 1;
      const snapshotPayload =
        item.snapshot_payload ??
        (Number.isFinite(questionId) && questionId > 0
          ? await loadQuestionSnapshot(db, questionId)
          : null);
      if (!snapshotPayload) continue;

      rows.push({
        deck_id: deckId,
        item_index: itemIndex,
        round_number: roundNumber,
        is_tiebreaker: Boolean(item.is_tiebreaker),
        question_id: Number.isFinite(questionId) && questionId > 0 ? questionId : null,
        snapshot_payload: snapshotPayload,
        locked: Boolean(item.locked),
        created_at: now,
        updated_at: now,
      });
      nextIndex += 1;
    }

    if (rows.length > 0) {
      const { error } = await db.from("trivia_deck_items").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

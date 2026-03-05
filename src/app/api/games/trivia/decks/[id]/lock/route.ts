import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { TRIVIA_BANK_ENABLED } from "src/lib/triviaBankApi";
import { type JsonValue } from "src/lib/triviaBank";
import { loadQuestionSnapshotsByIds } from "src/lib/triviaDeckSnapshots";

export const runtime = "nodejs";

type Body = {
  force_refresh_snapshots?: boolean;
};

type DeckItemRow = {
  id: number;
  question_id: number | null;
  snapshot_payload: JsonValue;
};

function parseDeckId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function hasSnapshotPromptAndAnswer(snapshotPayload: JsonValue): boolean {
  if (!snapshotPayload || typeof snapshotPayload !== "object" || Array.isArray(snapshotPayload)) return false;
  const snapshot = snapshotPayload as Record<string, unknown>;
  const promptText = typeof snapshot.prompt_text === "string" ? snapshot.prompt_text.trim() : "";
  const answerKey = typeof snapshot.answer_key === "string" ? snapshot.answer_key.trim() : "";
  return promptText.length > 0 && answerKey.length > 0;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const { id } = await params;
  const deckId = parseDeckId(id);
  if (!deckId) return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const forceRefreshSnapshots = body.force_refresh_snapshots === true;

  const db = getTriviaDb();
  const { data: deck, error: deckError } = await db
    .from("trivia_decks")
    .select("id, status")
    .eq("id", deckId)
    .maybeSingle();
  if (deckError) return NextResponse.json({ error: deckError.message }, { status: 500 });
  if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  if (deck.status === "archived") {
    return NextResponse.json({ error: "Archived decks cannot be locked" }, { status: 409 });
  }

  const { data: rows, error: rowsError } = await db
    .from("trivia_deck_items")
    .select("id, question_id, snapshot_payload")
    .eq("deck_id", deckId)
    .order("item_index", { ascending: true });
  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 });

  const items = (rows ?? []) as DeckItemRow[];
  if (items.length === 0) {
    return NextResponse.json({ error: "Deck has no items to lock" }, { status: 400 });
  }

  const questionIdsForRefresh = Array.from(
    new Set(
      items
        .filter((row) => {
          if (!Number.isFinite(Number(row.question_id))) return false;
          if (forceRefreshSnapshots) return true;
          return !hasSnapshotPromptAndAnswer(row.snapshot_payload);
        })
        .map((row) => Number(row.question_id))
        .filter((questionId) => Number.isFinite(questionId) && questionId > 0)
    )
  );

  const snapshotByQuestion = await loadQuestionSnapshotsByIds(db, questionIdsForRefresh);

  const now = new Date().toISOString();
  let refreshedCount = 0;

  for (const item of items) {
    const questionId = Number(item.question_id);
    const shouldRefresh = forceRefreshSnapshots || !hasSnapshotPromptAndAnswer(item.snapshot_payload);

    let nextSnapshot = item.snapshot_payload;
    if (shouldRefresh && Number.isFinite(questionId) && questionId > 0) {
      const refreshed = snapshotByQuestion.get(questionId);
      if (refreshed) {
        nextSnapshot = refreshed as unknown as JsonValue;
        refreshedCount += 1;
      }
    }

    if (!hasSnapshotPromptAndAnswer(nextSnapshot)) {
      return NextResponse.json(
        {
          error: `Deck item ${item.id} is missing snapshot prompt/answer and cannot be locked.`,
        },
        { status: 409 }
      );
    }

    const { error: updateItemError } = await db
      .from("trivia_deck_items")
      .update({
        snapshot_payload: nextSnapshot,
        locked: true,
        updated_at: now,
      })
      .eq("id", item.id)
      .eq("deck_id", deckId);
    if (updateItemError) return NextResponse.json({ error: updateItemError.message }, { status: 500 });
  }

  const { error: updateDeckError } = await db
    .from("trivia_decks")
    .update({
      status: "ready",
      locked_at: now,
      updated_at: now,
    })
    .eq("id", deckId);
  if (updateDeckError) return NextResponse.json({ error: updateDeckError.message }, { status: 500 });

  return NextResponse.json(
    {
      ok: true,
      data: {
        deck_id: deckId,
        item_count: items.length,
        refreshed_snapshot_count: refreshedCount,
        locked_at: now,
      },
    },
    { status: 200 }
  );
}

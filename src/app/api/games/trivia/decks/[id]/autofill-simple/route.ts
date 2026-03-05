import { NextRequest, NextResponse } from "next/server";
import { TRIVIA_BANK_ENABLED } from "src/lib/triviaBankApi";

export const runtime = "nodejs";

type AutofillBody = {
  include_recently_used?: boolean;
  allow_partial?: boolean;
  round_count?: number;
  questions_per_round?: number;
  tie_breaker_count?: number;
  target_count?: number;
  seed?: string;
};

function parseDeckId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) {
    return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });
  }

  const { id } = await params;
  const deckId = parseDeckId(id);
  if (!deckId) return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as AutofillBody;

  const buildUrl = new URL(`/api/games/trivia/decks/${deckId}/build`, request.url);
  const buildPayload = {
    preserve_existing: true,
    include_cooled_down: body.include_recently_used === true,
    allow_partial: body.allow_partial === true,
    round_count: body.round_count,
    questions_per_round: body.questions_per_round,
    tie_breaker_count: body.tie_breaker_count,
    target_count: body.target_count,
    seed: body.seed,
    build_mode: "hybrid",
    filters: {
      statuses: ["published"],
      has_required_cue: true,
    },
  };

  const response = await fetch(buildUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPayload),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(payload ?? { error: "Failed to autofill deck" }, { status: response.status });
  }

  return NextResponse.json(payload ?? { ok: true }, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import {
  backfillMissingLegacyCrates,
  createCrateFromRoundData,
  getCratesForSession,
  setActiveCrateForRound,
} from "src/lib/bingoCrateModel";

export const runtime = "nodejs";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getBingoDb();
  try {
    await backfillMissingLegacyCrates(db, sessionId);
    const crates = await getCratesForSession(db, sessionId);
    return NextResponse.json({ data: crates }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load crates" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const roundNumber = Number(body.round_number);
  const crateLetterRaw = body.crate_letter;

  if (!Number.isFinite(roundNumber) || roundNumber < 1) {
    return NextResponse.json({ error: "round_number must be a positive integer" }, { status: 400 });
  }

  const crateLetter =
    typeof crateLetterRaw === "string" && /^[A-Z]$/.test(crateLetterRaw)
      ? crateLetterRaw
      : crateLetterRaw === null
      ? null
      : undefined;

  if (crateLetter === undefined) {
    return NextResponse.json(
      { error: "crate_letter must be a single uppercase letter A-Z or null" },
      { status: 400 }
    );
  }

  const db = getBingoDb();
  try {
    await setActiveCrateForRound(db, sessionId, roundNumber, crateLetter);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set active crate" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const roundNumber = Number(body.round_number);

  if (!Number.isFinite(roundNumber) || roundNumber < 1) {
    return NextResponse.json({ error: "round_number must be a positive integer" }, { status: 400 });
  }

  const db = getBingoDb();
  try {
    const created = await createCrateFromRoundData(db, sessionId, roundNumber);
    if (!created) {
      return NextResponse.json(
        { error: "No existing round call-order data available to create a crate for that round" },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create crate" },
      { status: 500 }
    );
  }
}

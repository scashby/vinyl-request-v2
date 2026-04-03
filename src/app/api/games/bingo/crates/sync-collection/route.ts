import { NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { syncCollectionCrateMirrorsForAllSessions } from "src/lib/bingoCrateModel";

export const runtime = "nodejs";

export async function POST() {
  const db = getBingoDb();

  try {
    await syncCollectionCrateMirrorsForAllSessions(db);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync Bingo crates into collection crates" },
      { status: 500 }
    );
  }
}

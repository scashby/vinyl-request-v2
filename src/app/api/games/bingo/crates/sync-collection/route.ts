import { NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { syncCollectionPlaylistMirrorsForAllSessions } from "src/lib/bingoCrateModel";

export const runtime = "nodejs";

export async function POST() {
  const db = getBingoDb();

  try {
    await syncCollectionPlaylistMirrorsForAllSessions(db);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync Bingo game playlists into collection crates" },
      { status: 500 }
    );
  }
}

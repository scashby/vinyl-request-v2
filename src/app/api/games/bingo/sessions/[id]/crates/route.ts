import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import {
  backfillMissingLegacyPlaylists,
  createPlaylistFromSessionData,
  deletePlaylistByLetter,
  getPlaylistsForSession,
  reshuffleAllPlaylists,
  setActivePlaylistForRound,
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
    await backfillMissingLegacyPlaylists(db, sessionId);
    const playlists = await getPlaylistsForSession(db, sessionId);
    return NextResponse.json({ data: playlists }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load game playlists" },
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
  const playlistLetterRaw = body.playlist_letter;

  if (!Number.isFinite(roundNumber) || roundNumber < 1) {
    return NextResponse.json({ error: "round_number must be a positive integer" }, { status: 400 });
  }

  const playlistLetter =
    typeof playlistLetterRaw === "string" && /^[A-Za-z]+$/.test(playlistLetterRaw)
      ? playlistLetterRaw
      : playlistLetterRaw === null
      ? null
      : undefined;

  if (playlistLetter === undefined) {
    return NextResponse.json(
      { error: "playlist_letter must be a single uppercase letter A-Z or null" },
      { status: 400 }
    );
  }

  const db = getBingoDb();
  try {
    await setActivePlaylistForRound(db, sessionId, roundNumber, playlistLetter);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set active playlist" },
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
  const roundNumberRaw = Number(body.round_number);
  const roundNumber = Number.isFinite(roundNumberRaw) && roundNumberRaw >= 1 ? Math.floor(roundNumberRaw) : undefined;

  const db = getBingoDb();
  try {
    const created = await createPlaylistFromSessionData(db, sessionId, roundNumber);
    if (!created) {
      return NextResponse.json(
        { error: "No existing round call-order data available to create a playlist for that round" },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create game playlist" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const playlistLetterRaw = body.playlist_letter;
  if (typeof playlistLetterRaw !== "string" || !/^[A-Za-z]+$/.test(playlistLetterRaw)) {
    return NextResponse.json({ error: "playlist_letter must be a non-empty alphabetic string" }, { status: 400 });
  }

  const db = getBingoDb();
  try {
    await deletePlaylistByLetter(db, sessionId, playlistLetterRaw);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete game playlist" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    await reshuffleAllPlaylists(db, sessionId);
    const playlists = await getPlaylistsForSession(db, sessionId);
    return NextResponse.json({ data: playlists }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reshuffle game playlists" },
      { status: 500 }
    );
  }
}

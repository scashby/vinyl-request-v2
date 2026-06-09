import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import {
  backfillMissingLegacyPlaylists,
  createPlaylistFromSessionData,
  deletePlaylistByLetter,
  getPlaylistsForRound,
  getPlaylistsForSession,
  reshuffleAllPlaylists,
  savePlaylistForRound,
  setActivePlaylistForRound,
} from "src/lib/bingoCrateModel";
import { planRoundSessionCalls, resolvePlaylistTracksForPlaylists } from "src/lib/bingoEngine";
import { resolveRoundPlaylistIds, type RoundPlaylistEntry } from "src/lib/bingoRoundPlaylists";

export const runtime = "nodejs";

type SessionSourceRow = {
  id: number;
  playlist_id: number;
  playlist_ids: number[] | null;
  round_playlist_ids: RoundPlaylistEntry[] | null;
  round_count: number;
};

async function loadSessionSourceRow(db: ReturnType<typeof getBingoDb>, sessionId: number): Promise<SessionSourceRow | null> {
  const query = (db
    .from("bingo_sessions")
    .select("id, playlist_id, playlist_ids, round_playlist_ids, round_count") as unknown as {
      eq: (column: string, value: number) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    });

  const { data, error } = await query.eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SessionSourceRow | null) ?? null;
}

async function regenerateRoundFromLiveSources(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  session: SessionSourceRow,
  roundNumber: number,
  replaceRound: boolean,
  generation = 0
) {
  const playlistIdsForRound = resolveRoundPlaylistIds(session, roundNumber);
  if (playlistIdsForRound.length === 0) {
    throw new Error(`Round ${roundNumber} has no configured playlists`);
  }

  const tracks = await resolvePlaylistTracksForPlaylists(db, playlistIdsForRound);
  if (tracks.length === 0) {
    throw new Error(`Round ${roundNumber} has no resolvable tracks`);
  }

  const planned = planRoundSessionCalls(tracks, sessionId, roundNumber, generation);
  const callOrder = planned.map((row, index) => ({
    id: -(index + 1),
    call_index: row.call_index,
    ball_number: row.ball_number,
    column_letter: row.column_letter,
    track_title: row.track_title,
    artist_name: row.artist_name,
    album_name: row.album_name,
    side: row.side,
    position: row.position,
    status: "pending",
    track_key: row.playlist_track_key,
    link_group: row.link_group ?? null,
    theme_hint: row.theme_hint ?? null,
  }));

  const existingRoundPlaylists = await getPlaylistsForRound(db, sessionId, roundNumber);
  const created = await savePlaylistForRound(db, sessionId, roundNumber, callOrder);

  if (replaceRound) {
    for (const playlist of existingRoundPlaylists) {
      if (playlist.playlist_letter === created.playlist_letter) continue;
      await deletePlaylistByLetter(db, sessionId, playlist.playlist_letter);
    }
    await setActivePlaylistForRound(db, sessionId, roundNumber, created.playlist_letter);
  }

  return created;
}

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
  const replaceRound = body.replace_round === true;
  const replaceAllRounds = body.replace_all_rounds === true;

  const db = getBingoDb();
  try {
    if (replaceAllRounds) {
      const session = await loadSessionSourceRow(db, sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const totalRounds = Math.max(1, session.round_count ?? 1);
      const createdPlaylists = [];
      for (let round = 1; round <= totalRounds; round += 1) {
        const created = await regenerateRoundFromLiveSources(db, sessionId, session, round, true, round);
        createdPlaylists.push(created);
      }

      return NextResponse.json({ data: createdPlaylists }, { status: 201 });
    }

    if (replaceRound) {
      if (!roundNumber) {
        return NextResponse.json({ error: "round_number is required when replace_round is true" }, { status: 400 });
      }

      const session = await loadSessionSourceRow(db, sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      if (roundNumber > Math.max(1, session.round_count ?? 1)) {
        return NextResponse.json(
          { error: `round_number must be between 1 and ${Math.max(1, session.round_count ?? 1)}` },
          { status: 400 }
        );
      }

      const created = await regenerateRoundFromLiveSources(db, sessionId, session, roundNumber, true, roundNumber);
      return NextResponse.json({ data: created }, { status: 201 });
    }

    const existingRoundPlaylists = roundNumber
      ? await getPlaylistsForRound(db, sessionId, roundNumber)
      : [];

    const created = await createPlaylistFromSessionData(db, sessionId, roundNumber);
    if (!created) {
      return NextResponse.json(
        { error: "No existing round call-order data available to create a playlist for that round" },
        { status: 400 }
      );
    }

    if (replaceRound) {
      for (const playlist of existingRoundPlaylists) {
        if (playlist.playlist_letter === created.playlist_letter) continue;
        await deletePlaylistByLetter(db, sessionId, playlist.playlist_letter);
      }
      await setActivePlaylistForRound(db, sessionId, created.round_number, created.playlist_letter);
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

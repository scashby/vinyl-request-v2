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
import { rehydrateBingoCardLabels } from "src/lib/playlistMetadataSync";
import { planRoundSessionCalls, resolvePlaylistTracksForPlaylists } from "src/lib/bingoEngine";
import { resolveRoundPlaylistIds, type RoundPlaylistEntry } from "src/lib/bingoRoundPlaylists";

export const runtime = "nodejs";

type SessionSourceRow = {
  id: number;
  playlist_id: number;
  playlist_ids: number[] | null;
  round_playlist_ids: RoundPlaylistEntry[] | null;
  round_count: number;
  current_round?: number;
};

async function loadSessionSourceRow(db: ReturnType<typeof getBingoDb>, sessionId: number): Promise<SessionSourceRow | null> {
  const query = (db
    .from("bingo_sessions")
    .select("id, playlist_id, playlist_ids, round_playlist_ids, round_count, current_round") as unknown as {
      eq: (column: string, value: number) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    });

  const { data, error } = await query.eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SessionSourceRow | null) ?? null;
}

type SessionCallUpsertRow = {
  playlist_track_key: string;
  call_index: number;
  ball_number: number;
  column_letter: string;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
  link_group: string | null;
  theme_hint: string | null;
  status: "pending";
  called_at: null;
  completed_at: null;
};

function normalizeCallOrderRow(row: Record<string, unknown>, index: number): SessionCallUpsertRow {
  const callIndexRaw = Number(row.call_index);
  const callIndex = Number.isFinite(callIndexRaw) && callIndexRaw > 0 ? Math.floor(callIndexRaw) : index + 1;

  const ballNumberRaw = Number(row.ball_number);
  const fallbackBall = Math.max(1, Math.min(75, index + 1));
  const ballNumber = Number.isFinite(ballNumberRaw) ? Math.max(1, Math.min(75, Math.floor(ballNumberRaw))) : fallbackBall;

  const columnLetterRaw = typeof row.column_letter === "string" ? row.column_letter.toUpperCase().trim() : "B";
  const columnLetter = ["B", "G", "I", "N", "O"].includes(columnLetterRaw) ? columnLetterRaw : "B";

  const playlistTrackKey =
    typeof row.playlist_track_key === "string" && row.playlist_track_key.length > 0
      ? row.playlist_track_key
      : typeof row.track_key === "string" && row.track_key.length > 0
        ? row.track_key
        : `missing:${index + 1}`;

  return {
    playlist_track_key: playlistTrackKey,
    call_index: callIndex,
    ball_number: ballNumber,
    column_letter: columnLetter,
    track_title: typeof row.track_title === "string" ? row.track_title : "",
    artist_name: typeof row.artist_name === "string" ? row.artist_name : "",
    album_name: typeof row.album_name === "string" ? row.album_name : null,
    side: typeof row.side === "string" ? row.side : null,
    position: typeof row.position === "string" ? row.position : null,
    link_group: typeof row.link_group === "string" ? row.link_group : null,
    theme_hint: typeof row.theme_hint === "string" ? row.theme_hint : null,
    status: "pending",
    called_at: null,
    completed_at: null,
  };
}

async function replaceSessionCallsFromCallOrder(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  callOrder: Array<Record<string, unknown>>
) {
  const normalized = callOrder.map((row, index) => normalizeCallOrderRow(row, index));

  const { data: existingCalls, error: existingError } = await db
    .from("bingo_session_calls")
    .select("id")
    .eq("session_id", sessionId)
    .order("id", { ascending: true });

  if (existingError) throw new Error(existingError.message);

  const typedExisting = (existingCalls ?? []) as Array<{ id: number }>;
  if (typedExisting.length !== normalized.length) {
    const { error: deleteCallsError } = await db
      .from("bingo_session_calls")
      .delete()
      .eq("session_id", sessionId);
    if (deleteCallsError) throw new Error(deleteCallsError.message);

    const { error: insertCallsError } = await db
      .from("bingo_session_calls")
      .insert(normalized.map((row) => ({ session_id: sessionId, ...row })));
    if (insertCallsError) throw new Error(insertCallsError.message);
    return;
  }

  for (let index = 0; index < typedExisting.length; index += 1) {
    const existing = typedExisting[index];
    const { error } = await db
      .from("bingo_session_calls")
      .update({
        call_index: 1000 + index + 1,
        ball_number: null,
        status: "pending",
        called_at: null,
        completed_at: null,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const existing = typedExisting[index];
    const next = normalized[index];
    const { error } = await db
      .from("bingo_session_calls")
      .update(next)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  }
}

async function resetSessionAfterPlaylistReset(db: ReturnType<typeof getBingoDb>, sessionId: number) {
  const { error: clearEventsError } = await db
    .from("bingo_session_events")
    .delete()
    .eq("session_id", sessionId);
  if (clearEventsError) throw new Error(clearEventsError.message);

  const { error: sessionError } = await db
    .from("bingo_sessions")
    .update({
      status: "pending",
      current_call_index: 0,
      current_round: 1,
      started_at: null,
      ended_at: null,
      paused_at: null,
      paused_remaining_seconds: null,
      countdown_started_at: null,
      call_reveal_at: null,
      bingo_overlay: "welcome",
      next_game_scheduled_at: null,
      next_game_rules_text: null,
    })
    .eq("id", sessionId);
  if (sessionError) throw new Error(sessionError.message);
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

      const roundOnePlaylist = createdPlaylists.find((playlist) => playlist.round_number === 1);
      if (roundOnePlaylist) {
        await replaceSessionCallsFromCallOrder(
          db,
          sessionId,
          (roundOnePlaylist.call_order ?? []) as Array<Record<string, unknown>>
        );
        await resetSessionAfterPlaylistReset(db, sessionId);
        await rehydrateBingoCardLabels(sessionId);
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

      const currentRound = Math.max(1, Math.floor(Number(session.current_round ?? 1)));
      if (roundNumber === currentRound) {
        await replaceSessionCallsFromCallOrder(
          db,
          sessionId,
          (created.call_order ?? []) as Array<Record<string, unknown>>
        );
        await rehydrateBingoCardLabels(sessionId);
      }

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

import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import {
  computeMinimumPlaylistTracks,
  generateCards,
  generateSessionCalls,
  getPlaylistTrackCountForPlaylists,
  type GameMode,
} from "src/lib/bingoEngine";
import { createRoundTrackSnapshots, getRoundSnapshotTracks, normalizeRoundCrateIds, type RoundCrateEntry } from "src/lib/bingoGameModel";
import { normalizeRoundModes } from "src/lib/bingoModes";
import {
  collectResolvedPlaylistIdsByRound,
  findPrimaryPlaylistId,
  normalizePlaylistIds,
  normalizeRoundPlaylistIds,
} from "src/lib/bingoRoundPlaylists";
import { generateBingoSessionCode } from "src/lib/bingoSessionCode";

export const runtime = "nodejs";

type CreateSessionBody = {
  event_id?: number | null;
  playlist_id?: number;
  master_playlist_ids?: number[];
  playlist_ids?: number[];
  round_playlist_ids?: { round: number; playlist_ids: number[] }[];
  round_crate_ids?: RoundCrateEntry[];
  game_mode?: GameMode;
  round_modes?: { round: number; modes: GameMode[] }[];
  card_count?: number;
  card_layout?: "2-up" | "4-up";
  card_label_mode?: "track_artist" | "track_only";
  round_count?: number;
  remove_resleeve_seconds?: number;
  place_vinyl_seconds?: number;
  cue_seconds?: number;
  start_slide_seconds?: number;
  host_buffer_seconds?: number;
  sonos_output_delay_ms?: number;
  call_reveal_delay_seconds?: number;
  default_intermission_seconds?: number;
  next_game_rules_text?: string | null;
  recent_calls_limit?: number;
  show_title?: boolean;
  show_logo?: boolean;
  show_rounds?: boolean;
  show_countdown?: boolean;
  is_favorite?: boolean;
  favorite_note?: string | null;
};

type SessionListRow = {
  id: number;
  event_id: number | null;
  playlist_id: number;
  playlist_ids: number[] | null;
  master_playlist_ids: number[] | null;
  round_playlist_ids: { round: number; playlist_ids: number[] }[] | null;
  round_crate_ids: RoundCrateEntry[] | null;
  session_code: string;
  game_mode: string;
  round_modes: { round: number; modes: GameMode[] }[] | null;
  card_count: number;
  status: string;
  current_round: number;
  round_count: number;
  remove_resleeve_seconds: number;
  place_vinyl_seconds: number;
  cue_seconds: number;
  start_slide_seconds: number;
  host_buffer_seconds: number;
  sonos_output_delay_ms: number;
  seconds_to_next_call: number;
  call_reveal_delay_seconds: number;
  show_countdown: boolean;
  recent_calls_limit: number;
  next_game_rules_text: string | null;
  is_favorite: boolean;
  favorite_note: string | null;
  created_at: string;
};

type PlaylistRow = { id: number; name: string };
type EventRow = { id: number; title: string };

async function generateUniqueSessionCode() {
  const db = getBingoDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateBingoSessionCode();
    const { data } = await db.from("bingo_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

export async function GET(request: NextRequest) {
  const db = getBingoDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  const queryBase = (db
    .from("bingo_sessions")
    .select("id, event_id, playlist_id, playlist_ids, master_playlist_ids, round_playlist_ids, round_crate_ids, session_code, game_mode, round_modes, card_count, status, current_round, round_count, remove_resleeve_seconds, place_vinyl_seconds, cue_seconds, start_slide_seconds, host_buffer_seconds, sonos_output_delay_ms, seconds_to_next_call, call_reveal_delay_seconds, show_countdown, recent_calls_limit, next_game_rules_text, is_favorite, favorite_note, created_at") as unknown as {
      order: (column: string, options: { ascending: boolean }) => {
        eq: (column: string, value: number) => Promise<{ data: unknown; error: { message: string } | null }>;
        then?: unknown;
      } & Promise<{ data: unknown; error: { message: string } | null }>;
    });

  const orderedQuery = queryBase.order("created_at", { ascending: false });
  const result = eventId
    ? await orderedQuery.eq("event_id", Number(eventId))
    : await (orderedQuery as unknown as Promise<{ data: unknown; error: { message: string } | null }>);

  const { data, error } = result;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions = (data ?? []) as SessionListRow[];
  const playlistIds = Array.from(
    new Set(
      sessions.flatMap((row) => {
        const selected = Array.isArray(row.playlist_ids) && row.playlist_ids.length > 0
          ? row.playlist_ids
          : [row.playlist_id];
        return selected.filter((value) => Number.isFinite(value));
      })
    )
  );
  const eventIds = Array.from(new Set(sessions.map((row) => row.event_id).filter((value): value is number => Number.isFinite(value))));

  const { data: playlists } = playlistIds.length
    ? await db.from("collection_playlists").select("id, name").in("id", playlistIds)
    : { data: [] as PlaylistRow[] };
  const playlistById = new Map<number, string>(((playlists ?? []) as PlaylistRow[]).map((row) => [row.id, row.name]));

  const { data: events } = eventIds.length
    ? await db.from("events").select("id, title").in("id", eventIds)
    : { data: [] as EventRow[] };
  const eventsById = new Map<number, EventRow>(((events ?? []) as EventRow[]).map((row) => [row.id, row]));

  return NextResponse.json(
    {
      data: sessions.map((row) => ({
        ...row,
        playlist_name: playlistById.get(row.playlist_id) ?? "Unknown Playlist",
        playlist_names: (Array.isArray(row.master_playlist_ids) && row.master_playlist_ids.length > 0 ? row.master_playlist_ids : Array.isArray(row.playlist_ids) && row.playlist_ids.length > 0 ? row.playlist_ids : [row.playlist_id])
          .map((id) => playlistById.get(id) ?? `Playlist ${id}`),
        event_title: row.event_id ? eventsById.get(row.event_id)?.title ?? null : null,
      })),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = getBingoDb();
    const body = (await request.json()) as CreateSessionBody;

    const playlistId = Number(body.playlist_id);
    const selectedPlaylistIds = normalizePlaylistIds(body.master_playlist_ids ?? body.playlist_ids, playlistId);
    if (selectedPlaylistIds.length === 0) {
      return NextResponse.json({ error: "At least one playlist is required" }, { status: 400 });
    }

    const gameMode = body.game_mode ?? "single_line";
    const cardCount = Math.max(1, Math.floor(body.card_count ?? 40));
    const roundCount = Math.max(1, Math.floor(body.round_count ?? 3));
    const roundModes = normalizeRoundModes(body.round_modes, roundCount);
    const roundPlaylistIds = normalizeRoundPlaylistIds(body.round_playlist_ids, roundCount);
    const roundCrateIds = normalizeRoundCrateIds(body.round_crate_ids, roundCount);
    const resolvedPlaylistsByRound = collectResolvedPlaylistIdsByRound(
      {
        playlist_id: selectedPlaylistIds[0] ?? null,
        playlist_ids: selectedPlaylistIds,
        round_playlist_ids: roundPlaylistIds,
      },
      roundCount
    );

    for (let round = 1; round <= roundCount; round += 1) {
      if ((resolvedPlaylistsByRound.get(round) ?? []).length === 0) {
        return NextResponse.json(
          { error: `Round ${round} needs at least one playlist or a master playlist selection.` },
          { status: 400 }
        );
      }
    }

    const requiredTrackCount = computeMinimumPlaylistTracks(roundCount, cardCount);
    const trackCountCache = new Map<string, number>();
    for (let round = 1; round <= roundCount; round += 1) {
      const playlistIdsForRound = resolvedPlaylistsByRound.get(round) ?? [];
      const cacheKey = playlistIdsForRound.join(",");
      let availableTrackCount = trackCountCache.get(cacheKey);
      if (availableTrackCount === undefined) {
        availableTrackCount = await getPlaylistTrackCountForPlaylists(db, playlistIdsForRound);
        trackCountCache.set(cacheKey, availableTrackCount);
      }

      if (availableTrackCount < requiredTrackCount) {
        return NextResponse.json(
          {
            error: `Round ${round} playlist selection must contain at least ${requiredTrackCount} tracks to build one bingo crate.`,
          },
          { status: 400 }
        );
      }
    }

    const primaryPlaylistId = findPrimaryPlaylistId(selectedPlaylistIds, roundPlaylistIds);
    if (!primaryPlaylistId) {
      return NextResponse.json({ error: "At least one playlist is required" }, { status: 400 });
    }

    const code = await generateUniqueSessionCode();
    const removeResleeveSeconds = body.remove_resleeve_seconds ?? 20;
    const placeVinylSeconds = body.place_vinyl_seconds ?? 8;
    const cueSeconds = body.cue_seconds ?? 12;
    const startSlideSeconds = body.start_slide_seconds ?? 5;
    const hostBufferSeconds = body.host_buffer_seconds ?? 2;
    const sonosDelayMs = body.sonos_output_delay_ms ?? 75;
    const callRevealDelaySeconds = body.call_reveal_delay_seconds ?? 10;
    const defaultIntermissionSeconds = body.default_intermission_seconds ?? 600;
    const secondsToNextCall = 45;

    const { data: session, error: insertError } = await db
      .from("bingo_sessions")
      .insert({
        event_id: body.event_id ?? null,
        // Keep primary playlist_id for backwards compatibility in existing views.
        playlist_id: primaryPlaylistId,
        playlist_ids: selectedPlaylistIds.length > 0 ? selectedPlaylistIds : null,
        master_playlist_ids: selectedPlaylistIds.length > 0 ? selectedPlaylistIds : null,
        round_playlist_ids: roundPlaylistIds.length > 0 ? roundPlaylistIds : null,
        round_crate_ids: roundCrateIds.length > 0 ? roundCrateIds : null,
        session_code: code,
        game_mode: gameMode,
        round_modes: roundModes.length > 0 ? roundModes : null,
        card_count: cardCount,
        card_layout: body.card_layout ?? "2-up",
        card_label_mode: body.card_label_mode ?? "track_artist",
        round_count: roundCount,
        current_round: 1,
        round_end_policy: "open_until_winner",
        tie_break_policy: "one_song_playoff",
        pool_exhaustion_policy: "declare_tie",
        remove_resleeve_seconds: removeResleeveSeconds,
        place_vinyl_seconds: placeVinylSeconds,
        cue_seconds: cueSeconds,
        start_slide_seconds: startSlideSeconds,
        host_buffer_seconds: hostBufferSeconds,
        seconds_to_next_call: secondsToNextCall,
        sonos_output_delay_ms: sonosDelayMs,
        recent_calls_limit: body.recent_calls_limit ?? 5,
        show_title: body.show_title ?? true,
        show_logo: body.show_logo ?? true,
        show_rounds: body.show_rounds ?? true,
        show_countdown: body.show_countdown ?? true,
        status: "pending",
        countdown_started_at: null,
        paused_at: null,
        paused_remaining_seconds: null,
        bingo_overlay: "welcome",
        call_reveal_delay_seconds: callRevealDelaySeconds,
        default_intermission_seconds: defaultIntermissionSeconds,
        next_game_rules_text: body.next_game_rules_text ?? null,
        is_favorite: body.is_favorite ?? false,
        favorite_note: body.favorite_note?.trim() || null,
      })
      .select("id, session_code, playlist_id, card_count, card_label_mode")
      .single();

    if (insertError || !session) {
      return NextResponse.json({ error: insertError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      await createRoundTrackSnapshots(db, session.id, resolvedPlaylistsByRound);
      const roundOneTracks = await getRoundSnapshotTracks(db, session.id, 1);
      if (roundOneTracks.length === 0) {
        throw new Error("Failed to build immutable game playlist for round 1.");
      }
      await generateSessionCalls(db, session.id, resolvedPlaylistsByRound.get(1) ?? [], { roundNumber: 1 });
      await generateCards(
        db,
        session.id,
        session.card_count,
        session.card_label_mode as "track_artist" | "track_only",
        session.session_code
      );
    } catch (error) {
      await db.from("bingo_sessions").delete().eq("id", session.id);
      const message = error instanceof Error ? error.message : "Failed to generate calls/cards";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ id: session.id, session_code: session.session_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const idRaw = request.nextUrl.searchParams.get("id");
  const sessionId = Number(idRaw);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const db = getBingoDb();
  const { error } = await db.from("bingo_sessions").delete().eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

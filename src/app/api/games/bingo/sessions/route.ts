import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import {
  computeMinimumPlaylistTracks,
  generateCards,
  generateSessionCalls,
  generateSessionCallsFromTracks,
  getPlaylistTrackCountForPlaylists,
  resolvePlaylistTracksForPlaylists,
  resolveTrackKeys,
  type ResolvedPlaylistTrack,
  type GameMode,
} from "src/lib/bingoEngine";
import {
  createRoundTrackSnapshots,
  createRoundTrackSnapshotsFromTracks,
  getRoundSnapshotTracks,
} from "src/lib/bingoGameModel";
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
  game_preset_id?: number | null;
  playlist_id?: number;
  master_playlist_ids?: number[];
  playlist_ids?: number[];
  round_playlist_ids?: { round: number; playlist_ids: number[] }[];
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
  game_preset_id: number | null;
  playlist_id: number;
  playlist_ids: number[] | null;
  master_playlist_ids: number[] | null;
  round_playlist_ids: { round: number; playlist_ids: number[] }[] | null;
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
type PresetRow = {
  id: number;
  source_playlist_ids: number[] | null;
  pool_size: number;
};

const DEFAULT_POOL_SIZE = 75;

function sampleTracks(tracks: ResolvedPlaylistTrack[], targetSize: number): ResolvedPlaylistTrack[] {
  const copy = [...tracks];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.max(1, targetSize));
}

async function loadPresetPoolTracks(db: ReturnType<typeof getBingoDb>, presetId: number): Promise<ResolvedPlaylistTrack[]> {
  const { data: poolRows, error: poolError } = await db
    .from("bingo_game_pool_tracks")
    .select("track_key, sort_order")
    .eq("preset_id", presetId)
    .order("sort_order", { ascending: true });

  if (poolError) throw new Error(poolError.message);
  const trackKeys = (poolRows ?? []).map((row) => String(row.track_key ?? "")).filter(Boolean);
  if (trackKeys.length === 0) {
    throw new Error("Preset has no saved pool tracks.");
  }

  const resolved = await resolveTrackKeys(db, trackKeys);
  const tracks: ResolvedPlaylistTrack[] = [];
  trackKeys.forEach((trackKey, index) => {
    const row = resolved.get(trackKey);
    if (!row) return;
    tracks.push({
      trackKey,
      sortOrder: index,
      trackTitle: row.track_title,
      artistName: row.artist_name,
      albumName: row.album_name,
      side: row.side,
      position: row.position,
    });
  });

  if (tracks.length === 0) {
    throw new Error("Preset pool tracks no longer resolve to collection metadata.");
  }

  return tracks;
}

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
    .select("id, event_id, game_preset_id, playlist_id, playlist_ids, master_playlist_ids, round_playlist_ids, session_code, game_mode, round_modes, card_count, status, current_round, round_count, remove_resleeve_seconds, place_vinyl_seconds, cue_seconds, start_slide_seconds, host_buffer_seconds, sonos_output_delay_ms, seconds_to_next_call, call_reveal_delay_seconds, show_countdown, recent_calls_limit, next_game_rules_text, is_favorite, favorite_note, created_at") as unknown as {
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

    const requestedPresetId = Number(body.game_preset_id);
    const wantsPreset = Number.isFinite(requestedPresetId) && requestedPresetId > 0;

    let presetIdForSession: number | null = null;
    let selectedPlaylistIds = normalizePlaylistIds(body.master_playlist_ids ?? body.playlist_ids, Number(body.playlist_id));
    let fixedPoolTracks: ResolvedPlaylistTrack[] | null = null;

    if (wantsPreset) {
      const { data: preset, error: presetError } = await db
        .from("bingo_game_presets")
        .select("id, source_playlist_ids, pool_size")
        .eq("id", requestedPresetId)
        .maybeSingle();

      if (presetError) {
        return NextResponse.json({ error: presetError.message }, { status: 500 });
      }
      if (!preset) {
        return NextResponse.json({ error: "Favorite preset not found" }, { status: 404 });
      }

      const typedPreset = preset as PresetRow;
      const presetPlaylistIds = normalizePlaylistIds(typedPreset.source_playlist_ids);
      if (presetPlaylistIds.length > 0) {
        selectedPlaylistIds = presetPlaylistIds;
      }

      presetIdForSession = typedPreset.id;
      fixedPoolTracks = await loadPresetPoolTracks(db, typedPreset.id);
    }

    if (selectedPlaylistIds.length === 0) {
      return NextResponse.json({ error: "At least one playlist is required" }, { status: 400 });
    }

    const gameMode = body.game_mode ?? "single_line";
    const cardCount = Math.max(1, Math.floor(body.card_count ?? 40));
    const roundCount = Math.max(1, Math.floor(body.round_count ?? 3));
    const roundModes = normalizeRoundModes(body.round_modes, roundCount);
    const roundPlaylistIds = normalizeRoundPlaylistIds(body.round_playlist_ids, roundCount);
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
    if (fixedPoolTracks) {
      if (fixedPoolTracks.length < requiredTrackCount) {
        return NextResponse.json(
          {
            error: `Favorite preset pool must contain at least ${requiredTrackCount} tracks to build one bingo crate.`,
          },
          { status: 400 }
        );
      }
    } else {
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

      if (body.is_favorite) {
        const candidatePool = await resolvePlaylistTracksForPlaylists(db, selectedPlaylistIds);
        if (candidatePool.length < requiredTrackCount) {
          return NextResponse.json(
            {
              error: `Playlist selection must contain at least ${requiredTrackCount} tracks to build a reusable favorite pool.`,
            },
            { status: 400 }
          );
        }
        fixedPoolTracks = sampleTracks(candidatePool, Math.min(DEFAULT_POOL_SIZE, candidatePool.length));
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
        game_preset_id: presetIdForSession,
        // Keep primary playlist_id for backwards compatibility in existing views.
        playlist_id: primaryPlaylistId,
        playlist_ids: selectedPlaylistIds.length > 0 ? selectedPlaylistIds : null,
        master_playlist_ids: selectedPlaylistIds.length > 0 ? selectedPlaylistIds : null,
        round_playlist_ids: roundPlaylistIds.length > 0 ? roundPlaylistIds : null,
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
      if (!presetIdForSession && body.is_favorite && fixedPoolTracks && fixedPoolTracks.length > 0) {
        const presetName = body.favorite_note?.trim() || `Favorite ${session.session_code}`;
        const { data: createdPreset, error: presetInsertError } = await db
          .from("bingo_game_presets")
          .insert({
            name: presetName,
            source_playlist_ids: selectedPlaylistIds,
            pool_size: fixedPoolTracks.length,
            created_from_session_id: session.id,
            note: body.favorite_note?.trim() || null,
            archived: false,
          })
          .select("id")
          .single();

        if (presetInsertError || !createdPreset) {
          throw new Error(presetInsertError?.message ?? "Failed to create favorite preset");
        }

        presetIdForSession = Number(createdPreset.id);
        const poolRows = fixedPoolTracks.map((track, index) => ({
          preset_id: presetIdForSession,
          track_key: track.trackKey,
          sort_order: index,
        }));

        const { error: poolInsertError } = await db.from("bingo_game_pool_tracks").insert(poolRows);
        if (poolInsertError) {
          throw new Error(poolInsertError.message);
        }

        const { error: sessionPresetUpdateError } = await db
          .from("bingo_sessions")
          .update({ game_preset_id: presetIdForSession })
          .eq("id", session.id);
        if (sessionPresetUpdateError) {
          throw new Error(sessionPresetUpdateError.message);
        }
      }

      if (fixedPoolTracks && fixedPoolTracks.length > 0) {
        await createRoundTrackSnapshotsFromTracks(db, session.id, roundCount, fixedPoolTracks);
      } else {
        await createRoundTrackSnapshots(db, session.id, resolvedPlaylistsByRound);
      }

      const roundOneTracks = await getRoundSnapshotTracks(db, session.id, 1);
      if (roundOneTracks.length === 0) {
        throw new Error("Failed to build immutable game playlist for round 1.");
      }

      if (fixedPoolTracks && fixedPoolTracks.length > 0) {
        await generateSessionCallsFromTracks(db, session.id, fixedPoolTracks, { roundNumber: 1 });
      } else {
        await generateSessionCalls(db, session.id, resolvedPlaylistsByRound.get(1) ?? [], { roundNumber: 1 });
      }

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

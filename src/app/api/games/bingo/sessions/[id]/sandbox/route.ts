import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { buildCardIdentifier, planRoundSessionCalls } from "src/lib/bingoEngine";
import { getRoundSnapshotTracks } from "src/lib/bingoGameModel";
import { generateBingoSessionCode } from "src/lib/bingoSessionCode";

export const runtime = "nodejs";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type SourceSessionRow = {
  id: number;
  event_id: number | null;
  game_preset_id: number | null;
  playlist_id: number;
  playlist_ids: number[] | null;
  master_playlist_ids: number[] | null;
  round_playlist_ids: { round: number; playlist_ids: number[] }[] | null;
  session_code: string;
  game_mode: string;
  round_modes: { round: number; modes: string[] }[] | null;
  card_count: number;
  card_layout: string;
  card_label_mode: string;
  round_count: number;
  round_end_policy: string;
  tie_break_policy: string;
  pool_exhaustion_policy: string;
  remove_resleeve_seconds: number;
  place_vinyl_seconds: number;
  cue_seconds: number;
  start_slide_seconds: number;
  host_buffer_seconds: number;
  seconds_to_next_call: number;
  sonos_output_delay_ms: number;
  recent_calls_limit: number;
  show_title: boolean;
  show_logo: boolean;
  show_rounds: boolean;
  show_countdown: boolean;
  next_game_rules_text: string | null;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  welcome_rules_text: string | null;
  welcome_tiebreak_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  intermission_footer_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  thanks_events_heading_text: string | null;
  call_reveal_delay_seconds: number;
  default_intermission_seconds: number;
  active_playlist_letter_by_round: { round: number; letter: string }[] | null;
  theme_enabled: boolean;
  theme_name: string | null;
  is_sandbox: boolean;
};

type RoundTrackRow = {
  round_number: number;
  slot_index: number;
  playlist_track_key: string;
  source_playlist_id: number | null;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
  link_group: string | null;
  theme_hint: string | null;
};

type SessionPlaylistRow = {
  round_number: number;
  playlist_name: string;
  playlist_letter: string;
  call_order: Record<string, unknown>[];
};

type CardRow = {
  card_number: number;
  has_free_space: boolean;
  grid: Json;
};

type SourceCallRow = {
  call_index: number;
  ball_number: number | null;
  column_letter: string;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
  link_group: string | null;
  playlist_track_key: string | null;
  theme_hint: string | null;
};

function parseSessionId(id: string): number | null {
  const parsed = Number(id);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function coerceBallNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return Math.max(1, Math.min(75, rounded));
}

function coerceColumnLetter(value: unknown): "B" | "I" | "N" | "G" | "O" {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (normalized === "B" || normalized === "I" || normalized === "N" || normalized === "G" || normalized === "O") {
    return normalized;
  }
  return "B";
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

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sourceSessionId = parseSessionId(id);
  if (!sourceSessionId) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getBingoDb();
  const sourceQuery = (db
    .from("bingo_sessions")
    .select("id, event_id, game_preset_id, playlist_id, playlist_ids, master_playlist_ids, round_playlist_ids, session_code, game_mode, round_modes, card_count, card_layout, card_label_mode, round_count, round_end_policy, tie_break_policy, pool_exhaustion_policy, remove_resleeve_seconds, place_vinyl_seconds, cue_seconds, start_slide_seconds, host_buffer_seconds, seconds_to_next_call, sonos_output_delay_ms, recent_calls_limit, show_title, show_logo, show_rounds, show_countdown, next_game_rules_text, welcome_heading_text, welcome_message_text, welcome_rules_text, welcome_tiebreak_text, intermission_heading_text, intermission_message_text, intermission_footer_text, thanks_heading_text, thanks_subheading_text, thanks_events_heading_text, call_reveal_delay_seconds, default_intermission_seconds, active_playlist_letter_by_round, theme_enabled, theme_name, is_sandbox") as unknown as {
      eq: (column: string, value: number) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    });

  const { data: source, error: sourceError } = await sourceQuery.eq("id", sourceSessionId).maybeSingle();
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
  if (!source) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSource = source as SourceSessionRow;
  if (typedSource.is_sandbox) {
    return NextResponse.json({ error: "Sandbox sessions cannot be cloned again" }, { status: 400 });
  }

  const sessionCode = await generateUniqueSessionCode();
  const sandboxExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let sandboxSessionId: number | null = null;

  try {
    const { data: created, error: createError } = await db
      .from("bingo_sessions")
      .insert({
        event_id: typedSource.event_id,
        game_preset_id: typedSource.game_preset_id,
        playlist_id: typedSource.playlist_id,
        playlist_ids: typedSource.playlist_ids,
        master_playlist_ids: typedSource.master_playlist_ids,
        round_playlist_ids: typedSource.round_playlist_ids,
        session_code: sessionCode,
        game_mode: typedSource.game_mode,
        round_modes: typedSource.round_modes,
        card_count: typedSource.card_count,
        card_layout: typedSource.card_layout,
        card_label_mode: typedSource.card_label_mode,
        round_count: typedSource.round_count,
        current_round: 1,
        round_end_policy: typedSource.round_end_policy,
        tie_break_policy: typedSource.tie_break_policy,
        pool_exhaustion_policy: typedSource.pool_exhaustion_policy,
        remove_resleeve_seconds: typedSource.remove_resleeve_seconds,
        place_vinyl_seconds: typedSource.place_vinyl_seconds,
        cue_seconds: typedSource.cue_seconds,
        start_slide_seconds: typedSource.start_slide_seconds,
        host_buffer_seconds: typedSource.host_buffer_seconds,
        seconds_to_next_call: typedSource.seconds_to_next_call,
        sonos_output_delay_ms: typedSource.sonos_output_delay_ms,
        countdown_started_at: null,
        paused_remaining_seconds: null,
        paused_at: null,
        current_call_index: 0,
        recent_calls_limit: typedSource.recent_calls_limit,
        show_title: typedSource.show_title,
        show_logo: typedSource.show_logo,
        show_rounds: typedSource.show_rounds,
        show_countdown: typedSource.show_countdown,
        status: "pending",
        started_at: null,
        ended_at: null,
        next_game_scheduled_at: null,
        next_game_rules_text: typedSource.next_game_rules_text,
        welcome_heading_text: typedSource.welcome_heading_text,
        welcome_message_text: typedSource.welcome_message_text,
        welcome_rules_text: typedSource.welcome_rules_text,
        welcome_tiebreak_text: typedSource.welcome_tiebreak_text,
        intermission_heading_text: typedSource.intermission_heading_text,
        intermission_message_text: typedSource.intermission_message_text,
        intermission_footer_text: typedSource.intermission_footer_text,
        thanks_heading_text: typedSource.thanks_heading_text,
        thanks_subheading_text: typedSource.thanks_subheading_text,
        thanks_events_heading_text: typedSource.thanks_events_heading_text,
        call_reveal_delay_seconds: typedSource.call_reveal_delay_seconds,
        call_reveal_at: null,
        bingo_overlay: "welcome",
        default_intermission_seconds: typedSource.default_intermission_seconds,
        active_playlist_letter_by_round: typedSource.active_playlist_letter_by_round,
        theme_enabled: typedSource.theme_enabled,
        theme_name: typedSource.theme_name,
        is_sandbox: true,
        sandbox_source_session_id: typedSource.id,
        sandbox_expires_at: sandboxExpiresAt,
      })
      .select("id")
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: createError?.message ?? "Failed to create sandbox session" }, { status: 500 });
    }

    sandboxSessionId = Number(created.id);

    const { data: sourceTracks, error: sourceTracksError } = await db
      .from("bingo_session_round_tracks")
      .select("round_number, slot_index, playlist_track_key, source_playlist_id, track_title, artist_name, album_name, side, position, link_group, theme_hint")
      .eq("session_id", sourceSessionId)
      .order("round_number", { ascending: true })
      .order("slot_index", { ascending: true });

    if (sourceTracksError) throw new Error(sourceTracksError.message);

    const trackRows = (sourceTracks ?? []) as RoundTrackRow[];
    if (trackRows.length > 0) {
      const { error: trackInsertError } = await db.from("bingo_session_round_tracks").insert(
        trackRows.map((row) => ({
          session_id: sandboxSessionId,
          round_number: row.round_number,
          slot_index: row.slot_index,
          playlist_track_key: row.playlist_track_key,
          source_playlist_id: row.source_playlist_id,
          track_title: row.track_title,
          artist_name: row.artist_name,
          album_name: row.album_name,
          side: row.side,
          position: row.position,
          link_group: row.link_group,
          theme_hint: row.theme_hint,
        }))
      );
      if (trackInsertError) throw new Error(trackInsertError.message);
    }

    const { data: sourcePlaylists, error: sourcePlaylistsError } = await db
      .from("bingo_session_game_playlists")
      .select("round_number, playlist_name, playlist_letter, call_order")
      .eq("session_id", sourceSessionId)
      .order("round_number", { ascending: true })
      .order("playlist_letter", { ascending: true });

    if (sourcePlaylistsError) throw new Error(sourcePlaylistsError.message);

    const playlistRows = (sourcePlaylists ?? []) as SessionPlaylistRow[];
    if (playlistRows.length > 0) {
      const { error: playlistInsertError } = await db.from("bingo_session_game_playlists").insert(
        playlistRows.map((row) => ({
          session_id: sandboxSessionId,
          round_number: row.round_number,
          playlist_name: row.playlist_name,
          playlist_letter: row.playlist_letter,
          call_order: row.call_order,
        }))
      );
      if (playlistInsertError) throw new Error(playlistInsertError.message);
    }

    const { data: sourceCards, error: sourceCardsError } = await db
      .from("bingo_cards")
      .select("card_number, has_free_space, grid")
      .eq("session_id", sourceSessionId)
      .order("card_number", { ascending: true });

    if (sourceCardsError) throw new Error(sourceCardsError.message);

    const cardRows = (sourceCards ?? []) as CardRow[];
    if (cardRows.length > 0) {
      const { error: cardInsertError } = await db.from("bingo_cards").insert(
        cardRows.map((row) => ({
          session_id: sandboxSessionId,
          card_number: row.card_number,
          card_identifier: buildCardIdentifier(sessionCode, row.card_number),
          has_free_space: row.has_free_space,
          grid: row.grid,
        }))
      );
      if (cardInsertError) throw new Error(cardInsertError.message);
    }

    let callRows: Array<{
      playlist_track_key: string | null;
      call_index: number;
      ball_number: number | null;
      column_letter: string;
      track_title: string;
      artist_name: string;
      album_name: string | null;
      side: string | null;
      position: string | null;
      link_group: string | null;
      theme_hint: string | null;
    }> = [];

    const roundOneActiveLetter = (typedSource.active_playlist_letter_by_round ?? []).find((entry) => entry.round === 1)?.letter ?? null;
    const roundOnePlaylists = playlistRows.filter((row) => row.round_number === 1);
    const fallbackPlaylist = [...roundOnePlaylists].sort((left, right) => left.playlist_letter.localeCompare(right.playlist_letter))[0] ?? null;
    const selectedPlaylist = roundOneActiveLetter
      ? roundOnePlaylists.find((row) => row.playlist_letter === roundOneActiveLetter) ?? null
      : fallbackPlaylist;

    if (selectedPlaylist && Array.isArray(selectedPlaylist.call_order) && selectedPlaylist.call_order.length > 0) {
      callRows = selectedPlaylist.call_order.map((row, index) => ({
        playlist_track_key: typeof row.playlist_track_key === "string"
          ? row.playlist_track_key
          : typeof row.track_key === "string"
            ? row.track_key
            : null,
        call_index: Number(row.call_index) || index + 1,
        ball_number: coerceBallNumber(row.ball_number, index + 1),
        column_letter: coerceColumnLetter(row.column_letter),
        track_title: typeof row.track_title === "string" ? row.track_title : "",
        artist_name: typeof row.artist_name === "string" ? row.artist_name : "",
        album_name: typeof row.album_name === "string" ? row.album_name : null,
        side: typeof row.side === "string" ? row.side : null,
        position: typeof row.position === "string" ? row.position : null,
        link_group: typeof row.link_group === "string" ? row.link_group : null,
        theme_hint: typeof row.theme_hint === "string" ? row.theme_hint : null,
      }));
    }

    if (callRows.length === 0) {
      const snapshotTracks = await getRoundSnapshotTracks(db, sandboxSessionId, 1);
      if (snapshotTracks.length > 0) {
        callRows = planRoundSessionCalls(snapshotTracks, sandboxSessionId, 1).map((call) => ({
          playlist_track_key: call.playlist_track_key,
          call_index: call.call_index,
          ball_number: call.ball_number,
          column_letter: call.column_letter,
          track_title: call.track_title,
          artist_name: call.artist_name,
          album_name: call.album_name,
          side: call.side,
          position: call.position,
          link_group: call.link_group ?? null,
          theme_hint: call.theme_hint ?? null,
        }));
      }
    }

    if (callRows.length === 0) {
      const { data: sourceCalls, error: sourceCallsError } = await db
        .from("bingo_session_calls")
        .select("call_index, ball_number, column_letter, track_title, artist_name, album_name, side, position, link_group, playlist_track_key, theme_hint")
        .eq("session_id", sourceSessionId)
        .order("call_index", { ascending: true });

      if (sourceCallsError) throw new Error(sourceCallsError.message);

      callRows = ((sourceCalls ?? []) as SourceCallRow[]).map((row, index) => ({
        playlist_track_key: row.playlist_track_key,
        call_index: row.call_index || index + 1,
        ball_number: row.ball_number,
        column_letter: coerceColumnLetter(row.column_letter),
        track_title: row.track_title,
        artist_name: row.artist_name,
        album_name: row.album_name,
        side: row.side,
        position: row.position,
        link_group: row.link_group,
        theme_hint: row.theme_hint,
      }));
    }

    if (callRows.length === 0) {
      throw new Error("Unable to initialize sandbox calls for round 1");
    }

    const { error: callsInsertError } = await db.from("bingo_session_calls").insert(
      callRows.map((row) => ({
        session_id: sandboxSessionId,
        playlist_track_key: row.playlist_track_key,
        call_index: row.call_index,
        ball_number: row.ball_number,
        column_letter: row.column_letter,
        track_title: row.track_title,
        artist_name: row.artist_name,
        album_name: row.album_name,
        side: row.side,
        position: row.position,
        link_group: row.link_group,
        theme_hint: row.theme_hint,
        status: "pending",
      }))
    );

    if (callsInsertError) throw new Error(callsInsertError.message);

    return NextResponse.json(
      {
        id: sandboxSessionId,
        session_code: sessionCode,
        source_session_id: sourceSessionId,
        sandbox_expires_at: sandboxExpiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (sandboxSessionId) {
      await db.from("bingo_sessions").delete().eq("id", sandboxSessionId);
    }
    const message = error instanceof Error ? error.message : "Failed to create sandbox session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

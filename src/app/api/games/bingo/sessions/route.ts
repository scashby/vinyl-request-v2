import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { generateCards, generateSessionCalls, type GameMode } from "src/lib/bingoEngine";
import { generateBingoSessionCode } from "src/lib/bingoSessionCode";

export const runtime = "nodejs";

type CreateSessionBody = {
  event_id?: number | null;
  playlist_id?: number;
  game_mode?: GameMode;
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
  recent_calls_limit?: number;
  show_title?: boolean;
  show_logo?: boolean;
  show_rounds?: boolean;
  show_countdown?: boolean;
};

type SessionListRow = {
  id: number;
  event_id: number | null;
  playlist_id: number;
  session_code: string;
  game_mode: string;
  status: string;
  current_round: number;
  round_count: number;
  created_at: string;
};

type PlaylistRow = { id: number; name: string };

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

  let query = db
    .from("bingo_sessions")
    .select("id, event_id, playlist_id, session_code, game_mode, status, current_round, round_count, created_at")
    .order("created_at", { ascending: false });

  if (eventId) query = query.eq("event_id", Number(eventId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions = (data ?? []) as SessionListRow[];
  const playlistIds = Array.from(new Set(sessions.map((row) => row.playlist_id)));

  const { data: playlists } = playlistIds.length
    ? await db.from("collection_playlists").select("id, name").in("id", playlistIds)
    : { data: [] as PlaylistRow[] };
  const playlistById = new Map<number, string>(((playlists ?? []) as PlaylistRow[]).map((row) => [row.id, row.name]));

  return NextResponse.json(
    {
      data: sessions.map((row) => ({
        ...row,
        playlist_name: playlistById.get(row.playlist_id) ?? "Unknown Playlist",
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
    if (!Number.isFinite(playlistId)) {
      return NextResponse.json({ error: "playlist_id is required" }, { status: 400 });
    }

    const gameMode = body.game_mode ?? "single_line";
    const code = await generateUniqueSessionCode();
    const removeResleeveSeconds = body.remove_resleeve_seconds ?? 20;
    const placeVinylSeconds = body.place_vinyl_seconds ?? 8;
    const cueSeconds = body.cue_seconds ?? 12;
    const startSlideSeconds = body.start_slide_seconds ?? 5;
    const hostBufferSeconds = body.host_buffer_seconds ?? 2;
    const sonosDelayMs = body.sonos_output_delay_ms ?? 75;
    const secondsToNextCall =
      removeResleeveSeconds +
      placeVinylSeconds +
      cueSeconds +
      startSlideSeconds +
      hostBufferSeconds +
      Math.ceil(sonosDelayMs / 1000);

    const { data: session, error: insertError } = await db
      .from("bingo_sessions")
      .insert({
        event_id: body.event_id ?? null,
        playlist_id: playlistId,
        session_code: code,
        game_mode: gameMode,
        card_count: body.card_count ?? 40,
        card_layout: body.card_layout ?? "2-up",
        card_label_mode: body.card_label_mode ?? "track_artist",
        round_count: body.round_count ?? 3,
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
      })
      .select("id, session_code, playlist_id, card_count, card_label_mode")
      .single();

    if (insertError || !session) {
      return NextResponse.json({ error: insertError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      await generateSessionCalls(db, session.id, playlistId, gameMode);
      await generateCards(db, session.id, session.card_count, session.card_label_mode as "track_artist" | "track_only");
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

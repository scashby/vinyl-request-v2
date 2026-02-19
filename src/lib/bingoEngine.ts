import type { BingoDbClient } from "src/lib/bingoDb";

export const BINGO_COLUMNS = ["B", "I", "N", "G", "O"] as const;
export type BingoColumn = (typeof BINGO_COLUMNS)[number];

export type GameMode =
  | "single_line"
  | "double_line"
  | "triple_line"
  | "criss_cross"
  | "four_corners"
  | "blackout"
  | "death";

export type ResolvedPlaylistTrack = {
  trackKey: string;
  sortOrder: number;
  trackTitle: string;
  artistName: string;
  albumName: string | null;
  side: string | null;
  position: string | null;
};

export type ParsedTrackKey = {
  inventoryId: number | null;
  releaseTrackId: number | null;
  recordingId: number | null;
  fallbackPosition: string | null;
};

export type BingoCardCell = {
  row: number;
  col: number;
  free: boolean;
  column_letter: BingoColumn;
  call_id: number | null;
  track_title: string;
  artist_name: string;
  label: string;
};

type DbPlaylistItem = {
  playlist_id: number;
  track_key: string;
  sort_order: number;
};

type DbInventory = { id: number; release_id: number | null };
type DbReleaseTrack = {
  id: number;
  release_id: number | null;
  recording_id: number | null;
  position: string;
  side: string | null;
  title_override: string | null;
};
type DbRecording = { id: number; title: string | null; track_artist: string | null };
type DbRelease = { id: number; master_id: number | null };
type DbMaster = { id: number; title: string; main_artist_id: number | null };
type DbArtist = { id: number; name: string };

type SessionCallRow = {
  id: number;
  call_index: number;
  column_letter: string;
  track_title: string;
  artist_name: string;
};

export function parseTrackKey(trackKey: string): ParsedTrackKey {
  const parts = String(trackKey).split(":");
  const inventoryIdRaw = Number.parseInt(parts[0] ?? "", 10);
  const inventoryId = Number.isFinite(inventoryIdRaw) ? inventoryIdRaw : null;

  if (parts[1] === "fallback") {
    const recordingIdRaw = Number.parseInt(parts[2] ?? "", 10);
    return {
      inventoryId,
      releaseTrackId: null,
      recordingId: Number.isFinite(recordingIdRaw) ? recordingIdRaw : null,
      fallbackPosition: parts[3] ?? null,
    };
  }

  const releaseTrackPart = parts[1] ?? "";
  const releaseTrackId = /^\d+$/.test(releaseTrackPart) ? Number.parseInt(releaseTrackPart, 10) : null;
  const fallbackPosition = releaseTrackPart.startsWith("p:") ? releaseTrackPart.slice(2) : null;

  const recordingPart = parts[2] ?? "";
  const recordingId = /^\d+$/.test(recordingPart) ? Number.parseInt(recordingPart, 10) : null;

  return { inventoryId, releaseTrackId, recordingId, fallbackPosition };
}

export function getColumnLetter(index: number): BingoColumn {
  return BINGO_COLUMNS[(index - 1) % BINGO_COLUMNS.length] ?? "B";
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export async function resolvePlaylistTracks(db: BingoDbClient, playlistId: number): Promise<ResolvedPlaylistTrack[]> {
  const { data: playlistItems, error: itemError } = await db
    .from("collection_playlist_items")
    .select("playlist_id, track_key, sort_order")
    .eq("playlist_id", playlistId)
    .order("sort_order", { ascending: true });

  if (itemError) throw new Error(itemError.message);

  const source = (playlistItems ?? []) as DbPlaylistItem[];
  const parsedRows = source.map((item) => ({ item, parsed: parseTrackKey(item.track_key) }));

  const inventoryIds = Array.from(new Set(parsedRows.map((row) => row.parsed.inventoryId).filter((id): id is number => id !== null)));
  const releaseTrackIds = Array.from(new Set(parsedRows.map((row) => row.parsed.releaseTrackId).filter((id): id is number => id !== null)));
  const recordingIds = Array.from(new Set(parsedRows.map((row) => row.parsed.recordingId).filter((id): id is number => id !== null)));

  const [{ data: inventoryRows }, { data: releaseTrackRows }, { data: recordingRows }] = await Promise.all([
    inventoryIds.length
      ? db.from("inventory").select("id, release_id").in("id", inventoryIds)
      : Promise.resolve({ data: [] as DbInventory[] }),
    releaseTrackIds.length
      ? db.from("release_tracks").select("id, release_id, recording_id, position, side, title_override").in("id", releaseTrackIds)
      : Promise.resolve({ data: [] as DbReleaseTrack[] }),
    recordingIds.length
      ? db.from("recordings").select("id, title, track_artist").in("id", recordingIds)
      : Promise.resolve({ data: [] as DbRecording[] }),
  ]);

  const inventoryById = new Map<number, DbInventory>(((inventoryRows ?? []) as DbInventory[]).map((row) => [row.id, row]));
  const releaseTrackById = new Map<number, DbReleaseTrack>(((releaseTrackRows ?? []) as DbReleaseTrack[]).map((row) => [row.id, row]));

  const inferredRecordingIds = Array.from(
    new Set(
      ((releaseTrackRows ?? []) as DbReleaseTrack[])
        .map((row) => row.recording_id)
        .filter((id): id is number => typeof id === "number")
    )
  );
  const missingRecordingIds = inferredRecordingIds.filter((id) => !recordingIds.includes(id));
  const { data: inferredRecordings } = missingRecordingIds.length
    ? await db.from("recordings").select("id, title, track_artist").in("id", missingRecordingIds)
    : { data: [] as DbRecording[] };

  const recordingById = new Map<number, DbRecording>(
    [...((recordingRows ?? []) as DbRecording[]), ...((inferredRecordings ?? []) as DbRecording[])].map((row) => [row.id, row])
  );

  const releaseIds = Array.from(
    new Set(
      ((inventoryRows ?? []) as DbInventory[])
        .map((row) => row.release_id)
        .filter((id): id is number => typeof id === "number")
    )
  );
  const { data: releases } = releaseIds.length
    ? await db.from("releases").select("id, master_id").in("id", releaseIds)
    : { data: [] as DbRelease[] };
  const releaseById = new Map<number, DbRelease>(((releases ?? []) as DbRelease[]).map((row) => [row.id, row]));

  const masterIds = Array.from(
    new Set(
      ((releases ?? []) as DbRelease[])
        .map((row) => row.master_id)
        .filter((id): id is number => typeof id === "number")
    )
  );
  const { data: masters } = masterIds.length
    ? await db.from("masters").select("id, title, main_artist_id").in("id", masterIds)
    : { data: [] as DbMaster[] };
  const masterById = new Map<number, DbMaster>(((masters ?? []) as DbMaster[]).map((row) => [row.id, row]));

  const artistIds = Array.from(
    new Set(
      ((masters ?? []) as DbMaster[])
        .map((row) => row.main_artist_id)
        .filter((id): id is number => typeof id === "number")
    )
  );
  const { data: artists } = artistIds.length
    ? await db.from("artists").select("id, name").in("id", artistIds)
    : { data: [] as DbArtist[] };
  const artistById = new Map<number, DbArtist>(((artists ?? []) as DbArtist[]).map((row) => [row.id, row]));

  return parsedRows.map(({ item, parsed }, index) => {
    const inventory = parsed.inventoryId ? inventoryById.get(parsed.inventoryId) : undefined;
    const release = inventory?.release_id ? releaseById.get(inventory.release_id) : undefined;
    const master = release?.master_id ? masterById.get(release.master_id) : undefined;
    const releaseTrack = parsed.releaseTrackId ? releaseTrackById.get(parsed.releaseTrackId) : undefined;

    const recordingId = parsed.recordingId ?? releaseTrack?.recording_id ?? null;
    const recording = recordingId ? recordingById.get(recordingId) : undefined;

    const trackTitle = releaseTrack?.title_override ?? recording?.title ?? `Track ${index + 1}`;
    const artistName = recording?.track_artist ?? (master?.main_artist_id ? artistById.get(master.main_artist_id)?.name : undefined) ?? "Unknown Artist";

    return {
      trackKey: item.track_key,
      sortOrder: item.sort_order,
      trackTitle,
      artistName,
      albumName: master?.title ?? null,
      side: releaseTrack?.side ?? null,
      position: releaseTrack?.position ?? parsed.fallbackPosition,
    };
  });
}

export async function generateSessionCalls(
  db: BingoDbClient,
  sessionId: number,
  playlistId: number,
  setlistMode: boolean
): Promise<number> {
  const tracks = await resolvePlaylistTracks(db, playlistId);
  const source = setlistMode ? tracks : shuffle(tracks);

  if (source.length < 25) {
    throw new Error("Playlist must contain at least 25 tracks to generate cards.");
  }

  const rows = source.map((track, idx) => ({
    session_id: sessionId,
    playlist_track_key: track.trackKey,
    call_index: idx + 1,
    column_letter: getColumnLetter(idx + 1),
    track_title: track.trackTitle,
    artist_name: track.artistName,
    album_name: track.albumName,
    side: track.side,
    position: track.position,
    status: "pending",
  }));

  const { error } = await db.from("bingo_session_calls").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function generateCards(
  db: BingoDbClient,
  sessionId: number,
  cardCount: number,
  labelMode: "track_artist" | "track_only"
): Promise<void> {
  const { data, error } = await db
    .from("bingo_session_calls")
    .select("id, call_index, column_letter, track_title, artist_name")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) throw new Error(error.message);

  const calls = (data ?? []) as SessionCallRow[];
  const byColumn = {
    B: calls.filter((c) => c.column_letter === "B"),
    I: calls.filter((c) => c.column_letter === "I"),
    N: calls.filter((c) => c.column_letter === "N"),
    G: calls.filter((c) => c.column_letter === "G"),
    O: calls.filter((c) => c.column_letter === "O"),
  };

  const cards: Array<{ session_id: number; card_number: number; has_free_space: boolean; grid: BingoCardCell[] }> = [];

  for (let cardNum = 1; cardNum <= cardCount; cardNum += 1) {
    const picked = {
      B: shuffle(byColumn.B).slice(0, 5),
      I: shuffle(byColumn.I).slice(0, 5),
      N: shuffle(byColumn.N).slice(0, 5),
      G: shuffle(byColumn.G).slice(0, 5),
      O: shuffle(byColumn.O).slice(0, 5),
    };

    const grid: BingoCardCell[] = [];
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const letter = BINGO_COLUMNS[col];
        if (row === 2 && col === 2) {
          grid.push({
            row,
            col,
            free: true,
            column_letter: "N",
            call_id: null,
            track_title: "FREE",
            artist_name: "",
            label: "FREE",
          });
          continue;
        }

        const source = picked[letter][row] ?? shuffle(calls.filter((item) => item.column_letter === letter))[0];
        const label = labelMode === "track_only" ? source.track_title : `${source.track_title} - ${source.artist_name}`;
        grid.push({
          row,
          col,
          free: false,
          column_letter: letter,
          call_id: source.id,
          track_title: source.track_title,
          artist_name: source.artist_name,
          label,
        });
      }
    }

    cards.push({
      session_id: sessionId,
      card_number: cardNum,
      has_free_space: true,
      grid,
    });
  }

  const { error: insertError } = await db.from("bingo_cards").insert(cards);
  if (insertError) throw new Error(insertError.message);
}

export function computeRemainingSeconds(
  session: {
    seconds_to_next_call: number;
    countdown_started_at: string | null;
    paused_at: string | null;
    paused_remaining_seconds: number | null;
  },
  now = new Date()
): number {
  if (session.paused_at) {
    return Math.max(0, session.paused_remaining_seconds ?? session.seconds_to_next_call);
  }
  if (!session.countdown_started_at) return session.seconds_to_next_call;

  const started = new Date(session.countdown_started_at).getTime();
  const elapsed = Math.floor((now.getTime() - started) / 1000);
  return Math.max(0, session.seconds_to_next_call - elapsed);
}

import type { BingoDbClient } from "src/lib/bingoDb";
import type { CollectionPlaylist, SmartPlaylistRule } from "src/types/collectionPlaylist";
import type { CollectionTrackRow } from "src/types/collectionTrackRow";
import { trackMatchesSmartPlaylist } from "src/lib/playlistUtils";

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

type PlaylistConfigRow = {
  id: number;
  name: string;
  is_smart: boolean;
  smart_rules: { rules?: unknown[]; maxTracks?: number | null } | null;
  match_rules: string;
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

function canonicalizeFormatFacet(value: string): string | null {
  const token = value.trim().toLowerCase();
  if (!token) return null;
  const mapped: Array<[RegExp, string]> = [
    [/^vinyl$/, "Vinyl"],
    [/^cd$|^compact disc$/, "CD"],
    [/^cassette$|^cass$/, "Cassette"],
    [/^8[- ]?track cartridge$|^8[- ]?track$/, "8-Track"],
    [/^dvd$/, "DVD"],
    [/^all media$/, "All Media"],
    [/^box set$/, "Box Set"],
    [/^lp$/, "LP"],
    [/^ep$/, "EP"],
    [/^single$/, "Single"],
    [/^album$/, "Album"],
    [/^mini-album$/, "Mini-Album"],
    [/^maxi-single$/, "Maxi-Single"],
    [/^7"$/, '7"'],
    [/^10"$/, '10"'],
    [/^12"$/, '12"'],
    [/^45 rpm$|^45$/, "45 RPM"],
    [/^33 ?1\/3 rpm$|^33⅓ rpm$|^33 rpm$/, "33 RPM"],
    [/^78 rpm$|^78$/, "78 RPM"],
    [/^reissue$/, "Reissue"],
    [/^stereo$/, "Stereo"],
    [/^mono$/, "Mono"],
  ];

  for (const [regex, label] of mapped) {
    if (regex.test(token)) return label;
  }
  return null;
}

function buildTrackFormatFacets(mediaType: string | null, formatDetails: string[] | null): string[] {
  const rawTokens: string[] = [];
  if (mediaType) rawTokens.push(mediaType);
  for (const entry of formatDetails ?? []) {
    if (!entry) continue;
    rawTokens.push(entry);
    for (const part of entry.split(/[,/]/)) {
      const next = part.trim();
      if (next) rawTokens.push(next);
    }
  }

  const facets = new Set<string>();
  for (const token of rawTokens) {
    const normalized = canonicalizeFormatFacet(token);
    if (normalized) facets.add(normalized);
  }
  return Array.from(facets);
}

function parseDurationLabel(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

async function getPlaylistConfig(db: BingoDbClient, playlistId: number): Promise<PlaylistConfigRow> {
  const { data, error } = await db
    .from("collection_playlists")
    .select("id, name, is_smart, smart_rules, match_rules")
    .eq("id", playlistId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Playlist not found.");
  return data as PlaylistConfigRow;
}

async function buildCollectionTrackRows(db: BingoDbClient): Promise<CollectionTrackRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const { data: inventoryRows, error: inventoryError } = await dbAny
    .from("inventory")
    .select("id, release_id, status, location, media_condition, sleeve_condition, owner, personal_notes, barcode");
  if (inventoryError) throw new Error(inventoryError.message);

  const inventory = (inventoryRows ?? []) as Array<{
    id: number;
    release_id: number | null;
    status: string | null;
    location: string | null;
    media_condition: string | null;
    sleeve_condition: string | null;
    owner: string | null;
    personal_notes: string | null;
    barcode: string | null;
  }>;

  const releaseIds = Array.from(new Set(inventory.map((row) => row.release_id).filter((v): v is number => typeof v === "number")));
  const { data: releases, error: releaseError } = releaseIds.length
    ? await dbAny
        .from("releases")
        .select("id, master_id, media_type, label, catalog_number, country, release_date, release_year, notes, qty, format_details, packaging, vinyl_weight, rpm, spars_code, box_set, sound, studio")
        .in("id", releaseIds)
    : { data: [], error: null };
  if (releaseError) throw new Error(releaseError.message);

  const releaseRows = (releases ?? []) as Array<{
    id: number;
    master_id: number | null;
    media_type: string | null;
    label: string | null;
    catalog_number: string | null;
    country: string | null;
    release_date: string | null;
    release_year: number | null;
    notes: string | null;
    qty: number | null;
    format_details: string[] | null;
    packaging: string | null;
    vinyl_weight: string | null;
    rpm: string | null;
    spars_code: string | null;
    box_set: string | null;
    sound: string | null;
    studio: string | null;
  }>;
  const releasesById = new Map<number, (typeof releaseRows)[number]>(releaseRows.map((row) => [row.id, row]));

  const masterIds = Array.from(new Set(releaseRows.map((row) => row.master_id).filter((v): v is number => typeof v === "number")));
  const { data: masters, error: masterError } = masterIds.length
    ? await dbAny.from("masters").select("id, title, main_artist_id, notes, genres").in("id", masterIds)
    : { data: [], error: null };
  if (masterError) throw new Error(masterError.message);
  const masterRows = (masters ?? []) as Array<{
    id: number;
    title: string;
    main_artist_id: number | null;
    notes: string | null;
    genres: string[] | null;
  }>;
  const mastersById = new Map<number, (typeof masterRows)[number]>(masterRows.map((row) => [row.id, row]));

  const artistIds = Array.from(new Set(masterRows.map((row) => row.main_artist_id).filter((v): v is number => typeof v === "number")));
  const { data: artists, error: artistError } = artistIds.length
    ? await dbAny.from("artists").select("id, name").in("id", artistIds)
    : { data: [], error: null };
  if (artistError) throw new Error(artistError.message);
  const artistsById = new Map<number, string>(((artists ?? []) as Array<{ id: number; name: string }>).map((row) => [row.id, row.name]));

  const { data: releaseTracks, error: releaseTrackError } = releaseIds.length
    ? await dbAny.from("release_tracks").select("id, release_id, recording_id, position, side, title_override").in("release_id", releaseIds)
    : { data: [], error: null };
  if (releaseTrackError) throw new Error(releaseTrackError.message);

  const releaseTrackRows = (releaseTracks ?? []) as Array<{
    id: number;
    release_id: number | null;
    recording_id: number | null;
    position: string;
    side: string | null;
    title_override: string | null;
  }>;

  const recordingIds = Array.from(new Set(releaseTrackRows.map((row) => row.recording_id).filter((v): v is number => typeof v === "number")));
  const { data: recordings, error: recordingError } = recordingIds.length
    ? await dbAny.from("recordings").select("id, title, track_artist, duration_seconds").in("id", recordingIds)
    : { data: [], error: null };
  if (recordingError) throw new Error(recordingError.message);
  const recordingsById = new Map<number, { id: number; title: string | null; track_artist: string | null; duration_seconds: number | null }>(
    ((recordings ?? []) as Array<{ id: number; title: string | null; track_artist: string | null; duration_seconds: number | null }>).map((row) => [row.id, row])
  );

  const trackRows: CollectionTrackRow[] = [];

  for (const inv of inventory) {
    if (!inv.release_id) continue;
    const release = releasesById.get(inv.release_id);
    if (!release) continue;
    const master = release.master_id ? mastersById.get(release.master_id) : undefined;
    const albumTitle = master?.title ?? "Unknown Album";
    const albumArtist = master?.main_artist_id ? artistsById.get(master.main_artist_id) ?? "Unknown Artist" : "Unknown Artist";
    const trackFormatFacets = buildTrackFormatFacets(release.media_type, release.format_details);

    const tracksForRelease = releaseTrackRows.filter((row) => row.release_id === release.id);
    for (let idx = 0; idx < tracksForRelease.length; idx += 1) {
      const track = tracksForRelease[idx];
      const recording = track.recording_id ? recordingsById.get(track.recording_id) : undefined;
      const position = track.position?.trim() || String(idx + 1);
      const side = track.side ? track.side.toUpperCase() : null;
      const key = `${inv.id}:${track.id ?? `p:${position}`}:${recording?.id ?? idx}`;

      trackRows.push({
        key,
        inventoryId: inv.id,
        releaseTrackId: track.id ?? null,
        recordingId: recording?.id ?? null,
        albumArtist,
        albumTitle,
        trackArtist: recording?.track_artist ?? albumArtist,
        trackTitle: track.title_override ?? recording?.title ?? `Track ${idx + 1}`,
        position,
        side,
        durationSeconds: recording?.duration_seconds ?? null,
        durationLabel: parseDurationLabel(recording?.duration_seconds ?? null),
        albumMediaType: release.media_type ?? "Unknown",
        trackFormatFacets,
        format: release.media_type ?? null,
        country: release.country ?? null,
        location: inv.location ?? null,
        status: inv.status ?? null,
        barcode: inv.barcode ?? null,
        catalogNumber: release.catalog_number ?? null,
        label: release.label ?? null,
        owner: inv.owner ?? null,
        personalNotes: inv.personal_notes ?? null,
        releaseNotes: release.notes ?? null,
        masterNotes: master?.notes ?? null,
        mediaCondition: inv.media_condition ?? null,
        sleeveCondition: inv.sleeve_condition ?? null,
        packaging: release.packaging ?? null,
        studio: release.studio ?? null,
        sound: release.sound ?? null,
        vinylWeight: release.vinyl_weight ?? null,
        rpm: release.rpm ?? null,
        sparsCode: release.spars_code ?? null,
        boxSet: release.box_set ?? null,
        yearInt: release.release_year ?? null,
        discs: release.qty ?? null,
        dateAdded: null,
        purchaseDate: null,
        lastPlayedAt: null,
        lastCleanedDate: null,
        originalReleaseDate: release.release_date ?? null,
        recordingDate: null,
        forSale: inv.status === "for_sale",
        isLive: false,
        genres: master?.genres ?? [],
        labels: release.label ? [release.label] : [],
      });
    }
  }

  return trackRows;
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
  const playlist = await getPlaylistConfig(db, playlistId);
  if (playlist.is_smart) {
    const sourceRows = await buildCollectionTrackRows(db);
    const playlistModel: CollectionPlaylist = {
      id: playlist.id,
      name: playlist.name,
      icon: "🎵",
      color: "#3578b3",
      trackKeys: [],
      createdAt: new Date().toISOString(),
      sortOrder: 0,
      isSmart: true,
      smartRules: playlist.smart_rules && Array.isArray(playlist.smart_rules.rules)
        ? { rules: playlist.smart_rules.rules as SmartPlaylistRule[], maxTracks: playlist.smart_rules.maxTracks ?? null }
        : { rules: [], maxTracks: null },
      matchRules: playlist.match_rules === "any" ? "any" : "all",
      liveUpdate: true,
    };

    const filtered = sourceRows.filter((row) => trackMatchesSmartPlaylist(row, playlistModel));
    const maxTracks = playlistModel.smartRules?.maxTracks ?? null;
    const clipped = maxTracks && maxTracks > 0 ? filtered.slice(0, maxTracks) : filtered;

    return clipped.map((row, index) => ({
      trackKey: row.key,
      sortOrder: index,
      trackTitle: row.trackTitle,
      artistName: row.trackArtist,
      albumName: row.albumTitle,
      side: row.side,
      position: row.position,
    }));
  }

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

export async function getPlaylistTrackCount(db: BingoDbClient, playlistId: number): Promise<number> {
  const playlist = await getPlaylistConfig(db, playlistId);
  if (!playlist.is_smart) {
    const { count } = await db
      .from("collection_playlist_items")
      .select("id", { count: "exact", head: true })
      .eq("playlist_id", playlistId);
    return count ?? 0;
  }

  const tracks = await resolvePlaylistTracks(db, playlistId);
  return tracks.length;
}

export async function generateSessionCalls(
  db: BingoDbClient,
  sessionId: number,
  playlistId: number,
  gameMode: GameMode
): Promise<number> {
  const tracks = await resolvePlaylistTracks(db, playlistId);
  const source = shuffle(tracks);

  const minTracks = gameMode === "blackout" ? 100 : 75;
  if (source.length < minTracks) {
    throw new Error(`Playlist must contain at least ${minTracks} tracks for ${gameMode === "blackout" ? "Blackout" : "this game mode"}.`);
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

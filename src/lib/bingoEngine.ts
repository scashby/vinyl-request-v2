import type { BingoDbClient } from "src/lib/bingoDb";
import type { CollectionPlaylist, SmartPlaylistRule } from "src/types/collectionPlaylist";
import type { CollectionTrackRow } from "src/types/collectionTrackRow";
import { trackMatchesSmartPlaylist } from "src/lib/playlistUtils";
import { BINGO_COLUMNS, type BingoColumn, getColumnLetterForBallNumber } from "src/lib/bingoBall";
import { resolveTrackArtist } from "src/lib/artistName";

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

function normalizePositionKey(position: string | null | undefined): string | null {
  const raw = String(position ?? "").trim();
  if (!raw) return null;
  // Normalize common variants (ex: "B 4" vs "B4") so playlist keys match release_tracks.position.
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function buildPositionLookupKeys(position: string | null | undefined, side: string | null | undefined): string[] {
  const keys = new Set<string>();
  const normalizedPosition = normalizePositionKey(position);
  const normalizedSide = normalizePositionKey(side)?.slice(0, 1) ?? null;

  if (normalizedPosition) {
    keys.add(normalizedPosition);
    const numericPart = normalizedPosition.replace(/^[A-Z]+/, "");
    if (numericPart) keys.add(numericPart);
    if (normalizedSide) {
      keys.add(`${normalizedSide}${numericPart || normalizedPosition}`);
    }
  }

  return Array.from(keys);
}

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
  id: number;
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
type DbRecording = { id: number; title: string | null; track_artist: string | null; credits: unknown | null };
type DbRelease = { id: number; master_id: number | null };
type DbMaster = { id: number; title: string; main_artist_id: number | null };
type DbArtist = { id: number; name: string };

type SessionCallRow = {
  id: number;
  call_index: number;
  ball_number: number | null;
  column_letter: string;
  track_title: string;
  artist_name: string;
  playlist_track_key?: string;
  album_name?: string | null;
  side?: string | null;
  position?: string | null;
};

export type ResolvedTrackKey = {
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
};

export function parseTrackKey(trackKey: string): ParsedTrackKey {
  const parts = String(trackKey).split(":");
  const inventoryIdRaw = Number.parseInt(parts[0] ?? "", 10);
  const inventoryId = Number.isFinite(inventoryIdRaw) ? inventoryIdRaw : null;

  // Some imports/materialized playlists store keys like `${inventory_id}:${position}` (ex: `123:A1`).
  // Treat the second token as a position lookup.
  if (parts.length === 2 && inventoryId !== null) {
    const position = (parts[1] ?? "").trim();
    if (position) {
      return {
        inventoryId,
        releaseTrackId: null,
        recordingId: null,
        fallbackPosition: position,
      };
    }
  }

  if (parts[1] === "fallback") {
    return {
      inventoryId,
      releaseTrackId: null,
      recordingId: null,
      fallbackPosition: parts[3] ?? null,
    };
  }

  const releaseTrackPart = parts[1] ?? "";
  const releaseTrackId = /^\d+$/.test(releaseTrackPart) ? Number.parseInt(releaseTrackPart, 10) : null;
  const fallbackPosition = releaseTrackPart.startsWith("p:")
    ? releaseTrackPart.slice(2)
    : releaseTrackId === null && releaseTrackPart.trim().length > 0
      ? releaseTrackPart.trim()
      : null;

  const recordingPart = parts[2] ?? "";
  const recordingIdRaw = /^\d+$/.test(recordingPart) ? Number.parseInt(recordingPart, 10) : null;
  const recordingId = recordingIdRaw;

  return { inventoryId, releaseTrackId, recordingId, fallbackPosition };
}

const GAME_BALL_COUNT = 75;

export function computeMinimumPlaylistTracks(roundCount: number, cardCount: number): number {
  void roundCount;
  void cardCount;
  return GAME_BALL_COUNT;
}

type PlannedSessionCall = {
  playlist_track_key: string;
  call_index: number;
  ball_number: number;
  column_letter: BingoColumn;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableRoundSort<T>(items: T[], seed: string, keyForItem: (item: T) => string): T[] {
  return [...items]
    .map((item, index) => ({
      item,
      index,
      sortKey: hashString(`${seed}::${keyForItem(item)}::${index}`),
    }))
    .sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

function getRoundTrackPool(tracks: ResolvedPlaylistTrack[], sessionId: number, roundNumber: number): ResolvedPlaylistTrack[] {
  void roundNumber;
  const seed = `session:${sessionId}:playlist-order:v1`;
  const ordered = stableRoundSort(tracks, seed, (track) => track.trackKey);
  return ordered.slice(0, GAME_BALL_COUNT);
}

export function planRoundSessionCalls(
  tracks: ResolvedPlaylistTrack[],
  sessionId: number,
  roundNumber: number
): PlannedSessionCall[] {
  const normalizedRound = Math.max(1, Math.floor(roundNumber || 1));
  const roundTracks = getRoundTrackPool(tracks, sessionId, normalizedRound);

  if (roundTracks.length < GAME_BALL_COUNT) {
    throw new Error(`Playlist must contain at least ${GAME_BALL_COUNT} tracks to build a bingo crate.`);
  }

  const boardSlots = roundTracks.map((track, index) => {
    const ballNumber = index + 1;
    return {
      ballNumber,
      columnLetter: getColumnLetterForBallNumber(ballNumber),
      track,
    };
  });

  const drawSeed = `session:${sessionId}:round:${normalizedRound}:draw-order:v1`;
  const drawOrder = stableRoundSort(
    boardSlots,
    drawSeed,
    (slot) => `${slot.track.trackKey}:${slot.ballNumber}`
  );

  return drawOrder.map((entry, drawIndex) => ({
    playlist_track_key: entry.track.trackKey,
    call_index: drawIndex + 1,
    ball_number: entry.ballNumber,
    column_letter: entry.columnLetter,
    track_title: entry.track.trackTitle,
    artist_name: entry.track.artistName,
    album_name: entry.track.albumName,
    side: entry.track.side,
    position: entry.track.position,
  }));
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
    ? await dbAny.from("recordings").select("id, title, track_artist, credits, duration_seconds").in("id", recordingIds)
    : { data: [], error: null };
  if (recordingError) throw new Error(recordingError.message);
  const recordingsById = new Map<number, { id: number; title: string | null; track_artist: string | null; credits: unknown | null; duration_seconds: number | null }>(
    ((recordings ?? []) as Array<{ id: number; title: string | null; track_artist: string | null; credits: unknown | null; duration_seconds: number | null }>).map((row) => [row.id, row])
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
        trackArtist: resolveTrackArtist({
          trackArtist: recording?.track_artist,
          credits: recording?.credits,
          albumArtist,
        }),
        trackTitle: track.title_override ?? recording?.title ?? `Track ${position}`,
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
    .select("id, playlist_id, track_key, sort_order")
    .eq("playlist_id", playlistId)
    .order("sort_order", { ascending: true });

  if (itemError) throw new Error(itemError.message);

  const source = (playlistItems ?? []) as DbPlaylistItem[];
  const parsedRows = source.map((item) => ({ item, parsed: parseTrackKey(item.track_key) }));

  const inventoryIds = Array.from(new Set(parsedRows.map((row) => row.parsed.inventoryId).filter((id): id is number => id !== null)));
  const releaseTrackIds = Array.from(new Set(parsedRows.map((row) => row.parsed.releaseTrackId).filter((id): id is number => id !== null)));
  const directRecordingIds = Array.from(new Set(parsedRows.map((row) => row.parsed.recordingId).filter((id): id is number => id !== null)));

  const { data: inventoryRows, error: inventoryError } = inventoryIds.length
    ? await db.from("inventory").select("id, release_id").in("id", inventoryIds)
    : { data: [] as DbInventory[], error: null };
  if (inventoryError) throw new Error(inventoryError.message);

  const inventoryById = new Map<number, DbInventory>(((inventoryRows ?? []) as DbInventory[]).map((row) => [row.id, row]));
  const releaseIds = Array.from(
    new Set(
      ((inventoryRows ?? []) as DbInventory[])
        .map((row) => row.release_id)
        .filter((id): id is number => typeof id === "number")
    )
  );

  const { data: releaseTrackRowsById, error: releaseTrackByIdError } = releaseTrackIds.length
    ? await db.from("release_tracks").select("id, release_id, recording_id, position, side, title_override").in("id", releaseTrackIds)
    : { data: [] as DbReleaseTrack[], error: null };
  if (releaseTrackByIdError) throw new Error(releaseTrackByIdError.message);

  const wantsFallbackLookup = parsedRows.some((row) => row.parsed.releaseTrackId === null && row.parsed.fallbackPosition);
  const { data: releaseTrackRowsByRelease, error: releaseTrackByReleaseError } =
    wantsFallbackLookup && releaseIds.length
      ? await db
          .from("release_tracks")
          .select("id, release_id, recording_id, position, side, title_override")
          .in("release_id", releaseIds)
      : { data: [] as DbReleaseTrack[], error: null };
  if (releaseTrackByReleaseError) throw new Error(releaseTrackByReleaseError.message);

  const releaseTracksAll = [
    ...(((releaseTrackRowsById ?? []) as DbReleaseTrack[]) ?? []),
    ...(((releaseTrackRowsByRelease ?? []) as DbReleaseTrack[]) ?? []),
  ];

  const releaseTrackById = new Map<number, DbReleaseTrack>(releaseTracksAll.map((row) => [row.id, row]));

  const releaseTrackByReleaseAndPosition = new Map<string, DbReleaseTrack>();
  for (const row of releaseTracksAll) {
    if (!row.release_id) continue;
    for (const posKey of buildPositionLookupKeys(row.position, row.side)) {
      releaseTrackByReleaseAndPosition.set(`${row.release_id}:${posKey}`, row);
    }
  }

  const inferredRecordingIds = Array.from(
    new Set(
      releaseTracksAll
        .map((row) => row.recording_id)
        .filter((id): id is number => typeof id === "number")
    )
  );
  const allRecordingIds = Array.from(new Set([...directRecordingIds, ...inferredRecordingIds]));

  const { data: recordingRows, error: recordingError } = allRecordingIds.length
    ? await db.from("recordings").select("id, title, track_artist, credits").in("id", allRecordingIds)
    : { data: [] as DbRecording[], error: null };
  if (recordingError) throw new Error(recordingError.message);

  const recordingById = new Map<number, DbRecording>(((recordingRows ?? []) as DbRecording[]).map((row) => [row.id, row]));

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

  const resolved: ResolvedPlaylistTrack[] = [];
  const staleItemIds: number[] = [];

  for (const { item, parsed } of parsedRows) {
    const inventory = parsed.inventoryId ? inventoryById.get(parsed.inventoryId) : undefined;
    if (!inventory?.release_id) {
      // Skip stale playlist rows that no longer map to a real inventory item/release.
      staleItemIds.push(item.id);
      continue;
    }

    const release = inventory?.release_id ? releaseById.get(inventory.release_id) : undefined;
    const master = release?.master_id ? masterById.get(release.master_id) : undefined;
    const releaseTrack =
      (parsed.releaseTrackId ? releaseTrackById.get(parsed.releaseTrackId) : undefined) ??
      (inventory?.release_id && parsed.fallbackPosition
        ? (() => {
            for (const posKey of buildPositionLookupKeys(parsed.fallbackPosition, null)) {
              const hit = releaseTrackByReleaseAndPosition.get(`${inventory.release_id}:${posKey}`);
              if (hit) return hit;
            }
            return undefined;
          })()
        : undefined);

    const recordingId = releaseTrack?.recording_id ?? parsed.recordingId ?? null;
    const recording = recordingId ? recordingById.get(recordingId) : undefined;

    if (!releaseTrack && !recording) {
      // Keep games faithful to the playlist by dropping unresolvable ghost rows.
      staleItemIds.push(item.id);
      continue;
    }

    const position = releaseTrack?.position ?? parsed.fallbackPosition ?? null;
    const fallbackTitle = position ? `Track ${position}` : `Track ${item.sort_order + 1}`;
    const trackTitle = releaseTrack?.title_override ?? recording?.title ?? fallbackTitle;
    const artistName = resolveTrackArtist({
      trackArtist: recording?.track_artist,
      credits: recording?.credits,
      albumArtist: master?.main_artist_id ? artistById.get(master.main_artist_id)?.name : undefined,
    });

    resolved.push({
      trackKey: item.track_key,
      sortOrder: item.sort_order,
      trackTitle,
      artistName,
      albumName: master?.title ?? null,
      side: releaseTrack?.side ?? null,
      position: releaseTrack?.position ?? parsed.fallbackPosition,
    });
  }

  if (staleItemIds.length > 0) {
    try {
      await db.from("collection_playlist_items").delete().in("id", staleItemIds);
    } catch {
      // Non-fatal: unresolved rows are still excluded from gameplay even if pruning fails.
    }
  }

  return resolved;
}

export async function resolvePlaylistTracksForPlaylists(
  db: BingoDbClient,
  playlistIds: number[]
): Promise<ResolvedPlaylistTrack[]> {
  const normalized = Array.from(
    new Set(
      (playlistIds ?? [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  if (normalized.length === 0) {
    throw new Error("At least one playlist is required.");
  }

  const tracksByPlaylist = await Promise.all(normalized.map((playlistId) => resolvePlaylistTracks(db, playlistId)));
  const deduped = new Map<string, ResolvedPlaylistTrack>();

  // Keep first-seen order by playlist selection order, then playlist sort order.
  for (const tracks of tracksByPlaylist) {
    for (const track of tracks) {
      if (!deduped.has(track.trackKey)) {
        deduped.set(track.trackKey, track);
      }
    }
  }

  return Array.from(deduped.values());
}

export async function resolveTrackKeys(db: BingoDbClient, trackKeys: string[]): Promise<Map<string, ResolvedTrackKey>> {
  const uniqueKeys = Array.from(new Set(trackKeys.map((k) => String(k ?? "").trim()).filter(Boolean)));
  if (uniqueKeys.length === 0) return new Map();

  const parsedRows = uniqueKeys.map((track_key) => ({ track_key, parsed: parseTrackKey(track_key) }));
  const inventoryIds = Array.from(new Set(parsedRows.map((row) => row.parsed.inventoryId).filter((id): id is number => id !== null)));
  const releaseTrackIds = Array.from(new Set(parsedRows.map((row) => row.parsed.releaseTrackId).filter((id): id is number => id !== null)));
  const directRecordingIds = Array.from(new Set(parsedRows.map((row) => row.parsed.recordingId).filter((id): id is number => id !== null)));

  const { data: inventoryRows, error: inventoryError } = inventoryIds.length
    ? await db.from("inventory").select("id, release_id").in("id", inventoryIds)
    : { data: [] as DbInventory[], error: null };
  if (inventoryError) throw new Error(inventoryError.message);
  const inventoryById = new Map<number, DbInventory>(((inventoryRows ?? []) as DbInventory[]).map((row) => [row.id, row]));

  const releaseIds = Array.from(
    new Set(
      ((inventoryRows ?? []) as DbInventory[])
        .map((row) => row.release_id)
        .filter((id): id is number => typeof id === "number")
    )
  );

  const { data: releaseTrackRowsById, error: releaseTrackByIdError } = releaseTrackIds.length
    ? await db.from("release_tracks").select("id, release_id, recording_id, position, side, title_override").in("id", releaseTrackIds)
    : { data: [] as DbReleaseTrack[], error: null };
  if (releaseTrackByIdError) throw new Error(releaseTrackByIdError.message);

  const wantsFallbackLookup = parsedRows.some((row) => row.parsed.releaseTrackId === null && row.parsed.fallbackPosition);
  const { data: releaseTrackRowsByRelease, error: releaseTrackByReleaseError } =
    wantsFallbackLookup && releaseIds.length
      ? await db
          .from("release_tracks")
          .select("id, release_id, recording_id, position, side, title_override")
          .in("release_id", releaseIds)
      : { data: [] as DbReleaseTrack[], error: null };
  if (releaseTrackByReleaseError) throw new Error(releaseTrackByReleaseError.message);

  const releaseTracksAll = [
    ...(((releaseTrackRowsById ?? []) as DbReleaseTrack[]) ?? []),
    ...(((releaseTrackRowsByRelease ?? []) as DbReleaseTrack[]) ?? []),
  ];

  const releaseTrackById = new Map<number, DbReleaseTrack>(releaseTracksAll.map((row) => [row.id, row]));

  const releaseTrackByReleaseAndPosition = new Map<string, DbReleaseTrack>();
  for (const row of releaseTracksAll) {
    if (!row.release_id) continue;
    for (const posKey of buildPositionLookupKeys(row.position, row.side)) {
      releaseTrackByReleaseAndPosition.set(`${row.release_id}:${posKey}`, row);
    }
  }

  const inferredRecordingIds = Array.from(
    new Set(
      releaseTracksAll
        .map((row) => row.recording_id)
        .filter((id): id is number => typeof id === "number")
    )
  );
  const allRecordingIds = Array.from(new Set([...directRecordingIds, ...inferredRecordingIds]));

  const { data: recordingRows, error: recordingError } = allRecordingIds.length
    ? await db.from("recordings").select("id, title, track_artist, credits").in("id", allRecordingIds)
    : { data: [] as DbRecording[], error: null };
  if (recordingError) throw new Error(recordingError.message);
  const recordingById = new Map<number, DbRecording>(((recordingRows ?? []) as DbRecording[]).map((row) => [row.id, row]));

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

  const result = new Map<string, ResolvedTrackKey>();
  parsedRows.forEach(({ track_key, parsed }, index) => {
    const inventory = parsed.inventoryId ? inventoryById.get(parsed.inventoryId) : undefined;
    if (!inventory?.release_id) return;

    const release = inventory?.release_id ? releaseById.get(inventory.release_id) : undefined;
    const master = release?.master_id ? masterById.get(release.master_id) : undefined;
    const releaseTrack =
      (parsed.releaseTrackId ? releaseTrackById.get(parsed.releaseTrackId) : undefined) ??
      (inventory?.release_id && parsed.fallbackPosition
        ? (() => {
            for (const posKey of buildPositionLookupKeys(parsed.fallbackPosition, null)) {
              const hit = releaseTrackByReleaseAndPosition.get(`${inventory.release_id}:${posKey}`);
              if (hit) return hit;
            }
            return undefined;
          })()
        : undefined);

    const recordingId = releaseTrack?.recording_id ?? parsed.recordingId ?? null;
    const recording = recordingId ? recordingById.get(recordingId) : undefined;

    if (!releaseTrack && !recording) return;

    const position = releaseTrack?.position ?? parsed.fallbackPosition ?? null;
    const fallbackTitle = position ? `Track ${position}` : `Track ${index + 1}`;
    const trackTitle = releaseTrack?.title_override ?? recording?.title ?? fallbackTitle;
    const artistName = resolveTrackArtist({
      trackArtist: recording?.track_artist,
      credits: recording?.credits,
      albumArtist: master?.main_artist_id ? artistById.get(master.main_artist_id)?.name : undefined,
    });

    result.set(track_key, {
      track_title: trackTitle,
      artist_name: artistName,
      album_name: master?.title ?? null,
      side: releaseTrack?.side ?? null,
      position: releaseTrack?.position ?? parsed.fallbackPosition,
    });
  });

  return result;
}

export async function getPlaylistTrackCount(db: BingoDbClient, playlistId: number): Promise<number> {
  // Count only tracks that can actually resolve to collection metadata.
  const tracks = await resolvePlaylistTracks(db, playlistId);
  return tracks.length;
}

export async function getPlaylistTrackCountForPlaylists(db: BingoDbClient, playlistIds: number[]): Promise<number> {
  const tracks = await resolvePlaylistTracksForPlaylists(db, playlistIds);
  return tracks.length;
}

export async function generateSessionCalls(
  db: BingoDbClient,
  sessionId: number,
  playlistIds: number[],
  options?: { roundNumber?: number }
): Promise<number> {
  const roundNumber = options?.roundNumber ?? 1;
  const tracks = await resolvePlaylistTracksForPlaylists(db, playlistIds);

  const rows = planRoundSessionCalls(tracks, sessionId, roundNumber).map((entry) => ({
    session_id: sessionId,
    playlist_track_key: entry.playlist_track_key,
    call_index: entry.call_index,
    ball_number: entry.ball_number,
    column_letter: entry.column_letter,
    track_title: entry.track_title,
    artist_name: entry.artist_name,
    album_name: entry.album_name,
    side: entry.side,
    position: entry.position,
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
    .select("id, call_index, ball_number, column_letter, track_title, artist_name")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) throw new Error(error.message);

  const allCalls = (data ?? []) as SessionCallRow[];
  const baseCalls = allCalls.some((c) => c.ball_number !== null) ? allCalls.filter((c) => c.ball_number !== null) : allCalls;
  const byColumn = {
    B: baseCalls.filter((c) => c.column_letter === "B"),
    I: baseCalls.filter((c) => c.column_letter === "I"),
    N: baseCalls.filter((c) => c.column_letter === "N"),
    G: baseCalls.filter((c) => c.column_letter === "G"),
    O: baseCalls.filter((c) => c.column_letter === "O"),
  };

  const cards: Array<{ session_id: number; card_number: number; has_free_space: boolean; grid: BingoCardCell[] }> = [];
  const signatures = new Set<string>();

  function buildCardGrid(): BingoCardCell[] {
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

        const source = picked[letter][row] ?? shuffle(baseCalls.filter((item) => item.column_letter === letter))[0];
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

    return grid;
  }

  function buildCardSignature(grid: BingoCardCell[]): string {
    return grid
      .filter((cell) => !cell.free)
      .sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      })
      .map((cell) => `${cell.column_letter}:${cell.call_id ?? 0}`)
      .join("|");
  }

  for (let cardNum = 1; cardNum <= cardCount; cardNum += 1) {
    let grid: BingoCardCell[] = [];
    let signature = "";
    let generatedUnique = false;

    for (let attempt = 0; attempt < 200; attempt += 1) {
      grid = buildCardGrid();
      signature = buildCardSignature(grid);
      if (!signatures.has(signature)) {
        generatedUnique = true;
        break;
      }
    }

    if (!generatedUnique) {
      throw new Error("Unable to generate enough unique bingo cards for this session. Increase playlist size or reduce card count.");
    }

    signatures.add(signature);

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

import Papa from "papaparse";
import { requireSupabaseAdminServiceRole, supabaseAdmin } from "src/lib/supabaseAdmin";
import { getCachedInventoryIndex, matchTracks, sanitizePlaylistName } from "src/lib/vinylPlaylistImport";

export type ImportSourceRow = {
  title?: string;
  artist?: string;
};

export type PlaylistImportResult = {
  playlistId: number;
  playlistName: string;
  sourceCount: number;
  matchedCount: number;
  fuzzyMatchedCount: number;
  unmatchedCount: number;
  unmatchedSample: Array<{ title?: string; artist?: string; candidates: unknown[] }>;
  duplicatesSkipped: number;
};

type ImportOptions = {
  rows: ImportSourceRow[];
  playlistName: string;
  existingPlaylistId?: number;
  icon: string;
  color: string;
};

const TITLE_KEYS = ["title", "track", "track_title", "song", "name"];
const ARTIST_KEYS = ["artist", "track_artist", "performer", "band"];

const normalizeHeader = (value: string) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const strip = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const coerceRows = (rows: ImportSourceRow[]) =>
  rows
    .map((row) => ({
      title: strip(row?.title),
      artist: strip(row?.artist) || undefined,
    }))
    .filter((row) => row.title.length > 0);

const getPlaylistId = async (db: any, options: ImportOptions, fallbackName: string): Promise<number> => {
  const existingPlaylistId = Number(options.existingPlaylistId ?? 0);
  if (Number.isFinite(existingPlaylistId) && existingPlaylistId > 0) {
    const { data: existing, error: existingError } = await db
      .from("collection_playlists")
      .select("id")
      .eq("id", existingPlaylistId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing?.id) {
      throw new Error(`Playlist ${existingPlaylistId} not found`);
    }
    return Number(existing.id);
  }

  const { data: maxSortRow, error: maxSortError } = await db
    .from("collection_playlists")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxSortError) throw maxSortError;

  const maxSortOrder = maxSortRow && typeof maxSortRow.sort_order === "number" ? maxSortRow.sort_order : -1;
  const { data: inserted, error: insertError } = await db
    .from("collection_playlists")
    .insert({
      name: fallbackName,
      icon: options.icon,
      color: options.color,
      sort_order: maxSortOrder + 1,
      is_smart: false,
      smart_rules: null,
      match_rules: "all",
      live_update: true,
    })
    .select("id")
    .single();
  if (insertError || !inserted?.id) {
    throw insertError || new Error("Failed to create playlist");
  }

  return Number(inserted.id);
};

export const parsePlaylistCsvText = (csvText: string): ImportSourceRow[] => {
  const input = String(csvText ?? "");
  const headerProbe = Papa.parse(input, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  if (headerProbe.errors.length > 0 && headerProbe.data.length === 0) {
    throw new Error("CSV parse failed");
  }

  const fields = (headerProbe.meta.fields ?? []).map(normalizeHeader);
  const hasKnownHeaders = fields.some((field) => TITLE_KEYS.includes(field) || ARTIST_KEYS.includes(field));

  if (hasKnownHeaders) {
    const rows: ImportSourceRow[] = [];
    for (const row of headerProbe.data ?? []) {
      const record = row as Record<string, unknown>;
      const title =
        strip(TITLE_KEYS.map((key) => record[key]).find((value) => strip(value).length > 0)) ||
        strip(record[fields[0] ?? ""]);
      const artist =
        strip(ARTIST_KEYS.map((key) => record[key]).find((value) => strip(value).length > 0)) ||
        strip(record[fields[1] ?? ""]);
      if (!title) continue;
      rows.push({ title, artist: artist || undefined });
    }
    return rows;
  }

  const raw = Papa.parse(input, {
    header: false,
    skipEmptyLines: "greedy",
  });
  if (raw.errors.length > 0 && raw.data.length === 0) {
    throw new Error("CSV parse failed");
  }

  const rows: ImportSourceRow[] = [];
  for (const candidate of raw.data ?? []) {
    const row = candidate as unknown;
    if (!Array.isArray(row)) continue;
    const title = strip(row[0]);
    const artist = strip(row[1]);
    if (!title) continue;
    rows.push({ title, artist: artist || undefined });
  }

  return rows;
};

export const importRowsIntoPlaylist = async (options: ImportOptions): Promise<PlaylistImportResult> => {
  requireSupabaseAdminServiceRole();

  const rows = coerceRows(options.rows ?? []);
  if (rows.length === 0) {
    throw new Error("No valid rows found for import");
  }

  const playlistName = sanitizePlaylistName(options.playlistName);
  const index = await getCachedInventoryIndex();
  const { matched, missing, fuzzyMatchedCount } = matchTracks(rows, index);

  const matchedTrackKeys = matched
    .filter((row) => row.inventory_id && row.position)
    .map((row) => `${row.inventory_id}:${row.position}`);
  const dedupedTrackKeys = Array.from(new Set(matchedTrackKeys));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const playlistId = await getPlaylistId(db, options, playlistName);

  const { data: existingItems, error: existingItemsError } = await db
    .from("collection_playlist_items")
    .select("track_key, sort_order")
    .eq("playlist_id", playlistId);
  if (existingItemsError) throw existingItemsError;

  const existingKeys = new Set(
    (existingItems ?? [])
      .map((item: { track_key?: unknown }) => (typeof item.track_key === "string" ? item.track_key.trim() : ""))
      .filter((value: string) => value.length > 0)
  );

  let maxSortOrder = -1;
  for (const item of existingItems ?? []) {
    const sortOrder =
      typeof (item as { sort_order?: unknown }).sort_order === "number"
        ? Number((item as { sort_order: number }).sort_order)
        : -1;
    if (sortOrder > maxSortOrder) maxSortOrder = sortOrder;
  }

  const newTrackKeys = dedupedTrackKeys.filter((trackKey) => !existingKeys.has(trackKey));
  if (newTrackKeys.length > 0) {
    const records = newTrackKeys.map((trackKey, idx) => ({
      playlist_id: playlistId,
      track_key: trackKey,
      sort_order: maxSortOrder + idx + 1,
    }));
    const { error: insertItemsError } = await db
      .from("collection_playlist_items")
      .insert(records);
    if (insertItemsError) throw insertItemsError;
  }

  return {
    playlistId,
    playlistName,
    sourceCount: rows.length,
    matchedCount: newTrackKeys.length,
    fuzzyMatchedCount,
    unmatchedCount: missing.length,
    unmatchedSample: missing.slice(0, 25).map((row) => ({
      title: row.title,
      artist: row.artist,
      candidates: row.candidates,
    })),
    duplicatesSkipped: dedupedTrackKeys.length - newTrackKeys.length,
  };
};

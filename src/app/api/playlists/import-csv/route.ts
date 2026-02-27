import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";
import { getCachedInventoryIndex, matchTracks, sanitizePlaylistName } from "src/lib/vinylPlaylistImport";

export const runtime = "nodejs";

type ParsedRow = {
  title?: string;
  artist?: string;
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

const parseCsvRows = (csvText: string): ParsedRow[] => {
  const headerProbe = Papa.parse(csvText, {
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
    const out: ParsedRow[] = [];
    for (const row of headerProbe.data ?? []) {
      const record = row as Record<string, unknown>;
      const title =
        strip(TITLE_KEYS.map((key) => record[key]).find((value) => strip(value).length > 0)) ||
        strip(record[fields[0] ?? ""]);
      const artist =
        strip(ARTIST_KEYS.map((key) => record[key]).find((value) => strip(value).length > 0)) ||
        strip(record[fields[1] ?? ""]);
      if (!title) continue;
      out.push({ title, artist: artist || undefined });
    }
    return out;
  }

  const raw = Papa.parse(csvText, {
    header: false,
    skipEmptyLines: "greedy",
  });

  if (raw.errors.length > 0 && raw.data.length === 0) {
    throw new Error("CSV parse failed");
  }

  const rows: ParsedRow[] = [];
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

export async function POST(req: Request) {
  let step = "init";
  try {
    step = "parse-body";
    const body = await req.json();
    const csvText = String(body?.csvText ?? "").trim();
    const existingPlaylistId = Number(body?.existingPlaylistId ?? 0);
    const playlistName = sanitizePlaylistName(String(body?.playlistName ?? "CSV Import"));

    if (!csvText) {
      return NextResponse.json({ error: "csvText is required" }, { status: 400 });
    }

    step = "parse-csv";
    const rows = parseCsvRows(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 });
    }

    step = "inventory-index";
    const authHeader = getAuthHeader(req);
    const index = await getCachedInventoryIndex(authHeader);
    const { matched, missing, fuzzyMatchedCount } = matchTracks(rows, index);

    step = "playlist-upsert";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseServer(authHeader) as any;

    let playlistId: number;
    if (Number.isFinite(existingPlaylistId) && existingPlaylistId > 0) {
      playlistId = existingPlaylistId;
    } else {
      const { data: maxSortRow } = await db
        .from("collection_playlists")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const maxSortOrder = maxSortRow && typeof maxSortRow.sort_order === "number" ? maxSortRow.sort_order : -1;
      const { data: inserted, error: insertError } = await db
        .from("collection_playlists")
        .insert({
          name: playlistName,
          icon: "🎵",
          color: "#3578b3",
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
      playlistId = Number(inserted.id);
    }

    step = "insert-items";
    const resolvedTrackKeys = matched
      .filter((row) => row.inventory_id && row.position)
      .map((row) => `${row.inventory_id}:${row.position}`);
    const dedupedTrackKeys = Array.from(new Set(resolvedTrackKeys));

    const { data: existingItems, error: existingItemsError } = await db
      .from("collection_playlist_items")
      .select("track_key, sort_order")
      .eq("playlist_id", playlistId);
    if (existingItemsError) {
      throw existingItemsError;
    }

    const existingKeys = new Set(
      (existingItems ?? [])
        .map((item: { track_key?: unknown }) => (typeof item.track_key === "string" ? item.track_key.trim() : ""))
        .filter((value: string) => value.length > 0)
    );

    let maxSortOrder = -1;
    for (const item of existingItems ?? []) {
      const sortOrder = typeof (item as { sort_order?: unknown }).sort_order === "number"
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

      const { error: insertItemsError } = await db.from("collection_playlist_items").insert(records);
      if (insertItemsError) {
        throw insertItemsError;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        playlistId,
        playlistName,
        sourceCount: rows.length,
        matchedCount: newTrackKeys.length,
        fuzzyMatchedCount,
        unmatchedCount: missing.length,
        unmatchedSample: missing.slice(0, 25),
        duplicatesSkipped: dedupedTrackKeys.length - newTrackKeys.length,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV import failed";
    return NextResponse.json({ error: message, step }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAuthHeader } from "src/lib/supabaseServer";
import { importRowsToPlaylist, parseCsvRows, type ImportMatchFilters, type MatchingMode, type SourceRow } from "src/lib/playlistImportEngine";

export const runtime = "nodejs";

const parseStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
};

// Structured rows (used by "Retry Matching" on unmatched import rows) carry a
// reservedSortOrder so a track that matches on retry lands back in its
// original playlist position instead of being appended to the end.
const parseStructuredRows = (value: unknown): SourceRow[] | null => {
  if (!Array.isArray(value)) return null;
  const rows: SourceRow[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title) continue;
    rows.push({
      title,
      artist: typeof record.artist === "string" ? record.artist.trim() || undefined : undefined,
      album: typeof record.album === "string" ? record.album.trim() || undefined : undefined,
      reservedSortOrder: Number.isFinite(record.reservedSortOrder) ? Number(record.reservedSortOrder) : undefined,
    });
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
    const playlistName = String(body?.playlistName ?? "CSV Import");
    const matchingModeRaw = String(body?.matchingMode ?? "review").trim().toLowerCase();
    const matchingMode: MatchingMode =
      matchingModeRaw === "review" ||
      matchingModeRaw === "strict" ||
      matchingModeRaw === "aggressive" ||
      matchingModeRaw === "balanced"
        ? (matchingModeRaw as MatchingMode)
        : "review";
    const matchFilters: ImportMatchFilters = {
      mediaTypes: parseStringArray(body?.matchFilters?.mediaTypes),
      formatDetails: parseStringArray(body?.matchFilters?.formatDetails),
    };

    step = "parse-rows";
    const structuredRows = parseStructuredRows(body?.rows);
    const rows = structuredRows ?? parseCsvRows(csvText);

    if (!structuredRows && !csvText) {
      return NextResponse.json({ error: "csvText is required" }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found" }, { status: 400 });
    }

    step = "import";
    const result = await importRowsToPlaylist({
      authHeader: getAuthHeader(req),
      rows,
      playlistName,
      existingPlaylistId,
      icon: "🎵",
      color: "#3578b3",
      matchingMode,
      matchFilters,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV import failed";
    return NextResponse.json({ error: message, step }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAuthHeader } from "src/lib/supabaseServer";
import { importRowsToPlaylist, parseCsvRows, type MatchingMode } from "src/lib/playlistImportEngine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let step = "init";

  try {
    step = "parse-body";
    const body = await req.json();
    const csvText = String(body?.csvText ?? "").trim();
    const existingPlaylistId = Number(body?.existingPlaylistId ?? 0);
    const playlistName = String(body?.playlistName ?? "CSV Import");
    const matchingModeRaw = String(body?.matchingMode ?? "balanced").trim().toLowerCase();
    const matchingMode: MatchingMode =
      matchingModeRaw === "strict" || matchingModeRaw === "aggressive" || matchingModeRaw === "balanced"
        ? (matchingModeRaw as MatchingMode)
        : "balanced";

    if (!csvText) {
      return NextResponse.json({ error: "csvText is required" }, { status: 400 });
    }

    step = "parse-csv";
    const rows = parseCsvRows(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 });
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
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV import failed";
    return NextResponse.json({ error: message, step }, { status: 500 });
  }
}

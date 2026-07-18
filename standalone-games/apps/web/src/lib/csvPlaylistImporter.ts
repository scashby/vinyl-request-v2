import Papa from "papaparse";
import type { ImportedTrackInput } from "@/lib/importToTenantPlaylist";

interface CsvRow {
  title?: string;
  track?: string;
  track_title?: string;
  name?: string;
  artist?: string;
  artist_name?: string;
  album?: string;
  album_name?: string;
}

export interface CsvPlaylistImportResult {
  playlistName: string;
  tracks: ImportedTrackInput[];
}

function firstNonEmpty(values: Array<unknown>): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function sanitizePlaylistName(value?: string): string {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return "CSV Import";
  return cleaned.slice(0, 80);
}

export function importCsvPlaylistTracks(params: {
  csvText: string;
  playlistName?: string;
}): CsvPlaylistImportResult {
  const csvText = String(params.csvText ?? "").trim();
  if (!csvText) {
    throw new Error("csvText is required.");
  }

  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader(header) {
      return String(header ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
    },
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message || "CSV parse failed.");
  }

  const tracks: ImportedTrackInput[] = [];

  for (const row of parsed.data ?? []) {
      const trackTitle = firstNonEmpty([
        row.title,
        row.track,
        row.track_title,
        row.name,
      ]);
      const artistName = firstNonEmpty([row.artist, row.artist_name]);
      const albumName = firstNonEmpty([row.album, row.album_name]);

      if (!trackTitle || !artistName) {
        continue;
      }

      tracks.push({
        trackTitle,
        artistName,
        albumName: albumName || null,
        displayTitle: null,
      });
  }

  if (tracks.length === 0) {
    throw new Error("No valid tracks found in CSV.");
  }

  return {
    playlistName: sanitizePlaylistName(params.playlistName),
    tracks,
  };
}

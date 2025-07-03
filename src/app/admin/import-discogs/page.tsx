"use client";

import React, { useState } from "react";
import Papa from "papaparse";
import { supabase } from "lib/supabaseClient";

// Type for each row in the uploaded CSV
type CsvRow = Record<string, string>;

// Type for each track from Discogs
type DiscogsTrack = {
  position: string;
  title: string;
  duration: string;
};

// Expected Discogs API response structure
type DiscogsResponse = {
  images?: { uri: string }[];
  tracklist?: DiscogsTrack[];
};

// Final row to insert into Supabase collection table
type CollectionRow = {
  artist: string;
  title: string;
  year: string;
  format: string;
  folder: string;
  media_condition: string;
  image_url: string | null;
  tracklists: DiscogsTrack[] | null;
  discogs_master_id: string | null;
  discogs_release_id: string;
};

export default function ImportDiscogs(): React.ReactElement {
  // State: unique rows from CSV that aren't already in Supabase
  const [uniqueRows, setUniqueRows] = useState<CsvRow[]>([]);

  // State: whether import is actively running
  const [importing, setImporting] = useState(false);

  // State: status log for user feedback
  const [statusLog, setStatusLog] = useState<string[]>([]);

  // Append a message to the log area
  const log = (msg: string): void =>
    setStatusLog((prev) => [...prev, msg]);

  // CSV file upload handler
  const handleCSVUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Parse CSV using PapaParse
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: { data: CsvRow[] }) => {
        const rows = results.data;

        // Extract Release IDs from CSV
        const releaseIds = rows
          .map((r) => r["Release ID"])
          .filter((id): id is string => Boolean(id));

        // Query Supabase to find which IDs already exist
        const { data: existing, error } = await supabase
          .from("collection")
          .select("discogs_release_id")
          .in("discogs_release_id", releaseIds);

        if (error) {
          log(`Supabase query failed: ${error.message}`);
          return;
        }

        // Filter out already imported rows
        const existingIds = new Set(
          (existing || []).map((r) => r.discogs_release_id)
        );
        const newRows = rows.filter(
          (r) => !existingIds.has(r["Release ID"])
        );

        // Store the filtered new rows
        setUniqueRows(newRows);
        log(`Found ${newRows.length} new entries out of ${rows.length} total.`);
      },
    });
  };

  // Fetch image URL and tracklist from Discogs
  const enrichWithDiscogs = async (
    releaseId: string
  ): Promise<{ image_url: string | null; tracklists: DiscogsTrack[] | null }> => {
    try {
      const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DiscogsResponse = await res.json();

      // Extract first image URL and map tracklist
      const image_url = json.images?.[0]?.uri || null;
      const tracklists = json.tracklist?.map((t) => ({
        position: t.position,
        title: t.title,
        duration: t.duration,
      })) || null;

      return { image_url, tracklists };
    } catch (err) {
      log(`Discogs fetch failed for ${releaseId}: ${String(err)}`);
      return { image_url: null, tracklists: null };
    }
  };

  // Import button handler
  const handleImport = async (): Promise<void> => {
    setImporting(true);

    // Iterate through each new CSV row
    for (const row of uniqueRows) {
      const releaseId = row["Release ID"];
      const masterId = row["Master ID"] || null;

      // Enrich with image and tracklist data from Discogs
      const enriched = await enrichWithDiscogs(releaseId);

      // Build row object to insert into Supabase
      const fullRow: CollectionRow = {
        artist: row["Artist"],
        title: row["Title"],
        year: row["Released"],
        format: row["Format"],
        folder: row["Collection Folder"],
        media_condition: row["Media Condition"],
        discogs_release_id: releaseId,
        discogs_master_id: masterId,
        image_url: enriched.image_url,
        tracklists: enriched.tracklists,
      };

      // Insert into Supabase
      const { error } = await supabase.from("collection").insert(fullRow);

      if (error) {
        log(`Insert failed for ${releaseId}: ${error.message}`);
      } else {
        log(`Imported: ${fullRow.artist} – ${fullRow.title}`);
      }

      // Rate-limit requests
      await new Promise((res) => setTimeout(res, 1000));
    }

    setImporting(false);
  };

  // Render the upload form and preview
  return (
    <div style={{ padding: "2rem" }}>
      <h2>Import Discogs CSV</h2>
      <input type="file" accept=".csv" onChange={handleCSVUpload} />
      <br /><br />

      {uniqueRows.length > 0 && (
        <>
          <button onClick={handleImport} disabled={importing}>
            {importing ? "Importing..." : `Import ${uniqueRows.length} New Rows`}
          </button>
          <h4>Preview of entries to be imported:</h4>
          <ul>
            {uniqueRows.map((r, i) => (
              <li key={i}>
                {r["Artist"]} – {r["Title"]}
              </li>
            ))}
          </ul>
        </>
      )}

      <div style={{ marginTop: "2rem", whiteSpace: "pre-wrap" }}>
        {statusLog.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Papa from "papaparse";
import { supabase } from "lib/supabaseClient";

type CollectionRow = {
  artist: string;
  title: string;
  label: string;
  catalog_number: string;
  format: string;
  release_year: string | null;
  discogs_release_id: string;
  media_condition: string;
  sleeve_condition: string;
  notes: string;
  added_date: Date | null;
  media_type: string;
  image_url: string | null;
  tracklists: {
    position: string;
    title: string;
    duration: string;
  }[] | null;
};

type CsvRow = Record<string, string>;

type DiscogsTrack = {
  position: string;
  title: string;
  duration: string;
};

type DiscogsResponse = {
  images?: { uri: string }[];
  tracklist?: DiscogsTrack[];
};

export default function ImportDiscogs(): React.ReactElement {
  const [uniqueRows, setUniqueRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [statusLog, setStatusLog] = useState<string[]>([]);

  const log = (msg: string): void =>
    setStatusLog((prev: string[]) => [...prev, msg]);

  const handleCSVUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: { data: CsvRow[] }): Promise<void> => {
        const rows = results.data;
        const releaseIds = rows.map((r) => r["release_id"]).filter(Boolean);

        if (releaseIds.length === 0) {
          log("No Discogs release_ids found in uploaded CSV.");
          return;
        }

        const { data: existing } = await supabase
          .from("collection")
          .select("discogs_release_id")
          .in("discogs_release_id", releaseIds);

        const existingIds = new Set(
          (existing || []).map((r) => r.discogs_release_id)
        );

        const newRows = rows.filter(
          (r) => r["release_id"] && !existingIds.has(r["release_id"])
        );

        setUniqueRows(newRows);
        log(
          `Found ${newRows.length} new unique entries out of ${rows.length} total.`
        );
      },
    });
  };

  const enrichWithDiscogs = async (
    releaseId: string
  ): Promise<{ image_url: string | null; tracklists: CollectionRow["tracklists"] }> => {
    try {
      const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DiscogsResponse = await res.json();
      const image_url = json.images?.[0]?.uri || null;
      const tracklists =
        json.tracklist?.map((t) => ({
          position: t.position,
          title: t.title,
          duration: t.duration,
        })) || null;
      return { image_url, tracklists };
    } catch (err: unknown) {
      log(`Discogs fetch failed for ${releaseId}: ${String(err)}`);
      return { image_url: null, tracklists: null };
    }
  };

  const handleImport = async (): Promise<void> => {
    setImporting(true);
    for (const row of uniqueRows) {
      const release_id = row["release_id"];
      const collectionRow: Omit<CollectionRow, "image_url" | "tracklists"> = {
        catalog_number: row["catalog_number"],
        artist: row["artist"],
        title: row["title"],
        label: row["label"],
        format: row["format"],
        release_year: row["release_year"] || null,
        discogs_release_id: release_id,
        media_condition: row["media_condition"],
        sleeve_condition: row["sleeve_condition"],
        notes: row["notes"],
        added_date: row["added_date"] ? new Date(row["added_date"]) : null,
        media_type: row["media_type"],
      };

      const enriched = await enrichWithDiscogs(release_id);
      const fullRow: CollectionRow = {
        ...collectionRow,
        image_url: enriched.image_url,
        tracklists: enriched.tracklists,
      };

      const { error } = await supabase.from("collection").insert(fullRow);
      if (error) {
        log(`Insert failed for ${release_id}: ${error.message}`);
      } else {
        log(`Imported ${collectionRow.artist} – ${collectionRow.title}`);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
    setImporting(false);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Import Discogs CSV</h2>
      <input type="file" accept=".csv" onChange={handleCSVUpload} />
      <br />
      <br />
      {uniqueRows.length > 0 && (
        <>
          <button onClick={handleImport} disabled={importing}>
            {importing
              ? "Importing..."
              : `Import ${uniqueRows.length} New Rows`}
          </button>
          <h4>Preview of entries to be imported:</h4>
          <ul>
            {uniqueRows.map((r: CsvRow, i: number) => (
              <li key={i}>
                {r["artist"]} – {r["title"]}
              </li>
            ))}
          </ul>
        </>
      )}
      <div style={{ marginTop: "2rem", whiteSpace: "pre-wrap" }}>
        {statusLog.map((line: string, i: number) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

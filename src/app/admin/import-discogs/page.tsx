// Admin Import Discogs page – ESLint/TS error-free, fully rebuilt with visual preview

"use client";

import React, { useState, ChangeEvent } from "react";
import Papa from "papaparse";
import { supabase } from "lib/supabaseClient";

type DiscogsRelease = {
  images?: { uri?: string }[];
  tracklist?: unknown[];
};

type ParsedRow = {
  artist: string;
  title: string;
  folder: string;
  format: string;
  year: string;
  media_condition: string;
  discogs_release_id: string;
  discogs_master_id: string;
  image_url: string | null;
  tracklists: unknown[] | null;
  sides: unknown;
};

export default function Page() {
  const [newRows, setNewRows] = useState<ParsedRow[]>([]);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("Parsing file...");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: { data: Record<string, string>[] }) => {
        const parsed: ParsedRow[] = results.data.map((row: Record<string, string>) => ({
          artist: row["Artist"] || "",
          title: row["Title"] || "",
          folder: row["CollectionFolder"] || "",
          format: row["Format"] || "",
          year: row["Released"] || "",
          media_condition: row["Collection Media Condition"] || "",
          discogs_release_id: row["discogs_release_id"] || row["release_id"] || "",
          discogs_master_id: row["discogs_release_id"] || row["release_id"] || "",
          image_url: null,
          tracklists: null,
          sides: null,
        }));

        const existing = await fetchAllExistingReleaseIds();
        const deduped = parsed.filter(
          (row) => row.discogs_release_id && !existing.has(row.discogs_release_id)
        );

        setNewRows(deduped);
        setDuplicatesCount(parsed.length - deduped.length);
        setStatus(`Ready to import ${deduped.length} new entr${deduped.length === 1 ? "y" : "ies"}.`);
      },
    });
  };

  const fetchAllExistingReleaseIds = async (): Promise<Set<string>> => {
    const ids = new Set<string>();
    let from = 0;
    const batchSize = 1000;
    let done = false;

    while (!done) {
      const { data, error } = await supabase
        .from("collection")
        .select("discogs_release_id")
        .range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;

      data.forEach((row) => {
        if (row.discogs_release_id) ids.add(row.discogs_release_id.toString());
      });

      done = data.length < batchSize;
      from += batchSize;
    }

    return ids;
  };

  const fetchDiscogsRelease = async (releaseId: string): Promise<DiscogsRelease> => {
    const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
    if (!res.ok) {
      const text = await res.text();
      console.error(`DiscogsProxy failed (${res.status}):`, text);
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  };

  const enrichRow = async (row: ParsedRow): Promise<ParsedRow> => {
    try {
      const data = await fetchDiscogsRelease(row.discogs_release_id);
      const image = data.images?.[0]?.uri || null;
      const tracklist = Array.isArray(data.tracklist) ? data.tracklist : null;
      return { ...row, image_url: image, tracklists: tracklist };
    } catch (err) {
      console.error("Enrichment failed:", err);
      return row;
    }
  };

  const handleImport = async () => {
    if (newRows.length === 0) return;

    setLoading(true);
    setStatus("Importing...");
    let inserted = 0;

    for (let i = 0; i < newRows.length; i++) {
      const enriched = await enrichRow(newRows[i]);
      const record = {
        ...enriched,
        is_box_set: false,
        parent_id: null,
        blocked: false,
        blocked_sides: null,
        child_album_ids: null,
      };

      try {
        await supabase.from("collection").insert([record]);
        inserted++;
      } catch (err) {
        console.error("Insert failed:", err);
      }

      setStatus(`Imported ${inserted} of ${newRows.length}...`);
      await new Promise((r) => setTimeout(r, 2000));
    }

    setStatus(`✅ ${inserted} imported.`);
    setLoading(false);
  };

  return (
    <div>
      <h2>Import Discogs Collection</h2>
      <input type="file" accept=".csv" onChange={handleFile} />
      <p>{status}</p>
      <p>Duplicates Detected: {duplicatesCount}</p>
      {newRows.length > 0 && (
        <>
          <p><button onClick={handleImport} disabled={loading}>Import</button></p>
          <h3>Entries to Import:</h3>
          <ul>
            {newRows.map((row, idx) => (
              <li key={idx}>
                {row.artist} – {row.title}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

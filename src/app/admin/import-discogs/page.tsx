// Admin Import Discogs page ("/admin/import-discogs")
// Upload and import Discogs CSV exports to Supabase, including deduplication and enrichment.

"use client";

import React, { useState, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { supabase } from 'lib/supabaseClient';

// Artist cleaner: strips trailing (#), trims, preserves case
const cleanArtist = (artist: string): string =>
  (artist || "").replace(/\s*\(\d+\)$/, "").trim();

// dedupeKey: generates a stable unique key per row to detect duplicates
const dedupeKey = (row: Record<string, unknown>): string =>
  (row.discogs_release_id || row.release_id || '').toString().trim();

// fetchDiscogsRelease: calls local API route to fetch Discogs metadata
async function fetchDiscogsRelease(releaseId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Page component for handling Discogs CSV import and enrichment
export default function Page() {
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
  const [duplicates, setDuplicates] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState<string>('');
  const [onlyAddNew, setOnlyAddNew] = useState<boolean>(true);

  // handleFile: parses uploaded CSV file and enriches each row
  const handleFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results: { data: Record<string, unknown>[] }) {
        const existing = await fetchAllExistingRows();
        const existingMap = new Map(existing.map(e => [dedupeKey(e), e]));

        const csvData = await Promise.all(results.data.map(async (row: Record<string, unknown>) => {
          const norm = normalizeRow(row);
          const enriched = await enrichWithDiscogs(norm, existingMap);
          return enriched;
        }));

        setParsedData(csvData);

        const existingKeys = new Set(existing.map(e => dedupeKey(e)));
        const dupeRows = csvData.filter(row => existingKeys.has(dedupeKey(row)));
        setDuplicates(dupeRows);
      }
    });
  };

  // fetchAllExistingRows: retrieves all collection rows from Supabase
  async function fetchAllExistingRows(): Promise<Record<string, unknown>[]> {
    let all: Record<string, unknown>[] = [];
    let from = 0;
    const size = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('collection')
        .select('*')
        .range(from, from + size - 1);

      if (error || !data?.length) break;
      all = all.concat(data);
      if (data.length < size) break;
      from += size;
    }

    return all;
  }

  // enrichWithDiscogs: adds missing metadata to a row using Discogs API
  async function enrichWithDiscogs(row: Record<string, unknown>, existingMap: Map<string, Record<string, unknown>>): Promise<Record<string, unknown>> {
    const existing = existingMap.get(dedupeKey(row)) || {};
    let image = row.image_url || (existing as { image_url?: unknown }).image_url;

    if (row.discogs_release_id) {
      try {
        const discogsData = await fetchDiscogsRelease(row.discogs_release_id as string);

        // If image is missing or blank, use first Discogs image (if available)
        if (!image || String(image).trim() === '') {
          if ((discogsData.images as { uri: string }[] | undefined)?.[0]?.uri) {
            image = (discogsData.images as { uri: string }[])[0].uri;
          }
        }

        // Populate year if not already present
        if (!row.year && discogsData.year) {
          row.year = String(discogsData.year);
        }

        // Populate format from Discogs if not already set
        if (!row.format && Array.isArray(discogsData.formats)) {
          row.format = discogsData.formats.map((f: { name: string }) => f.name).join(', ');
        }

        // If tracklists field is missing or blank, use Discogs tracklist array
        if (!row.tracklists || String(row.tracklists).trim() === '') {
          if (Array.isArray(discogsData.tracklist)) {
            row.tracklists = JSON.stringify(discogsData.tracklist);
          }
        }

      } catch (err) {
        console.error("Discogs enrichment failed", err);
      }
    }

    return { ...row, image_url: image };
  }

  // normalizeRow: maps Discogs CSV headers to internal field keys
  function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    return {
      artist: row['Artist'] || '',
      title: row['Title'] || '',
      year: row['Released'] || '',
      folder: row['Collection Folder'] || '',
      format: row['Format'] || '',
      media_condition: row['Media Condition'] || '',
      discogs_release_id: row['discogs_release_id'] || row['Release ID'],
      image_url: row['image_url'] || '',
      tracklists: row['tracklists'] || '',
    };
  }

  // handleImport: inserts or updates enriched rows into Supabase
  const handleImport = async (): Promise<void> => {
    if (parsedData.length === 0) return;
    const existing = await fetchAllExistingRows();
    const existingMap = new Map(existing.map(e => [dedupeKey(e), e]));

    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < parsedData.length; i++) {
      const row = await enrichWithDiscogs(parsedData[i], existingMap);
      const key = dedupeKey(row);
      const match = existingMap.get(key);

      if (onlyAddNew && match) continue;

      const record = {
        artist: cleanArtist((row.artist as string) || ''),
        title: row.title || null,
        year: row.year || null,
        folder: row.folder || null,
        format: row.format || null,
        image_url: row.image_url || null,
        media_condition: row.media_condition || null,
        tracklists: row.tracklists || null,
        discogs_release_id: row.discogs_release_id || null,
      };

      try {
        if (match) {
          await supabase.from('collection').update(record).eq('id', (match as { id: string }).id);
          updated++;
        } else {
          await supabase.from('collection').insert([record]);
          inserted++;
        }
      } catch (err) {
        console.error("Import error on row", i + 1, err);
      }

      setStatus(`Processed ${i + 1} / ${parsedData.length}`);
    }

    setStatus(`✅ Done. Inserted: ${inserted}, Updated: ${updated}`);
  };

  // UI: CSV upload + status
  return (
    <div>
      <h1>Import Discogs CSV</h1>
      <input type="file" accept=".csv" onChange={handleFile} />
      <label>
        <input type="checkbox" checked={onlyAddNew} onChange={e => setOnlyAddNew(e.target.checked)} />
        Only Add New
      </label>
      <button onClick={handleImport}>Import</button>
      <p>{status}</p>
      <p>Duplicates detected: {duplicates.length}</p>
    </div>
  );
}

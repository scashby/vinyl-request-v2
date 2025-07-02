// Admin Import Discogs page ("/admin/import-discogs")
// Upload and import Discogs CSV exports to Supabase, excluding duplicates and enriching new records with image_url and tracklists.

"use client";

import React, { useState, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { supabase } from 'lib/supabaseClient';

type DiscogsRelease = {
  images?: { uri?: string }[];
  tracklist?: unknown[];
};

export default function Page() {
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
  const [duplicates, setDuplicates] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState<string>('');
  const [onlyAddNew, setOnlyAddNew] = useState<boolean>(true);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results: { data: Record<string, unknown>[] }) {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const existing = await fetchAllExistingRows();
        const existingKeys = new Set(existing.map(e => dedupeKey(e)));

        const csvData: Record<string, unknown>[] = [];
        const dupeRows: Record<string, unknown>[] = [];

        for (const rawRow of results.data) {
          const norm = normalizeRow(rawRow);
          const key = dedupeKey(norm);

          if (existingKeys.has(key)) {
            dupeRows.push(norm);
            continue;
          }

          try {
            const enriched = await enrichWithDiscogs(norm);
            csvData.push(enriched);
            await delay(2000); // throttle to avoid Cloudflare block
          } catch (err) {
            console.error(`❌ Skipped during enrichment: ${key}`, err);
          }
        }

        setParsedData(csvData);
        setDuplicates(dupeRows);
      }
    });
  };

  const handleImport = async (): Promise<void> => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    if (parsedData.length === 0) return;
    setStatus(`Importing 0 of ${parsedData.length}...`);

    const existing = await fetchAllExistingRows();
    const existingMap = new Map(existing.map(e => [dedupeKey(e), e]));

    let inserted = 0;

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      const key = dedupeKey(row);
      if (onlyAddNew && existingMap.has(key)) continue;

      const record = {
        artist: cleanArtist(row.artist as string),
        title: row.title || null,
        year: row.year || null,
        folder: row.folder || null,
        format: row.format || null,
        image_url: row.image_url || null,
        media_condition: row.media_condition || null,
        tracklists: cleanTextOrJSON(row.tracklists),
        sides: safeParse(row.sides),
        discogs_master_id: row.discogs_master_id || null,
        discogs_release_id: row.discogs_release_id || null,
        is_box_set: false,
        parent_id: null,
        blocked: false,
        blocked_sides: null,
        child_album_ids: null
      };

      try {
        await supabase.from('collection').insert([record], { count: undefined });
        inserted++;
      } catch (err) {
        console.error('Supabase insert error:', err, record);
        setStatus(`Error on row ${i + 1}: ${(err as Error).message}`);
        continue;
      }

      setStatus(`Importing ${i + 1} of ${parsedData.length}...`);
      await delay(2000);
    }

    setStatus(`✅ ${inserted} inserted.`);
  };

  function dedupeKey(row: Record<string, unknown>): string {
    return (row.discogs_release_id || row.release_id || '').toString().trim();
  }

  function cleanArtist(input: string): string {
    return input.replace(/\s*\(\d+\)$/, '').trim();
  }

  function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    const releaseId = row['discogs_release_id'] || row['release_id'] || '';
    return {
      artist: row['Artist'] || '',
      title: row['Title'] || '',
      folder: row['CollectionFolder'] || '',
      format: row['Format'] || '',
      year: row['Released'] || '',
      media_condition: row['Collection Media Condition'] || '',
      discogs_release_id: releaseId,
      discogs_master_id: releaseId,
      image_url: null,
      tracklists: null,
      sides: null,
      is_box_set: false,
      parent_id: null,
      blocked: false,
      blocked_sides: null,
      child_album_ids: null
    };
  }

  async function fetchAllExistingRows(): Promise<Record<string, unknown>[]> {
    let allRows: Record<string, unknown>[] = [];
    let from = 0;
    const batchSize = 1000;
    let keepGoing = true;

    while (keepGoing) {
      const { data: batch, error } = await supabase
        .from('collection')
        .select('*')
        .range(from, from + batchSize - 1);
      if (error) break;
      if (!batch || batch.length === 0) break;
      allRows = allRows.concat(batch);
      keepGoing = batch.length === batchSize;
      from += batchSize;
    }

    return allRows;
  }

  async function fetchDiscogsRelease(releaseId: string): Promise<DiscogsRelease> {
    const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
    if (!res.ok) {
      const text = await res.text();
      console.error(`DiscogsProxy failed (${res.status}):`, text);
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  }

  async function enrichWithDiscogs(row: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!row.discogs_release_id) return row;

    try {
      const data = await fetchDiscogsRelease(row.discogs_release_id as string);
      if (!row.image_url && Array.isArray(data.images) && data.images[0]?.uri) {
        row.image_url = data.images[0].uri;
      }
      if (!row.tracklists && Array.isArray(data.tracklist)) {
        row.tracklists = data.tracklist;
      }
    } catch (err) {
      console.error('Discogs enrichment failed:', err);
      throw err;
    }

    return row;
  }

  function cleanTextOrJSON(input: unknown): unknown[] | null {
    if (!input || input === 'None') return null;
    if (Array.isArray(input)) return input;
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  function safeParse(input: unknown): unknown {
    try {
      if (!input || input === 'None') return null;
      return typeof input === 'string' ? JSON.parse(input) : input;
    } catch {
      return null;
    }
  }

  return (
    <div>
      <h2>Import Discogs Collection</h2>
      <input type="file" accept=".csv" onChange={handleFile} />
      <p><label style={{ marginLeft: 8 }}>
        <input type="checkbox" checked={onlyAddNew} onChange={e => setOnlyAddNew(e.target.checked)} />
        {' '}Only add new items (skip updating existing)
      </label></p>
      <p><button onClick={handleImport}>Import</button></p>
      <p>{status}</p>
      <p>Duplicates Detected: {duplicates.length}</p>
    </div>
  );
}

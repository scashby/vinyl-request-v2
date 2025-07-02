// Admin Import Discogs page ("/admin/import-discogs")
// Upload and import Discogs CSV exports to Supabase, including deduplication and enrichment.

"use client";

import React, { useState, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { supabase } from 'lib/supabaseClient';

// Artist cleaner: strips trailing (#), trims, preserves case
const cleanArtist = (artist: string): string =>
  (artist || "").replace(/\s*\(\d+\)$/, "").trim();

// Bulletproof dedupe key for ALL sources
const dedupeKey = (row: Record<string, unknown>): string =>
  (row.discogs_release_id || row.release_id || '').toString().trim();

async function fetchDiscogsRelease(releaseId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function enrichMediaConditionIfBlank(row: Record<string, unknown>): Promise<string> {
  if (row.media_condition && String(row.media_condition).trim()) {
    return row.media_condition as string; // Already has value
  }
  if (!row.discogs_release_id) return ""; // Can't enrich
  try {
    const discogsData = await fetchDiscogsRelease(row.discogs_release_id as string);
    return (discogsData?.media_condition as string) || "";
  } catch {
    return "";
  }
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
    if (error) {
      break;
    }
    if (!batch || batch.length === 0) break;
    allRows = allRows.concat(batch);
    keepGoing = batch.length === batchSize;
    from += batchSize;
  }
  return allRows;
}

export default function Page() {
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
  const [duplicates, setDuplicates] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState<string>('');
  const [onlyAddNew, setOnlyAddNew] = useState<boolean>(true); // Default: only add new

  // Parse and normalize CSV
  const handleFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results: { data: Record<string, unknown>[] }) {
        const csvData = await Promise.all(results.data.map(async (row: Record<string, unknown>) => {
          const norm = normalizeRow(row);
          norm.media_condition = await enrichMediaConditionIfBlank(norm);
          return norm;
        }));
        setParsedData(csvData);

        const existing = await fetchAllExistingRows();
        const existingKeys = new Set(existing.map(e => dedupeKey(e)));
        const dupeRows = csvData.filter(row => existingKeys.has(dedupeKey(row)));
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
    let updated = 0;

    for (let i = 0; i < parsedData.length; i++) {
      const csvRow = parsedData[i];
      const rowKey = dedupeKey(csvRow);
      const match = existingMap.get(rowKey);

      // Only add new: skip if already exists
      if (onlyAddNew && match) continue;

      const row = await enrichWithDiscogs(csvRow, existingMap);

      const record = {
        artist: cleanArtist((row.artist as string) || '') || null,
        title: row.title || null,
        year: row.year || null,
        folder: row.folder || null,
        format: row.format || null,
        image_url: row.image_url || null,
        media_condition: row.media_condition || null,
        tracklists: cleanTextOrJSON(row.tracklists as string),
        sides: safeParse(row.sides as string),
        discogs_master_id: row.discogs_master_id || null,
        discogs_release_id: row.discogs_release_id || null,
        is_box_set: parseBoolean(row.is_box_set),
        parent_id: row.parent_id || null,
        blocked: parseBoolean(row.blocked),
        blocked_sides: parseArray(row.blocked_sides as string),
        child_album_ids: parseIntArray(row.child_album_ids as string)
      };

      try {
        if (match) {
          if (!onlyAddNew) {
            await supabase
              .from('collection')
              .update(record, { count: undefined })
              .eq('id', (match as { id: string }).id);
            updated++;
          }
        } else {
          await supabase.from('collection').insert([record], { count: undefined });
          inserted++;
        }
      } catch (err) {
        console.error('Supabase import error:', err, record);
        setStatus(`Error on row ${i + 1}: ${(err as Error).message}`);
        continue;
      }

      setStatus(`Importing ${i + 1} of ${parsedData.length}...`);
      await delay(5000);
    }

    setStatus(`✅ ${inserted} inserted${onlyAddNew ? '' : `, ${updated} updated`}.`);
  };

  async function enrichWithDiscogs(row: Record<string, unknown>, existingMap: Map<string, Record<string, unknown>>): Promise<Record<string, unknown>> {
    const existing = existingMap.get(dedupeKey(row)) || {};
    let image = row.image_url || (existing as { image_url?: unknown }).image_url;

    if (row.discogs_release_id) {
      try {
        const discogsData = await fetchDiscogsRelease(row.discogs_release_id as string);
        if (!discogsData || typeof discogsData !== 'object') {
          console.error('Invalid Discogs response:', discogsData);
          return row;
        }

        if (!image && (discogsData.images as { uri: string }[] | undefined)?.[0]?.uri) {
          image = (discogsData.images as { uri: string }[])[0].uri;
        }
        if (!row.year && discogsData.year) {
          row.year = discogsData.year.toString();
        }
        if (!row.format && (discogsData.formats as { name: string }[] | undefined)?.[0]?.name) {
          row.format = (discogsData.formats as { name: string }[])[0].name;
        }
        if (!row.tracklists && Array.isArray(discogsData.tracklist)) {
          row.tracklists = JSON.stringify(discogsData.tracklist);
        }
      } catch (err) {
        console.error('Discogs enrichment failed:', err);
      }
    }
    return { ...row, image_url: image };
  }

  function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    const releaseId = row['discogs_release_id'] || row['release_id'] || '';
    const masterId = row['discogs_master_id'] || row['discogs_release_id'] || row['release_id'] || '';
    return {
      artist: row['Artist'] || row['artist'] || null,
      title: row['Title'] || row['title'] || null,
      year: row['Released'] || row['year'] || null,
      folder: row['CollectionFolder'] || row['folder'] || null,
      format: row['Format'] || row['format'] || null,
      image_url: row['image_url'] || null,
      media_condition: row['Collection Media Condition'] || row['media_condition'] || null,
      tracklists: row['tracklists'] || null,
      sides: row['sides'] || null,
      discogs_master_id: masterId,
      discogs_release_id: releaseId,
      is_box_set: row['is_box_set'] || false,
      parent_id: row['parent_id'] || null,
      blocked: row['blocked'] || false,
      blocked_sides: row['blocked_sides'] || null,
      child_album_ids: row['child_album_ids'] || null
    };
  }

  function safeParse(input: string | null | undefined): unknown {
    try {
      if (!input || input === 'None') return null;
      return typeof input === 'string' ? JSON.parse(input) : input;
    } catch {
      return null;
    }
  }

  function cleanTextOrJSON(input: string | null | undefined): string | null {
    if (!input || input === 'None') return null;
    try {
      return JSON.stringify(JSON.parse(input));
    } catch {
      return input;
    }
  }

  function parseBoolean(input: unknown): boolean {
    return input === true || input === 'true';
  }

  function parseArray(input: string | null | undefined): string[] | null {
    if (!input || input === 'None') return null;
    try {
      return JSON.parse(input);
    } catch {
      return input.split(',').map(s => s.trim());
    }
  }

  function parseIntArray(input: string | null | undefined): number[] | null {
    if (!input || input === 'None' || input === 'null') return null;
    try {
      const parsed = JSON.parse(input);
      if (!Array.isArray(parsed)) return null;
      return parsed.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    } catch {
      return input.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
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

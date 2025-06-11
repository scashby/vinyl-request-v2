// Admin Import Discogs page ("/admin/import-discogs")
// Upload and import Discogs CSV exports to Supabase, including deduplication and enrichment.

"use client";

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabaseClient.js';

// Artist cleaner: strips trailing (#), trims, preserves case
const cleanArtist = artist =>
  (artist || "").replace(/\s*\(\d+\)$/, "").trim();

// Bulletproof dedupe key for ALL sources
const dedupeKey = row =>
  [
    (row.discogs_release_id || '').toString().trim(),
    (row.discogs_master_id || '').toString().trim(),
    (row.folder || '').toString().trim().toLowerCase(),
    (row.media_condition || '').toString().trim().toLowerCase(),
    cleanArtist(row.artist || '').toLowerCase(),
    (row.title || '').toString().trim().toLowerCase(),
    (row.year || '').toString().trim().toLowerCase()
  ].join('|--|');

async function fetchDiscogsRelease(releaseId) {
  const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function enrichMediaConditionIfBlank(row) {
  if (row.media_condition && row.media_condition.trim()) {
    return row.media_condition; // Already has value
  }
  if (!row.discogs_release_id) return ""; // Can't enrich
  try {
    const discogsData = await fetchDiscogsRelease(row.discogs_release_id);
    return discogsData?.media_condition || "";
  } catch {
    return "";
  }
}

async function fetchAllExistingRows() {
  let allRows = [];
  let from = 0;
  let batchSize = 1000;
  let keepGoing = true;

  while (keepGoing) {
    let { data: batch, error } = await supabase
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
  const [parsedData, setParsedData] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [status, setStatus] = useState('');
  const [onlyAddNew, setOnlyAddNew] = useState(true); // Default: only add new

  // Parse and normalize CSV
  const handleFile = async (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        const csvData = await Promise.all(results.data.map(async row => {
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

  const handleImport = async () => {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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
        artist: cleanArtist(row.artist) || null,
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
        is_box_set: parseBoolean(row.is_box_set),
        parent_id: row.parent_id || null,
        blocked: parseBoolean(row.blocked),
        blocked_sides: parseArray(row.blocked_sides),
        child_album_ids: parseIntArray(row.child_album_ids)
      };

      try {
        if (match) {
          if (!onlyAddNew) {
            await supabase
              .from('collection')
              .update(record, { returning: 'minimal', count: null })
              .eq('id', match.id);
            updated++;
          }
        } else {
          await supabase.from('collection').insert([record], { returning: 'minimal', count: null });
          inserted++;
        }
      } catch (err) {
        console.error('Supabase import error:', err, record);
        setStatus(`Error on row ${i + 1}: ${err.message}`);
        continue;
      }

      setStatus(`Importing ${i + 1} of ${parsedData.length}...`);
      await delay(5000);
    }

    setStatus(`✅ ${inserted} inserted${onlyAddNew ? '' : `, ${updated} updated`}.`);
  };

  async function enrichWithDiscogs(row, existingMap) {
    const existing = existingMap.get(dedupeKey(row)) || {};
    let image = row.image_url || existing.image_url;

    if (row.discogs_release_id) {
      try {
        const discogsData = await fetchDiscogsRelease(row.discogs_release_id);
        if (!discogsData || typeof discogsData !== 'object') {
          console.error('Invalid Discogs response:', discogsData);
          return row;
        }

        if (!image && discogsData.images?.[0]?.uri) {
          image = discogsData.images[0].uri;
        }
        if (!row.year && discogsData.year) {
          row.year = discogsData.year.toString();
        }
        if (!row.format && discogsData.formats?.[0]?.name) {
          row.format = discogsData.formats[0].name;
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

  function normalizeRow(row) {
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

  function safeParse(input) {
    try {
      if (!input || input === 'None') return null;
      return typeof input === 'string' ? JSON.parse(input) : input;
    } catch {
      return null;
    }
  }

  function cleanTextOrJSON(input) {
    if (!input || input === 'None') return null;
    try {
      return JSON.stringify(JSON.parse(input));
    } catch {
      return input;
    }
  }

  function parseBoolean(input) {
    return input === true || input === 'true';
  }

  function parseArray(input) {
    if (!input || input === 'None') return null;
    try {
      return JSON.parse(input);
    } catch {
      return input.split(',').map(s => s.trim());
    }
  }

  function parseIntArray(input) {
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
      <label style={{ marginLeft: 8 }}>
        <input type="checkbox" checked={onlyAddNew} onChange={e => setOnlyAddNew(e.target.checked)} />
        {' '}Only add new items (skip updating existing)
      </label>
      <button onClick={handleImport}>Import</button>
      <p>{status}</p>
      <p>Duplicates Detected: {duplicates.length}</p>
    </div>
  );
}

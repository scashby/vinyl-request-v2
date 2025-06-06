import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabaseClient.js';

export default function ImportDiscogs() {
  const [parsedData, setParsedData] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [status, setStatus] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        const csvData = results.data.map(normalizeRow);
        setParsedData(csvData);

        const { data: existing } = await supabase.from('collection').select('*');
        const existingKeys = new Set(existing.map(e => keyFor(e)));

        const dupeRows = csvData.filter(row => existingKeys.has(keyFor(row)));
        setDuplicates(dupeRows);
      }
    });
  };

  const keyFor = (row) => `${row.artist}|--|${row.title}|--|${row.year}|--|${row.folder}`;

  const handleImport = async () => {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    if (parsedData.length === 0) return;
    setStatus(`Importing 0 of ${parsedData.length}...`);

    const { data: existing } = await supabase.from('collection').select('*');
    const existingMap = new Map(existing.map(e => [keyFor(e), e]));

    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < parsedData.length; i++) {
      const row = await enrichWithDiscogs(parsedData[i], existingMap);

      const record = {
        artist: row.artist,
        title: row.title,
        year: row.year,
        folder: row.folder,
        format: row.format,
        image_url: row.image,
        media_condition: row.media_condition,
        tracklists: typeof row.tracklists === 'string' ? row.tracklists : JSON.stringify(row.tracklists),
        sides: safeParse(row.sides),
        discogs_master_id: row.discogs_master_id,
        discogs_release_id: row.discogs_release_id,
        is_box_set: parseBoolean(row.is_box_set),
        parent_id: row.parent_id && row.parent_id !== 'None' ? row.parent_id : null,
        blocked: parseBoolean(row.blocked),
        blocked_sides: parseArray(row.blocked_sides),
        child_album_ids: parseIntArray(row.child_album_ids)
      };

      if (existingMap.has(keyFor(row))) {
        await supabase
          .from('collection')
          .update(record, { returning: 'minimal', count: null })
          .match({ artist: row.artist, title: row.title, year: row.year, folder: row.folder });
        updated++;
      } else {
        await supabase
          .from('collection')
          .insert([record], { returning: 'minimal', count: null });
        inserted++;
      }

      setStatus(`Importing ${i + 1} of ${parsedData.length}...`);
      await delay(200);
    }

    setStatus(`✅ ${inserted} inserted, ${updated} updated.`);
  };

  async function enrichWithDiscogs(row, existingMap) {
    const existing = existingMap.get(keyFor(row)) || {};
    let image = row.image_url || existing.image_url;

    if (!image && row.discogs_release_id) {
      try {
        console.warn('Fetching release ID:', row.discogs_release_id);
        const response = await fetch(`/api/discogsProxy?releaseId=${row.discogs_release_id}`);
        if (!response.ok) {
          console.error('Discogs fetch failed', response.status);
        } else {
          const discogsData = await response.json();
          console.log('Discogs tracklist:', discogsData.tracklist);
          image = discogsData.images?.[0]?.uri || null;
          row.year = row.year || discogsData.year?.toString();
          row.format = row.format || discogsData.formats?.[0]?.name;
          row.tracklists = row.tracklists || (discogsData.tracklist?.length ? JSON.stringify(discogsData.tracklist) : null);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        image = existing.image_url || null;
      }
    }

    return { ...row, image };
  }

  function normalizeRow(row) {
    return {
      artist: row['Artist'] || null,
      title: row['Title'] || null,
      year: row['Released'] || null,
      folder: row['CollectionFolder'] || null,
      format: row['Format'] || null,
      image_url: row.image_url || null,
      media_condition: row['Collection Media Condition'] || null,
      tracklists: row.tracklists || null,
      sides: row.sides || null,
      discogs_master_id: row.discogs_master_id || row.release_id || null,
      discogs_release_id: row.release_id || null,
      is_box_set: row.is_box_set || false,
      parent_id: row.parent_id || null,
      blocked: row.blocked || false,
      blocked_sides: row.blocked_sides || null,
      child_album_ids: row.child_album_ids || null
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
      <button onClick={handleImport}>Import</button>
      <p>{status}</p>
      <p>Duplicates Detected: {duplicates.length}</p>
    </div>
  );
}

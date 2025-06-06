import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabaseClient.js';

export default function ImportDiscogs() {
  const [parsedData, setParsedData] = useState([]);
  const [status, setStatus] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        const csvData = results.data;
        setParsedData(csvData);
      }
    });
  };

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
      return JSON.stringify(JSON.parse(input)); // valid JSON string
    } catch {
      return input; // fall back to string as-is
    }
  }

  function parseBoolean(input) {
    return input === true || input === 'true' ? true : false;
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
    if (!input || input === 'None') return null;
    try {
      return JSON.parse(input).map(Number);
    } catch {
      return input.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    }
  }

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setStatus('Importing...');

    const { data: existing } = await supabase.from('collection').select('*');
    const matchKey = (r) => `${r.artist}|--|${r.title}|--|${r.year}`;
    const existingMap = new Map(existing.map(e => [matchKey(e), e]));

    let updated = 0;
    let inserted = 0;

    for (const row of parsedData) {
      const key = matchKey(row);
      const record = {
        artist: row.artist,
        title: row.title,
        year: row.year,
        folder: row.folder,
        format: row.format,
        image_url: row.image_url,
        media_condition: row.media_condition,
        tracklists: cleanTextOrJSON(row.tracklists),
        sides: safeParse(row.sides),
        discogs_master_id: row.discogs_master_id,
        discogs_release_id: row.discogs_release_id,
        is_box_set: parseBoolean(row.is_box_set),
        parent_id: row.parent_id || null,
        blocked: parseBoolean(row.blocked),
        blocked_sides: parseArray(row.blocked_sides),
        child_album_ids: parseIntArray(row.child_album_ids)
      };

      if (existingMap.has(key)) {
        await supabase
          .from('collection')
          .update(record, { returning: 'minimal', count: null })
          .match({ artist: row.artist, title: row.title, year: row.year, folder: row.folder });
          updated++;
      } else {
        await supabase.from('collection').insert([record], { returning: 'minimal', count: null });
        inserted++;
      }
    }

    setStatus(`${inserted} inserted, ${updated} updated.`);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Import Discogs CSV</h1>
      <input type="file" accept=".csv" onChange={handleFile} className="mb-4" />
      {parsedData.length > 0 && (
        <>
          <div className="overflow-x-auto border rounded mb-4">
            <table className="min-w-full text-sm text-left text-white">
              <thead className="bg-gray-700 text-xs uppercase">
                <tr>
                  {Object.keys(parsedData[0]).map(key => (
                    <th key={key} className="px-4 py-2">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedData.map((row, idx) => (
                  <tr key={idx} className="bg-gray-800">
                    {Object.values(row).map((val, i) => (
                      <td key={i} className="px-4 py-2">{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
            onClick={handleImport}
          >
            Confirm Import
          </button>
          {status && <p className="mt-2 text-sm italic text-zinc-300">{status}</p>}
        </>
      )}
    </div>
  );
}

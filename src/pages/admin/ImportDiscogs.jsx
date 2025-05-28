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
        const csvData = results.data;
        setParsedData(csvData);

        // Fetch existing collection to find duplicates
        const { data: existing } = await supabase.from('collection').select('*');
        const existingKeys = new Set(existing.map(e => `${e.artist}|--|${e.title}|--|${e.year}`));

        const dupeRows = csvData.filter(row =>
          existingKeys.has(`${row.artist}|--|${row.title}|--|${row.year}`)
        );
        setDuplicates(dupeRows);
      }
    });
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setStatus('Importing...');

    const { data: existing } = await supabase.from('collection').select('*');
    const existingKeys = new Set(existing.map(e => `${e.artist}|--|${e.title}|--|${e.year}`));

    const toInsert = parsedData.filter(row =>
      !existingKeys.has(`${row.artist}|--|${row.title}|--|${row.year}`)
    );

    const toUpdate = parsedData.filter(row =>
      existingKeys.has(`${row.artist}|--|${row.title}|--|${row.year}`)
    );

    for (const row of toUpdate) {
      await supabase
        .from('collection')
        .update(row)
        .match({ artist: row.artist, title: row.title, year: row.year });
    }

    if (toInsert.length > 0) {
      await supabase.from('collection').insert(toInsert);
    }

    setStatus(`${toInsert.length} inserted, ${toUpdate.length} updated.`);
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
                  <tr key={idx} className={duplicates.includes(row) ? 'bg-red-900' : 'bg-gray-800'}>
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

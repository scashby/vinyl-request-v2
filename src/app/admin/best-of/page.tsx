// src/app/admin/best-of/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from 'src/lib/supabaseClient';

type BestOfSourceType = 'ranked' | 'chronological' | 'unranked';

type BestOfSource = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  source_url: string | null;
  source_type: BestOfSourceType;
  max_rank: number | null;
  weight: number;
  created_at: string;
};

type CsvRow = {
  [key: string]: string | number | null;
};

type ParsedRow = {
  rank: number | null;
  artist: string;
  album: string;
  year: number | null;
  notes: string | null;
};

type PapaParseError = {
  message?: string;
};

type PapaParseResult<T> = {
  data: T[];
  errors: PapaParseError[];
};

const CHUNK_SIZE = 200;

export default function BestOfImportPage() {
  const [, setSources] = useState<BestOfSource[]>([]);
  const [, setLoadingSources] = useState(false);

  const [selectedSourceId, setSelectedSourceId] = useState<number | 'new' | null>(null);

  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceDescription, setNewSourceDescription] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<BestOfSourceType>('ranked');
  const [newSourceMaxRank, setNewSourceMaxRank] = useState<number | ''>(500);
  const [newSourceWeight, setNewSourceWeight] = useState<number | ''>(1.0);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  const [runningScores, setRunningScores] = useState(false);
  const [scoresStatus, setScoresStatus] = useState<string | null>(null);

  const [urlToParse, setUrlToParse] = useState('');
  const [urlParsing, setUrlParsing] = useState(false);
  const [urlParseError, setUrlParseError] = useState<string | null>(null);
  const [urlParsedRows, setUrlParsedRows] = useState<ParsedRow[]>([]);

  useEffect(() => {
    const loadSources = async () => {
      setLoadingSources(true);
      const { data } = await supabase
        .from('music_bestof_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) setSources(data as BestOfSource[]);
      setLoadingSources(false);
    };

    void loadSources();
  }, []);

  function normalizeHeader(h: string) {
    return h.trim().toLowerCase();
  }

  function parseCsvRows(csvRows: CsvRow[]): ParsedRow[] {
    const results: ParsedRow[] = [];

    for (const row of csvRows) {
      const keys = Object.keys(row);
      const normalized: Record<string, string> = {};
      for (const k of keys) {
        normalized[normalizeHeader(k)] = String(row[k] ?? '').trim();
      }

      const rankStr =
        normalized['rank'] ?? normalized['number'] ?? normalized['position'] ?? '';

      const artist =
        normalized['artist'] ?? normalized['artist_name'] ?? '';

      const album =
        normalized['album'] ?? normalized['title'] ?? normalized['record'] ?? '';

      const yearStr =
        normalized['year'] ?? normalized['release_year'] ?? '';

      const notes =
        normalized['notes'] ?? normalized['note'] ?? normalized['extra'] ?? '';

      if (!artist && !album) continue;

      let rank: number | null = null;
      if (rankStr) {
        const n = Number(rankStr);
        rank = Number.isFinite(n) ? n : null;
      }

      let year: number | null = null;
      if (yearStr) {
        const m = yearStr.match(/(\d{4})/);
        if (m) {
          const y = Number(m[1]);
          year = Number.isFinite(y) ? y : null;
        }
      }

      results.push({
        rank,
        artist,
        album,
        year,
        notes: notes || null,
      });
    }

    return results;
  }

  async function handleParseCsv(file: File) {
    setIsParsing(true);
    setParseError(null);
    setParsedRows([]);
    setImportStatus(null);
    setImportProgress(null);

    try {
      const text = await file.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
      }) as PapaParseResult<CsvRow>;

      if (parsed.errors?.length) {
        setParseError(parsed.errors[0]?.message ?? 'Error parsing CSV');
        setIsParsing(false);
        return;
      }

      const rows = parsed.data || [];
      const normalizedRows = parseCsvRows(rows);

      if (!normalizedRows.length) {
        setParseError('No valid rows found in CSV.');
      } else {
        setParsedRows(normalizedRows);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error reading CSV';
      setParseError(message);
    } finally {
      setIsParsing(false);
    }
  }

  async function ensureSource(): Promise<number | null> {
    if (selectedSourceId && selectedSourceId !== 'new') return selectedSourceId;

    if (!newSourceName.trim()) {
      setImportStatus('Please enter a name for the new source.');
      return null;
    }

    const payload = {
      name: newSourceName.trim(),
      description: newSourceDescription.trim() || null,
      source_url: newSourceUrl.trim() || null,
      source_type: newSourceType,
      max_rank:
        newSourceType === 'ranked' && newSourceMaxRank ? Number(newSourceMaxRank) : null,
      weight: newSourceWeight ? Number(newSourceWeight) : 1.0,
    };

    const { data, error } = await supabase
      .from('music_bestof_sources')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      setImportStatus('Error creating source: ' + (error?.message ?? 'Unknown error'));
      return null;
    }

    const created = data as BestOfSource;
    setSources(prev => [created, ...prev]);
    setSelectedSourceId(created.id);

    return created.id;
  }

  async function handleImport() {
    if (!parsedRows.length) {
      setImportStatus('No parsed rows to import.');
      return;
    }

    const sourceId = await ensureSource();
    if (!sourceId) return;

    setImporting(true);
    setImportStatus('Starting import…');
    setImportProgress({ done: 0, total: parsedRows.length });

    try {
      const rowsToInsert = parsedRows.map(pr => ({
        source_id: sourceId,
        source_rank: pr.rank,
        source_artist: pr.artist,
        source_album: pr.album,
        source_year: pr.year,
        source_notes: pr.notes,
      }));

      for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
        const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('music_bestof_items').insert(chunk);

        if (error) {
          setImportStatus(`Error inserting rows: ${error.message}`);
          setImporting(false);
          return;
        }

        setImportProgress({
          done: Math.min(i + CHUNK_SIZE, rowsToInsert.length),
          total: rowsToInsert.length,
        });
      }

      setImportStatus('Import complete.');
    } finally {
      setImporting(false);
    }
  }

  async function handleRunScores() {
    setRunningScores(true);
    setScoresStatus('Recomputing aggregate scores…');

    const { error } = await supabase.rpc('compute_music_bestof_scores');

    if (error) {
      setScoresStatus('Error: ' + error.message);
    } else {
      setScoresStatus('Scores recomputed successfully.');
    }

    setRunningScores(false);
  }

  async function handleParseUrl() {
    setUrlParsing(true);
    setUrlParseError(null);
    setUrlParsedRows([]);

    try {
      const res = await fetch('/api/parse-bestof-url', {
        method: 'POST',
        body: JSON.stringify({ url: urlToParse }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const text = await res.text();
        setUrlParseError(text || 'Error parsing URL.');
        setUrlParsing(false);
        return;
      }

      const { csv } = await res.json();
      const parsed = Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
      }) as PapaParseResult<CsvRow>;

      const normalized = parseCsvRows(parsed.data);
      setUrlParsedRows(normalized);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error parsing URL';
      setUrlParseError(msg);
    } finally {
      setUrlParsing(false);
    }
  }

  function useParsedUrlRows() {
    setParsedRows(urlParsedRows);
    setUrlParsedRows([]);
    setParseError(null);
  }

  const previewRows = parsedRows.slice(0, 10);
  const urlPreviewRows = urlParsedRows.slice(0, 10);

  return (
    <div className="space-y-6 text-slate-100">
      <h1 className="text-2xl font-bold mb-2 text-slate-50">Best-Of Lists Import</h1>

      {/* NEW SOURCE FORM BLOCK — FIXES ALL UNUSED VARIABLE ERRORS */}
      <div className="border border-slate-700 rounded p-4 bg-slate-900 space-y-3">
        <h2 className="text-lg font-semibold text-slate-50">
          Source Information
        </h2>

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Source Name</label>
          <input
            value={newSourceName}
            onChange={e => setNewSourceName(e.target.value)}
            className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Description (optional)</label>
          <input
            value={newSourceDescription}
            onChange={e => setNewSourceDescription(e.target.value)}
            className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Source URL (optional)</label>
          <input
            value={newSourceUrl}
            onChange={e => setNewSourceUrl(e.target.value)}
            className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Source Type</label>
          <select
            value={newSourceType}
            onChange={e => setNewSourceType(e.target.value as BestOfSourceType)}
            className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100"
          >
            <option value="ranked">Ranked</option>
            <option value="chronological">Chronological</option>
            <option value="unranked">Unranked</option>
          </select>
        </div>

        {newSourceType === 'ranked' && (
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Max Rank</label>
            <input
              type="number"
              value={newSourceMaxRank}
              onChange={e => {
                const val = e.target.value;
                setNewSourceMaxRank(val === '' ? '' : Number(val));
              }}
              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100"
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Weight</label>
          <input
            type="number"
            step="0.1"
            value={newSourceWeight}
            onChange={e => {
              const val = e.target.value;
              setNewSourceWeight(val === '' ? '' : Number(val));
            }}
            className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100"
          />
        </div>
      </div>

      {/* URL PARSER BLOCK */}
      <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/80 shadow-sm space-y-4">
        <h2 className="font-semibold text-lg text-slate-50">
          OR: Convert Website URL → CSV
        </h2>

        <textarea
          value={urlToParse}
          onChange={e => setUrlToParse(e.target.value)}
          className="w-full h-20 border border-slate-600 rounded bg-slate-950 text-slate-100 px-2 py-1 text-sm"
          placeholder="Paste link to a best-of list webpage…"
        />

        <button
          type="button"
          onClick={handleParseUrl}
          disabled={urlParsing || !urlToParse.trim()}
          className={`px-3 py-1.5 rounded text-sm font-semibold ${
            urlParsing || !urlToParse.trim()
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {urlParsing ? 'Parsing URL…' : 'Convert URL to CSV'}
        </button>

        {urlParseError && (
          <div className="text-sm text-red-400">{urlParseError}</div>
        )}

        {urlParsedRows.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-200">
              Parsed {urlParsedRows.length} rows from webpage. Preview of first 10:
            </p>

            <div className="overflow-x-auto border border-slate-700 rounded">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-2 py-1 text-left text-slate-100">Rank</th>
                    <th className="px-2 py-1 text-left text-slate-100">Artist</th>
                    <th className="px-2 py-1 text-left text-slate-100">Album</th>
                    <th className="px-2 py-1 text-left text-slate-100">Year</th>
                    <th className="px-2 py-1 text-left text-slate-100">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {urlPreviewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900'}
                    >
                      <td className="px-2 py-1 text-slate-100">{row.rank ?? ''}</td>
                      <td className="px-2 py-1 text-slate-100">{row.artist}</td>
                      <td className="px-2 py-1 text-slate-100">{row.album}</td>
                      <td className="px-2 py-1 text-slate-100">{row.year ?? ''}</td>
                      <td className="px-2 py-1 text-slate-100">{row.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={useParsedUrlRows}
              className="px-3 py-1.5 rounded text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Use This CSV for Import
            </button>
          </div>
        )}
      </div>

      {/* CSV UPLOAD BLOCK */}
      <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/80 shadow-sm space-y-4">
        <h2 className="font-semibold text-lg text-slate-50">Upload & Parse CSV</h2>

        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-slate-100"
            onChange={e => {
              const file = e.target.files?.[0] ?? null;
              setCsvFile(file);
              setParsedRows([]);
              setParseError(null);
              if (file) void handleParseCsv(file);
            }}
          />
          {csvFile && (
            <span className="text-xs text-slate-200">Selected: {csvFile.name}</span>
          )}
          {isParsing && (
            <span className="text-xs text-emerald-400">Parsing CSV…</span>
          )}
        </div>

        {parseError && <div className="text-sm text-red-400">{parseError}</div>}

        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-200">
              Parsed {parsedRows.length} rows. Preview of first 10:
            </p>

            <div className="overflow-x-auto border border-slate-700 rounded">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-2 py-1 text-left text-slate-100">Rank</th>
                    <th className="px-2 py-1 text-left text-slate-100">Artist</th>
                    <th className="px-2 py-1 text-left text-slate-100">Album</th>
                    <th className="px-2 py-1 text-left text-slate-100">Year</th>
                    <th className="px-2 py-1 text-left text-slate-100">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900'}
                    >
                      <td className="px-2 py-1 text-slate-100">{row.rank ?? ''}</td>
                      <td className="px-2 py-1 text-slate-100">{row.artist}</td>
                      <td className="px-2 py-1 text-slate-100">{row.album}</td>
                      <td className="px-2 py-1 text-slate-100">{row.year ?? ''}</td>
                      <td className="px-2 py-1 text-slate-100">{row.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* IMPORT BLOCK */}
      <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/80 shadow-sm space-y-3">
        <h2 className="font-semibold text-lg text-slate-50">Import & Compute Scores</h2>

        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !parsedRows.length}
            className={`px-3 py-1.5 rounded text-sm font-semibold ${
              importing || !parsedRows.length
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {importing ? 'Importing…' : 'Import rows'}
          </button>

          {importProgress && (
            <span className="text-xs text-slate-200">
              {importProgress.done} / {importProgress.total}
            </span>
          )}

          {importStatus && (
            <span className="text-xs text-slate-200">{importStatus}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center border-t border-slate-700 pt-3 mt-2">
          <button
            type="button"
            onClick={handleRunScores}
            disabled={runningScores}
            className={`px-3 py-1.5 rounded text-sm font-semibold ${
              runningScores
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {runningScores ? 'Recomputing…' : 'Recompute aggregate scores'}
          </button>

          {scoresStatus && (
            <span className="text-xs text-slate-200">{scoresStatus}</span>
          )}
        </div>
      </div>
    </div>
  );
}

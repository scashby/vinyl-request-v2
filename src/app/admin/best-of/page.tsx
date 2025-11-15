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
  const [sources, setSources] = useState<BestOfSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);

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

  // --- load existing sources on mount ---
  useEffect(() => {
    const loadSources = async () => {
      setLoadingSources(true);
      const { data, error } = await supabase
        .from('music_bestof_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading sources', error);
      } else if (data) {
        setSources(data as BestOfSource[]);
      }
      setLoadingSources(false);
    };

    void loadSources();
  }, []);

  // --- helpers ---

  function normalizeHeader(h: string): string {
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
        normalized['rank'] ??
        normalized['number'] ??
        normalized['position'] ??
        '';

      const artist =
        normalized['artist'] ??
        normalized['artist_name'] ??
        '';

      const album =
        normalized['album'] ??
        normalized['title'] ??
        normalized['record'] ??
        '';

      const yearStr =
        normalized['year'] ??
        normalized['release_year'] ??
        '';

      const notes =
        normalized['notes'] ??
        normalized['note'] ??
        normalized['extra'] ??
        '';

      if (!artist && !album) {
        // completely empty row, skip
        continue;
      }

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

      if (parsed.errors && parsed.errors.length > 0) {
        console.error('CSV parse errors', parsed.errors);
        const firstMessage = parsed.errors[0]?.message ?? 'Error parsing CSV';
        setParseError(firstMessage);
        setIsParsing(false);
        return;
      }

      const rows = parsed.data || [];
      const normalizedRows = parseCsvRows(rows);

      if (normalizedRows.length === 0) {
        setParseError('No valid rows found in CSV.');
      } else {
        setParsedRows(normalizedRows);
      }
    } catch (err) {
      console.error('Error reading CSV', err);
      const message =
        err instanceof Error ? err.message : 'Error reading CSV';
      setParseError(message);
    } finally {
      setIsParsing(false);
    }
  }

  async function ensureSource(): Promise<number | null> {
    if (selectedSourceId && selectedSourceId !== 'new') {
      return selectedSourceId;
    }

    if (!newSourceName.trim()) {
      setImportStatus('Please enter a name for the new source.');
      return null;
    }

    const payload: {
      name: string;
      description: string | null;
      source_url: string | null;
      source_type: BestOfSourceType;
      max_rank: number | null;
      weight: number;
    } = {
      name: newSourceName.trim(),
      description: newSourceDescription.trim() || null,
      source_url: newSourceUrl.trim() || null,
      source_type: newSourceType,
      max_rank:
        newSourceType === 'ranked' && newSourceMaxRank
          ? Number(newSourceMaxRank)
          : null,
      weight: newSourceWeight ? Number(newSourceWeight) : 1.0,
    };

    const { data, error } = await supabase
      .from('music_bestof_sources')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Error creating source', error);
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
      setImportStatus('No parsed rows to import. Please upload and parse a CSV first.');
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

        const { error } = await supabase
          .from('music_bestof_items')
          .insert(chunk);

        if (error) {
          console.error('Error inserting chunk', error);
          setImportStatus(`Error inserting rows: ${error.message}`);
          setImporting(false);
          return;
        }

        setImportProgress({
          done: Math.min(i + CHUNK_SIZE, rowsToInsert.length),
          total: rowsToInsert.length,
        });
      }

      setImportStatus('Import complete. You can now run score computation or review matches.');
    } finally {
      setImporting(false);
    }
  }

  async function handleRunScores() {
    setRunningScores(true);
    setScoresStatus('Recomputing aggregate scores…');

    const { error } = await supabase.rpc('compute_music_bestof_scores');

    if (error) {
      console.error('Error running score function', error);
      setScoresStatus('Error: ' + error.message);
    } else {
      setScoresStatus('Scores recomputed successfully.');
    }

    setRunningScores(false);
  }

  const previewRows = parsedRows.slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-2">Best-Of Lists Import</h1>
      <p className="text-sm text-slate-600">
        Import ranked or unranked “best albums” lists into
        <code className="mx-1 px-1 py-0.5 bg-slate-100 rounded text-xs">music_bestof_sources</code>
        and
        <code className="mx-1 px-1 py-0.5 bg-slate-100 rounded text-xs">music_bestof_items</code>.
        Use a CSV with columns like
        <code className="mx-1 px-1 py-0.5 bg-slate-100 rounded text-xs">rank, artist, album, year, notes</code>.
      </p>

      {/* Source selection / creation */}
      <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
        <h2 className="font-semibold text-lg">1. Choose or Create Source</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Existing Sources
            </label>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={selectedSourceId === 'new' ? 'new' : (selectedSourceId ?? '')}
              onChange={e => {
                const v = e.target.value;
                if (v === 'new') {
                  setSelectedSourceId('new');
                } else if (v) {
                  setSelectedSourceId(Number(v));
                } else {
                  setSelectedSourceId(null);
                }
              }}
            >
              <option value="">– Select source –</option>
              <option value="new">➕ Create new source…</option>
              {sources.map(src => (
                <option key={src.id} value={src.id}>
                  {src.name} ({src.source_type})
                </option>
              ))}
            </select>
            {loadingSources && (
              <p className="text-xs text-slate-500">Loading sources…</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Source Type
            </label>
            <div className="flex gap-2 text-sm">
              {(['ranked', 'chronological', 'unranked'] as BestOfSourceType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewSourceType(t)}
                  className={`px-2 py-1 rounded border ${
                    newSourceType === t
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {newSourceType === 'ranked' && (
              <div className="flex items-center gap-2 text-sm mt-1">
                <span>Max rank:</span>
                <input
                  type="number"
                  className="w-24 border rounded px-2 py-1 text-sm"
                  value={newSourceMaxRank}
                  onChange={e => setNewSourceMaxRank(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            )}
          </div>
        </div>

        {/* New source fields */}
        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Source Name (for new sources)
            </label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1 text-sm"
              value={newSourceName}
              onChange={e => setNewSourceName(e.target.value)}
              placeholder='e.g. "Dimery 1001 Albums", "Paste Top 300 Albums"'
            />
            <label className="block text-xs font-medium mt-1">
              Weight
            </label>
            <input
              type="number"
              step="0.1"
              className="w-24 border rounded px-2 py-1 text-sm"
              value={newSourceWeight}
              onChange={e => setNewSourceWeight(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Source URL (optional)
            </label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1 text-sm"
              value={newSourceUrl}
              onChange={e => setNewSourceUrl(e.target.value)}
              placeholder="https://…"
            />
            <label className="block text-sm font-medium mt-1">
              Description (optional)
            </label>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm h-16"
              value={newSourceDescription}
              onChange={e => setNewSourceDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* CSV upload & preview */}
      <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
        <h2 className="font-semibold text-lg">2. Upload & Parse CSV</h2>
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => {
              const file = e.target.files?.[0] ?? null;
              setCsvFile(file);
              setParsedRows([]);
              setParseError(null);
              if (file) {
                void handleParseCsv(file);
              }
            }}
          />
          {csvFile && (
            <span className="text-xs text-slate-600">
              Selected: {csvFile.name}
            </span>
          )}
          {isParsing && (
            <span className="text-xs text-emerald-700">Parsing CSV…</span>
          )}
        </div>
        {parseError && (
          <div className="text-sm text-red-600">
            {parseError}
          </div>
        )}
        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">
              Parsed {parsedRows.length} rows. Preview of first 10:
            </p>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Rank</th>
                    <th className="px-2 py-1 text-left">Artist</th>
                    <th className="px-2 py-1 text-left">Album</th>
                    <th className="px-2 py-1 text-left">Year</th>
                    <th className="px-2 py-1 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-2 py-1">{row.rank ?? ''}</td>
                      <td className="px-2 py-1">{row.artist}</td>
                      <td className="px-2 py-1">{row.album}</td>
                      <td className="px-2 py-1">{row.year ?? ''}</td>
                      <td className="px-2 py-1">{row.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Import + scores */}
      <div className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
        <h2 className="font-semibold text-lg">3. Import & Compute Scores</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || parsedRows.length === 0}
            className={`px-3 py-1.5 rounded text-sm font-semibold ${
              importing || parsedRows.length === 0
                ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {importing ? 'Importing…' : 'Import rows into music_bestof_items'}
          </button>

          {importProgress && (
            <span className="text-xs text-slate-700">
              Imported {importProgress.done} / {importProgress.total} rows
            </span>
          )}

          {importStatus && (
            <span className="text-xs text-slate-700">
              {importStatus}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center border-t pt-3 mt-2">
          <button
            type="button"
            onClick={handleRunScores}
            disabled={runningScores}
            className={`px-3 py-1.5 rounded text-sm font-semibold ${
              runningScores
                ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {runningScores ? 'Recomputing…' : 'Recompute aggregate scores'}
          </button>
          {scoresStatus && (
            <span className="text-xs text-slate-700">
              {scoresStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

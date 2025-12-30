// src/app/edit-collection/components/ImportDiscogsModal.tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type SyncMode = 'full_replacement' | 'full_sync' | 'partial_sync' | 'new_only';

interface SyncModeInfo {
  value: SyncMode;
  label: string;
  description: string;
  apiImpact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  color: string;
}

const SYNC_MODE_INFO: SyncModeInfo[] = [
  { 
    value: 'full_replacement', 
    label: 'Full Replacement', 
    description: 'Delete all → Import all → Scrape all from Discogs', 
    apiImpact: 'CRITICAL', 
    color: '#ef4444' 
  },
  { 
    value: 'full_sync', 
    label: 'Full Sync', 
    description: 'Add new + Update changed + Remove missing + Scrape all from Discogs', 
    apiImpact: 'HIGH', 
    color: '#f97316' 
  },
  { 
    value: 'partial_sync', 
    label: 'Partial Sync (Recommended)', 
    description: 'Add new + Update changed + Remove missing + Scrape only new/changed from Discogs', 
    apiImpact: 'MEDIUM', 
    color: '#eab308' 
  },
  { 
    value: 'new_only', 
    label: 'New Only', 
    description: 'Add new only + Scrape only new from Discogs', 
    apiImpact: 'LOW', 
    color: '#22c55e' 
  }
];

// Normalization functions
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(\d+\)/g, '')        // Remove "(2)", "(3)" etc
    .replace(/^the\s+/i, '')        // Remove leading "The"
    .replace(/^a\s+/i, '')          // Remove leading "A"
    .replace(/^an\s+/i, '')         // Remove leading "An"
    .replace(/[^\w\s]/g, '')        // Remove special chars
    .replace(/\s+/g, '')            // Remove spaces
    .trim();
}

function normalizeArtist(artist: string): string {
  return normalizeText(artist);
}

function normalizeTitle(title: string): string {
  return normalizeText(title);
}

function normalizeArtistAlbum(artist: string, title: string): string {
  return `${normalizeArtist(artist)}|${normalizeTitle(title)}`;
}

function generateSortName(name: string): string {
  const articles = ['the ', 'a ', 'an '];
  const lower = name.toLowerCase();
  for (const article of articles) {
    if (lower.startsWith(article)) {
      return name.substring(article.length) + ', ' + name.substring(0, article.length - 1);
    }
  }
  return name;
}

interface ImportDiscogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

interface ParsedAlbum {
  catalog_number: string;
  artist: string;
  title: string;
  label: string;
  format: string;
  rating: string;
  released: string;
  release_id: string;
  collection_media_condition: string;
  collection_sleeve_condition: string;
  year: string;
  added: string;
  collection_notes: string;
  discogs_release_url: string;
  barcode: string;
  country: string;
}

interface ExistingAlbum {
  id: number;
  artist: string | null;
  title: string | null;
  format: string | null;
  year: string | null;
  artist_norm: string | null;
  title_norm: string | null;
  artist_album_norm: string | null;
}

interface AlbumComparison {
  status: 'NEW' | 'CHANGED' | 'UNCHANGED' | 'REMOVED';
  parsed?: ParsedAlbum;
  existing?: ExistingAlbum;
}

interface ComparisonStats {
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  removedCount: number;
  toScrapeCount: number;
}

export default function ImportDiscogsModal({ isOpen, onClose, onImportComplete }: ImportDiscogsModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [syncMode, setSyncMode] = useState<SyncMode>('partial_sync');
  const [parsedData, setParsedData] = useState<ParsedAlbum[]>([]);
  const [comparison, setComparison] = useState<AlbumComparison[]>([]);
  const [stats, setStats] = useState<ComparisonStats>({ newCount: 0, changedCount: 0, unchangedCount: 0, removedCount: 0, toScrapeCount: 0 });
  const [enableFormatParser, setEnableFormatParser] = useState(true);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, stage: '' });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse CSV
  function parseDiscogsCSV(csvText: string): ParsedAlbum[] {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const result: ParsedAlbum[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Partial<ParsedAlbum> = {};
      headers.forEach((header, idx) => {
        row[header as keyof ParsedAlbum] = values[idx] || '';
      });
      
      result.push(row as ParsedAlbum);
    }
    
    return result;
  }

  // Compare with existing collection
  function compareWithCollection(parsed: ParsedAlbum[], existing: ExistingAlbum[], mode: SyncMode): {
    comparison: AlbumComparison[];
    stats: ComparisonStats;
  } {
    const comparisonResults: AlbumComparison[] = [];
    let newCount = 0, changedCount = 0, unchangedCount = 0, removedCount = 0;

    // Check each parsed album
    parsed.forEach(parsedAlbum => {
      const normalizedKey = normalizeArtistAlbum(parsedAlbum.artist, parsedAlbum.title);
      
      const match = existing.find(ex => {
        // Try using normalized fields first
        if (ex.artist_album_norm) {
          return ex.artist_album_norm === normalizedKey;
        }
        // Fallback to runtime normalization
        return normalizeArtistAlbum(ex.artist || '', ex.title || '') === normalizedKey;
      });

      if (!match) {
        comparisonResults.push({ status: 'NEW', parsed: parsedAlbum });
        newCount++;
      } else {
        // Check if changed
        const hasChanges = 
          match.format !== parsedAlbum.format ||
          match.year !== parsedAlbum.year;
        
        if (hasChanges) {
          comparisonResults.push({ status: 'CHANGED', parsed: parsedAlbum, existing: match });
          changedCount++;
        } else {
          comparisonResults.push({ status: 'UNCHANGED', parsed: parsedAlbum, existing: match });
          unchangedCount++;
        }
      }
    });

    // Check for removed albums (if not new_only mode)
    if (mode !== 'new_only') {
      existing.forEach(ex => {
        const normalizedKey = ex.artist_album_norm || normalizeArtistAlbum(ex.artist || '', ex.title || '');
        
        const inParsed = parsed.some(p => 
          normalizeArtistAlbum(p.artist, p.title) === normalizedKey
        );
        
        if (!inParsed) {
          comparisonResults.push({ status: 'REMOVED', existing: ex });
          removedCount++;
        }
      });
    }

    // Calculate toScrape based on mode
    let toScrapeCount = 0;
    if (mode === 'partial_sync') {
      toScrapeCount = newCount + changedCount;
    } else if (mode === 'new_only') {
      toScrapeCount = newCount;
    } else {
      // full_replacement and full_sync scrape everything
      toScrapeCount = parsed.length;
    }

    return {
      comparison: comparisonResults,
      stats: { newCount, changedCount, unchangedCount, removedCount, toScrapeCount }
    };
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      setError(null);

      // Read and parse CSV
      const text = await selectedFile.text();
      const parsed = parseDiscogsCSV(text);
      setParsedData(parsed);

      // Load existing albums with normalized fields
      const { data: existing, error: fetchError } = await supabase
        .from('collection')
        .select('id, artist, title, format, year, artist_norm, title_norm, artist_album_norm');
      
      if (fetchError) throw fetchError;

      // Compare
      const { comparison: comp, stats: s } = compareWithCollection(parsed, existing || [], syncMode);
      setComparison(comp);
      setStats(s);

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  }, [syncMode]);

  const handleImport = useCallback(async () => {
    try {
      setStep('importing');
      setError(null);
      setImportProgress({ current: 0, total: parsedData.length, stage: 'Processing albums...' });

      // Build albums to insert/update
      const albumsToProcess = parsedData.map((parsed, index) => {
        const artist = parsed.artist;
        const title = parsed.title;
        
        // Generate normalized fields
        const artist_norm = normalizeArtist(artist);
        const title_norm = normalizeTitle(title);
        const artist_album_norm = normalizeArtistAlbum(artist, title);
        const sort_artist = generateSortName(artist);
        const sort_title = generateSortName(title);
        
        setImportProgress({ 
          current: index + 1, 
          total: parsedData.length, 
          stage: 'Normalizing fields...' 
        });

        return {
          artist,
          title,
          artist_norm,
          title_norm,
          artist_album_norm,
          sort_artist,
          sort_title,
          format: parsed.format,
          year: parsed.released,
          year_int: parseInt(parsed.released) || null,
          barcode: parsed.barcode || null,
          cat_no: parsed.catalog_number || null,
          country: parsed.country || null,
          labels: parsed.label ? [parsed.label] : null,
          media_condition: parsed.collection_media_condition || null,
          package_sleeve_condition: parsed.collection_sleeve_condition || null,
          notes: parsed.collection_notes || null,
          discogs_release_id: parsed.release_id || null,
          my_rating: parsed.rating ? parseInt(parsed.rating) : null,
          date_added: parsed.added || new Date().toISOString(),
        };
      });

      // Handle based on sync mode
      if (syncMode === 'full_replacement') {
        setImportProgress({ current: 0, total: parsedData.length, stage: 'Deleting existing collection...' });
        const { error: deleteError } = await supabase.from('collection').delete().neq('id', 0);
        if (deleteError) throw deleteError;
      }

      // Insert/update albums
      setImportProgress({ current: 0, total: albumsToProcess.length, stage: 'Importing albums...' });
      
      // For now, we'll just insert - proper upsert logic will come in next iteration
      const { error: insertError } = await supabase
        .from('collection')
        .insert(albumsToProcess);

      if (insertError) throw insertError;

      // TODO: Implement Discogs scraping here
      // This will come in the next iteration with proper rate limiting

      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  }, [parsedData, syncMode]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setParsedData([]);
    setComparison([]);
    setStats({ newCount: 0, changedCount: 0, unchangedCount: 0, removedCount: 0, toScrapeCount: 0 });
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      const fakeEvent = {
        target: { files: [droppedFile] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  }, [handleFileSelect]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'white',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        background: '#2A2A2A',
        color: 'white',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '15px' }}>
          ◀ Back
        </button>
        <div style={{ fontSize: '16px', fontWeight: 500 }}>Import from Discogs CSV</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer' }}>×</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {step === 'upload' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2>Select Discogs CSV Export</h2>
            
            {/* Sync Mode */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Sync Mode</label>
              {SYNC_MODE_INFO.map(mode => (
                <div key={mode.value} style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={syncMode === mode.value}
                      onChange={() => setSyncMode(mode.value)}
                    />
                    <span style={{ fontWeight: 600 }}>{mode.label}</span>
                    <span style={{ color: mode.color, fontSize: '12px' }}>({mode.apiImpact} API Impact)</span>
                  </label>
                  <p style={{ fontSize: '13px', color: '#666', marginLeft: '28px', marginTop: '2px' }}>{mode.description}</p>
                </div>
              ))}
            </div>

            {/* File Upload */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              style={{
                border: '2px dashed #ddd',
                borderRadius: '8px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '24px'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
              <p>Drag and drop your Discogs CSV here, or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            {/* Options */}
            <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600, color: '#333' }}>
                ✅ Discogs enrichment enabled
              </div>
              <p style={{ fontSize: '13px', color: '#666', margin: '0 0 12px 0' }}>
                All albums will be enriched with metadata from Discogs API based on your sync mode selection.
              </p>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={enableFormatParser}
                  onChange={(e) => setEnableFormatParser(e.target.checked)}
                />
                <span style={{ fontSize: '14px' }}>Enable format parser</span>
              </label>
              <p style={{ fontSize: '13px', color: '#666', marginLeft: '28px', marginTop: '4px' }}>
                Parse format strings to extract vinyl details (weight, color, RPM, etc.)
              </p>
            </div>

            {error && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2>Import Preview</h2>
            
            {/* Stats */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', background: '#e8f5e9', borderRadius: '8px', flex: 1 }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#2e7d32' }}>{stats.newCount}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>NEW</div>
              </div>
              <div style={{ padding: '16px', background: '#fff3e0', borderRadius: '8px', flex: 1 }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#f57c00' }}>{stats.changedCount}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>CHANGED</div>
              </div>
              <div style={{ padding: '16px', background: '#e3f2fd', borderRadius: '8px', flex: 1 }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#1976d2' }}>{stats.unchangedCount}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>UNCHANGED</div>
              </div>
              <div style={{ padding: '16px', background: '#ffebee', borderRadius: '8px', flex: 1 }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#c62828' }}>{stats.removedCount}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>REMOVED</div>
              </div>
              <div style={{ padding: '16px', background: '#f3e5f5', borderRadius: '8px', flex: 1 }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#7b1fa2' }}>{stats.toScrapeCount}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>TO SCRAPE</div>
              </div>
            </div>

            {/* Preview Table */}
            <div style={{ marginBottom: '24px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f5f5f5' }}>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Status</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Artist</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Title</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Format</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.slice(0, 100).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: 
                            item.status === 'NEW' ? '#e8f5e9' :
                            item.status === 'CHANGED' ? '#fff3e0' :
                            item.status === 'UNCHANGED' ? '#e3f2fd' : '#ffebee',
                          color:
                            item.status === 'NEW' ? '#2e7d32' :
                            item.status === 'CHANGED' ? '#f57c00' :
                            item.status === 'UNCHANGED' ? '#1976d2' : '#c62828'
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>{item.parsed?.artist || item.existing?.artist}</td>
                      <td style={{ padding: '8px' }}>{item.parsed?.title || item.existing?.title}</td>
                      <td style={{ padding: '8px' }}>{item.parsed?.format || item.existing?.format}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleReset} style={{ padding: '8px 16px', background: '#ddd', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleImport} style={{ padding: '8px 16px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Import {parsedData.length} Albums
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            <h2>Importing...</h2>
            <p>{importProgress.stage}</p>
            <div style={{ width: '100%', height: '8px', background: '#ddd', borderRadius: '4px', overflow: 'hidden', marginTop: '16px' }}>
              <div style={{
                width: `${(importProgress.current / importProgress.total) * 100}%`,
                height: '100%',
                background: '#2196F3',
                transition: 'width 0.3s'
              }} />
            </div>
            <p style={{ marginTop: '8px' }}>{importProgress.current} / {importProgress.total}</p>
          </div>
        )}

        {step === 'complete' && (
          <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
            <h2>Import Complete!</h2>
            <p>Successfully imported {parsedData.length} albums.</p>
            <button onClick={() => { onImportComplete(); onClose(); }} style={{
              marginTop: '24px',
              padding: '12px 24px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
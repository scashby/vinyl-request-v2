// src/app/edit-collection/components/ImportDiscogsModal.tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import styles from '../EditCollection.module.css';

type SyncMode = 'full_replacement' | 'full_sync' | 'partial_sync' | 'new_only';

interface SyncModeInfo {
  value: SyncMode;
  label: string;
  description: string;
  apiImpact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const SYNC_MODE_INFO: SyncModeInfo[] = [
  { 
    value: 'full_replacement', 
    label: 'Full Replacement', 
    description: 'Delete all → Import all → Scrape all from Discogs', 
    apiImpact: 'CRITICAL'
  },
  { 
    value: 'full_sync', 
    label: 'Full Sync', 
    description: 'Add new + Update changed + Remove missing + Scrape all from Discogs', 
    apiImpact: 'HIGH'
  },
  { 
    value: 'partial_sync', 
    label: 'Partial Sync (Recommended)', 
    description: 'Add new + Update changed + Remove missing + Scrape only new/changed from Discogs', 
    apiImpact: 'MEDIUM'
  },
  { 
    value: 'new_only', 
    label: 'New Only', 
    description: 'Add new only + Scrape only new from Discogs', 
    apiImpact: 'LOW'
  }
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(\d+\)/g, '')
    .replace(/^the\s+/i, '')
    .replace(/^a\s+/i, '')
    .replace(/^an\s+/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '')
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

  function compareWithCollection(parsed: ParsedAlbum[], existing: ExistingAlbum[], mode: SyncMode): {
    comparison: AlbumComparison[];
    stats: ComparisonStats;
  } {
    const comparisonResults: AlbumComparison[] = [];
    let newCount = 0, changedCount = 0, unchangedCount = 0, removedCount = 0;

    parsed.forEach(parsedAlbum => {
      const normalizedKey = normalizeArtistAlbum(parsedAlbum.artist, parsedAlbum.title);
      
      const match = existing.find(ex => {
        if (ex.artist_album_norm) {
          return ex.artist_album_norm === normalizedKey;
        }
        return normalizeArtistAlbum(ex.artist || '', ex.title || '') === normalizedKey;
      });

      if (!match) {
        comparisonResults.push({ status: 'NEW', parsed: parsedAlbum });
        newCount++;
      } else {
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

    let toScrapeCount = 0;
    if (mode === 'partial_sync') {
      toScrapeCount = newCount + changedCount;
    } else if (mode === 'new_only') {
      toScrapeCount = newCount;
    } else {
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

      const text = await selectedFile.text();
      const parsed = parseDiscogsCSV(text);
      setParsedData(parsed);

      const { data: existing, error: fetchError } = await supabase
        .from('collection')
        .select('id, artist, title, format, year, artist_norm, title_norm, artist_album_norm');
      
      if (fetchError) throw fetchError;

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

      const albumsToProcess = parsedData.map((parsed, index) => {
        const artist = parsed.artist;
        const title = parsed.title;
        
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

      if (syncMode === 'full_replacement') {
        setImportProgress({ current: 0, total: parsedData.length, stage: 'Deleting existing collection...' });
        const { error: deleteError } = await supabase.from('collection').delete().neq('id', 0);
        if (deleteError) throw deleteError;
      }

      setImportProgress({ current: 0, total: albumsToProcess.length, stage: 'Importing albums...' });
      
      const { error: insertError } = await supabase
        .from('collection')
        .insert(albumsToProcess);

      if (insertError) throw insertError;

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

  const getImpactClass = (impact: string) => {
    switch (impact) {
      case 'CRITICAL': return styles.impactCritical;
      case 'HIGH': return styles.impactHigh;
      case 'MEDIUM': return styles.impactMedium;
      case 'LOW': return styles.impactLow;
      default: return '';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'NEW': return styles.importStatusNew;
      case 'CHANGED': return styles.importStatusChanged;
      case 'UNCHANGED': return styles.importStatusUnchanged;
      case 'REMOVED': return styles.importStatusRemoved;
      default: return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.importModalContainer}>
      <div className={styles.importModalHeader}>
        <div className={styles.importModalHeaderLeft}>
          <button onClick={onClose} className={styles.importModalBackButton}>◀ Back</button>
          <div className={styles.importModalTitle}>Import from Discogs CSV</div>
        </div>
        <button onClick={onClose} className={styles.importModalCloseButton}>×</button>
      </div>

      <div className={styles.importModalContent}>
        {step === 'upload' && (
          <div className={styles.importModalInner}>
            <h2 className={styles.importModalH2}>Select Discogs CSV Export</h2>
            
            <div className={styles.importSyncModeSection}>
              <label className={styles.importSyncModeLabel}>Sync Mode</label>
              <div className={styles.importSyncModeOptions}>
                {SYNC_MODE_INFO.map(mode => (
                  <div 
                    key={mode.value} 
                    className={syncMode === mode.value ? styles.importSyncModeOptionSelected : styles.importSyncModeOption}
                    onClick={() => setSyncMode(mode.value)}
                  >
                    <div className={styles.importSyncModeOptionTop}>
                      <input
                        type="radio"
                        checked={syncMode === mode.value}
                        onChange={() => setSyncMode(mode.value)}
                        className={styles.importSyncModeRadio}
                      />
                      <span className={styles.importSyncModeOptionName}>{mode.label}</span>
                      <span className={`${styles.importSyncModeImpact} ${getImpactClass(mode.apiImpact)}`}>
                        {mode.apiImpact} API Impact
                      </span>
                    </div>
                    <p className={styles.importSyncModeDescription}>{mode.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={styles.importDropzone}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className={styles.importDropzoneIcon}>📄</div>
              <p className={styles.importDropzoneText}>Drag and drop your Discogs CSV here, or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className={styles.importFileInput}
              />
            </div>

            <div className={styles.importEnrichSection}>
              <div className={styles.importEnrichTitle}>
                <span>✅</span>
                <span>Discogs enrichment enabled</span>
              </div>
              <p className={styles.importEnrichDescription}>
                All albums will be enriched with metadata from Discogs API based on your sync mode selection.
              </p>
              
              <label className={styles.importCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={enableFormatParser}
                  onChange={(e) => setEnableFormatParser(e.target.checked)}
                />
                <span className={styles.importCheckboxText}>Enable format parser</span>
              </label>
              <p className={styles.importCheckboxDescription}>
                Parse format strings to extract vinyl details (weight, color, RPM, etc.)
              </p>
            </div>

            {error && <div className={styles.importError}>{error}</div>}
          </div>
        )}

        {step === 'preview' && (
          <div className={styles.importModalInner}>
            <h2 className={styles.importModalH2}>Import Preview</h2>
            
            <div className={styles.importPreviewStats}>
              <div className={styles.importPreviewStat}>
                <div className={styles.importPreviewStatValue}>{stats.newCount}</div>
                <div className={styles.importPreviewStatLabel}>NEW</div>
              </div>
              <div className={styles.importPreviewStat}>
                <div className={styles.importPreviewStatValue}>{stats.changedCount}</div>
                <div className={styles.importPreviewStatLabel}>CHANGED</div>
              </div>
              <div className={styles.importPreviewStat}>
                <div className={styles.importPreviewStatValue}>{stats.unchangedCount}</div>
                <div className={styles.importPreviewStatLabel}>UNCHANGED</div>
              </div>
              <div className={styles.importPreviewStat}>
                <div className={styles.importPreviewStatValue}>{stats.removedCount}</div>
                <div className={styles.importPreviewStatLabel}>REMOVED</div>
              </div>
              <div className={styles.importPreviewStat}>
                <div className={styles.importPreviewStatValue}>{stats.toScrapeCount}</div>
                <div className={styles.importPreviewStatLabel}>TO SCRAPE</div>
              </div>
            </div>

            <div className={styles.importPreviewTableContainer}>
              <table className={styles.importPreviewTable}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Artist</th>
                    <th>Title</th>
                    <th>Format</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.slice(0, 100).map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`${styles.importStatusBadge} ${getStatusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{item.parsed?.artist || item.existing?.artist}</td>
                      <td>{item.parsed?.title || item.existing?.title}</td>
                      <td>{item.parsed?.format || item.existing?.format}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.importButtonContainer}>
              <button onClick={handleReset} className={styles.importCancelButton}>Cancel</button>
              <button onClick={handleImport} className={styles.importConfirmButton}>
                Import {parsedData.length} Albums
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className={styles.importProgressContainer}>
            <div className={styles.importProgressIcon}>⏳</div>
            <h2 className={styles.importModalH2}>Importing...</h2>
            <p className={styles.importProgressStage}>{importProgress.stage}</p>
            <div className={styles.importProgressBar}>
              <div 
                className={styles.importProgressBarFill}
              />
            </div>
            <p className={styles.importProgressText}>
              {importProgress.current} / {importProgress.total}
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div className={styles.importCompleteContainer}>
            <div className={styles.importCompleteIcon}>✅</div>
            <h2 className={styles.importModalH2}>Import Complete!</h2>
            <p className={styles.importCompleteText}>
              Successfully imported {parsedData.length} albums.
            </p>
            <button 
              onClick={() => { onImportComplete(); onClose(); }} 
              className={styles.importDoneButton}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
// src/app/edit-collection/components/ImportDiscogsModal.tsx
'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { parseDiscogsFormat } from '../../../lib/formatParser';

type SyncMode = 'full_replacement' | 'full_sync' | 'partial_sync' | 'new_only';
type ImportStage = 'upload' | 'preview' | 'importing' | 'complete';
type AlbumStatus = 'NEW' | 'CHANGED' | 'UNCHANGED' | 'REMOVED';

interface ParsedAlbum {
  artist: string;
  title: string;
  format: string;
  labels: string[];
  cat_no: string | null;
  barcode: string | null;
  country: string | null;
  year: string | null;
  discogs_release_id: string;
  discogs_master_id: string | null;
  artist_norm: string;
  title_norm: string;
  artist_album_norm: string;
  album_norm: string;
}

interface ExistingAlbum {
  id: number;
  artist: string;
  title: string;
  artist_norm: string;
  title_norm: string;
  artist_album_norm: string;
  discogs_release_id: string | null;
  image_url: string | null;
  tracks: unknown[] | null;
  discogs_genres: string[] | null;
  packaging: string | null;
}

interface ComparedAlbum extends ParsedAlbum {
  status: AlbumStatus;
  existingId?: number;
  needsEnrichment: boolean;
  missingFields: string[];
}

interface ImportDiscogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

// Normalization functions
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/^the\s+/i, '')
    .replace(/^a\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizeArtist(artist: string): string {
  return normalizeText(artist);
}

function normalizeTitle(title: string): string {
  return normalizeText(title);
}

function normalizeArtistAlbum(artist: string, title: string): string {
  return normalizeArtist(artist) + normalizeTitle(title);
}

// CSV parsing
function parseDiscogsCSV(csvText: string): ParsedAlbum[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const albums: ParsedAlbum[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV with quotes
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    const artist = row['Artist'] || row['artist'] || '';
    const title = row['Title'] || row['title'] || '';
    
    if (!artist || !title) continue;

    const labelsText = row['Label'] || row['label'] || '';
    const labels = labelsText ? labelsText.split(',').map(l => l.trim()) : [];

    const album: ParsedAlbum = {
      artist,
      title,
      format: row['Format'] || row['format'] || '',
      labels,
      cat_no: row['Catalog #'] || row['catalog'] || row['cat_no'] || null,
      barcode: row['Barcode'] || row['barcode'] || null,
      country: row['Country'] || row['country'] || null,
      year: row['Released'] || row['Year'] || row['year'] || null,
      discogs_release_id: row['Release ID'] || row['release_id'] || row['discogs_release_id'] || '',
      discogs_master_id: row['Master ID'] || row['master_id'] || row['discogs_master_id'] || null,
      artist_norm: normalizeArtist(artist),
      title_norm: normalizeTitle(title),
      artist_album_norm: normalizeArtistAlbum(artist, title),
      album_norm: normalizeTitle(title),
    };

    albums.push(album);
  }

  return albums;
}

// Compare albums
function compareAlbums(
  parsed: ParsedAlbum[],
  existing: ExistingAlbum[]
): ComparedAlbum[] {
  const existingMap = new Map<string, ExistingAlbum>();
  existing.forEach(album => {
    existingMap.set(album.artist_album_norm, album);
  });

  const compared: ComparedAlbum[] = [];

  // Check parsed albums
  for (const parsedAlbum of parsed) {
    const existingAlbum = existingMap.get(parsedAlbum.artist_album_norm);

    if (!existingAlbum) {
      // NEW album
      compared.push({
        ...parsedAlbum,
        status: 'NEW',
        needsEnrichment: true,
        missingFields: ['all'],
      });
    } else {
      // Exists - check what's missing
      const missingFields: string[] = [];
      
      if (!existingAlbum.image_url) missingFields.push('image_url');
      if (!existingAlbum.tracks || existingAlbum.tracks.length === 0) missingFields.push('tracks');
      if (!existingAlbum.discogs_genres || existingAlbum.discogs_genres.length === 0) missingFields.push('genres');
      if (!existingAlbum.packaging) missingFields.push('packaging');

      const isChanged = parsedAlbum.discogs_release_id !== existingAlbum.discogs_release_id;

      compared.push({
        ...parsedAlbum,
        status: isChanged || missingFields.length > 0 ? 'CHANGED' : 'UNCHANGED',
        existingId: existingAlbum.id,
        needsEnrichment: missingFields.length > 0,
        missingFields,
      });

      existingMap.delete(parsedAlbum.artist_album_norm);
    }
  }

  // Remaining in database but not in CSV = REMOVED
  for (const [, existingAlbum] of existingMap) {
    compared.push({
      artist: existingAlbum.artist,
      title: existingAlbum.title,
      format: '',
      labels: [],
      cat_no: null,
      barcode: null,
      country: null,
      year: null,
      discogs_release_id: existingAlbum.discogs_release_id || '',
      discogs_master_id: null,
      artist_norm: existingAlbum.artist_norm,
      title_norm: existingAlbum.title_norm,
      artist_album_norm: existingAlbum.artist_album_norm,
      album_norm: existingAlbum.title_norm,
      status: 'REMOVED',
      existingId: existingAlbum.id,
      needsEnrichment: false,
      missingFields: [],
    });
  }

  return compared;
}

// Discogs API enrichment
async function enrichFromDiscogs(releaseId: string): Promise<Record<string, unknown>> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting

  const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
    headers: {
      'User-Agent': 'DeadWaxDialogues/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Discogs API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract data
  const enriched: Record<string, unknown> = {
    image_url: data.images?.[0]?.uri || null,
    back_image_url: data.images?.[1]?.uri || null,
    discogs_genres: data.genres || [],
    discogs_styles: data.styles || [],
    packaging: data.formats?.[0]?.descriptions?.find((d: string) => 
      ['Gatefold', 'Single Sleeve', 'Digipak'].some(p => d.includes(p))
    ) || null,
  };

  // Extract tracks
  if (data.tracklist && Array.isArray(data.tracklist)) {
    const tracks: unknown[] = [];
    let position = 1;

    data.tracklist.forEach((track: {
      position?: string;
      title?: string;
      duration?: string;
      artists?: { name: string }[];
      type_?: string;
    }) => {
      const positionStr = track.position || '';
      let discNumber = 1;
      let side = '';
      let trackPosition = position;

      // Parse position
      const sideMatch = positionStr.match(/^([A-Z])(\d+)?/);
      if (sideMatch) {
        side = sideMatch[1];
        trackPosition = parseInt(sideMatch[2] || '1');
        discNumber = Math.ceil((side.charCodeAt(0) - 64) / 2);
      } else {
        const discMatch = positionStr.match(/^(\d+)-(\d+)?/);
        if (discMatch) {
          discNumber = parseInt(discMatch[1]);
          trackPosition = parseInt(discMatch[2] || position.toString());
        }
      }

      const isHeader = track.type_ === 'heading';

      tracks.push({
        position: trackPosition.toString(),
        title: track.title || '',
        artist: track.artists?.[0]?.name || null,
        duration: track.duration || null,
        type: isHeader ? 'header' : 'track',
        disc_number: discNumber,
        side: side || undefined,
      });

      position++;
    });

    enriched.tracks = tracks;
  }

  // Extract credits
  const engineers: string[] = [];
  const producers: string[] = [];
  const songwriters: string[] = [];

  if (data.extraartists && Array.isArray(data.extraartists)) {
    data.extraartists.forEach((artist: { name: string; role: string }) => {
      const role = artist.role.toLowerCase();
      if (role.includes('engineer')) engineers.push(artist.name);
      if (role.includes('producer')) producers.push(artist.name);
      if (role.includes('written-by') || role.includes('songwriter')) songwriters.push(artist.name);
    });
  }

  if (engineers.length > 0) enriched.engineers = engineers;
  if (producers.length > 0) enriched.producers = producers;
  if (songwriters.length > 0) enriched.songwriters = songwriters;

  return enriched;
}

export default function ImportDiscogsModal({ isOpen, onClose, onImportComplete }: ImportDiscogsModalProps) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [syncMode, setSyncMode] = useState<SyncMode>('partial_sync');
  const [file, setFile] = useState<File | null>(null);
  
  const [comparedAlbums, setComparedAlbums] = useState<ComparedAlbum[]>([]);
  
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [error, setError] = useState<string | null>(null);
  
  const [results, setResults] = useState({
    added: 0,
    updated: 0,
    removed: 0,
    unchanged: 0,
    errors: 0,
  });

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleParseCSV = async () => {
    if (!file) return;

    try {
      setError(null);
      const text = await file.text();
      const parsed = parseDiscogsCSV(text);

      if (parsed.length === 0) {
        setError('No albums found in CSV file');
        return;
      }

      // Load existing collection
      const { data: existing, error: dbError } = await supabase
        .from('collection')
        .select('id, artist, title, artist_norm, title_norm, artist_album_norm, discogs_release_id, image_url, tracks, discogs_genres, packaging');

      if (dbError) {
        setError(`Database error: ${dbError.message}`);
        return;
      }

      // Compare
      const compared = compareAlbums(parsed, existing as ExistingAlbum[]);
      setComparedAlbums(compared);
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  };

  const handleStartImport = async () => {
    setStage('importing');
    setError(null);

    try {
      let albumsToProcess: ComparedAlbum[] = [];

      // Determine what to process based on sync mode
      if (syncMode === 'full_replacement') {
        // Delete everything, process all
        await supabase.from('collection').delete().neq('id', 0);
        albumsToProcess = comparedAlbums.filter(a => a.status !== 'REMOVED');
      } else if (syncMode === 'full_sync') {
        // Process all CSV albums (scrape missing/changed data), delete REMOVED
        const removed = comparedAlbums.filter(a => a.status === 'REMOVED');
        if (removed.length > 0) {
          await supabase.from('collection').delete().in('id', removed.map(a => a.existingId!));
        }
        albumsToProcess = comparedAlbums.filter(a => a.status !== 'REMOVED');
      } else if (syncMode === 'partial_sync') {
        // Only NEW and CHANGED
        albumsToProcess = comparedAlbums.filter(a => 
          a.status === 'NEW' || (a.status === 'CHANGED' && a.needsEnrichment)
        );
      } else if (syncMode === 'new_only') {
        // Only NEW
        albumsToProcess = comparedAlbums.filter(a => a.status === 'NEW');
      }

      setProgress({ current: 0, total: albumsToProcess.length, status: 'Processing...' });

      const resultCounts = {
        added: 0,
        updated: 0,
        removed: syncMode === 'full_sync' ? comparedAlbums.filter(a => a.status === 'REMOVED').length : 0,
        unchanged: 0,
        errors: 0,
      };

      // Process in batches of 25
      const batchSize = 25;
      for (let i = 0; i < albumsToProcess.length; i += batchSize) {
        const batch = albumsToProcess.slice(i, i + batchSize);

        for (const album of batch) {
          setProgress({
            current: i + batch.indexOf(album) + 1,
            total: albumsToProcess.length,
            status: `Processing ${album.artist} - ${album.title}`,
          });

          try {
            // Base album data
            const albumData: Record<string, unknown> = {
              artist: album.artist,
              title: album.title,
              format: album.format,
              labels: album.labels,
              cat_no: album.cat_no,
              barcode: album.barcode,
              country: album.country,
              year: album.year,
              year_int: album.year ? parseInt(album.year) : null,
              discogs_release_id: album.discogs_release_id,
              discogs_master_id: album.discogs_master_id,
              artist_norm: album.artist_norm,
              title_norm: album.title_norm,
              artist_album_norm: album.artist_album_norm,
              album_norm: album.album_norm,
            };

            // Parse format
            const formatData = parseDiscogsFormat(album.format);
            Object.assign(albumData, formatData);

            // Enrich from Discogs if needed
            if (album.status === 'NEW' || 
                (syncMode === 'full_sync' && album.missingFields.length > 0) ||
                (syncMode === 'partial_sync' && album.needsEnrichment)) {
              
              const enrichedData = await enrichFromDiscogs(album.discogs_release_id);
              
              // For full_sync, only add missing fields
              if (syncMode === 'full_sync') {
                album.missingFields.forEach(field => {
                  if (enrichedData[field]) {
                    albumData[field] = enrichedData[field];
                  }
                });
              } else {
                // For other modes, add all enriched data
                Object.assign(albumData, enrichedData);
              }
            }

            // Insert or update
            if (album.status === 'NEW') {
              const { error: insertError } = await supabase
                .from('collection')
                .insert(albumData);

              if (insertError) throw insertError;
              resultCounts.added++;
            } else {
              const { error: updateError } = await supabase
                .from('collection')
                .update(albumData)
                .eq('id', album.existingId!);

              if (updateError) throw updateError;
              
              if (album.status === 'CHANGED') {
                resultCounts.updated++;
              } else {
                resultCounts.unchanged++;
              }
            }
          } catch (err) {
            console.error(`Error processing ${album.artist} - ${album.title}:`, err);
            resultCounts.errors++;
          }
        }
      }

      setResults(resultCounts);
      setStage('complete');
      
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStage('preview');
    }
  };

  const handleClose = () => {
    setStage('upload');
    setFile(null);
    setComparedAlbums([]);
    setProgress({ current: 0, total: 0, status: '' });
    setError(null);
    setResults({ added: 0, updated: 0, removed: 0, unchanged: 0, errors: 0 });
    onClose();
  };

  const newCount = comparedAlbums.filter(a => a.status === 'NEW').length;
  const changedCount = comparedAlbums.filter(a => a.status === 'CHANGED').length;
  const unchangedCount = comparedAlbums.filter(a => a.status === 'UNCHANGED').length;
  const removedCount = comparedAlbums.filter(a => a.status === 'REMOVED').length;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 30000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '600px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f97316',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            Import from Discogs
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '4px',
              marginBottom: '16px',
              color: '#991b1b',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {/* UPLOAD STAGE */}
          {stage === 'upload' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                }}>
                  Sync Mode
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { value: 'full_replacement', label: 'Full Replacement', desc: 'Delete all, import everything fresh' },
                    { value: 'full_sync', label: 'Full Sync', desc: 'Scrape missing/changed data for all albums' },
                    { value: 'partial_sync', label: 'Partial Sync', desc: 'Only process new & changed albums (recommended)' },
                    { value: 'new_only', label: 'New Only', desc: 'Only import albums not in database' },
                  ].map(mode => (
                    <label key={mode.value} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      padding: '12px',
                      border: `2px solid ${syncMode === mode.value ? '#f97316' : '#e5e7eb'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      backgroundColor: syncMode === mode.value ? '#fff7ed' : 'white',
                    }}>
                      <input
                        type="radio"
                        name="syncMode"
                        value={mode.value}
                        checked={syncMode === mode.value}
                        onChange={(e) => setSyncMode(e.target.value as SyncMode)}
                        style={{ marginRight: '12px', marginTop: '2px' }}
                      />
                      <div>
                        <div style={{ fontWeight: '600', color: '#111827', marginBottom: '2px' }}>
                          {mode.label}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>
                          {mode.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                }}>
                  Discogs CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
                {file && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            </>
          )}

          {/* PREVIEW STAGE */}
          {stage === 'preview' && (
            <>
              <div style={{
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                marginBottom: '20px',
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#111827' }}>
                  Import Preview
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <span style={{ color: '#059669', fontWeight: '600' }}>NEW:</span>{' '}
                    <span style={{ color: '#6b7280' }}>{newCount} albums</span>
                  </div>
                  <div>
                    <span style={{ color: '#d97706', fontWeight: '600' }}>CHANGED:</span>{' '}
                    <span style={{ color: '#6b7280' }}>{changedCount} albums</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280', fontWeight: '600' }}>UNCHANGED:</span>{' '}
                    <span style={{ color: '#6b7280' }}>{unchangedCount} albums</span>
                  </div>
                  {syncMode === 'full_sync' && (
                    <div>
                      <span style={{ color: '#dc2626', fontWeight: '600' }}>REMOVED:</span>{' '}
                      <span style={{ color: '#6b7280' }}>{removedCount} albums</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                padding: '12px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#92400e',
              }}>
                <strong>Mode: {syncMode.replace(/_/g, ' ').toUpperCase()}</strong>
                <br />
                {syncMode === 'full_replacement' && 'Will delete entire database and import all albums from CSV.'}
                {syncMode === 'full_sync' && 'Will scrape missing/changed data for all CSV albums and remove albums not in CSV.'}
                {syncMode === 'partial_sync' && 'Will only process new and changed albums.'}
                {syncMode === 'new_only' && 'Will only add albums not currently in database.'}
              </div>
            </>
          )}

          {/* IMPORTING STAGE */}
          {stage === 'importing' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '12px',
              }}>
                <div style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  height: '100%',
                  backgroundColor: '#f97316',
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                {progress.current} / {progress.total}
              </div>
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                {progress.status}
              </div>
            </div>
          )}

          {/* COMPLETE STAGE */}
          {stage === 'complete' && (
            <div style={{
              padding: '20px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '6px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#15803d' }}>
                Import Complete
              </h3>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                <div><strong>{results.added}</strong> albums added</div>
                <div><strong>{results.updated}</strong> albums updated</div>
                {results.removed > 0 && <div><strong>{results.removed}</strong> albums removed</div>}
                <div><strong>{results.unchanged}</strong> albums unchanged</div>
                {results.errors > 0 && (
                  <div style={{ color: '#dc2626', marginTop: '8px' }}>
                    <strong>{results.errors}</strong> errors occurred
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          {stage === 'upload' && (
            <>
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  color: '#374151',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleParseCSV}
                disabled={!file}
                style={{
                  padding: '8px 16px',
                  backgroundColor: file ? '#f97316' : '#d1d5db',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: file ? 'pointer' : 'not-allowed',
                  color: 'white',
                }}
              >
                Continue
              </button>
            </>
          )}

          {stage === 'preview' && (
            <>
              <button
                onClick={() => setStage('upload')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  color: '#374151',
                }}
              >
                Back
              </button>
              <button
                onClick={handleStartImport}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f97316',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: 'white',
                }}
              >
                Start Import
              </button>
            </>
          )}

          {stage === 'complete' && (
            <button
              onClick={handleClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f97316',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                color: 'white',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
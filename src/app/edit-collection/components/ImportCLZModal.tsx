// src/app/edit-collection/components/ImportCLZModal.tsx
'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { normalizeArtist, normalizeTitle } from '../../../lib/importUtils';

type SyncMode = 'update_all' | 'update_missing_only';
type ImportStage = 'upload' | 'preview' | 'importing' | 'complete';
type AlbumStatus = 'MATCHED' | 'NO_MATCH';

interface ParsedCLZAlbum {
  artist: string;
  title: string;
  year: string;
  tracks: Array<{
    id: string;
    title: string;
    position: number;
    side: string | null;
    duration: string;
    disc_number: number;
    type: 'track';
    artist: null;
  }>;
  disc_metadata: Array<{
    index: number;
    name: string;
  }>;
  disc_count: number;
  musicians: string[];
  producers: string[];
  engineers: string[];
  songwriters: string[];
  barcode: string;
  cat_no: string;
  artist_norm: string;
  title_norm: string;
}

interface ExistingAlbum {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  tracks: unknown[] | null;
  musicians: string[] | null;
  producers: string[] | null;
  engineers: string[] | null;
  songwriters: string[] | null;
}

interface ComparedCLZAlbum extends ParsedCLZAlbum {
  status: AlbumStatus;
  existingId?: number;
  hasTracks: boolean;
  hasCredits: boolean;
}

interface ImportCLZModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

// Parse CLZ XML
function parseCLZXML(xmlText: string): ParsedCLZAlbum[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  const musicList = xmlDoc.querySelector('musiclist');
  if (!musicList) return [];

  const albums: ParsedCLZAlbum[] = [];
  const musicElements = musicList.querySelectorAll('music');

  musicElements.forEach(music => {
    // Get artist (first artist from list)
    const artistNode = music.querySelector('artists artist displayname');
    const artist = artistNode?.textContent || 'Unknown Artist';
    
    // Get title and year
    const title = music.querySelector('title')?.textContent || 'Unknown Title';
    const year = music.querySelector('releaseyear')?.textContent || '';

    // Parse tracks and discs
    const tracks: ParsedCLZAlbum['tracks'] = [];
    const discMetadata: ParsedCLZAlbum['disc_metadata'] = [];
    const discsNodes = music.querySelectorAll('discs disc');
    
    if (discsNodes.length === 0) {
      // Single disc album
      discMetadata.push({ index: 1, name: 'Disc 1' });
      
      const trackNodes = music.querySelectorAll('tracks track');
      trackNodes.forEach(track => {
        const position = track.querySelector('position')?.textContent || '0';
        const seconds = parseInt(track.querySelector('length')?.textContent || '0');
        const hash = track.querySelector('hash')?.textContent || '0';
        
        tracks.push({
          id: `clz-${hash}`,
          title: track.querySelector('title')?.textContent || '',
          position: cleanPosition(position),
          side: position[0]?.match(/[A-Z]/) ? position[0] : null,
          duration: formatDuration(seconds),
          disc_number: 1,
          type: 'track',
          artist: null,
        });
      });
    } else {
      // Multi-disc album
      discsNodes.forEach((disc, index) => {
        const discIndex = index + 1;
        const discName = disc.querySelector('displayname')?.textContent || `Disc ${discIndex}`;
        discMetadata.push({ index: discIndex, name: discName });
        
        const trackNodes = disc.querySelectorAll('track');
        trackNodes.forEach(track => {
          const position = track.querySelector('position')?.textContent || '0';
          const seconds = parseInt(track.querySelector('length')?.textContent || '0');
          const hash = track.querySelector('hash')?.textContent || '0';
          
          tracks.push({
            id: `clz-${hash}`,
            title: track.querySelector('title')?.textContent || '',
            position: cleanPosition(position),
            side: position[0]?.match(/[A-Z]/) ? position[0] : null,
            duration: formatDuration(seconds),
            disc_number: discIndex,
            type: 'track',
            artist: null,
          });
        });
      });
    }

    // Extract credits
    const musicians: string[] = [];
    const producers: string[] = [];
    const engineers: string[] = [];
    const songwriters: string[] = [];

    music.querySelectorAll('musicians musician displayname').forEach(node => {
      if (node.textContent) musicians.push(node.textContent);
    });
    music.querySelectorAll('producers producer displayname').forEach(node => {
      if (node.textContent) producers.push(node.textContent);
    });
    music.querySelectorAll('engineers engineer displayname').forEach(node => {
      if (node.textContent) engineers.push(node.textContent);
    });
    music.querySelectorAll('songwriters songwriter displayname').forEach(node => {
      if (node.textContent) songwriters.push(node.textContent);
    });

    albums.push({
      artist,
      title,
      year,
      tracks,
      disc_metadata: discMetadata,
      disc_count: discMetadata.length,
      musicians,
      producers,
      engineers,
      songwriters,
      barcode: music.querySelector('barcode')?.textContent || '',
      cat_no: music.querySelector('labelnumber')?.textContent || '',
      artist_norm: normalizeArtist(artist),
      title_norm: normalizeTitle(title),
    });
  });

  return albums;
}

function cleanPosition(pos: string): number {
  const nums = pos.match(/\d+/);
  return nums ? parseInt(nums[0]) : 0;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Compare CLZ albums with existing collection
function compareCLZAlbums(
  parsed: ParsedCLZAlbum[],
  existing: ExistingAlbum[]
): ComparedCLZAlbum[] {
  // Build lookup map by normalized artist + title
  const existingMap = new Map<string, ExistingAlbum>();
  
  existing.forEach(album => {
    const key = normalizeArtist(album.artist) + normalizeTitle(album.title);
    existingMap.set(key, album);
  });

  const compared: ComparedCLZAlbum[] = [];

  for (const clzAlbum of parsed) {
    const key = clzAlbum.artist_norm + clzAlbum.title_norm;
    const existingAlbum = existingMap.get(key);

    if (existingAlbum) {
      // MATCHED
      compared.push({
        ...clzAlbum,
        status: 'MATCHED',
        existingId: existingAlbum.id,
        hasTracks: !!(existingAlbum.tracks && existingAlbum.tracks.length > 0),
        hasCredits: !!(
          (existingAlbum.musicians && existingAlbum.musicians.length > 0) ||
          (existingAlbum.producers && existingAlbum.producers.length > 0) ||
          (existingAlbum.engineers && existingAlbum.engineers.length > 0) ||
          (existingAlbum.songwriters && existingAlbum.songwriters.length > 0)
        ),
      });
    } else {
      // NO MATCH
      compared.push({
        ...clzAlbum,
        status: 'NO_MATCH',
        hasTracks: false,
        hasCredits: false,
      });
    }
  }

  return compared;
}

export default function ImportCLZModal({ isOpen, onClose, onImportComplete }: ImportCLZModalProps) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [syncMode, setSyncMode] = useState<SyncMode>('update_missing_only');
  const [file, setFile] = useState<File | null>(null);
  
  const [comparedAlbums, setComparedAlbums] = useState<ComparedCLZAlbum[]>([]);
  
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [error, setError] = useState<string | null>(null);
  
  const [results, setResults] = useState({
    updated: 0,
    skipped: 0,
    noMatch: 0,
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

  const handleParseXML = async () => {
    if (!file) return;

    try {
      setError(null);
      const text = await file.text();
      const parsed = parseCLZXML(text);

      if (parsed.length === 0) {
        setError('No albums found in XML file');
        return;
      }

      // Load existing collection
      const { data: existing, error: dbError } = await supabase
        .from('collection')
        .select('id, artist, title, year, tracks, musicians, producers, engineers, songwriters');

      if (dbError) {
        setError(`Database error: ${dbError.message}`);
        return;
      }

      // Compare
      const compared = compareCLZAlbums(parsed, existing as ExistingAlbum[]);
      setComparedAlbums(compared);
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse XML');
    }
  };

  const handleStartImport = async () => {
    setStage('importing');
    setError(null);

    try {
      // Only process MATCHED albums
      const matchedAlbums = comparedAlbums.filter(a => a.status === 'MATCHED');
      
      // Filter based on sync mode
      let albumsToProcess: ComparedCLZAlbum[] = [];
      
      if (syncMode === 'update_all') {
        albumsToProcess = matchedAlbums;
      } else if (syncMode === 'update_missing_only') {
        // Only update albums missing tracks or credits
        albumsToProcess = matchedAlbums.filter(a => !a.hasTracks || !a.hasCredits);
      }

      setProgress({ current: 0, total: albumsToProcess.length, status: 'Processing...' });

      const resultCounts = {
        updated: 0,
        skipped: matchedAlbums.length - albumsToProcess.length,
        noMatch: comparedAlbums.filter(a => a.status === 'NO_MATCH').length,
        errors: 0,
      };

      // Process albums
      for (let i = 0; i < albumsToProcess.length; i++) {
        const album = albumsToProcess[i];
        
        setProgress({
          current: i + 1,
          total: albumsToProcess.length,
          status: `Updating ${album.artist} - ${album.title}`,
        });

        try {
          const updateData: Record<string, unknown> = {
            tracks: album.tracks,
            disc_metadata: album.disc_metadata,
            discs: album.disc_count,
            musicians: album.musicians,
            producers: album.producers,
            engineers: album.engineers,
            songwriters: album.songwriters,
          };

          // Only update barcode/cat_no if they have values
          if (album.barcode) updateData.barcode = album.barcode;
          if (album.cat_no) updateData.cat_no = album.cat_no;

          const { error: updateError } = await supabase
            .from('collection')
            .update(updateData)
            .eq('id', album.existingId!);

          if (updateError) throw updateError;
          resultCounts.updated++;
        } catch (err) {
          console.error(`Error updating ${album.artist} - ${album.title}:`, err);
          resultCounts.errors++;
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
    setResults({ updated: 0, skipped: 0, noMatch: 0, errors: 0 });
    onClose();
  };

  const matchedCount = comparedAlbums.filter(a => a.status === 'MATCHED').length;
  const noMatchCount = comparedAlbums.filter(a => a.status === 'NO_MATCH').length;
  const needsUpdateCount = comparedAlbums.filter(a => 
    a.status === 'MATCHED' && (!a.hasTracks || !a.hasCredits)
  ).length;

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
            Import from CLZ Music Web
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
                  Update Mode
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { value: 'update_missing_only', label: 'Update Missing Only', desc: 'Only update albums missing tracks or credits (recommended)' },
                    { value: 'update_all', label: 'Update All', desc: 'Update all matched albums with CLZ data' },
                  ].map(mode => (
                    <label key={mode.value} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      padding: '12px',
                      border: `2px solid ${syncMode === mode.value ? '#f97316' : '#e5e7eb'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      backgroundColor: syncMode === mode.value ? '#f5f3ff' : 'white',
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
                  CLZ Music Web XML Export
                </label>
                <input
                  type="file"
                  accept=".xml"
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
              {/* Summary Stats */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                marginBottom: '16px',
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#111827' }}>
                  Import Summary
                </h3>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                  <strong>{comparedAlbums.length}</strong> albums found in XML
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#059669', fontWeight: '600' }}>Matched albums:</span>
                    <span style={{ color: '#111827', fontWeight: '600' }}>{matchedCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#d97706', fontWeight: '600' }}>Missing tracks/credits:</span>
                    <span style={{ color: '#111827', fontWeight: '600' }}>{needsUpdateCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#dc2626', fontWeight: '600' }}>No match found:</span>
                    <span style={{ color: '#111827', fontWeight: '600' }}>{noMatchCount}</span>
                  </div>
                </div>
              </div>

              {/* Mode Warning */}
              <div style={{
                padding: '12px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#92400e',
                marginBottom: '16px',
              }}>
                <strong>Mode: {syncMode.replace(/_/g, ' ').toUpperCase()}</strong>
                <br />
                {syncMode === 'update_all' && `Will update all ${matchedCount} matched albums with CLZ data.`}
                {syncMode === 'update_missing_only' && `Will only update ${needsUpdateCount} albums missing tracks or credits.`}
              </div>

              {/* Preview Table */}
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  fontWeight: '600',
                  fontSize: '13px',
                  color: '#6b7280',
                }}>
                  Preview (first 10 albums)
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Artist</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Title</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Status</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparedAlbums.slice(0, 10).map((album, idx) => {
                        let statusColor = '#6b7280';
                        let statusDisplay = album.status;
                        let actionText = 'No action';

                        if (album.status === 'MATCHED') {
                          statusColor = '#059669';
                          statusDisplay = 'MATCHED';
                          if (!album.hasTracks && !album.hasCredits) {
                            actionText = 'Update tracks + credits';
                          } else if (!album.hasTracks) {
                            actionText = 'Update tracks';
                          } else if (!album.hasCredits) {
                            actionText = 'Update credits';
                          } else if (syncMode === 'update_all') {
                            actionText = 'Update all data';
                          } else {
                            actionText = 'Skip (has data)';
                          }
                        } else {
                          statusColor = '#dc2626';
                          statusDisplay = 'NO_MATCH';
                          actionText = 'Skip (not in DB)';
                        }

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px 12px', color: '#111827' }}>{album.artist}</td>
                            <td style={{ padding: '8px 12px', color: '#111827' }}>{album.title}</td>
                            <td style={{ padding: '8px 12px', color: statusColor, fontWeight: '600' }}>
                              {statusDisplay}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: '12px' }}>
                              {actionText}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
                <div><strong>{results.updated}</strong> albums updated</div>
                <div><strong>{results.skipped}</strong> albums skipped</div>
                <div><strong>{results.noMatch}</strong> albums not found in database</div>
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
                onClick={handleParseXML}
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
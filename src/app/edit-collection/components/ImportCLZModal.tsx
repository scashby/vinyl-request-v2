// src/app/edit-collection/components/ImportCLZModal.tsx
'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { normalizeArtist, normalizeTitle } from '../../../lib/importUtils';
import {
  buildIdentifyingFieldUpdates,
  detectConflicts,
  type FieldConflict,
  type PreviousResolution,
} from '../../../lib/conflictDetection';
import ConflictResolutionModal from './ConflictResolutionModal';

type ImportStage = 'upload' | 'preview' | 'importing' | 'conflicts' | 'complete';
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
  labels: string[];
}

// Use Record type for existing albums since we need all fields for conflict detection
type ExistingAlbum = Record<string, unknown> & {
  id: number;
  artist: string;
  title: string;
};

interface ComparedCLZAlbum extends ParsedCLZAlbum {
  status: AlbumStatus;
  existingId?: number;
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

    // Get labels
    const labels: string[] = [];
    music.querySelectorAll('labels label displayname').forEach(node => {
      if (node.textContent) labels.push(node.textContent);
    });

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
      labels,
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
    const key = normalizeArtist(album.artist as string) + normalizeTitle(album.title as string);
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
      });
    } else {
      // NO MATCH
      compared.push({
        ...clzAlbum,
        status: 'NO_MATCH',
      });
    }
  }

  return compared;
}

export default function ImportCLZModal({ isOpen, onClose, onImportComplete }: ImportCLZModalProps) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [file, setFile] = useState<File | null>(null);
  
  const [comparedAlbums, setComparedAlbums] = useState<ComparedCLZAlbum[]>([]);
  const [existingAlbums, setExistingAlbums] = useState<ExistingAlbum[]>([]);
  
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [error, setError] = useState<string | null>(null);
  
  const [allConflicts, setAllConflicts] = useState<FieldConflict[]>([]);
  
  const [results, setResults] = useState({
    updated: 0,
    skipped: 0,
    noMatch: 0,
    errors: 0,
    conflicts: 0,
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

      // Load existing collection (select all fields needed for conflict detection)
      const { data: existing, error: dbError } = await supabase
        .from('collection')
        .select('*');

      if (dbError) {
        setError(`Database error: ${dbError.message}`);
        return;
      }

      // Compare
      const compared = compareCLZAlbums(parsed, existing as ExistingAlbum[]);
      setComparedAlbums(compared);
      setExistingAlbums(existing as ExistingAlbum[]);
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse XML');
    }
  };

  const handleStartImport = async () => {
    setStage('importing');
    setError(null);

    try {
      // Process ALL MATCHED albums
      const matchedAlbums = comparedAlbums.filter(a => a.status === 'MATCHED');
      const albumsToProcess = matchedAlbums; // Process all matched albums

      setProgress({ current: 0, total: albumsToProcess.length, status: 'Processing...' });

      const resultCounts = {
        updated: 0,
        skipped: 0,
        noMatch: comparedAlbums.filter(a => a.status === 'NO_MATCH').length,
        errors: 0,
        conflicts: 0,
      };

      const conflicts: FieldConflict[] = [];

      // Process albums
      for (let i = 0; i < albumsToProcess.length; i++) {
        const album = albumsToProcess[i];
        
        setProgress({
          current: i + 1,
          total: albumsToProcess.length,
          status: `Processing ${album.artist} - ${album.title}`,
        });

        try {
          // Find existing album
          const existingAlbum = existingAlbums.find(e => e.id === album.existingId);
          if (!existingAlbum) continue;

          // Load previous conflict resolutions
          const { data: resolutions } = await supabase
            .from('import_conflict_resolutions')
            .select('*')
            .eq('album_id', album.existingId!)
            .eq('source', 'clz');

          // Build CLZ data object
          const clzData: Record<string, unknown> = {
            artist: album.artist,
            title: album.title,
            year: album.year,
            tracks: album.tracks,
            disc_metadata: album.disc_metadata,
            discs: album.disc_count,
            musicians: album.musicians,
            producers: album.producers,
            engineers: album.engineers,
            songwriters: album.songwriters,
            barcode: album.barcode,
            cat_no: album.cat_no,
            labels: album.labels,
          };

          // Step 1: Handle identifying fields (only fill if NULL)
          const identifyingUpdates = buildIdentifyingFieldUpdates(
            existingAlbum,
            clzData
          );

          // Step 2: Detect conflicts for conflictable fields
          const { safeUpdates, conflicts: albumConflicts } = detectConflicts(
            existingAlbum,
            clzData,
            'clz',
            (resolutions || []) as PreviousResolution[]
          );

          // Combine identifying updates and safe updates
          const updateData = {
            ...identifyingUpdates,
            ...safeUpdates,
          };

          // Update album with non-conflicting data
          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from('collection')
              .update(updateData)
              .eq('id', album.existingId!);

            if (updateError) throw updateError;
          }
          
          // Count as updated if we applied changes or found conflicts
          if (Object.keys(updateData).length > 0 || albumConflicts.length > 0) {
            resultCounts.updated++;
          } else {
            resultCounts.skipped++;
          }

          // Queue conflicts for later resolution
          if (albumConflicts.length > 0) {
            conflicts.push(...albumConflicts);
            resultCounts.conflicts += albumConflicts.length;
          }
        } catch (err) {
          console.error(`Error processing ${album.artist} - ${album.title}:`, err);
          resultCounts.errors++;
        }
      }

      setResults(resultCounts);
      
      // If there are conflicts, show resolution modal
      if (conflicts.length > 0) {
        setAllConflicts(conflicts);
        setStage('conflicts');
      } else {
        setStage('complete');
        if (onImportComplete) {
          onImportComplete();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStage('preview');
    }
  };

  const handleConflictsResolved = () => {
    setStage('complete');
    if (onImportComplete) {
      onImportComplete();
    }
  };

  const handleClose = () => {
    setStage('upload');
    setFile(null);
    setComparedAlbums([]);
    setExistingAlbums([]);
    setProgress({ current: 0, total: 0, status: '' });
    setError(null);
    setAllConflicts([]);
    setResults({ updated: 0, skipped: 0, noMatch: 0, errors: 0, conflicts: 0 });
    onClose();
  };

  const matchedCount = comparedAlbums.filter(a => a.status === 'MATCHED').length;
  const noMatchCount = comparedAlbums.filter(a => a.status === 'NO_MATCH').length;

  // Show conflict resolution modal
  if (stage === 'conflicts') {
    return (
      <ConflictResolutionModal
        conflicts={allConflicts}
        source="clz"
        onComplete={handleConflictsResolved}
        onCancel={() => setStage('complete')}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30000]">
      <div className="bg-white rounded-lg w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-orange-500 text-white flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold">
            Import from CLZ Music Web
          </h2>
          <button
            onClick={handleClose}
            className="bg-none border-none text-white text-2xl cursor-pointer p-0 hover:text-white/80"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded mb-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* UPLOAD STAGE */}
          {stage === 'upload' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CLZ Music Web XML Export
                </label>
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleFileChange}
                  className="block w-full p-2 border border-gray-300 rounded text-sm"
                />
                {file && (
                  <div className="mt-2 text-xs text-gray-500">
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
              <div className="p-4 bg-gray-50 rounded-md mb-4">
                <h3 className="m-0 mb-3 text-[15px] font-semibold text-gray-900">
                  Import Summary
                </h3>
                <div className="text-sm text-gray-500 mb-3">
                  <strong>{comparedAlbums.length}</strong> albums found in XML
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-emerald-600 font-semibold">Matched albums:</span>
                    <span className="text-gray-900 font-semibold">{matchedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-600 font-semibold">No match found:</span>
                    <span className="text-gray-900 font-semibold">{noMatchCount}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-300 rounded text-[13px] text-amber-800 mb-4">
                <strong>Safe Import Mode</strong>
                <br />
                Will process all {matchedCount} matched albums. Identifying fields (artist, title, format, barcode, etc.) are locked. Other fields will be updated if empty, or queued for conflict resolution if both sources have data.
              </div>

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200 font-semibold text-[13px] text-gray-500">
                  Preview (first 10 albums)
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-[13px] border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-[1]">
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Artist</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Title</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparedAlbums.slice(0, 10).map((album, idx) => {
                        let statusColor = 'text-gray-500';
                        let statusDisplay = album.status;
                        let actionText = 'No action';

                        if (album.status === 'MATCHED') {
                          statusColor = 'text-emerald-600';
                          statusDisplay = 'MATCHED';
                          actionText = 'Process for updates/conflicts';
                        } else {
                          statusColor = 'text-red-600';
                          statusDisplay = 'NO_MATCH';
                          actionText = 'Skip (not in DB)';
                        }

                        return (
                          <tr key={idx} className="border-b border-gray-100 last:border-none">
                            <td className="px-3 py-2 text-gray-900">{album.artist}</td>
                            <td className="px-3 py-2 text-gray-900">{album.title}</td>
                            <td className={`px-3 py-2 font-semibold ${statusColor}`}>
                              {statusDisplay}
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">
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
            <div className="text-center py-10 px-5">
              <div className="w-full h-2 bg-gray-200 rounded overflow-hidden mb-3">
                <div 
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="text-sm text-gray-500 mb-2">
                {progress.current} / {progress.total}
              </div>
              <div className="text-[13px] text-gray-400">
                {progress.status}
              </div>
            </div>
          )}

          {/* COMPLETE STAGE */}
          {stage === 'complete' && (
            <div className="p-5 bg-green-50 border border-green-200 rounded-md text-center">
              <div className="text-5xl mb-3">✓</div>
              <h3 className="m-0 mb-4 text-lg font-semibold text-green-700">
                Import Complete
              </h3>
              <div className="text-sm text-gray-500">
                <div><strong>{results.updated}</strong> albums updated</div>
                <div><strong>{results.skipped}</strong> albums skipped</div>
                <div><strong>{results.noMatch}</strong> albums not found in database</div>
                {results.conflicts > 0 && (
                  <div><strong>{results.conflicts}</strong> conflicts resolved</div>
                )}
                {results.errors > 0 && (
                  <div className="text-red-600 mt-2">
                    <strong>{results.errors}</strong> errors occurred
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3">
          {stage === 'upload' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-medium cursor-pointer text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleParseXML}
                disabled={!file}
                className={`px-4 py-2 border-none rounded text-sm font-semibold text-white ${
                  file ? 'bg-orange-500 cursor-pointer hover:bg-orange-600' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Continue
              </button>
            </>
          )}

          {stage === 'preview' && (
            <>
              <button
                onClick={() => setStage('upload')}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-medium cursor-pointer text-gray-700 hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handleStartImport}
                className="px-4 py-2 bg-orange-500 border-none rounded text-sm font-semibold cursor-pointer text-white hover:bg-orange-600"
              >
                Start Import
              </button>
            </>
          )}

          {stage === 'complete' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-orange-500 border-none rounded text-sm font-semibold cursor-pointer text-white hover:bg-orange-600"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
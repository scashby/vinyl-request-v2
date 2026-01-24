// src/app/edit-collection/components/ImportDiscogsModal.tsx
'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { parseDiscogsFormat } from '../../../lib/formatParser';
import { normalizeArtist, normalizeTitle, normalizeArtistAlbum } from '../../../lib/importUtils';

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
  location: string; // FIXED: Renamed from folder to location
  discogs_release_id: string;
  discogs_master_id: string | null;
  date_added: string;
  media_condition: string;
  package_sleeve_condition: string | null;
  personal_notes: string | null;
  my_rating: number | null;
  decade: number | null;
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
  genres: string[] | null;
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

// Helper functions
function sanitizeMediaCondition(condition: string | null | undefined): string {
  if (!condition || condition.trim() === '') return 'Unknown';
  return condition.trim();
}

// FIXED: Renamed to sanitizeLocation to match DB
function sanitizeLocation(folder: string | null | undefined): string {
  if (!folder || folder.trim() === '') return 'Uncategorized';
  return folder.trim();
}

function parseDiscogsDate(dateString: string): string {
  if (!dateString || dateString.trim() === '') return new Date().toISOString();
  try {
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function calculateDecade(year: string | null): number | null {
  if (!year) return null;
  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum <= 0) return null;
  return Math.floor(yearNum / 10) * 10;
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

    const year = row['Released'] || row['Year'] || row['year'] || null;
    const ratingText = row['Rating'] || row['rating'] || '';
    const my_rating = ratingText ? parseInt(ratingText) : null;

    const album: ParsedAlbum = {
      artist,
      title,
      format: row['Format'] || row['format'] || '',
      labels,
      cat_no: row['Catalog#'] || row['Catalog #'] || row['catalog'] || row['cat_no'] || null,
      barcode: row['Barcode'] || row['barcode'] || null,
      country: row['Country'] || row['country'] || null,
      year,
      // FIXED: Map CSV 'Folder' to DB 'location'
      location: sanitizeLocation(row['CollectionFolder'] || row['Folder'] || row['folder']),
      discogs_release_id: row['release_id'] || row['Release ID'] || row['discogs_release_id'] || '',
      discogs_master_id: row['Master ID'] || row['master_id'] || row['discogs_master_id'] || null,
      date_added: parseDiscogsDate(row['Date Added'] || row['date_added'] || ''),
      media_condition: sanitizeMediaCondition(row['Collection Media Condition'] || row['media_condition']),
      package_sleeve_condition: row['Collection Sleeve Condition'] || row['package_sleeve_condition'] || null,
      personal_notes: row['Collection Notes'] || row['notes'] || null,
      my_rating,
      decade: calculateDecade(year),
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
  const releaseIdMap = new Map<string, ExistingAlbum>();
  const artistAlbumMap = new Map<string, ExistingAlbum>();
  const matchedDbIds = new Set<number>();
  
  existing.forEach(album => {
    if (album.discogs_release_id) {
      releaseIdMap.set(album.discogs_release_id, album);
    }
    const normalizedKey = normalizeArtistAlbum(album.artist, album.title);
    artistAlbumMap.set(normalizedKey, album);
  });

  const compared: ComparedAlbum[] = [];

  for (const parsedAlbum of parsed) {
    let existingAlbum: ExistingAlbum | undefined;
    
    if (parsedAlbum.discogs_release_id) {
      existingAlbum = releaseIdMap.get(parsedAlbum.discogs_release_id);
    }
    
    if (!existingAlbum) {
      existingAlbum = artistAlbumMap.get(parsedAlbum.artist_album_norm);
    }

    if (!existingAlbum) {
      compared.push({
        ...parsedAlbum,
        status: 'NEW',
        needsEnrichment: true,
        missingFields: ['all'],
      });
    } else {
      const missingFields: string[] = [];
      
      if (!existingAlbum.image_url) missingFields.push('cover images');
      if (!existingAlbum.tracks || existingAlbum.tracks.length === 0) missingFields.push('tracks');
      if (!existingAlbum.genres || existingAlbum.genres.length === 0) missingFields.push('genres');
      if (!existingAlbum.packaging) missingFields.push('packaging');

      const isChanged = parsedAlbum.discogs_release_id !== existingAlbum.discogs_release_id;

      compared.push({
        ...parsedAlbum,
        status: isChanged || missingFields.length > 0 ? 'CHANGED' : 'UNCHANGED',
        existingId: existingAlbum.id,
        needsEnrichment: missingFields.length > 0,
        missingFields,
      });

      matchedDbIds.add(existingAlbum.id);

      if (existingAlbum.discogs_release_id) {
        releaseIdMap.delete(existingAlbum.discogs_release_id);
      }
      const existingNormalizedKey = existingAlbum.artist_album_norm || 
        normalizeArtistAlbum(existingAlbum.artist, existingAlbum.title);
      artistAlbumMap.delete(existingNormalizedKey);
    }
  }

  for (const existingAlbum of existing) {
    if (matchedDbIds.has(existingAlbum.id)) {
      continue;
    }

    const normalizedKey = normalizeArtistAlbum(existingAlbum.artist, existingAlbum.title);
      
    compared.push({
      artist: existingAlbum.artist,
      title: existingAlbum.title,
      format: '',
      labels: [],
      cat_no: null,
      barcode: null,
      country: null,
      year: null,
      // FIXED: Use location for removed items too
      location: 'Unknown',
      discogs_release_id: existingAlbum.discogs_release_id || '',
      discogs_master_id: null,
      date_added: new Date().toISOString(),
      media_condition: 'Unknown',
      package_sleeve_condition: null,
      personal_notes: null,
      my_rating: null,
      decade: null,
      artist_norm: normalizeArtist(existingAlbum.artist),
      title_norm: normalizeTitle(existingAlbum.title),
      artist_album_norm: normalizedKey,
      album_norm: normalizeTitle(existingAlbum.title),
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

  const response = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);

  if (!response.ok) {
    throw new Error(`Discogs API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract data
  const enriched: Record<string, unknown> = {
    image_url: data.images?.[0]?.uri || null,
    back_image_url: data.images?.[1]?.uri || null,
    genres: data.genres || [],
    styles: data.styles || [],
    packaging: data.formats?.[0]?.descriptions?.find((d: string) => 
      ['Gatefold', 'Single Sleeve', 'Digipak'].some(p => d.includes(p))
    ) || null,
    release_notes: data.notes || null,
  };

  if (data.released) {
      let dateStr = data.released.trim();
      dateStr = dateStr.replace(/-00/g, ''); 
      if (/^\d{4}$/.test(dateStr)) {
          dateStr = `${dateStr}-01-01`;
          enriched.original_release_year = parseInt(data.released);
      } 
      else if (/^\d{4}-\d{2}$/.test(dateStr)) {
          dateStr = `${dateStr}-01`;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          enriched.original_release_date = dateStr;
      }
  }

  if (data.companies && Array.isArray(data.companies)) {
    const labels = data.companies
      .filter((c: { entity_type_name: string; name: string }) => c.entity_type_name === 'Label')
      .map((c: { name: string }) => c.name);
    
    if (labels.length > 0) {
      enriched.labels = labels;
    }
  }

  if (data.formats && Array.isArray(data.formats)) {
    const soundDescriptions = data.formats[0]?.descriptions || [];
    const soundTypes = ['Stereo', 'Mono', 'Quadraphonic', 'Surround'];
    const sound = soundDescriptions.find((d: string) => 
      soundTypes.some(type => d.includes(type))
    );
    if (sound) enriched.sound = sound;
  }

  if (data.identifiers && Array.isArray(data.identifiers)) {
    const matrixEntries: Record<string, string> = {};
    
    data.identifiers.forEach((identifier: { type: string; value: string; description?: string }) => {
      if (identifier.type === 'Matrix / Runout') {
        const desc = identifier.description || '';
        if (desc.toLowerCase().includes('side a') || desc.toLowerCase().includes('a-side')) {
          matrixEntries.side_a = identifier.value;
        } else if (desc.toLowerCase().includes('side b') || desc.toLowerCase().includes('b-side')) {
          matrixEntries.side_b = identifier.value;
        } else if (desc.toLowerCase().includes('side c')) {
          matrixEntries.side_c = identifier.value;
        } else if (desc.toLowerCase().includes('side d')) {
          matrixEntries.side_d = identifier.value;
        } else if (!matrixEntries.side_a) {
          matrixEntries.side_a = identifier.value;
        } else if (!matrixEntries.side_b) {
          matrixEntries.side_b = identifier.value;
        }
      } else if (identifier.type === 'SPARS Code') {
        enriched.spars_code = identifier.value;
      }
    });

    if (Object.keys(matrixEntries).length > 0) {
      enriched.matrix_numbers = matrixEntries;
    }
  }

  if (data.tracklist && Array.isArray(data.tracklist)) {
    const tracks: unknown[] = [];
    const discMetadata: { disc_number: number; title: string | null }[] = [];
    let position = 1;
    let currentDiscNumber = 1;
    let currentDiscTitle: string | null = null;

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

      if (isHeader) {
        if (discNumber !== currentDiscNumber) {
          currentDiscNumber = discNumber;
          currentDiscTitle = track.title || null;
          
          const existingDisc = discMetadata.find(d => d.disc_number === discNumber);
          if (!existingDisc) {
            discMetadata.push({
              disc_number: discNumber,
              title: currentDiscTitle,
            });
          }
        }
        return;
      }

      tracks.push({
        position: trackPosition.toString(),
        title: track.title || '',
        artist: track.artists?.[0]?.name || null,
        duration: track.duration || null,
        type: 'track',
        disc_number: discNumber,
        side: side || undefined,
      });

      position++;
    });

    enriched.tracks = tracks;
    
    if (discMetadata.length > 0) {
      enriched.disc_metadata = discMetadata;
    }
  }

  const engineers: string[] = [];
  const producers: string[] = [];
  const musicians: string[] = [];
  const songwriters: string[] = [];
  let studio: string | null = null;

  if (data.extraartists && Array.isArray(data.extraartists)) {
    data.extraartists.forEach((artist: { name: string; role: string }) => {
      const role = artist.role.toLowerCase();
      if (role.includes('engineer')) engineers.push(artist.name);
      if (role.includes('producer')) producers.push(artist.name);
      if (role.includes('musician') || role.includes('performer')) musicians.push(artist.name);
      if (role.includes('written-by') || role.includes('songwriter')) songwriters.push(artist.name);
      if ((role.includes('recorded at') || role.includes('studio')) && !studio) studio = artist.name;
    });
  }

  if (engineers.length > 0) enriched.engineers = engineers;
  if (producers.length > 0) enriched.producers = producers;
  if (musicians.length > 0) enriched.musicians = musicians;
  if (songwriters.length > 0) enriched.songwriters = songwriters;
  if (studio) enriched.studio = studio;

  return enriched;
}

export default function ImportDiscogsModal({ isOpen, onClose, onImportComplete }: ImportDiscogsModalProps) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [syncMode, setSyncMode] = useState<SyncMode>('partial_sync');
  const [file, setFile] = useState<File | null>(null);
  
  const [comparedAlbums, setComparedAlbums] = useState<ComparedAlbum[]>([]);
  const [totalDatabaseCount, setTotalDatabaseCount] = useState<number>(0);
  
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      
      try {
        const text = await selectedFile.text();
        const parsed = parseDiscogsCSV(text);

        if (parsed.length === 0) {
          setError('No albums found in CSV file');
          setComparedAlbums([]);
          return;
        }

        const { data: existing, error: dbError } = await supabase
          .from('collection')
          .select('id, artist, title, artist_norm, title_norm, artist_album_norm, discogs_release_id, image_url, tracks, genres, packaging');

        if (dbError) {
          setError(`Database error: ${dbError.message}`);
          setComparedAlbums([]);
          return;
        }

        if (!existing) {
          setError('No data returned from database');
          setComparedAlbums([]);
          return;
        }

        setTotalDatabaseCount(existing.length);
        const compared = compareAlbums(parsed, existing as ExistingAlbum[]);
        setComparedAlbums(compared);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV');
        setComparedAlbums([]);
      }
    }
  };

  const handleParseCSV = async () => {
    if (!file || comparedAlbums.length === 0) {
      setError('Please select a valid CSV file');
      return;
    }
    setStage('preview');
  };

  const handleStartImport = async () => {
    setStage('importing');
    setError(null);

    try {
      let albumsToProcess: ComparedAlbum[] = [];

      if (syncMode === 'full_replacement') {
        await supabase.from('collection').delete().gt('id', 0);
        albumsToProcess = comparedAlbums.filter(a => a.status !== 'REMOVED');
      } else if (syncMode === 'full_sync') {
        const removed = comparedAlbums.filter(a => a.status === 'REMOVED' && a.existingId);
        if (removed.length > 0) {
          const idsToDelete = removed.map(a => a.existingId!);
          const batchSize = 100;
          for (let i = 0; i < idsToDelete.length; i += batchSize) {
            const batch = idsToDelete.slice(i, i + batchSize);
            await supabase.from('collection').delete().in('id', batch);
          }
        }
        albumsToProcess = comparedAlbums.filter(a => a.status !== 'REMOVED');
      } else if (syncMode === 'partial_sync') {
        albumsToProcess = comparedAlbums.filter(a => 
          a.status === 'NEW' || (a.status === 'CHANGED' && a.needsEnrichment)
        );
      } else if (syncMode === 'new_only') {
        albumsToProcess = comparedAlbums.filter(a => a.status === 'NEW');
      }

      setProgress({ current: 0, total: albumsToProcess.length, status: 'Processing...' });

      const resultCounts = {
        added: 0,
        updated: 0,
        removed: syncMode === 'full_replacement' ? totalDatabaseCount : 
                 syncMode === 'full_sync' ? comparedAlbums.filter(a => a.status === 'REMOVED').length : 0,
        unchanged: 0,
        errors: 0,
      };

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
            const albumData: Record<string, unknown> = {
              artist: album.artist,
              title: album.title,
              format: album.format,
              labels: album.labels,
              cat_no: album.cat_no,
              barcode: album.barcode,
              country: album.country,
              year: album.year,
              // FIXED: Map to location column
              location: album.location,
              discogs_release_id: album.discogs_release_id,
              discogs_master_id: album.discogs_master_id,
              date_added: album.date_added,
              media_condition: album.media_condition,
              package_sleeve_condition: album.package_sleeve_condition,
              // FIXED: Map to personal_notes column
              personal_notes: album.personal_notes,
              my_rating: album.my_rating,
              decade: album.decade,
            };

            const formatData = parseDiscogsFormat(album.format);
            Object.assign(albumData, formatData);

            if (album.status === 'NEW' || 
                syncMode === 'full_sync' || 
                (syncMode === 'partial_sync' && album.needsEnrichment)) {
              
              const enrichedData = await enrichFromDiscogs(album.discogs_release_id);
              
              if (syncMode === 'full_sync' || album.status === 'NEW') {
                Object.assign(albumData, enrichedData);
              } else {
                album.missingFields.forEach(field => {
                  if (enrichedData[field]) {
                    if (field === 'genres') albumData.genres = enrichedData.genres;
                    else if (field === 'styles') albumData.styles = enrichedData.styles;
                    else albumData[field] = enrichedData[field];
                  }
                });
              }
            }

            if (album.status === 'NEW') {
              const { error: insertError } = await supabase.from('collection').insert(albumData);
              if (insertError) throw insertError;
              resultCounts.added++;
            } else {
              const { error: updateError } = await supabase.from('collection').update(albumData).eq('id', album.existingId!);
              if (updateError) throw updateError;
              if (album.status === 'CHANGED') resultCounts.updated++;
              else resultCounts.unchanged++;
            }
          } catch (err) {
            console.error(`Error processing ${album.artist} - ${album.title}:`, err);
            resultCounts.errors++;
          }
        }
      }

      setResults(resultCounts);
      setStage('complete');
      if (onImportComplete) onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStage('preview');
    }
  };

  const handleClose = () => {
    setStage('upload');
    setFile(null);
    setComparedAlbums([]);
    setTotalDatabaseCount(0);
    setProgress({ current: 0, total: 0, status: '' });
    setError(null);
    setResults({ added: 0, updated: 0, removed: 0, unchanged: 0, errors: 0 });
    onClose();
  };

  const newCount = syncMode === 'full_replacement' 
    ? comparedAlbums.filter(a => a.status !== 'REMOVED').length 
    : comparedAlbums.filter(a => a.status === 'NEW').length;
  const unchangedCount = syncMode === 'full_replacement'
    ? 0
    : comparedAlbums.filter(a => a.status === 'UNCHANGED').length;
  const removedCount = syncMode === 'full_replacement'
    ? totalDatabaseCount
    : syncMode === 'full_sync'
      ? comparedAlbums.filter(a => a.status === 'REMOVED').length
      : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30000]">
      <div className="bg-white rounded-lg w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-orange-500 text-white flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold">
            Import from Discogs
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
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sync Mode
                </label>
                <div className="flex flex-col gap-2">
                  {[
                    { value: 'full_replacement', label: 'Full Replacement', desc: 'Delete all, import everything fresh' },
                    { value: 'full_sync', label: 'Full Sync', desc: 'Scrape missing/changed data for all albums' },
                    { value: 'partial_sync', label: 'Partial Sync', desc: 'Only process new & changed albums (recommended)' },
                    { value: 'new_only', label: 'New Only', desc: 'Only import albums not in database' },
                  ].map(mode => (
                    <label key={mode.value} className={`flex items-start p-3 border-2 rounded-md cursor-pointer ${syncMode === mode.value ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                      <input
                        type="radio"
                        name="syncMode"
                        value={mode.value}
                        checked={syncMode === mode.value}
                        onChange={(e) => setSyncMode(e.target.value as SyncMode)}
                        className="mr-3 mt-0.5"
                      />
                      <div>
                        <div className="font-semibold text-gray-900 mb-0.5">
                          {mode.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {mode.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Discogs CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full p-2 border border-gray-300 rounded text-sm"
                />
                {file && (
                  <div className="mt-2 text-xs text-gray-500">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
                
                {file && comparedAlbums.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="text-sm font-semibold text-gray-900 mb-3">
                      CSV Analysis
                    </div>
                    <div className="flex flex-col gap-2 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total albums in CSV:</span>
                        <span className="font-semibold text-gray-900">
                          {comparedAlbums.filter(a => a.status !== 'REMOVED').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-600">New albums (not in database):</span>
                        <span className="font-semibold text-emerald-600">
                          {comparedAlbums.filter(a => a.status === 'NEW').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-600">Existing albums missing data:</span>
                        <span className="font-semibold text-amber-600">
                          {comparedAlbums.filter(a => a.status === 'CHANGED' && a.needsEnrichment).length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Unchanged albums:</span>
                        <span className="font-semibold text-gray-500">
                          {comparedAlbums.filter(a => a.status === 'UNCHANGED').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-600">Albums in DB but not in CSV:</span>
                        <span className="font-semibold text-red-600">
                          {comparedAlbums.filter(a => a.status === 'REMOVED').length}
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between">
                        <span className="text-gray-500">Current database total:</span>
                        <span className="font-semibold text-gray-900">
                          {totalDatabaseCount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* PREVIEW STAGE */}
          {stage === 'preview' && (
            <>
              <div className="text-sm mb-4 bg-blue-50 p-3 rounded text-blue-800 border border-blue-200">
                Found {comparedAlbums.length} potential changes. Review the summary below before proceeding.
              </div>

              {/* Summary Stats */}
              <div className="flex justify-between mb-4 text-center gap-2">
                <div className="flex-1 bg-green-50 p-2 rounded border border-green-200">
                  <div className="text-xl font-bold text-green-700">{newCount}</div>
                  <div className="text-xs text-green-600 font-semibold">NEW</div>
                </div>
                <div className="flex-1 bg-gray-50 p-2 rounded border border-gray-200">
                  <div className="text-xl font-bold text-gray-700">{unchangedCount}</div>
                  <div className="text-xs text-gray-600 font-semibold">UNCHANGED</div>
                </div>
                {(syncMode === 'full_sync' || syncMode === 'full_replacement') && (
                  <div className="flex-1 bg-red-50 p-2 rounded border border-red-200">
                    <div className="text-xl font-bold text-red-700">{removedCount}</div>
                    <div className="text-xs text-red-600 font-semibold">REMOVED</div>
                  </div>
                )}
              </div>

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200 font-semibold text-[13px] text-gray-500">
                  Preview (first 10 albums that will be processed)
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
                      {(() => {
                        let albumsToShow = comparedAlbums;
                        if (syncMode === 'new_only') albumsToShow = comparedAlbums.filter(a => a.status === 'NEW');
                        else if (syncMode === 'partial_sync') albumsToShow = comparedAlbums.filter(a => a.status === 'NEW' || (a.status === 'CHANGED' && a.needsEnrichment));
                        else if (syncMode === 'full_sync') albumsToShow = comparedAlbums.filter(a => a.status !== 'UNCHANGED');
                        
                        return albumsToShow.slice(0, 10).map((album, idx) => {
                          let statusColor = 'text-gray-500';
                          let statusDisplay: string = album.status;
                          let actionText = 'No action';

                          if (syncMode === 'full_replacement') {
                            if (album.status === 'REMOVED') {
                              statusColor = 'text-red-600';
                              statusDisplay = 'WILL DELETE';
                              actionText = 'Delete from database';
                            } else {
                              statusColor = 'text-emerald-600';
                              statusDisplay = 'WILL IMPORT';
                              actionText = 'Import + enrich';
                            }
                          } else if (album.status === 'NEW') {
                            statusColor = 'text-emerald-600';
                            statusDisplay = 'NEW';
                            actionText = 'Add + enrich';
                          } else if (album.status === 'CHANGED' && album.needsEnrichment) {
                            statusColor = 'text-amber-600';
                            statusDisplay = 'MISSING DATA';
                            actionText = album.missingFields.join(', ');
                          } else if (album.status === 'UNCHANGED') {
                            statusColor = 'text-gray-500';
                            statusDisplay = 'UNCHANGED';
                            actionText = 'Skip';
                          } else if (album.status === 'REMOVED') {
                            statusColor = 'text-red-600';
                            statusDisplay = 'REMOVED';
                            actionText = syncMode === 'full_sync' ? 'Delete' : 'Keep';
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
                        });
                      })()}
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
                <div><strong>{results.added}</strong> albums added</div>
                <div><strong>{results.updated}</strong> albums updated</div>
                {results.removed > 0 && <div><strong>{results.removed}</strong> albums removed</div>}
                <div><strong>{results.unchanged}</strong> albums unchanged</div>
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
                onClick={handleParseCSV}
                disabled={!file || comparedAlbums.length === 0}
                className={`px-4 py-2 border-none rounded text-sm font-semibold text-white ${
                  (file && comparedAlbums.length > 0) 
                    ? 'bg-orange-500 cursor-pointer hover:bg-orange-600' 
                    : 'bg-gray-300 cursor-not-allowed'
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

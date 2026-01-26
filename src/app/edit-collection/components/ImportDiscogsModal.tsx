// src/app/edit-collection/components/ImportDiscogsModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { parseDiscogsFormat } from '../../../lib/formatParser';
import { normalizeArtist, normalizeTitle, normalizeArtistAlbum } from '../../../lib/importUtils';

type SyncMode = 'full_replacement' | 'full_sync' | 'partial_sync' | 'new_only';
type ImportStage = 'select_mode' | 'fetching_definitions' | 'fetching' | 'preview' | 'importing' | 'complete';
type AlbumStatus = 'NEW' | 'CHANGED' | 'UNCHANGED' | 'REMOVED';
type DiscogsSourceType = 'collection' | 'wantlist';

// --- Interfaces for Discogs API Responses ---
interface DiscogsEntity {
  name: string;
  catno?: string;
  entity_type_name?: string;
  role?: string;
}

interface DiscogsNote {
  field_id: number;
  value: string;
}

interface DiscogsFormat {
  name: string;
  qty: string;
  descriptions?: string[];
}

interface DiscogsBasicInfo {
  id: number;
  master_id?: number;
  title: string;
  year?: number;
  artists?: { name: string }[];
  labels?: DiscogsEntity[];
  formats?: DiscogsFormat[];
  thumb?: string;
  cover_image?: string;
}

interface DiscogsItem {
  id: number;
  instance_id: number;
  folder_id: number;
  date_added: string;
  rating: number;
  notes?: DiscogsNote[];
  basic_information: DiscogsBasicInfo;
}

interface DiscogsCollectionResponse {
  pagination: {
    pages: number;
    items: number;
  };
  releases: DiscogsItem[];
}

interface DiscogsWantlistResponse {
  pagination: {
    pages: number;
    items: number;
  };
  wants: DiscogsItem[];
}

// Interface for Enrichment Data (Detailed Release)
interface DiscogsReleaseData {
  images?: { uri: string }[];
  genres?: string[];
  styles?: string[];
  notes?: string;
  country?: string;
  released?: string;
  identifiers?: { type: string; value: string; description?: string }[];
  tracklist?: {
    position?: string;
    title?: string;
    duration?: string;
    artists?: { name: string }[];
    type_?: string;
  }[];
  formats?: { descriptions?: string[] }[];
  extraartists?: { name: string; role: string }[];
  companies?: DiscogsEntity[];
}

// Interfaces for Metadata Lookups
interface DiscogsField {
    id: number;
    name: string;
    position: number;
}

interface DiscogsFolder {
    id: number;
    name: string;
    count: number;
}
// --------------------------------------------

interface ParsedAlbum {
  artist: string;
  title: string;
  format: string;
  labels: string[];
  cat_no: string | null;
  barcode: string | null;
  country: string | null;
  year: string | null;
  year_int: number | null;
  location: string;
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
  for_sale: boolean;
  index_number: number | null;
  cover_image: string | null;
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
function calculateDecade(year: string | null): number | null {
  if (!year) return null;
  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum <= 0) return null;
  return Math.floor(yearNum / 10) * 10;
}

// Compare albums logic
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
      year_int: null,
      location: 'Unknown',
      discogs_release_id: existingAlbum.discogs_release_id || '',
      discogs_master_id: null,
      date_added: new Date().toISOString(),
      media_condition: '',
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
      for_sale: false,
      index_number: null,
      cover_image: existingAlbum.image_url
    });
  }

  return compared;
}

// Discogs API enrichment
async function enrichFromDiscogs(releaseId: string): Promise<Record<string, unknown>> {
  await new Promise(resolve => setTimeout(resolve, 1100)); // Rate limiting

  const response = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);

  if (!response.ok) {
    throw new Error(`Discogs API error: ${response.status}`);
  }

  // Cast response to defined interface
  const data = (await response.json()) as DiscogsReleaseData;

  // Extract data
  const enriched: Record<string, unknown> = {
    image_url: data.images?.[0]?.uri || null,
    back_image_url: data.images?.[1]?.uri || null,
    genres: data.genres || [],
    styles: data.styles || [],
    packaging: data.formats?.[0]?.descriptions?.find((d) => 
      ['Gatefold', 'Single Sleeve', 'Digipak'].some(p => d.includes(p))
    ) || null,
    release_notes: data.notes || null,
    country: data.country || null,
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
      const year = parseInt(data.released.substring(0, 4));
      if (!isNaN(year)) enriched.original_release_year = year;
  }

  if (data.identifiers && Array.isArray(data.identifiers)) {
    const barcode = data.identifiers.find((i) => i.type === 'Barcode');
    if (barcode) {
        enriched.barcode = barcode.value;
    }
  }

  if (data.companies && Array.isArray(data.companies)) {
    const labels = data.companies
      .filter((c) => c.entity_type_name === 'Label')
      .map((c) => c.name);
    
    if (labels.length > 0) {
      enriched.labels = labels;
    }
  }

  // Format & Sound parsing
  if (data.formats && Array.isArray(data.formats)) {
    const soundDescriptions = data.formats[0]?.descriptions || [];
    const soundTypes = ['Stereo', 'Mono', 'Quadraphonic', 'Surround'];
    const sound = soundDescriptions.find((d) => 
      soundTypes.some(type => d.includes(type))
    );
    if (sound) enriched.sound = sound;
  }

  // Matrix & Identifiers parsing
  if (data.identifiers && Array.isArray(data.identifiers)) {
    const matrixEntries: Record<string, string> = {};
    
    data.identifiers.forEach((identifier) => {
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

  // Track parsing
  if (data.tracklist && Array.isArray(data.tracklist)) {
    const tracks: unknown[] = [];
    const discMetadata: { disc_number: number; title: string | null }[] = [];
    let position = 1;
    let currentDiscNumber = 1;
    let currentDiscTitle: string | null = null;

    data.tracklist.forEach((track) => {
      const positionStr = track.position || '';
      let discNumber = 1;
      let side = '';
      
      const sideMatch = positionStr.match(/^([A-Z])(\d+)?/);
      if (sideMatch) {
        side = sideMatch[1];
        discNumber = Math.ceil((side.charCodeAt(0) - 64) / 2);
      } else {
        const discMatch = positionStr.match(/^(\d+)-(\d+)?/);
        if (discMatch) {
          discNumber = parseInt(discMatch[1]);
        }
      }

      if (track.type_ === 'heading') {
        if (discNumber !== currentDiscNumber) {
            currentDiscNumber = discNumber;
            currentDiscTitle = track.title || null;
            if (!discMetadata.find(d => d.disc_number === discNumber)) {
                discMetadata.push({ disc_number: discNumber, title: currentDiscTitle });
            }
        }
        return;
      }

      tracks.push({
        position: position.toString(),
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

  // Credits parsing - Map to Objects for JSONB
  if (data.extraartists && Array.isArray(data.extraartists)) {
    enriched.musicians = data.extraartists
      .filter((a) => a.role && (a.role.toLowerCase().includes('musician') || a.role.toLowerCase().includes('performer')))
      .map((a) => ({ name: a.name, role: a.role }));
      
    enriched.producers = data.extraartists
      .filter((a) => a.role && a.role.toLowerCase().includes('producer'))
      .map((a) => ({ name: a.name, role: a.role }));
      
    enriched.engineers = data.extraartists
      .filter((a) => a.role && a.role.toLowerCase().includes('engineer'))
      .map((a) => ({ name: a.name, role: a.role }));
      
    enriched.songwriters = data.extraartists
      .filter((a) => a.role && (a.role.toLowerCase().includes('written-by') || a.role.toLowerCase().includes('songwriter')))
      .map((a) => ({ name: a.name, role: a.role }));
  }

  return enriched;
}

export default function ImportDiscogsModal({ isOpen, onClose, onImportComplete }: ImportDiscogsModalProps) {
  const [stage, setStage] = useState<ImportStage>('select_mode');
  const [sourceType, setSourceType] = useState<DiscogsSourceType>('collection');
  const [syncMode, setSyncMode] = useState<SyncMode>('partial_sync');
  
  const [comparedAlbums, setComparedAlbums] = useState<ComparedAlbum[]>([]);
  const [totalDatabaseCount, setTotalDatabaseCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  
  // Metadata Definitions
  const [folders, setFolders] = useState<Record<number, string>>({});
  const [fields, setFields] = useState<{media: number, sleeve: number, notes: number}>({ media: 0, sleeve: 0, notes: 0 });

  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [error, setError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  
  const [results, setResults] = useState({
    added: 0,
    updated: 0,
    removed: 0,
    unchanged: 0,
    errors: 0,
  });

  // Check connection on open
  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  const checkConnection = async () => {
    try {
      const res = await fetch('/api/discogs/collection?page=1');
      if (res.status === 401) {
        setIsConnected(false);
      } else if (res.ok) {
        setIsConnected(true);
      } else {
        // Connected but maybe empty
        setIsConnected(true);
      }
    } catch {
      setIsConnected(false);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/auth/discogs';
  };

  const fetchDefinitions = async () => {
      setStage('fetching_definitions');
      try {
          // Fetch Folders
          const folderRes = await fetch('/api/discogs/folders');
          if (folderRes.ok) {
              const folderData = await folderRes.json();
              const folderMap: Record<number, string> = {};
              folderData.folders?.forEach((f: DiscogsFolder) => folderMap[f.id] = f.name);
              setFolders(folderMap);
          }

          // Fetch Fields
          const fieldRes = await fetch('/api/discogs/fields');
          if (fieldRes.ok) {
              const fieldData = await fieldRes.json();
              const mapping = { media: 0, sleeve: 0, notes: 0 };
              fieldData.fields?.forEach((f: DiscogsField) => {
                  const name = f.name.toLowerCase();
                  if (name.includes('media')) mapping.media = f.id;
                  else if (name.includes('sleeve')) mapping.sleeve = f.id;
                  else if (name.includes('notes')) mapping.notes = f.id;
              });
              setFields(mapping);
          }
          return true;
      } catch (e) {
          console.warn("Could not fetch definitions", e);
          return false;
      }
  };

  const handleFetchFromDiscogs = async () => {
    await fetchDefinitions();
    setStage('fetching');
    setError(null);
    setComparedAlbums([]);
    
    try {
        // 1. Fetch from API pages
        let page = 1;
        let hasMore = true;
        const allFetchedItems: ParsedAlbum[] = [];
        const endpoint = sourceType === 'collection' ? '/api/discogs/collection' : '/api/discogs/wantlist';

        while (hasMore) {
            setProgress({ current: allFetchedItems.length, total: 0, status: `Fetching page ${page} from Discogs...` });
            
            const res = await fetch(`${endpoint}?page=${page}`);
            if (!res.ok) throw new Error('Failed to fetch from Discogs API');
            
            const data: DiscogsCollectionResponse | DiscogsWantlistResponse = await res.json();
            const items = sourceType === 'collection' 
              ? (data as DiscogsCollectionResponse).releases 
              : (data as DiscogsWantlistResponse).wants;
            
            if (!items || items.length === 0) {
                hasMore = false;
                break;
            }

            for (const item of items) {
                const info = item.basic_information;
                const artist = info.artists?.[0]?.name || 'Unknown';
                const title = info.title || 'Unknown';
                const year = info.year?.toString() || null;
                const yearInt = year ? parseInt(year) : null;
                
                // Extract values using fetched field IDs or Heuristic regex fallback
                let mediaCond = ''; // Default to empty string per schema audit
                let sleeveCond = null;
                let personalNoteStr = '';
                const conditionRegex = /^(Mint|Near Mint|Very Good|Good|Fair|Poor)/i;

                if (item.notes) {
                    for (const note of item.notes) {
                        if (fields.media && note.field_id === fields.media) mediaCond = note.value;
                        else if (fields.sleeve && note.field_id === fields.sleeve) sleeveCond = note.value;
                        else if (fields.notes && note.field_id === fields.notes) personalNoteStr = note.value;
                        else if (conditionRegex.test(note.value)) {
                            // If fields map failed, use regex fallback
                            if (mediaCond === '') mediaCond = note.value;
                            else if (!sleeveCond) sleeveCond = note.value; 
                        } else {
                            if (personalNoteStr) personalNoteStr += '; ';
                            personalNoteStr += note.value;
                        }
                    }
                }
                
                // Reconstruct Full Format String for parser
                let fullFormat = '';
                if (info.formats && info.formats.length > 0) {
                    const f = info.formats[0];
                    fullFormat = `${f.qty}x${f.name}`;
                    if (f.descriptions) fullFormat += `, ${f.descriptions.join(', ')}`;
                }

                // Map Folder to Location & For Sale
                const folderName = folders[item.folder_id] || 'Uncategorized';
                const isForSale = folderName.toLowerCase().includes('sale') || folderName.toLowerCase().includes('sell');

                // Ensure date is YYYY-MM-DD
                const dateAdded = item.date_added ? item.date_added.split('T')[0] : new Date().toISOString().split('T')[0];

                allFetchedItems.push({
                    artist,
                    title,
                    format: fullFormat,
                    labels: info.labels?.map((l: DiscogsEntity) => l.name) || [],
                    cat_no: info.labels?.[0]?.catno || null,
                    barcode: null, 
                    country: null,
                    year,
                    year_int: isNaN(yearInt!) ? null : yearInt,
                    location: sourceType === 'collection' && item.folder_id === 0 ? 'All' : 'Uncategorized',
                    for_sale: isForSale,
                    discogs_release_id: item.id.toString(),
                    discogs_master_id: info.master_id?.toString() || null,
                    date_added: dateAdded,
                    media_condition: mediaCond,
                    package_sleeve_condition: sleeveCond,
                    personal_notes: personalNoteStr,
                    my_rating: item.rating || null,
                    decade: calculateDecade(year),
                    artist_norm: normalizeArtist(artist),
                    title_norm: normalizeTitle(title),
                    artist_album_norm: normalizeArtistAlbum(artist, title),
                    album_norm: normalizeTitle(title),
                    index_number: item.instance_id,
                    cover_image: info.thumb || null
                });
            }

            if (page >= data.pagination.pages) {
                hasMore = false;
            } else {
                page++;
            }
        }

        // 2. Fetch Existing from DB to Compare
        const targetTable = sourceType === 'collection' ? 'collection' : 'wantlist';
        // Use unknown casting to satisfy TS without using 'any'
        const { data: existing, error: dbError } = await supabase
          .from(targetTable)
          .select('id, artist, title, artist_norm, title_norm, artist_album_norm, discogs_release_id, image_url, tracks, genres, packaging'); 

        if (dbError) throw dbError;

        setTotalDatabaseCount(existing?.length || 0);

        // 3. Run Comparison Logic
        const compared = compareAlbums(allFetchedItems, (existing || []) as unknown as ExistingAlbum[]);
        setComparedAlbums(compared);
        setStage('preview');

    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch from Discogs');
        setStage('select_mode');
    }
  };

  const handleStartImport = async () => {
    setStage('importing');
    setError(null);
    setImportErrors([]);

    try {
      let albumsToProcess: ComparedAlbum[] = [];

      // Determine which albums to process based on Sync Mode
      if (syncMode === 'full_replacement') {
        const targetTable = sourceType === 'collection' ? 'collection' : 'wantlist';
        await supabase.from(targetTable).delete().gt('id', 0); 
        albumsToProcess = comparedAlbums.filter(a => a.status !== 'REMOVED');
      } else if (syncMode === 'full_sync') {
        // Handle removals
        const removed = comparedAlbums.filter(a => a.status === 'REMOVED' && a.existingId);
        if (removed.length > 0) {
          const idsToDelete = removed.map(a => a.existingId!);
          const targetTable = sourceType === 'collection' ? 'collection' : 'wantlist';
          await supabase.from(targetTable).delete().in('id', idsToDelete);
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

      const targetTable = sourceType === 'collection' ? 'collection' : 'wantlist';

      const batchSize = 1; // Process one by one to avoid rate limiting on enrichment
      for (let i = 0; i < albumsToProcess.length; i += batchSize) {
        const batch = albumsToProcess.slice(i, i + batchSize);

        for (const album of batch) {
          setProgress({
            current: i + batch.indexOf(album) + 1,
            total: albumsToProcess.length,
            status: `Processing ${album.artist} - ${album.title}`,
          });

          try {
            // Use Record<string, unknown> instead of any
            // Base Data
            const albumData: Record<string, unknown> = {
              artist: album.artist,
              title: album.title,
              year: album.year,
              format: album.format,
              discogs_release_id: album.discogs_release_id,
              discogs_master_id: album.discogs_master_id,
              artist_norm: album.artist_norm,
              title_norm: album.title_norm,
              artist_album_norm: album.artist_album_norm,
              // Added discogs_id to match schema availability
              discogs_id: album.discogs_release_id, 
            };

            // Table specific fields
            if (sourceType === 'collection') {
                albumData.cat_no = album.cat_no;
                albumData.labels = album.labels;
                albumData.location = album.location;
                albumData.date_added = album.date_added;
                albumData.media_condition = album.media_condition;
                albumData.package_sleeve_condition = album.package_sleeve_condition;
                albumData.personal_notes = album.personal_notes;
                albumData.my_rating = album.my_rating;
                albumData.decade = album.decade;
                albumData.for_sale = album.for_sale;
                albumData.index_number = album.index_number;
                albumData.year_int = album.year_int;
                
                // Important: Map cover image directly in case enrichment is skipped
                if (album.cover_image) albumData.image_url = album.cover_image;
                
                // Parse format string for extra details (vinyl color etc)
                // ADDED: Await to fix the Promise error
                const formatData = await parseDiscogsFormat(album.format);
                
                // FIX: EXPLICIT MAPPING to avoid unknown keys
                // We do NOT spread formatData to avoid injecting 'unknownElements'
                const mappedFormatData = {
                    discs: formatData.discs,
                    rpm: formatData.rpm,
                    sound: formatData.sound,
                    vinyl_weight: formatData.vinyl_weight,
                    packaging: formatData.packaging,
                    extra: formatData.extraText, // Map extraText to 'extra' DB column
                    vinyl_color: formatData.vinyl_color ? [formatData.vinyl_color] : null // Map to ARRAY type
                };
                
                Object.assign(albumData, mappedFormatData);
            } else {
                // Wantlist specific
                albumData.date_added_to_wantlist = album.date_added;
                albumData.notes = album.personal_notes;
                albumData.cover_image = album.cover_image;
            }

            // Enrichment Logic (Only if NEW or Full Sync/Partial Sync needs it)
            if (sourceType === 'collection' && (
                album.status === 'NEW' || 
                syncMode === 'full_sync' || 
                (syncMode === 'partial_sync' && album.needsEnrichment)
            )) {
              const enrichedData = await enrichFromDiscogs(album.discogs_release_id);
              
              if (syncMode === 'full_sync' || album.status === 'NEW') {
                Object.assign(albumData, enrichedData);
              } else {
                // Smart merge for partial sync
                album.missingFields.forEach(field => {
                  if (enrichedData[field]) {
                    if (field === 'genres') albumData.genres = enrichedData.genres;
                    else if (field === 'styles') albumData.styles = enrichedData.styles;
                    else albumData[field] = enrichedData[field];
                  }
                });
              }
              
              // Double check image url after enrichment
              if (!albumData.image_url && album.cover_image) {
                 albumData.image_url = album.cover_image;
              }
            }

            // Database Operations
            if (album.status === 'NEW') {
              const { error: insertError } = await supabase.from(targetTable).insert(albumData);
              if (insertError) throw insertError;
              resultCounts.added++;
            } else {
              const { error: updateError } = await supabase.from(targetTable).update(albumData).eq('id', album.existingId!);
              if (updateError) throw updateError;
              if (album.status === 'CHANGED') resultCounts.updated++;
              else resultCounts.unchanged++;
            }
          } catch (err) {
            console.error(`Error processing ${album.artist} - ${album.title}:`, err);
            resultCounts.errors++;
            const message = err instanceof Error ? err.message : 'Unknown error';
            setImportErrors(prev => ([
              ...prev,
              `${album.artist} — ${album.title}: ${message}`
            ]));
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
    setStage('select_mode');
    setComparedAlbums([]);
    setTotalDatabaseCount(0);
    setProgress({ current: 0, total: 0, status: '' });
    setError(null);
    setImportErrors([]);
    setResults({ added: 0, updated: 0, removed: 0, unchanged: 0, errors: 0 });
    onClose();
  };

  if (!isOpen) return null;

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
      {/* FIXED: Added text-gray-900 to ensure text is visible on white background */}
      <div className="bg-white text-gray-900 rounded-lg w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
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

          {/* SELECT MODE STAGE */}
          {stage === 'select_mode' && (
            <>
              {!isConnected ? (
                <div className="text-center py-8">
                  <p className="mb-4 text-gray-600">Connect your Discogs account to sync directly.</p>
                  <button 
                    onClick={handleConnect}
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold transition-colors cursor-pointer"
                  >
                    Connect Discogs
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded text-sm font-medium">
                    <span>●</span> Connected to Discogs API
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Import Source</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setSourceType('collection')}
                            className={`p-3 border rounded text-left ${sourceType === 'collection' ? 'border-orange-500 bg-orange-50 text-orange-900' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}
                        >
                            <div className="font-bold">Collection</div>
                            <div className="text-xs opacity-70">Your owned releases</div>
                        </button>
                        <button
                            onClick={() => setSourceType('wantlist')}
                            className={`p-3 border rounded text-left ${sourceType === 'wantlist' ? 'border-pink-500 bg-pink-50 text-pink-900' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}
                        >
                            <div className="font-bold">Wantlist</div>
                            <div className="text-xs opacity-70">Items you want</div>
                        </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Sync Mode</label>
                    <div className="flex flex-col gap-2">
                      {[
                        { value: 'partial_sync', label: 'Partial Sync', desc: 'Add new & enrich items missing data (Recommended)' },
                        { value: 'new_only', label: 'New Only', desc: 'Only import albums not in database' },
                        { value: 'full_sync', label: 'Full Sync', desc: 'Update everything, remove deleted items' },
                        { value: 'full_replacement', label: 'Full Replacement', desc: 'Wipe database and re-import' },
                      ].map(mode => (
                        <label key={mode.value} className={`flex items-start p-3 border rounded-md cursor-pointer ${syncMode === mode.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                          <input
                            type="radio"
                            name="syncMode"
                            value={mode.value}
                            checked={syncMode === mode.value}
                            onChange={(e) => setSyncMode(e.target.value as SyncMode)}
                            className="mr-3 mt-0.5"
                          />
                          <div>
                            <div className="font-semibold text-gray-900 mb-0.5">{mode.label}</div>
                            <div className="text-xs text-gray-500">{mode.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* FETCHING STAGE */}
          {stage === 'fetching' || stage === 'fetching_definitions' && (
             <div className="text-center py-10 px-5">
                <div className="text-2xl mb-4">📡</div>
                <div className="text-gray-900 font-medium mb-2">Fetching from Discogs...</div>
                <div className="text-sm text-gray-500">{progress.status || (stage === 'fetching_definitions' ? 'Loading definitions...' : '')}</div>
                <div className="text-xs text-gray-400 mt-2">{progress.current} items found</div>
             </div>
          )}

          {/* PREVIEW STAGE */}
          {stage === 'preview' && (
            <>
              <div className="text-sm mb-4 bg-blue-50 p-3 rounded text-blue-800 border border-blue-200">
                Analyzed <strong>{comparedAlbums.length}</strong> items from your {sourceType}.
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
                  Preview (first 10 affected items)
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-[13px] border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-[1]">
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Artist</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Title</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparedAlbums.slice(0, 10).map((album, idx) => {
                          let statusColor = 'text-gray-500';
                          if (album.status === 'NEW') statusColor = 'text-emerald-600';
                          if (album.status === 'REMOVED') statusColor = 'text-red-600';
                          if (album.status === 'CHANGED') statusColor = 'text-amber-600';

                          return (
                            <tr key={idx} className="border-b border-gray-100 last:border-none">
                              <td className="px-3 py-2 text-gray-900">{album.artist}</td>
                              <td className="px-3 py-2 text-gray-900">{album.title}</td>
                              <td className={`px-3 py-2 font-semibold ${statusColor}`}>
                                {album.status}
                              </td>
                            </tr>
                          );
                        })
                      }
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
                  style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
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
                Sync Complete
              </h3>
              <div className="text-sm text-gray-500">
                <div><strong>{results.added}</strong> added</div>
                <div><strong>{results.updated}</strong> updated</div>
                {results.removed > 0 && <div><strong>{results.removed}</strong> removed</div>}
                {results.errors > 0 && (
                  <div className="text-red-600 mt-2 text-left">
                    <div><strong>{results.errors}</strong> errors occurred</div>
                    {importErrors.length > 0 && (
                      <ul className="mt-2 max-h-[140px] overflow-y-auto list-disc pl-5 text-[12px] text-red-700">
                        {importErrors.map((importError, index) => (
                          <li key={`${importError}-${index}`}>{importError}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3">
          {stage === 'select_mode' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-medium cursor-pointer text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleFetchFromDiscogs}
                disabled={!isConnected}
                className={`px-4 py-2 border-none rounded text-sm font-semibold text-white ${
                  isConnected 
                    ? 'bg-orange-500 cursor-pointer hover:bg-orange-600' 
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Analyze {sourceType === 'collection' ? 'Collection' : 'Wantlist'}
              </button>
            </>
          )}

          {stage === 'preview' && (
            <>
              <button
                onClick={() => setStage('select_mode')}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-medium cursor-pointer text-gray-700 hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handleStartImport}
                className="px-4 py-2 bg-orange-500 border-none rounded text-sm font-semibold cursor-pointer text-white hover:bg-orange-600"
              >
                Start Sync
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
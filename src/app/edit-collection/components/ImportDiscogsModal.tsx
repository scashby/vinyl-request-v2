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
// --------------------------------------------

const coerceYear = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildFormatLabel = (release?: { media_type?: string | null; format_details?: string[] | null; qty?: number | null } | null) => {
  if (!release) return '';
  const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
  const base = parts.join(', ');
  const qty = release.qty ?? 1;
  if (!base) return '';
  return qty > 1 ? `${qty}x${base}` : base;
};

const getOrCreateArtist = async (name: string) => {
  const { data: existing } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', name)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('artists')
    .insert({ name })
    .select('id')
    .single();

  if (error || !created) throw error;
  return created;
};

const getOrCreateMaster = async (artistId: number, title: string, year?: string | null) => {
  const { data: existing } = await supabase
    .from('masters')
    .select('id')
    .eq('title', title)
    .eq('main_artist_id', artistId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('masters')
    .insert({
      title,
      main_artist_id: artistId,
      original_release_year: coerceYear(year),
    })
    .select('id')
    .single();

  if (error || !created) throw error;
  return created;
};

const getOrCreateRelease = async (
  masterId: number,
  payload: {
    media_type: string;
    format_details: string[] | null;
    qty: number | null;
    label: string | null;
    catalog_number: string | null;
    barcode: string | null;
    country: string | null;
    release_year: number | null;
    discogs_release_id: string | null;
  }
) => {
  let existing = null;
  if (payload.discogs_release_id) {
    const { data } = await supabase
      .from('releases')
      .select('id')
      .eq('discogs_release_id', payload.discogs_release_id)
      .maybeSingle();
    existing = data;
  }

  if (!existing && payload.catalog_number) {
    const { data } = await supabase
      .from('releases')
      .select('id')
      .eq('master_id', masterId)
      .eq('catalog_number', payload.catalog_number)
      .maybeSingle();
    existing = data;
  }

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('releases')
    .insert({
      master_id: masterId,
      media_type: payload.media_type,
      format_details: payload.format_details,
      qty: payload.qty,
      label: payload.label,
      catalog_number: payload.catalog_number,
      barcode: payload.barcode,
      country: payload.country,
      release_year: payload.release_year,
      discogs_release_id: payload.discogs_release_id,
    })
    .select('id')
    .single();

  if (error || !created) throw error;
  return created;
};

const getOrCreateInventory = async (releaseId: number) => {
  const { data: existing } = await supabase
    .from('inventory')
    .select('id')
    .eq('release_id', releaseId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('inventory')
    .insert({ release_id: releaseId })
    .select('id')
    .single();

  if (error || !created) throw error;
  return created;
};

const splitDiscogsUpdates = (payload: Record<string, unknown>) => {
  const inventoryUpdates: Record<string, unknown> = {};
  const releaseUpdates: Record<string, unknown> = {};
  const masterUpdates: Record<string, unknown> = {};

  Object.entries(payload).forEach(([key, value]) => {
    switch (key) {
      case 'location':
      case 'media_condition':
      case 'personal_notes':
      case 'date_added':
        inventoryUpdates[key] = value ?? null;
        break;
      case 'sleeve_condition':
        inventoryUpdates.sleeve_condition = value ?? null;
        break;
      case 'label':
        releaseUpdates.label = value ?? null;
        break;
      case 'catalog_number':
        releaseUpdates.catalog_number = value ?? null;
        break;
      case 'barcode':
      case 'country':
      case 'discogs_release_id':
        releaseUpdates[key] = value ?? null;
        break;
      case 'year':
        releaseUpdates.release_year = coerceYear(value as string | null);
        break;
      case 'image_url':
      case 'cover_image':
        masterUpdates.cover_image_url = value ?? null;
        break;
      case 'genres':
      case 'styles':
      case 'discogs_master_id':
      case 'original_release_year':
        masterUpdates[key] = value ?? null;
        break;
      case 'notes':
      case 'release_notes':
        releaseUpdates.notes = value ?? null;
        break;
      default:
        break;
    }
  });

  return { inventoryUpdates, releaseUpdates, masterUpdates };
};

interface ParsedAlbum {
  artist: string;
  title: string;
  format: string;
  label: string | null;
  catalog_number: string | null;
  barcode: string | null;
  country: string | null;
  year: string | null;
  year_int: number | null;
  location: string;
  discogs_release_id: string;
  discogs_master_id: string | null;
  date_added: string;
  media_condition: string;
  sleeve_condition: string | null;
  personal_notes: string | null;
  artist_norm: string;
  title_norm: string;
  artist_album_norm: string;
  album_norm: string;
  cover_image: string | null;
}

interface ExistingAlbum {
  id: number;
  release_id?: number | null;
  master_id?: number | null;
  artist: string;
  title: string;
  artist_norm: string;
  title_norm: string;
  artist_album_norm: string;
  discogs_release_id: string | null;
  discogs_master_id?: string | null;
  format?: string | null;
  catalog_number?: string | null;
  media_condition?: string | null;
  sleeve_condition?: string | null;
  country?: string | null;
  year?: string | null;
  image_url?: string | null;
  cover_image?: string | null;
  tracks?: unknown[] | null;
  genres?: string[] | null;
}

interface ComparedAlbum extends ParsedAlbum {
  status: AlbumStatus;
  existingId?: number;
  existingReleaseId?: number | null;
  existingMasterId?: number | null;
  needsEnrichment: boolean;
  missingFields: string[];
}

interface ImportDiscogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const typedError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const parts = [typedError.message, typedError.details, typedError.hint]
      .filter((part): part is string => Boolean(part));
    if (parts.length > 0) return parts.join(' ');
    if (typedError.code) return `Error code: ${typedError.code}`;
  }
  return String(error);
}

function normalizeComparable(value?: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

function buildComparisonKey(data: {
  format?: string | null;
  catalog_number?: string | null;
  media_condition?: string | null;
  sleeve_condition?: string | null;
  country?: string | null;
  year?: string | null;
  discogs_master_id?: string | null;
}): string {
  return [
    normalizeComparable(data.format),
    normalizeComparable(data.catalog_number),
    normalizeComparable(data.media_condition),
    normalizeComparable(data.sleeve_condition),
    normalizeComparable(data.country),
    normalizeComparable(data.year),
    normalizeComparable(data.discogs_master_id),
  ].join('|');
}

// Compare albums logic
function compareAlbums(
  parsed: ParsedAlbum[],
  existing: ExistingAlbum[],
  sourceType: DiscogsSourceType
): ComparedAlbum[] {
  const releaseIdMap = new Map<string, ExistingAlbum>();
  const artistAlbumMap = new Map<string, ExistingAlbum[]>();
  const matchedDbIds = new Set<number>();
  
  existing.forEach(album => {
    if (album.discogs_release_id) {
      releaseIdMap.set(album.discogs_release_id, album);
    }
    const normalizedKey = normalizeArtistAlbum(album.artist, album.title);
    const entries = artistAlbumMap.get(normalizedKey) ?? [];
    entries.push(album);
    artistAlbumMap.set(normalizedKey, entries);
  });

  const compared: ComparedAlbum[] = [];

  for (const parsedAlbum of parsed) {
    let existingAlbum: ExistingAlbum | undefined;
    
    if (parsedAlbum.discogs_release_id) {
      existingAlbum = releaseIdMap.get(parsedAlbum.discogs_release_id);
    }
    
    if (!existingAlbum) {
      const candidates = artistAlbumMap.get(parsedAlbum.artist_album_norm);
      if (candidates && candidates.length > 0) {
        const parsedKey = buildComparisonKey(parsedAlbum);
        const matchIndex = candidates.findIndex(
          (candidate) => buildComparisonKey(candidate) === parsedKey
        );
        if (matchIndex >= 0) {
          existingAlbum = candidates[matchIndex];
          candidates.splice(matchIndex, 1);
          if (candidates.length === 0) {
            artistAlbumMap.delete(parsedAlbum.artist_album_norm);
          }
        }
      }
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
      
      const existingCoverImage = existingAlbum.image_url ?? existingAlbum.cover_image;
      if (!existingCoverImage) missingFields.push('cover images');
      if (sourceType === 'collection') {
        if (!existingAlbum.tracks || existingAlbum.tracks.length === 0) missingFields.push('tracks');
        if (!existingAlbum.genres || existingAlbum.genres.length === 0) missingFields.push('genres');
      }
      
      const isChanged = parsedAlbum.discogs_release_id !== existingAlbum.discogs_release_id;

      compared.push({
        ...parsedAlbum,
        status: isChanged || missingFields.length > 0 ? 'CHANGED' : 'UNCHANGED',
        existingId: existingAlbum.id,
        existingReleaseId: existingAlbum.release_id ?? null,
        existingMasterId: existingAlbum.master_id ?? null,
        needsEnrichment: missingFields.length > 0,
        missingFields,
      });

      matchedDbIds.add(existingAlbum.id);

      if (existingAlbum.discogs_release_id) {
        releaseIdMap.delete(existingAlbum.discogs_release_id);
      }

      const normalizedKey = normalizeArtistAlbum(existingAlbum.artist, existingAlbum.title);
      const matchedCandidates = artistAlbumMap.get(normalizedKey);
      if (matchedCandidates) {
        const remaining = matchedCandidates.filter((candidate) => candidate.id !== existingAlbum.id);
        if (remaining.length > 0) {
          artistAlbumMap.set(normalizedKey, remaining);
        } else {
          artistAlbumMap.delete(normalizedKey);
        }
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
      label: null,
      catalog_number: null,
      barcode: null,
      country: null,
      year: null,
      year_int: null,
      location: 'Unknown',
      discogs_release_id: existingAlbum.discogs_release_id || '',
      discogs_master_id: null,
      date_added: new Date().toISOString(),
      media_condition: '',
      sleeve_condition: null,
      personal_notes: null,
      artist_norm: normalizeArtist(existingAlbum.artist),
      title_norm: normalizeTitle(existingAlbum.title),
      artist_album_norm: normalizedKey,
      album_norm: normalizeTitle(existingAlbum.title),
      status: 'REMOVED',
      existingId: existingAlbum.id,
      existingReleaseId: existingAlbum.release_id ?? null,
      existingMasterId: existingAlbum.master_id ?? null,
      needsEnrichment: false,
      missingFields: [],
      cover_image: existingAlbum.image_url ?? existingAlbum.cover_image ?? null
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
    genres: data.genres || [],
    styles: data.styles || [],
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
      enriched.label = labels[0] ?? null;
    }
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

                // Ensure date is YYYY-MM-DD
                const dateAdded = item.date_added ? item.date_added.split('T')[0] : new Date().toISOString().split('T')[0];

                allFetchedItems.push({
                    artist,
                    title,
                    format: fullFormat,
                    label: info.labels?.[0]?.name || null,
                    catalog_number: info.labels?.[0]?.catno || null,
                    barcode: null, 
                    country: null,
                    year,
                    year_int: isNaN(yearInt!) ? null : yearInt,
                    location: sourceType === 'collection' && item.folder_id === 0 ? 'All' : 'Uncategorized',
                    discogs_release_id: item.id.toString(),
                    discogs_master_id: info.master_id?.toString() || null,
                    date_added: dateAdded,
                    media_condition: mediaCond,
                    sleeve_condition: sleeveCond,
                    personal_notes: personalNoteStr,
                    artist_norm: normalizeArtist(artist),
                    title_norm: normalizeTitle(title),
                    artist_album_norm: normalizeArtistAlbum(artist, title),
                    album_norm: normalizeTitle(title),
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
        let existing: ExistingAlbum[] = [];
        if (sourceType === 'collection') {
          const { data: existingRaw, error: dbError } = await supabase
            .from('inventory')
            .select(`
              id,
              location,
              media_condition,
              sleeve_condition,
              personal_notes,
              release:releases (
                id,
                label,
                catalog_number,
                barcode,
                country,
                release_year,
                discogs_release_id,
                media_type,
                format_details,
                qty,
                master:masters (
                  id,
                  title,
                  original_release_year,
                  cover_image_url,
                  genres,
                  styles,
                  discogs_master_id,
                  artist:artists ( name )
                )
              )
            `);
          if (dbError) throw dbError;
          existing = (existingRaw ?? []).map((row) => {
            const release = row.release as {
              id?: number | null;
              label?: string | null;
              catalog_number?: string | null;
              barcode?: string | null;
              country?: string | null;
              release_year?: number | null;
              discogs_release_id?: string | null;
              media_type?: string | null;
              format_details?: string[] | null;
              qty?: number | null;
              master?: {
                id?: number | null;
                title?: string | null;
                original_release_year?: number | null;
                cover_image_url?: string | null;
                genres?: string[] | null;
                styles?: string[] | null;
                discogs_master_id?: string | null;
                artist?: { name?: string | null } | null;
              } | null;
            } | null;
            const master = release?.master;
            const formatLabel = buildFormatLabel(release);
            const artistName = master?.artist?.name ?? 'Unknown Artist';
            const title = master?.title ?? 'Untitled';
            return {
              id: row.id as number,
              release_id: release?.id ?? null,
              master_id: master?.id ?? null,
              artist: artistName,
              title,
              artist_norm: normalizeArtist(artistName),
              title_norm: normalizeTitle(title),
              artist_album_norm: normalizeArtistAlbum(artistName, title),
              discogs_release_id: release?.discogs_release_id ?? null,
              discogs_master_id: master?.discogs_master_id ?? null,
              format: formatLabel,
              catalog_number: release?.catalog_number ?? null,
              media_condition: row.media_condition ?? null,
              sleeve_condition: row.sleeve_condition ?? null,
              country: release?.country ?? null,
              year: (release?.release_year ?? master?.original_release_year)?.toString() ?? null,
              image_url: master?.cover_image_url ?? null,
              cover_image: master?.cover_image_url ?? null,
              tracks: null,
              genres: master?.genres ?? null,
            } satisfies ExistingAlbum;
          });
        } else {
          const { data: existingRaw, error: dbError } = await supabase
            .from('wantlist')
            .select('id, artist, title, artist_norm, title_norm, artist_album_norm, discogs_release_id, discogs_master_id, format, year, cover_image');
          if (dbError) throw dbError;
          existing = (existingRaw ?? []).map((album) => {
            const wantlistAlbum = album as ExistingAlbum;
            return {
              ...wantlistAlbum,
              country: null,
              catalog_number: null,
              image_url: wantlistAlbum.cover_image ?? null,
              tracks: null,
              genres: null,
            };
          });
        }

        setTotalDatabaseCount(existing.length);

        // 3. Run Comparison Logic
        const compared = compareAlbums(allFetchedItems, existing, sourceType);
        setComparedAlbums(compared);
        setStage('preview');

    } catch (err) {
        setError(getErrorMessage(err) || 'Failed to fetch from Discogs');
        setStage('select_mode');
    }
  };

  const handleStartImport = async () => {
    setStage('importing');
    setError(null);
    setImportErrors([]);

    try {
      let albumsToProcess: ComparedAlbum[] = [];

      const isCollection = sourceType === 'collection';

      // Determine which albums to process based on Sync Mode
      if (syncMode === 'full_replacement') {
        if (isCollection) {
          await supabase.from('inventory').delete().gt('id', 0);
        } else {
          await supabase.from('wantlist').delete().gt('id', 0);
        }
        albumsToProcess = comparedAlbums.filter(a => a.status !== 'REMOVED');
      } else if (syncMode === 'full_sync') {
        // Handle removals
        const removed = comparedAlbums.filter(a => a.status === 'REMOVED' && a.existingId);
        if (removed.length > 0) {
          const idsToDelete = removed.map(a => a.existingId!);
          if (isCollection) {
            await supabase.from('inventory').delete().in('id', idsToDelete);
          } else {
            await supabase.from('wantlist').delete().in('id', idsToDelete);
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

      for (let i = 0; i < albumsToProcess.length; i += 1) {
        const album = albumsToProcess[i];
        setProgress({
          current: i + 1,
          total: albumsToProcess.length,
          status: `Processing ${album.artist} - ${album.title}`,
        });

        try {
            let payload: Record<string, unknown> = {};

            if (isCollection) {
              const normalizedFormat = album.format?.trim() || '';
              const normalizedMediaCondition = album.media_condition?.trim() || '';
              const formatData = await parseDiscogsFormat(normalizedFormat);

              payload = {
                artist: album.artist,
                title: album.title,
                year: album.year || undefined,
                discogs_release_id: album.discogs_release_id || undefined,
                discogs_master_id: album.discogs_master_id || undefined,
                catalog_number: album.catalog_number,
                label: album.label,
                location: album.location,
                date_added: album.date_added,
                sleeve_condition: album.sleeve_condition,
                personal_notes: album.personal_notes,
                media_condition: album.status === 'NEW' || normalizedMediaCondition ? normalizedMediaCondition || 'Unknown' : undefined,
                cover_image: album.cover_image || undefined,
                genres: undefined,
                styles: undefined,
              };

              const { inventoryUpdates, releaseUpdates, masterUpdates } = splitDiscogsUpdates(payload);
              releaseUpdates.media_type = formatData.media_type ?? 'Vinyl';
              releaseUpdates.format_details = formatData.format_details ?? null;
              releaseUpdates.qty = formatData.qty ?? 1;

              // Enrichment Logic (Only if NEW or Full Sync/Partial Sync needs it)
              if (
                album.status === 'NEW' ||
                syncMode === 'full_sync' ||
                (syncMode === 'partial_sync' && album.needsEnrichment)
              ) {
                const enrichedData = await enrichFromDiscogs(album.discogs_release_id);

                if (syncMode === 'full_sync' || album.status === 'NEW') {
                  const enrichedSplit = splitDiscogsUpdates({ ...payload, ...enrichedData });
                  Object.assign(inventoryUpdates, enrichedSplit.inventoryUpdates);
                  Object.assign(releaseUpdates, enrichedSplit.releaseUpdates);
                  Object.assign(masterUpdates, enrichedSplit.masterUpdates);
                } else {
                  album.missingFields.forEach((field) => {
                    if (enrichedData[field]) {
                      const enrichedSplit = splitDiscogsUpdates({ [field]: enrichedData[field] });
                      Object.assign(inventoryUpdates, enrichedSplit.inventoryUpdates);
                      Object.assign(releaseUpdates, enrichedSplit.releaseUpdates);
                      Object.assign(masterUpdates, enrichedSplit.masterUpdates);
                    }
                  });
                }
              }

              const artistRow = await getOrCreateArtist(album.artist);
              const masterRow = album.existingMasterId
                ? { id: album.existingMasterId }
                : await getOrCreateMaster(artistRow.id, album.title, album.year);
              const getString = (value: unknown): string | null =>
                typeof value === 'string' && value.trim().length > 0 ? value : null;
              const getNumber = (value: unknown): number | null =>
                typeof value === 'number' && !Number.isNaN(value) ? value : null;
              const getStringArray = (value: unknown): string[] =>
                Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
              const releaseRow = album.existingReleaseId
                ? { id: album.existingReleaseId }
                : await getOrCreateRelease(masterRow.id, {
                    media_type: getString(releaseUpdates.media_type) ?? 'Vinyl',
                    format_details: getStringArray(releaseUpdates.format_details),
                    qty: getNumber(releaseUpdates.qty) ?? 1,
                    label: getString(releaseUpdates.label),
                    catalog_number: getString(releaseUpdates.catalog_number),
                    barcode: getString(releaseUpdates.barcode),
                    country: getString(releaseUpdates.country),
                    release_year: getNumber(releaseUpdates.release_year),
                    discogs_release_id: getString(releaseUpdates.discogs_release_id) ?? album.discogs_release_id,
                  });
              const inventoryRow = album.existingId
                ? { id: album.existingId }
                : await getOrCreateInventory(releaseRow.id);

              if (Object.keys(inventoryUpdates).length > 0) {
                await supabase.from('inventory').update(inventoryUpdates as Record<string, unknown>).eq('id', inventoryRow.id);
              }
              if (Object.keys(releaseUpdates).length > 0) {
                await supabase.from('releases').update(releaseUpdates as Record<string, unknown>).eq('id', releaseRow.id);
              }
              if (Object.keys(masterUpdates).length > 0) {
                await supabase.from('masters').update(masterUpdates as Record<string, unknown>).eq('id', masterRow.id);
              }

              if (album.status === 'NEW') {
                resultCounts.added++;
              } else if (album.status === 'CHANGED') {
                resultCounts.updated++;
              } else {
                resultCounts.unchanged++;
              }
            } else {
              const wantlistData = {
                artist: album.artist,
                title: album.title,
                format: album.format?.trim() || 'Unknown',
                year: album.year || undefined,
                discogs_release_id: album.discogs_release_id || undefined,
                discogs_master_id: album.discogs_master_id || undefined,
                artist_norm: album.artist_norm,
                title_norm: album.title_norm,
                artist_album_norm: album.artist_album_norm,
                date_added_to_wantlist: album.date_added,
                notes: album.personal_notes,
                cover_image: album.cover_image,
              };

              if (album.status === 'NEW') {
                const { error: insertError } = await supabase.from('wantlist').insert(wantlistData);
                if (insertError) throw insertError;
                resultCounts.added++;
              } else {
                const { error: updateError } = await supabase.from('wantlist').update(wantlistData).eq('id', album.existingId!);
                if (updateError) throw updateError;
                if (album.status === 'CHANGED') resultCounts.updated++;
                else resultCounts.unchanged++;
              }
            }
        } catch (err) {
          console.error(`Error processing ${album.artist} - ${album.title}:`, err);
          resultCounts.errors++;
          const message = getErrorMessage(err);
          setImportErrors(prev => ([
            ...prev,
            `${album.artist} — ${album.title}: ${message}`
          ]));
        }
      }

      setResults(resultCounts);
      setStage('complete');
      if (onImportComplete) onImportComplete();
    } catch (err) {
      setError(getErrorMessage(err) || 'Import failed');
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
          {/* FIX: Wrapped condition in parens to fix rendering bug */}
          {(stage === 'fetching' || stage === 'fetching_definitions') && (
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
// AUDIT: inspected, no changes.

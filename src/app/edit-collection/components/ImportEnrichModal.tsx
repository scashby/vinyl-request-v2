// src/app/edit-collection/components/ImportEnrichModal.tsx
/* * ----------------------------------------------------------------------------
 * MODEL INSTRUCTION: DO NOT REMOVE OR CONSOLIDATE CODE WITHOUT APPROVAL.
 * KEEP DEBUGGING LOGS AND EXPANDED CONFIGURATION OBJECTS.
 * ----------------------------------------------------------------------------
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from 'lib/supabaseClient';
import EnrichmentReviewModal from './EnrichmentReviewModal';
import { type FieldConflict } from 'lib/conflictDetection';
import { parseDiscogsFormat } from 'lib/formatParser';
import { 
  type DataCategory, 
  type EnrichmentService,
  DATA_CATEGORY_CHECK_FIELDS, 
  FIELD_TO_SERVICES,
  SERVICE_ICONS,
  DATA_CATEGORY_LABELS,
  DATA_CATEGORY_ICONS
} from 'lib/enrichment-data-mapping';

const ALLOWED_COLUMNS = new Set([
  'artist', 'title', 'year', 'format', 'country', 'barcode', 'labels', 'cat_no',
  'tracklists', 'tracklist', 'tracks', 'disc_metadata', 
  'image_url', 'back_image_url', 'sell_price', 'media_condition', 'location', // FIXED: Was 'folder'
  'discogs_master_id', 'discogs_release_id', 'spotify_id', 'spotify_url',
  'apple_music_id', 'apple_music_url', 'lastfm_id', 'lastfm_url', 
  'musicbrainz_id', 'musicbrainz_url', 'wikipedia_url', 'genius_url', 'allmusic_url',
  'tags', 'lastfm_tags', 'notes', 'release_notes', 'master_notes', 'enriched_metadata', 'enrichment_summary', 'companies', 'genres', 'styles', 'original_release_date',
  'inner_sleeve_images', 'musicians', 'credits', 'producers', 'engineers', 
  'songwriters', 'composer', 'conductor', 'orchestra',
  'tempo_bpm', 'musical_key', 'lyrics', 'lyrics_url', 'time_signature', 
  'danceability', 'energy', 'mood_acoustic', 'mood_happy', 'mood_sad',
  'mood_aggressive', 'mood_electronic', 'mood_party', 'mood_relaxed',
  'rpm', 'vinyl_weight', 'vinyl_color', 'packaging', 'is_box_set', 'box_set', 'extra',
  // --- UNBLOCKED FIELDS ---
  'samples', 'sampled_by',
  'is_cover', 'original_artist', 'original_year',
  'tracks.lyrics', 'tracks.lyrics_url',
  'cultural_significance', 'recording_location', 'critical_reception', 'awards', 'certifications',
  'chart_positions', 'sort_title', 'subtitle', 'master_release_date', 'recording_date', 'recording_year',
  'allmusic_rating', 'allmusic_review', 'pitchfork_score', 'pitchfork_review',
  'apple_music_editorial_notes',
  'lastfm_similar_albums', 'allmusic_similar_albums'
]);

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

// --- 2. TYPES ---
interface ImportEnrichModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

// Map: FieldName -> Set of Allowed Service IDs
export type FieldConfigMap = Record<string, Set<string>>;

type EnrichmentStats = {
  total: number;
  needsEnrichment: number;
  fullyEnriched: number;
  missingArtwork: number;
  missingFrontCover?: number;
  missingBackCover: number;
  missingSpine?: number;
  missingInnerSleeve?: number;
  missingVinylLabel?: number;
  missingCredits: number;
  missingMusicians: number;
  missingProducers: number;
  missingEngineers?: number;
  missingSongwriters?: number;
  missingTracklists: number;
  missingDurations?: number; // New Type
  missingAudioAnalysis: number;
  missingTempo: number;
  missingMusicalKey?: number;
  missingDanceability?: number;
  missingEnergy?: number;
  missingGenres: number;
  missingStyles?: number;
  missingStreamingLinks: number;
  missingSpotify: number;
  missingAppleMusic?: number;
  missingLastFM?: number;
  missingReleaseMetadata: number;
  missingBarcode?: number;
  missingLabels?: number;
  missingOriginalDate?: number;
  missingCatalogNumber: number;
  // --- OPTIONAL STATS FOR NEW CATEGORIES ---
  missingLyrics?: number;
  missingReviews?: number;
  missingChartData?: number;
  missingSimilar?: number;
  missingContext?: number;
  fieldMissing?: Record<string, number>;
  fieldApplicable?: Record<string, number>;
};

type Album = {
  id: number;
  release_id?: number | null;
  master_id?: number | null;
  artist: string;
  title: string;
  image_url?: string | null;
  finalized_fields?: string[];
  last_reviewed_at?: string;
  enriched_metadata?: Record<string, unknown>; // New JSONB column
  [key: string]: unknown; // Allows dynamic access like album[key]
};

interface CandidateResult {
  album: Album;
  candidates: Record<string, unknown>;
}

type FetchCandidatesResponse = {
  success: boolean;
  error?: string;
  nextCursor?: number | null;
  results?: CandidateResult[];
  processedCount?: number;
};

type LogEntry = {
  id: string;
  album: string;
  action: 'auto-fill' | 'conflict-resolved' | 'skipped' | 'info';
  details: string;
  timestamp: Date;
};

type EnrichmentRunLogInsert = import('types/supabase').Database['public']['Tables']['enrichment_run_logs']['Insert'];

type ActiveServiceMap = ReturnType<typeof getServicesForSelectionFromConfig>;

const SERVICE_FLAG_TO_ID: Record<string, string> = {
  musicbrainz: 'musicbrainz',
  spotify: 'spotify',
  discogs: 'discogs',
  lastfm: 'lastfm',
  appleMusicEnhanced: 'appleMusic',
  allmusic: 'allmusic',
  wikipedia: 'wikipedia',
  genius: 'genius',
  coverArt: 'coverArtArchive',
  whosampled: 'whosampled',
  secondhandsongs: 'secondhandsongs',
  theaudiodb: 'theaudiodb',
  wikidata: 'wikidata',
  setlistfm: 'setlistfm',
  rateyourmusic: 'rateyourmusic',
  fanarttv: 'fanarttv',
  deezer: 'deezer',
  musixmatch: 'musixmatch',
  popsike: 'popsike',
  pitchfork: 'pitchfork',
};

const normalizeSourceForLog = (source: string): string => {
  if (source === 'coverArt') return 'coverArtArchive';
  if (source === 'appleMusicEnhanced') return 'appleMusic';
  return source;
};

const createEnrichmentRunId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

function getServicesForSelectionFromConfig(config: FieldConfigMap) {
  const activeServices = new Set<string>();

  Object.values(config).forEach(allowedSources => {
    allowedSources.forEach(s => activeServices.add(s));
  });

  return {
    musicbrainz: activeServices.has('musicbrainz'),
    spotify: activeServices.has('spotify'),
    discogs: activeServices.has('discogs'),
    lastfm: activeServices.has('lastfm'),
    appleMusicEnhanced: activeServices.has('appleMusic'),
    allmusic: activeServices.has('allmusic'),
    wikipedia: activeServices.has('wikipedia'),
    genius: activeServices.has('genius'),
    coverArt: activeServices.has('coverArtArchive'),
    whosampled: activeServices.has('whosampled'),
    secondhandsongs: activeServices.has('secondhandsongs'),
    theaudiodb: activeServices.has('theaudiodb'),
    wikidata: activeServices.has('wikidata'),
    setlistfm: activeServices.has('setlistfm'),
    rateyourmusic: activeServices.has('rateyourmusic'),
    fanarttv: activeServices.has('fanarttv'),
    deezer: activeServices.has('deezer'),
    musixmatch: activeServices.has('musixmatch'),
    popsike: activeServices.has('popsike'),
    pitchfork: activeServices.has('pitchfork'),
  };
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isTransientFetchError = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const lower = msg.toLowerCase();
  return (
    lower.includes('err_network_io_suspended') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network connection') ||
    lower.includes('load failed') ||
    lower.includes('timeout') ||
    lower.includes('temporarily unavailable')
  );
};

const checkedSourcesFromActiveServices = (activeServices: ActiveServiceMap): string[] => {
  return Object.entries(activeServices)
    .filter(([, enabled]) => !!enabled)
    .map(([flag]) => SERVICE_FLAG_TO_ID[flag] ?? flag)
    .sort();
};

const DEFERRED_CATEGORY_REASONS: Partial<Record<DataCategory, string>> = {};
const CLASSICAL_ONLY_FIELDS = new Set(['composer', 'conductor', 'orchestra', 'chorus', 'composition']);
const TRACKED_ENRICHMENT_CATEGORIES = new Set<DataCategory>([
  'artwork',
  'credits',
  'tracklists',
  'genres',
  'streaming_links',
  'release_metadata',
  'lyrics',
]);

// Local interface for resolution history
interface ResolutionHistory {
  album_id: number;
  field_name: string;
  source: string;
}

type ConflictResolutionWriteRow = {
  album_id: number;
  field_name: string;
  source: string;
  resolution: string;
  kept_value: import('types/supabase').Json | null;
  resolved_at: string;
};

// Extended type for Multi-Source Conflicts
export type ExtendedFieldConflict = FieldConflict & {
  source: string;
  candidates?: Record<string, unknown>; // map of source -> value
  existing_finalized?: string[];
  release_id?: number | null;
  master_id?: number | null;
  artist?: string;
  title?: string;
  format?: string;
  year?: string | number | null;
  country?: string;
  cat_no?: string;
  catalog_number?: string;
  barcode?: string;
  labels?: string[];
  label?: string;
};

// Helper to normalize values for comparison
const normalizeValue = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return String(val);
  
  // Helper: Strip protocol, query params, trailing slash, lowercase
  const clean = (s: unknown) => String(s).trim().toLowerCase()
    .replace(/^https?:\/\//, '') // Ignore http vs https
    .replace(/\/+$/, '')         // Ignore trailing slashes
    .split('?')[0];              // Ignore query params (common in images)

  if (Array.isArray(val)) {
    const validItems = val.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (validItems.length === 0) return '';
    return JSON.stringify(validItems.map(clean).sort());
  }
  
  if (typeof val === 'object') return JSON.stringify(val);
  return clean(val);
};

const hasMeaningfulValue = (val: unknown): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) {
    return val.some((item) => hasMeaningfulValue(item));
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return Object.values(obj).some((item) => hasMeaningfulValue(item));
  }
  return true;
};

const isEmptyValue = (val: unknown): boolean => {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (Array.isArray(val)) {
    return val.length === 0 || val.every((item) => isEmptyValue(item));
  }
  if (typeof val === 'object') {
    return Object.keys(val as object).length === 0;
  }
  return false;
};

const isFieldMissingOnAlbum = (album: Record<string, unknown>, field: string): boolean => {
  if (field === 'tracks.lyrics_url') {
    return isEmptyValue(album.tracks_lyrics_url);
  }
  if (field === 'tracks.lyrics') {
    const hasLyrics = !isEmptyValue(album.tracks_lyrics);
    const hasLyricsUrl = !isEmptyValue(album.tracks_lyrics_url);
    return !(hasLyrics || hasLyricsUrl);
  }
  if (field === 'labels') {
    return isEmptyValue(album.labels) && isEmptyValue(album.label);
  }
  if (field === 'release_notes') {
    return isEmptyValue(album.release_notes) && isEmptyValue(album.notes);
  }
  if (field === 'original_release_date') {
    return isEmptyValue(album.original_release_date) && isEmptyValue(album.year);
  }

  const rootField = field.split('.')[0];
  if (!isEmptyValue(album[field])) return false;
  return isEmptyValue(album[rootField]);
};

const areValuesEqual = (a: unknown, b: unknown): boolean => {
  return normalizeValue(a) === normalizeValue(b);
};

const toJsonValue = (value: unknown): import('types/supabase').Json | null => {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as import('types/supabase').Json;
  } catch {
    return null;
  }
};

const parseDurationToSeconds = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  if (str.endsWith('s')) {
    const num = parseInt(str.slice(0, -1), 10);
    return Number.isNaN(num) ? null : num;
  }
  const parts = str.split(':').map(p => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

const extractSide = (position: unknown): string | null => {
  if (typeof position !== 'string') return null;
  const match = position.trim().match(/^([A-Za-z])/);
  return match ? match[1].toUpperCase() : null;
};

const extractDiscNumber = (position: string): number => {
  const trimmed = position.trim().toUpperCase();
  const sideMatch = trimmed.match(/^([A-Z])/);
  if (sideMatch?.[1]) {
    const idx = sideMatch[1].charCodeAt(0) - 65;
    if (idx >= 0) return Math.floor(idx / 2) + 1;
  }
  const discMatch = trimmed.match(/^(\d+)[-./]/);
  if (discMatch?.[1]) {
    const num = Number(discMatch[1]);
    if (!Number.isNaN(num) && num > 0) return num;
  }
  return 1;
};

const deriveDiscDataFromTracks = (tracks: Record<string, unknown>[]) => {
  const discMap = new Map<number, Set<string>>();
  tracks.forEach((track) => {
    const pos = String(track.position ?? '').trim();
    if (!pos) return;
    const discNumber = extractDiscNumber(pos);
    const side = extractSide(pos);
    if (!discMap.has(discNumber)) discMap.set(discNumber, new Set());
    if (side) discMap.get(discNumber)?.add(side);
  });
  if (discMap.size === 0) return null;
  const discNumbers = Array.from(discMap.keys()).sort((a, b) => a - b);
  const disc_metadata = discNumbers.map((num) => ({
    disc_number: num,
    title: `Disc #${num}`,
    storage_device: null,
    slot: null
  }));
  const matrix_numbers: Record<string, { side_a: string; side_b: string }> = {};
  discNumbers.forEach((num) => {
    matrix_numbers[String(num)] = { side_a: '', side_b: '' };
  });
  return { disc_metadata, matrix_numbers };
};

// Helper to validate Postgres dates
const isValidDate = (dateStr: unknown): boolean => {
  if (typeof dateStr !== 'string') return false;
  // Strict check for YYYY-MM-DD.
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
};

type UpdateBatch = {
  inventoryUpdates: Record<string, unknown>;
  releaseUpdates: Record<string, unknown>;
  masterUpdates: Record<string, unknown>;
  albumCredits: Record<string, unknown>;
  tagNames: string[];
};

const coerceYear = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const extractIdFromUrl = (value: unknown, marker: string): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('http')) return trimmed;
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return null;
  const part = trimmed.slice(idx + marker.length);
  return part.split(/[/?#]/)[0] || null;
};

const normalizeCreditsValue = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.filter(Boolean);
  return value;
};

const appendAlbumCredits = (bucket: Record<string, unknown>, key: string, value: unknown) => {
  const normalized = normalizeCreditsValue(value);
  if (normalized === undefined) return;
  bucket[key] = normalized;
};

const splitV3Updates = (updates: Record<string, unknown>): UpdateBatch => {
  const inventoryUpdates: Record<string, unknown> = {};
  const releaseUpdates: Record<string, unknown> = {};
  const masterUpdates: Record<string, unknown> = {};
  const albumCredits: Record<string, unknown> = {};
  const tagNames: string[] = [];
  const artwork: Record<string, unknown> = {};
  const albumDetails: Record<string, unknown> = {};

  Object.entries(updates).forEach(([key, value]) => {
    switch (key) {
      case 'location':
      case 'personal_notes':
      case 'media_condition':
      case 'sleeve_condition':
      case 'package_sleeve_condition':
        inventoryUpdates[key === 'package_sleeve_condition' ? 'sleeve_condition' : key] = value;
        break;
      case 'owner':
      case 'purchase_price':
      case 'current_value':
      case 'purchase_date':
      case 'play_count':
      case 'last_played_at':
        inventoryUpdates[key] = value ?? null;
        break;
      case 'labels':
        releaseUpdates.label = Array.isArray(value) ? value[0] ?? null : value;
        break;
      case 'format': {
        const formatString = typeof value === 'string' ? value.trim() : '';
        if (formatString) {
          const parsed = parseDiscogsFormat(formatString);
          releaseUpdates.media_type = parsed.media_type ?? releaseUpdates.media_type;
          releaseUpdates.format_details = parsed.format_details ?? releaseUpdates.format_details;
          releaseUpdates.qty = parsed.qty ?? releaseUpdates.qty;
          releaseUpdates.rpm = parsed.rpm ?? releaseUpdates.rpm ?? null;
          releaseUpdates.vinyl_weight = parsed.weight ?? releaseUpdates.vinyl_weight ?? null;
          releaseUpdates.vinyl_color = parsed.color ? [parsed.color] : releaseUpdates.vinyl_color ?? null;
          releaseUpdates.packaging = parsed.packaging ?? releaseUpdates.packaging ?? null;
          releaseUpdates.box_set = parsed.box_set ?? releaseUpdates.box_set ?? null;
          releaseUpdates.qty = parsed.qty ?? releaseUpdates.qty ?? null;
        }
        break;
      }
      case 'cat_no':
        releaseUpdates.catalog_number = value ?? null;
        break;
      case 'barcode':
      case 'country':
      case 'discogs_release_id':
        releaseUpdates[key] = value ?? null;
        break;
      case 'spotify_id':
        releaseUpdates.spotify_album_id = value ?? null;
        break;
      case 'spotify_url':
        releaseUpdates.spotify_album_id =
          extractIdFromUrl(value, '/album/') ?? value ?? null;
        break;
      case 'notes':
      case 'release_notes':
        releaseUpdates.notes = value ?? null;
        break;
      case 'master_notes':
        masterUpdates.notes = value ?? null;
        break;
      case 'year':
        releaseUpdates.release_year = coerceYear(value);
        break;
      case 'original_release_date':
        if (isValidDate(value)) {
          releaseUpdates.release_date = value;
          const yearMatch = String(value).match(/^(\d{4})/);
          if (yearMatch) {
            const yearNum = Number(yearMatch[1]);
            if (!Number.isNaN(yearNum)) {
              masterUpdates.original_release_year = yearNum;
            }
          }
        }
        break;
      case 'image_url':
        masterUpdates.cover_image_url = value ?? null;
        break;
      case 'genres':
      case 'styles':
      case 'discogs_master_id':
        masterUpdates[key] = value ?? null;
        break;
      case 'tags':
      case 'lastfm_tags':
        if (Array.isArray(value)) {
          value.forEach((tag) => {
            const cleaned = String(tag ?? '').trim();
            if (cleaned) tagNames.push(cleaned);
          });
        } else if (typeof value === 'string') {
          const cleaned = value.trim();
          if (cleaned) tagNames.push(cleaned);
        }
        break;
      case 'musicbrainz_id':
        masterUpdates.musicbrainz_release_group_id = value ?? null;
        break;
      case 'musicians':
      case 'producers':
      case 'engineers':
      case 'songwriters':
      case 'composer':
      case 'conductor':
      case 'chorus':
      case 'composition':
      case 'orchestra':
        masterUpdates[key] = normalizeCreditsValue(value) ?? null;
        break;
      case 'back_image_url':
      case 'spine_image_url':
      case 'inner_sleeve_images':
      case 'vinyl_label_images':
        appendAlbumCredits(artwork, key, value);
        break;
      case 'sort_title':
      case 'subtitle':
      case 'master_release_date':
      case 'recording_date':
      case 'recording_year':
      case 'recording_location':
      case 'critical_reception':
      case 'cultural_significance':
      case 'chart_positions':
      case 'awards':
      case 'certifications':
      case 'allmusic_rating':
      case 'allmusic_review':
      case 'pitchfork_score':
      case 'pitchfork_review':
      case 'lastfm_similar_albums':
      case 'allmusic_similar_albums':
        masterUpdates[key] = normalizeCreditsValue(value) ?? null;
        break;
      case 'packaging':
      case 'vinyl_color':
      case 'vinyl_weight':
      case 'rpm':
      case 'spars_code':
      case 'box_set':
      case 'sound':
      case 'studio':
      case 'disc_metadata':
      case 'matrix_numbers':
        releaseUpdates[key] = normalizeCreditsValue(value) ?? null;
        break;
      case 'tracklist':
      case 'tracklists':
      case 'tempo_bpm':
      case 'musical_key':
      case 'energy':
      case 'danceability':
      case 'mood_acoustic':
      case 'mood_electronic':
      case 'mood_happy':
      case 'mood_sad':
      case 'mood_aggressive':
      case 'mood_relaxed':
      case 'mood_party':
      case 'apple_music_editorial_notes':
      case 'companies':
      case 'enrichment_sources':
      case 'purchase_store':
      case 'signed_by':
      case 'my_rating':
      case 'last_cleaned_date':
      case 'played_history':
      case 'apple_music_id':
      case 'lastfm_id':
      case 'musicbrainz_url':
      case 'enriched_metadata':
      case 'enrichment_summary':
      case 'finalized_fields':
      case 'last_reviewed_at':
        appendAlbumCredits(albumDetails, key, value);
        break;
      case 'apple_music_url':
      case 'lastfm_url':
      case 'allmusic_url':
      case 'wikipedia_url':
      case 'genius_url':
        masterUpdates[key] = normalizeCreditsValue(value) ?? null;
        break;
      case 'custom_links':
        masterUpdates.custom_links = value ?? null;
        break;
      default:
        break;
    }
  });

  if (Object.keys(artwork).length > 0) {
    albumCredits.artwork = artwork;
  }
  if (Object.keys(albumDetails).length > 0) {
    albumCredits.album_details = albumDetails;
  }

  return { inventoryUpdates, releaseUpdates, masterUpdates, albumCredits, tagNames };
};

const mergeRecordingCredits = (
  existing: unknown,
  albumCredits: Record<string, unknown>
): Record<string, unknown> => {
  if (!albumCredits || Object.keys(albumCredits).length === 0) {
    return typeof existing === 'object' && existing !== null && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  }
  const base =
    typeof existing === 'object' && existing !== null && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...base,
    ...albumCredits,
  };
};

const applyAlbumCreditsToRecordings = async (
  albumId: number,
  albumCredits: Record<string, unknown>
) => {
  if (!albumId || Object.keys(albumCredits).length === 0) return;

  const { data: inventoryRow, error } = await supabase
    .from('inventory')
    .select(`
      id,
      release:releases (
        id,
        release_tracks:release_tracks (
          id,
          recording:recordings ( id, credits )
        )
      )
    `)
    .eq('id', albumId)
    .single();

  if (error || !inventoryRow) return;
  const release = toSingle(inventoryRow.release);
  const releaseTracks = release?.release_tracks ?? [];
  if (releaseTracks.length === 0) return;

  const updates = releaseTracks
    .map((track) => {
      const recording = toSingle(track.recording);
      if (!recording?.id) return null;
      
      const mergedCredits = mergeRecordingCredits(recording.credits, albumCredits);
      
      // EXTRACT VALUES FROM THE JSON TO SAVE TO COLUMNS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const details = (mergedCredits as any).album_details || {};

      return Promise.resolve(
        supabase
          .from('recordings')
          .update({ 
            credits: mergedCredits as unknown as import('types/supabase').Json,
            // FORCE DATA INTO THE COLUMNS
            bpm: details.tempo_bpm ? Math.round(Number(details.tempo_bpm)) : null,
            energy: details.energy ? Number(details.energy) : null,
            danceability: details.danceability ? Number(details.danceability) : null,
            valence: details.mood_happy ? Number(details.mood_happy) : null,
            musical_key: details.musical_key || null
          })
          .eq('id', recording.id)
      );
    })
    .filter(Boolean) as Promise<unknown>[];

  if (updates.length > 0) {
    await Promise.all(updates);
  }
};

const addTagsToMaster = async (masterId: number, tags: string[]) => {
  const cleaned = Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean)));
  if (!masterId || cleaned.length === 0) return;

  await supabase
    .from('master_tags')
    .upsert(
      cleaned.map((name) => ({ name, category: 'custom' })),
      { onConflict: 'name' }
    );

  const { data: tagRows } = await supabase
    .from('master_tags')
    .select('id, name')
    .in('name', cleaned);

  if (!tagRows || tagRows.length === 0) return;

  const tagIds = tagRows.map((row) => row.id).filter(Boolean);
  const { data: existingLinks } = await supabase
    .from('master_tag_links')
    .select('tag_id')
    .eq('master_id', masterId)
    .in('tag_id', tagIds);

  const existingIds = new Set((existingLinks ?? []).map((row) => row.tag_id));
  const newLinks = tagIds
    .filter((id) => !existingIds.has(id))
    .map((tag_id) => ({ master_id: masterId, tag_id }));

  if (newLinks.length > 0) {
    await supabase.from('master_tag_links').insert(newLinks);
  }
};

// --- 3. MAIN COMPONENT ---
export default function ImportEnrichModal({ isOpen, onClose, onImportComplete }: ImportEnrichModalProps) {
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [status, setStatus] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [batchSize, setBatchSize] = useState('10');
  const [autoSnooze, setAutoSnooze] = useState(true); // Default to true (30-day skip)
  const [missingDataOnly, setMissingDataOnly] = useState(false);
  
  const [fieldConfig, setFieldConfig] = useState<FieldConfigMap>({});

  // Initialize Default State on Load
  useEffect(() => {
    if (isOpen) {
      const initialConfig: FieldConfigMap = {};
      // Default enabled categories
      const defaultCats: DataCategory[] = ['artwork', 'credits', 'tracklists', 'genres', 'sonic_domain'];
      
      defaultCats.forEach(cat => {
        const fields = DATA_CATEGORY_CHECK_FIELDS[cat] || [];
        fields.forEach(field => {
          if (ALLOWED_COLUMNS.has(field)) {
            const services = FIELD_TO_SERVICES[field] || [];
            if (services.length > 0) {
              initialConfig[field] = new Set(services);
            }
          }
        });
      });
      setFieldConfig(initialConfig);
    }
  }, [isOpen]);
  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryTitle, setCategoryTitle] = useState('');
  const [categoryAlbums, setCategoryAlbums] = useState<Album[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  
  const [showReview, setShowReview] = useState(false);
  const [conflicts, setConflicts] = useState<ExtendedFieldConflict[]>([]);
  const [sessionLog, setSessionLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [batchSummary, setBatchSummary] = useState<{album: string, field: string, action: string}[] | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [historyWriteEnabled, setHistoryWriteEnabled] = useState(true);
  const [auditLogWriteEnabled, setAuditLogWriteEnabled] = useState(true);
  const historyWriteModeRef = useRef<'upsert' | 'insert' | 'disabled'>('upsert');
  const historyDisabledRef = useRef(false);
  const auditDisabledRef = useRef(false);

  // Loop Control Refs
  const hasMoreRef = useRef(true);
  const isLoopingRef = useRef(false);
  const cursorRef = useRef(0); // Tracks current position in DB
  const statsRefreshInFlightRef = useRef(false);

  useEffect(() => {
    if (isOpen) loadStats();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setCurrentRunId(null);
      setHistoryWriteEnabled(true);
      setAuditLogWriteEnabled(true);
      historyWriteModeRef.current = 'upsert';
      historyDisabledRef.current = false;
      auditDisabledRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionLog]);

  async function loadStats(background = false) {
    if (statsRefreshInFlightRef.current) return;
    statsRefreshInFlightRef.current = true;
    if (!background) setLoading(true);
    try {
      const res = await fetch('/api/enrich-sources/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      statsRefreshInFlightRef.current = false;
      if (!background) setLoading(false);
    }
  }

  function getServicesForSelection() {
    return getServicesForSelectionFromConfig(fieldConfig);
  }

  function disableHistoryWrites(context: string, error: unknown) {
    if (historyDisabledRef.current) return;
    historyDisabledRef.current = true;
    historyWriteModeRef.current = 'disabled';
    setHistoryWriteEnabled(false);
    const message = error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message)
      : 'Unknown error';
    addLog('System', 'skipped', `Disabled conflict history writes (${context}): ${message}`);
  }

  async function persistConflictResolutionHistory(rows: ConflictResolutionWriteRow[], context: string) {
    if (rows.length === 0 || historyWriteModeRef.current === 'disabled' || historyDisabledRef.current) return;

    if (historyWriteModeRef.current === 'upsert') {
      const { error } = await supabase
        .from('import_conflict_resolutions')
        .upsert(rows, { onConflict: 'album_id,field_name,source' });

      if (!error) return;

      const message = error.message || '';
      if (message.toLowerCase().includes('no unique or exclusion constraint')) {
        historyWriteModeRef.current = 'insert';
        addLog('System', 'info', `Conflict history fallback: switching to insert mode (${context}).`);
      } else {
        disableHistoryWrites(context, error);
        return;
      }
    }

    if (historyWriteModeRef.current === 'insert') {
      const { error } = await supabase.from('import_conflict_resolutions').insert(rows);
      if (error) {
        disableHistoryWrites(`${context} (insert fallback)`, error);
      }
    }
  }

  async function persistEnrichmentRunLogs(rows: EnrichmentRunLogInsert[]) {
    if (!auditLogWriteEnabled || auditDisabledRef.current || rows.length === 0) return;
    const { error } = await supabase.from('enrichment_run_logs').insert(rows);
    if (error) {
      auditDisabledRef.current = true;
      setAuditLogWriteEnabled(false);
      addLog('System', 'skipped', `Disabled enrichment run logging: ${error.message}`);
    }
  }

  const toggleField = (field: string) => {
    setFieldConfig(prev => {
      const next = { ...prev };
      if (next[field]) {
        delete next[field];
      } else {
        const defaults = FIELD_TO_SERVICES[field] || [];
        next[field] = new Set(defaults);
      }
      return next;
    });
  };

  const toggleFieldSource = (field: string, service: string) => {
    setFieldConfig(prev => {
      if (!prev[field]) return prev;
      const nextSources = new Set(prev[field]);
      if (nextSources.has(service)) nextSources.delete(service);
      else nextSources.add(service);
      return { ...prev, [field]: nextSources };
    });
  };

  const toggleCategory = (category: DataCategory) => {
    const fields = DATA_CATEGORY_CHECK_FIELDS[category] || [];
    const validFields = fields.filter(f => ALLOWED_COLUMNS.has(f));
    const allEnabled = validFields.every(f => !!fieldConfig[f]);

    setFieldConfig(prev => {
      const next = { ...prev };
      validFields.forEach(f => {
        if (allEnabled) {
          delete next[f];
        } else {
          const defaults = FIELD_TO_SERVICES[f] || [];
          next[f] = new Set(defaults);
        }
      });
      return next;
    });
  };

  function addLog(album: string, action: LogEntry['action'], details: string) {
    setSessionLog(prev => [...prev, {
      id: Math.random().toString(36),
      album,
      action,
      details,
      timestamp: new Date()
    }]);
  }

  // --- MAIN LOOP LOGIC ---

  async function startEnrichment(specificAlbumIds?: number[]) {
    if (Object.keys(fieldConfig).length === 0) {
      alert('Please select at least one field to enrich');
      return;
    }

    hasMoreRef.current = true;
    isLoopingRef.current = true;
    cursorRef.current = 0; 
    setConflicts([]);
    if (!currentRunId) {
      setCurrentRunId(createEnrichmentRunId());
    }
    
    if (specificAlbumIds && specificAlbumIds.length > 0) {
      isLoopingRef.current = false;
    }

    await runScanLoop(specificAlbumIds);
  }

  async function runScanLoop(specificAlbumIds?: number[]) {
    if (!hasMoreRef.current && !specificAlbumIds) {
      setStatus('Collection scan complete.');
      setEnriching(false);
      isLoopingRef.current = false;
      return;
    }

    setEnriching(true);
    const targetConflicts = parseInt(batchSize);
    let collectedConflicts: ExtendedFieldConflict[] = [];
    let collectedSummary: {album: string, field: string, action: string}[] = [];

    while ((collectedConflicts.length < targetConflicts || specificAlbumIds) && hasMoreRef.current) {
      setStatus(`Scanning... Found ${collectedConflicts.length}/${targetConflicts} conflicts.`);

      try {
        const payload = {
          albumIds: specificAlbumIds,
          limit: specificAlbumIds ? undefined : 5, // Reduced to prevent timeouts
          cursor: specificAlbumIds ? undefined : cursorRef.current,
          // FIXED: Renamed folder to location in API call if necessary, or just don't pass it if it's dead
          // Assuming the API expects 'folder' to filter by location:
          location: folderFilter || undefined, 
          services: getServicesForSelection(),
          fields: Object.keys(fieldConfig),
          autoSnooze: autoSnooze, // PASSED TO SERVER
          missingDataOnly: missingDataOnly
        };

        const fetchCandidatesWithRetry = async (requestPayload: Record<string, unknown>) => {
          const maxAttempts = 4;
          let attempt = 0;
          let lastError: Error | null = null;

          while (attempt < maxAttempts) {
            attempt += 1;
            try {
              const res = await fetch('/api/enrich-sources/fetch-candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
              });

              let result: Partial<FetchCandidatesResponse> = {};
              try {
                result = await res.json();
              } catch {
                result = {};
              }

              if (!res.ok) {
                const errorMessage =
                  typeof result.error === 'string'
                    ? result.error
                    : `HTTP ${res.status} ${res.statusText}`;
                const isRetryableStatus = [408, 425, 429, 500, 502, 503, 504].includes(res.status);
                if (isRetryableStatus && attempt < maxAttempts) {
                  const delay = Math.min(500 * 2 ** (attempt - 1), 4000);
                  addLog('System', 'info', `Candidate fetch retry ${attempt}/${maxAttempts} after ${res.status}`);
                  await wait(delay);
                  continue;
                }
                throw new Error(errorMessage);
              }

              if (result.success !== true) {
                const errorMessage =
                  typeof result.error === 'string'
                    ? result.error
                    : 'Unknown candidate fetch error';
                throw new Error(errorMessage);
              }

              return { result: result as FetchCandidatesResponse, attempts: attempt };
            } catch (error) {
              const err = error instanceof Error ? error : new Error('Unknown fetch error');
              lastError = err;

              if (!isTransientFetchError(err) || attempt >= maxAttempts) {
                throw err;
              }

              const delay = Math.min(500 * 2 ** (attempt - 1), 4000);
              setStatus(`Network interruption during scan. Retrying (${attempt}/${maxAttempts})...`);
              addLog('System', 'info', `Transient candidate fetch error; retrying (${attempt}/${maxAttempts}): ${err.message}`);
              await wait(delay);
            }
          }

          throw lastError ?? new Error('Candidate fetch failed after retries');
        };

        const { result, attempts } = await fetchCandidatesWithRetry(payload);
        if (attempts > 1) {
          addLog('System', 'info', `Candidate fetch recovered after ${attempts} attempts.`);
        }

        if (result.nextCursor !== undefined && result.nextCursor !== null) {
          cursorRef.current = result.nextCursor;
        } else {
          if (!result.results || result.results.length === 0) {
             hasMoreRef.current = false;
          }
        }

        const candidates = result.results || [];
        const lastCheckedAlbum = candidates.length > 0 ? candidates[candidates.length - 1].album : null;
        const lastCheckedLabel = lastCheckedAlbum
          ? `${lastCheckedAlbum.artist} - ${lastCheckedAlbum.title}`
          : (result.processedCount ? `No matches in last batch (${result.processedCount} checked)` : 'No matches in last batch');
        setStatus(`Scanning... Last checked: ${lastCheckedLabel}. Found ${collectedConflicts.length}/${targetConflicts} conflicts.`);

        if (result.processedCount > candidates.length) {
          // This is fine, logs empty results if any
        }

        if (candidates.length === 0 && hasMoreRef.current === false) {
          break; 
        }

        const { conflicts: batchConflicts, summary: batchSummaryItems } = await processBatchAndSave(candidates);
        
        collectedConflicts = [...collectedConflicts, ...batchConflicts];
        if (batchSummaryItems && batchSummaryItems.length > 0) {
            collectedSummary = [...collectedSummary, ...batchSummaryItems];
        }
        if (batchConflicts.length > 0) {
          setStatus(`Scanning... Last checked: ${lastCheckedLabel}. Found ${collectedConflicts.length}/${targetConflicts} conflicts.`);
        }

        if (specificAlbumIds) break;

      } catch (error) {
        setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setEnriching(false);
        isLoopingRef.current = false;
        return;
      }
    }

    setEnriching(false);

    if (collectedSummary.length > 0) {
        setBatchSummary(prev => [...(prev || []), ...collectedSummary]);
    }

    if (collectedConflicts.length > 0) {
      setConflicts(collectedConflicts);
      setShowReview(true);
      setStatus(`Review required for ${collectedConflicts.length} items.`);
    } else {
      setStatus('✅ No conflicts found in this batch.');
      if (isLoopingRef.current && hasMoreRef.current) {
        setTimeout(() => runScanLoop(), 1000);
      } else {
        setStatus('Enrichment complete.');
        if (onImportComplete) onImportComplete();
        loadStats();
      }
    }
  }

  const applyAlbumUpdates = async (album: Album, updates: Record<string, unknown>) => {
    const { inventoryUpdates, releaseUpdates, masterUpdates, albumCredits, tagNames } = splitV3Updates(updates);
    const operations: Promise<unknown>[] = [];

    if (Object.keys(inventoryUpdates).length > 0) {
      operations.push(
        (async () => {
          await supabase
            .from('inventory')
            .update(inventoryUpdates as Record<string, unknown>)
            .eq('id', album.id);
        })()
      );
    }

    if (album.release_id && Object.keys(releaseUpdates).length > 0) {
      operations.push(
        (async () => {
          await supabase
            .from('releases')
            .update(releaseUpdates as Record<string, unknown>)
            .eq('id', album.release_id);
        })()
      );
    }

    if (album.master_id && Object.keys(masterUpdates).length > 0) {
      operations.push(
        (async () => {
          await supabase
            .from('masters')
            .update(masterUpdates as Record<string, unknown>)
            .eq('id', album.master_id);
        })()
      );
    }

    if (operations.length > 0) {
      await Promise.all(operations);
    }

    if (Object.keys(albumCredits).length > 0) {
      await applyAlbumCreditsToRecordings(album.id, albumCredits);
    }

    if (tagNames.length > 0 && album.master_id) {
      await addTagsToMaster(album.master_id, tagNames);
    }
  };

  async function processBatchAndSave(results: CandidateResult[]) {
    const activeServices = getServicesForSelection();
    const checkedSources = checkedSourcesFromActiveServices(activeServices);
    const selectedFields = Object.keys(fieldConfig);
    const runId = currentRunId ?? createEnrichmentRunId();
    if (!currentRunId) {
      setCurrentRunId(runId);
    }
    const wantsLyrics = !!fieldConfig['tracks.lyrics'] || !!fieldConfig['tracks.lyrics_url'];
    const runGeniusLyrics = wantsLyrics && activeServices.genius;

    const albumIds = results.map(r => r.album.id);
    const { data: resolutions, error: resError } = await supabase
      .from('import_conflict_resolutions')
      .select('album_id, field_name, source')
      .in('album_id', albumIds)
      .limit(10000);
      
    if (resError) console.error('Error fetching history:', resError);

    const autoUpdates: { album: Album; fields: Record<string, unknown> }[] = [];
    const newConflicts: ExtendedFieldConflict[] = [];
    const processedIds: number[] = [];
    const historyUpdates: ConflictResolutionWriteRow[] = [];
    const trackSavePromises: Promise<unknown>[] = [];
    const lyricJobs: { albumId: number; artist: string; title: string; appleMusicId?: string | null }[] = [];
    const pendingAuditRows: EnrichmentRunLogInsert[] = [];
    
    const GLOBAL_PRIORITY = [
      'discogs', 'musicbrainz', 'spotify', 'appleMusic', 'deezer', 
      'rateyourmusic', 'lastfm', 'theaudiodb', 'wikipedia', 'wikidata', 
      'coverArt', 'fanarttv', 
      'genius', 'musixmatch', 
      'whosampled', 'secondhandsongs', 'setlistfm', 
      'popsike', 'pitchfork'
    ];
    
    const STATIC_PRIORITY = ['discogs', 'musicbrainz', 'spotify', 'appleMusic', 'deezer', 'wikidata'];
    const SONIC_PRIORITY = ['spotify', 'acousticbrainz', 'musicbrainz'];

    const localBatchSummary: {album: string, field: string, action: string}[] = [];

    results.forEach((item) => {
      processedIds.push(item.album.id);
      const { album, candidates } = item;
      const genrePool = [
        ...(Array.isArray(album.genres) ? album.genres : []),
        ...(Array.isArray(album.styles) ? album.styles : []),
        ...(Array.isArray(album.tags) ? album.tags : []),
      ]
        .map((value) => String(value ?? '').toLowerCase())
        .filter((value) => value.length > 0);
      const isClassicalAlbum = genrePool.some((value) => value.includes('classical'));
      
      const foundKeys = new Set<string>();
      Object.values(candidates).forEach((c) => {
        if (c && typeof c === 'object') {
          Object.entries(c as Record<string, unknown>).forEach(([k, v]) => {
            if (hasMeaningfulValue(v)) {
              foundKeys.add(k);
            }
          });
        }
      });
      
      const allowedSummaryKeys = Array.from(foundKeys)
        .filter(k => !['artist', 'title'].includes(k))
        .filter(k => ALLOWED_COLUMNS.has(k))
        .filter(k => !!fieldConfig[k]);

      if (!missingDataOnly && allowedSummaryKeys.length > 0) {
         const summary = allowedSummaryKeys
            .map(k => k.replace(/_/g, ' '))
            .join(', ');
            
         if (summary) {
             addLog(`${album.artist} - ${album.title}`, 'info', `Found: ${summary}`);
         }
      }

      if (Object.keys(candidates).length === 0) {
        addLog(
          `${album.artist} - ${album.title}`,
          'skipped',
          `No enrichable data returned from selected sources (${checkedSources.join(', ') || 'none'}) for selected fields (${selectedFields.join(', ') || 'none'}).`
        );
        pendingAuditRows.push({
          run_id: runId,
          album_id: album.id,
          album_artist: album.artist,
          album_title: album.title,
          phase: 'scan',
          selected_fields: selectedFields,
          checked_sources: checkedSources,
          returned_sources: [],
          returned_fields: [],
          source_payload: toJsonValue({}),
          proposed_updates: null,
          applied_updates: null,
          conflict_fields: [],
          update_status: 'no_data_returned',
          notes: null,
        });
        return;
      }

      if (runGeniusLyrics && Array.isArray(album.tracks) && album.tracks.length > 0) {
        lyricJobs.push({
          albumId: album.id,
          artist: album.artist,
          title: album.title,
          appleMusicId: (album as Record<string, unknown>).apple_music_id as string | null
        });
      }

      const updatesForAlbum: Record<string, unknown> = {};
      const autoFilledFields: string[] = [];
      const fieldCandidates: Record<string, Record<string, unknown>> = {};
      const unresolvedMissingReasons = new Map<string, string>();
      const updatedMissingFields = new Set<string>();
      const albumRecord = album as Record<string, unknown>;
      const selectedMissingFields = selectedFields.filter((field) => isFieldMissingOnAlbum(albumRecord, field));
      let derivedDiscData: { disc_metadata: unknown; matrix_numbers: unknown } | null = null;

      for (const source of GLOBAL_PRIORITY) {
         const sourceData = (candidates as Record<string, Record<string, unknown>>)[source];
         if (!sourceData) continue;

         Object.entries(sourceData).forEach(([key, value]) => {
            if (!ALLOWED_COLUMNS.has(key)) return;
            if (CLASSICAL_ONLY_FIELDS.has(key) && !isClassicalAlbum) return;
            
            const allowedSources = fieldConfig[key];
            if (!allowedSources) return; 

            let normalizedSource = source;
            if (source === 'appleMusicEnhanced') normalizedSource = 'appleMusic';
            if (source === 'coverArt') normalizedSource = 'coverArtArchive';
            
            if (!allowedSources.has(normalizedSource)) return; 

            if (['bpm', 'key', 'time_signature'].includes(key)) return;

            const finalized = (album as Record<string, unknown>).finalized_fields as string[] | undefined;
            if (Array.isArray(finalized) && finalized.includes(key)) return;

            // CLIENT SIDE CHECK (Still useful for specific fields)
            if (autoSnooze) {
               const lastReviewed = (album as Record<string, unknown>).last_reviewed_at as string | undefined;
               if (lastReviewed) {
                  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                  if (new Date(lastReviewed).getTime() > thirtyDaysAgo) return; 
               }
            }

            const alreadySeen = (resolutions as ResolutionHistory[] | null)?.some(r => 
               r.album_id === album.id && r.field_name === key && r.source === source
            );
            if (alreadySeen) return; 

            let newVal = value;
            if (key === 'original_release_date' && typeof newVal === 'string') {
                 if (/^\d{4}$/.test(newVal)) newVal = `${newVal}-01-01`;
                 if (!isValidDate(newVal)) return;
            }
            
            if (newVal !== null && newVal !== undefined && newVal !== '') {
            let targetKey = key === 'label' ? 'labels' : key === 'lastfm_tags' ? 'tags' : key;
            if (key === 'notes') {
              targetKey = normalizedSource === 'discogs' ? 'release_notes' : 'master_notes';
            }
            if (!fieldCandidates[targetKey]) fieldCandidates[targetKey] = {};
            fieldCandidates[targetKey][source] = newVal;
            }
         });

         const tracks = sourceData.tracks;
         if (Array.isArray(tracks) && tracks.length > 0) {
            const trackDot = (resolutions as ResolutionHistory[] | null)?.some(r => 
               r.album_id === album.id && r.field_name === 'track_data' && r.source === source
            );
            if (!trackDot) {
               trackSavePromises.push(saveTrackData(album.id, tracks as unknown[]));
               historyUpdates.push({
                 album_id: album.id,
                 field_name: 'track_data',
                 source,
                 resolution: 'keep_current',
                 kept_value: toJsonValue('tracks_updated'),
                 resolved_at: new Date().toISOString()
               });
            }

            if (!derivedDiscData) {
              derivedDiscData = deriveDiscDataFromTracks(tracks as Record<string, unknown>[]);
            }

            const discMetadataAllowed = !!fieldConfig.disc_metadata && fieldConfig.disc_metadata.has(source);
            const matrixNumbersAllowed = !!fieldConfig.matrix_numbers && fieldConfig.matrix_numbers.has(source);

            if (discMetadataAllowed && derivedDiscData?.disc_metadata && !fieldCandidates.disc_metadata) {
              fieldCandidates.disc_metadata = { [source]: derivedDiscData.disc_metadata };
            }
            if (matrixNumbersAllowed && derivedDiscData?.matrix_numbers && !fieldCandidates.matrix_numbers) {
              fieldCandidates.matrix_numbers = { [source]: derivedDiscData.matrix_numbers };
            }
         }
      }

      // SMART MERGE & CONFLICT DETECTION
      Object.entries(fieldCandidates).forEach(([key, sourceValues]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const currentVal = (album as any)[key];
          
          const isCurrentEmpty = isEmptyValue(currentVal);

          const sources = Object.keys(sourceValues);
          if (sources.length === 0) return;

          const ARRAY_FIELDS = ['genres', 'styles', 'musicians', 'producers', 'engineers', 'songwriters'];
          const isArrayField = ARRAY_FIELDS.includes(key);

          let proposedValue: unknown;
          let isMerge = false;

          // Special Handling for 'enriched_metadata'
          if (key === 'enriched_metadata') {
             // Pass the full source map to the review modal
             proposedValue = sourceValues;
             isMerge = true;
          }
          else if (isArrayField) {
             const mergedSet = new Set<string>();
             const lowerCaseMap = new Set<string>();
             
             Object.values(sourceValues).forEach(val => {
                if (Array.isArray(val)) {
                   val.forEach(item => {
                      const str = String(item).trim();
                      const lower = str.toLowerCase().replace(/[^a-z0-9]/g, ''); 
                      if (!lowerCaseMap.has(lower)) {
                         mergedSet.add(str);
                         lowerCaseMap.add(lower);
                      }
                   });
                }
             });
             proposedValue = Array.from(mergedSet);
             isMerge = true;
          } 
          else if (key === 'notes') {
              // Should not happen due to redirect, but safe fallback
              proposedValue = Object.values(sourceValues)[0];
          }
          else if (key === 'enrichment_summary') {
             const combinedSummary: Record<string, string> = {};
             if (currentVal && typeof currentVal === 'object') {
                Object.assign(combinedSummary, currentVal);
             }
             Object.values(sourceValues).forEach(val => {
                if (typeof val === 'object' && val !== null) {
                   Object.assign(combinedSummary, val);
                }
             });
             proposedValue = combinedSummary;
             isMerge = true; 
          }
          else {
             let priorityList = GLOBAL_PRIORITY;
             if (['original_release_date', 'year', 'tracklist', 'labels', 'cat_no', 'country', 'barcode'].includes(key)) {
                priorityList = STATIC_PRIORITY;
             } else if (['tempo_bpm', 'musical_key', 'energy', 'danceability'].includes(key)) {
                priorityList = SONIC_PRIORITY;
             }

             let winnerSrc = priorityList.find(s => sources.includes(s)) || sources[0];

             if (album.discogs_release_id && sources.includes('discogs')) {
                if (['tracklist', 'labels', 'cat_no', 'country', 'barcode', 'format'].includes(key)) {
                   winnerSrc = 'discogs';
                }
             }

             proposedValue = sourceValues[winnerSrc];
          }

          if (proposedValue === null || proposedValue === undefined || proposedValue === '') {
            if (missingDataOnly && isCurrentEmpty) {
              unresolvedMissingReasons.set(key, 'candidate value empty');
            }
            return;
          }
          
          if (Array.isArray(proposedValue)) {
             const filtered = proposedValue.filter(v => v && String(v).trim() !== '');
             if (filtered.length === 0) {
               if (missingDataOnly && isCurrentEmpty) {
                 unresolvedMissingReasons.set(key, 'candidate array empty');
               }
               return;
             }
             proposedValue = filtered;
          }
          
          if (typeof proposedValue === 'object' && Object.keys(proposedValue as object).length === 0) {
            if (missingDataOnly && isCurrentEmpty) {
              unresolvedMissingReasons.set(key, 'candidate object empty');
            }
            return;
          }

          const uniqueSingleValues = new Set(Object.values(sourceValues).map(v => normalizeValue(v)));
          const singleValuesAgree = !isArrayField && uniqueSingleValues.size === 1;

          if (isCurrentEmpty && (isMerge || singleValuesAgree || missingDataOnly)) {
              if (key === 'enriched_metadata') {
                 // Auto-fill logic for metadata
                 const base = (currentVal as Record<string, unknown>) || {};
                 const newMeta = { ...base };
                 Object.entries(sourceValues).forEach(([src, txt]) => {
                     if (src === 'wikipedia') newMeta['wiki_bio'] = txt;
                     if (src === 'discogs') newMeta['media_notes'] = txt;
                     if (src === 'allmusic') newMeta['review'] = txt;
                     else newMeta[`${src}_notes`] = txt;
                 });
                 updatesForAlbum[key] = newMeta;
                 autoFilledFields.push(key);
              } else {
                 updatesForAlbum[key] = proposedValue;
                 autoFilledFields.push(key);
              }
              if (missingDataOnly) {
                updatedMissingFields.add(key);
                unresolvedMissingReasons.delete(key);
              }
              
              sources.forEach(src => {
                 historyUpdates.push({
                    album_id: album.id,
                    field_name: key,
                    source: src,
                    resolution: 'use_new',
                    kept_value: toJsonValue(proposedValue),
                    resolved_at: new Date().toISOString()
                 });
              });
          } 
          else {
              if (key === 'tracks' && !isCurrentEmpty) return;
              if (autoFilledFields.includes(key)) return;
              if (missingDataOnly && !isCurrentEmpty) return;

              if (!areValuesEqual(currentVal, proposedValue)) {
                  let priorityList = GLOBAL_PRIORITY;
                  if (['original_release_date', 'year', 'tracklist', 'labels', 'cat_no', 'country', 'barcode'].includes(key)) {
                     priorityList = STATIC_PRIORITY;
                  }
                  
                  const primarySource = isMerge ? 'merge' : (priorityList.find(s => sources.includes(s)) || sources[0]);
                  
                  newConflicts.push({
                      album_id: album.id,
                      field_name: key,
                      current_value: currentVal,
                      new_value: proposedValue,
                      source: primarySource, 
                      candidates: sourceValues,
                      existing_finalized: album.finalized_fields || [],
                      release_id: album.release_id ?? null,
                      master_id: album.master_id ?? null,
                      artist: album.artist,
                      title: album.title,
                      format: (album.format as string) || 'Unknown',
                      year: album.year as string,
                      country: album.country as string,
                      cat_no: (album.cat_no as string) || '', 
                      barcode: (album.barcode as string) || '',
                      labels: (album.labels as string[]) || (album.label ? [album.label as string] : []),
                      label: (album.label as string) || '',
                      catalog_number: (album.catalog_number as string) || (album.cat_no as string) || ''
                   });
              }
          }
      });

      const hasConflictsForAlbum = newConflicts.some(c => c.album_id === album.id);
      if (!hasConflictsForAlbum) {
        updatesForAlbum.last_reviewed_at = new Date().toISOString();
      }

      if (missingDataOnly) {
        selectedMissingFields.forEach((field) => {
          if (updatedMissingFields.has(field)) return;
          if (unresolvedMissingReasons.has(field)) return;
          const candidatesForField = fieldCandidates[field];
          if (!candidatesForField || Object.keys(candidatesForField).length === 0) {
            unresolvedMissingReasons.set(field, 'no candidate data from selected sources');
          } else {
            unresolvedMissingReasons.set(field, 'not applied after normalization');
          }
        });

        const formatField = (field: string) => field.replace(/_/g, ' ');
        if (updatedMissingFields.size > 0) {
          const updatedList = Array.from(updatedMissingFields).map(formatField);
          addLog(
            `${album.artist} - ${album.title}`,
            'auto-fill',
            `Updated missing fields: ${updatedList.join(', ')}`
          );
        }
        if (unresolvedMissingReasons.size > 0) {
          const unresolvedList = Array.from(unresolvedMissingReasons.entries()).map(
            ([field, reason]) => `${formatField(field)} (${reason})`
          );
          addLog(
            `${album.artist} - ${album.title}`,
            'skipped',
            `Still missing: ${unresolvedList.join(', ')}`
          );
        }
      }

      const conflictFieldsForAlbum = newConflicts
        .filter(c => c.album_id === album.id)
        .map(c => c.field_name);

      pendingAuditRows.push({
        run_id: runId,
        album_id: album.id,
        album_artist: album.artist,
        album_title: album.title,
        phase: 'scan',
        selected_fields: selectedFields,
        checked_sources: checkedSources,
        returned_sources: Object.keys(candidates).map(normalizeSourceForLog),
        returned_fields: allowedSummaryKeys,
        source_payload: toJsonValue(candidates),
        proposed_updates: toJsonValue(updatesForAlbum),
        applied_updates: null,
        conflict_fields: conflictFieldsForAlbum,
        update_status: Object.keys(updatesForAlbum).length > 0 ? 'pending_apply' : (conflictFieldsForAlbum.length > 0 ? 'conflict' : 'no_change'),
        notes: null,
      });

      if (Object.keys(updatesForAlbum).length > 0) {
        autoUpdates.push({ album, fields: updatesForAlbum });
        
        autoFilledFields.forEach(field => {
          const val = updatesForAlbum[field];
          let valStr = String(val);
          if (Array.isArray(val)) {
            valStr = val.join(', ');
          } else if (typeof val === 'object' && val !== null) {
            valStr = JSON.stringify(val);
          }
          
          localBatchSummary.push({
            album: `${album.artist} - ${album.title}`,
            field: field,
            action: `Auto-Filled: ${valStr.substring(0, 50)}${valStr.length > 50 ? '...' : ''}`
          });
        });
      }
    });

    if (historyUpdates.length > 0 && historyWriteEnabled) {
      await persistConflictResolutionHistory(historyUpdates, 'scan auto-fill');
    }

    if (trackSavePromises.length > 0) {
      await Promise.all(trackSavePromises);
    }

    const failedAutoApplyAlbumIds = new Set<number>();
    const appliedUpdatesByAlbumId = new Set<number>();
    if (autoUpdates.length > 0) {
      const applyResults = await Promise.allSettled(autoUpdates.map(u => applyAlbumUpdates(u.album, u.fields)));
      applyResults.forEach((res, index) => {
        const albumId = autoUpdates[index].album.id;
        if (res.status === 'fulfilled') {
          appliedUpdatesByAlbumId.add(albumId);
        } else {
          failedAutoApplyAlbumIds.add(albumId);
          addLog(`${autoUpdates[index].album.artist} - ${autoUpdates[index].album.title}`, 'skipped', `Auto-save failed: ${res.reason instanceof Error ? res.reason.message : 'Unknown error'}`);
        }
      });
    }

    if (pendingAuditRows.length > 0) {
      const finalizedRows = pendingAuditRows.map((row) => {
        const hasProposed = !!row.proposed_updates && row.proposed_updates !== null && row.proposed_updates !== '{}';
        let updateStatus = row.update_status ?? 'no_change';
        if (failedAutoApplyAlbumIds.has(row.album_id)) {
          updateStatus = 'apply_failed';
        } else if (appliedUpdatesByAlbumId.has(row.album_id)) {
          updateStatus = row.conflict_fields && row.conflict_fields.length > 0 ? 'applied_with_conflicts' : 'applied';
        } else if (row.conflict_fields && row.conflict_fields.length > 0) {
          updateStatus = 'conflict';
        } else if (hasProposed) {
          updateStatus = 'pending_apply';
        } else {
          updateStatus = 'no_change';
        }

        const appliedUpdates = appliedUpdatesByAlbumId.has(row.album_id)
          ? row.proposed_updates
          : null;

        return {
          ...row,
          applied_updates: appliedUpdates,
          update_status: updateStatus,
        };
      });

      await persistEnrichmentRunLogs(finalizedRows);
    }

    if (runGeniusLyrics && lyricJobs.length > 0) {
      const lyricResults = await Promise.all(lyricJobs.map(async (job) => {
        try {
          const res = await fetch('/api/enrich-sources/genius', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ albumId: job.albumId })
          });
          const data = await res.json();
          if (data?.success) {
            const failedCount = Number(data.data?.failedCount ?? 0);
            const syncedCount = Number(data.data?.syncedCount ?? 0);
            const attemptedCount = Number(data.data?.attemptedCount ?? 0);
            const skippedExistingCount = Number(data.data?.skippedExistingCount ?? 0);
            const failedSample = Array.isArray(data.data?.failedTracks) && data.data.failedTracks.length > 0
              ? String(data.data.failedTracks[0]?.error ?? '')
              : '';
            const baseCountLabel = syncedCount > 0
              ? `Lyrics URLs: ${data.data?.enrichedCount ?? 0}/${data.data?.totalTracks ?? 0} (synced existing: ${syncedCount})`
              : `Lyrics URLs: ${data.data?.enrichedCount ?? 0}/${data.data?.totalTracks ?? 0}`;
            const attemptedLabel = attemptedCount > 0 ? `attempted: ${attemptedCount}` : null;
            const skippedLabel = skippedExistingCount > 0 ? `already had URL: ${skippedExistingCount}` : null;
            const failedLabel = failedCount > 0 && failedSample
              ? `failed: ${failedCount}; sample: ${failedSample}`
              : (failedCount > 0 ? `failed: ${failedCount}` : null);
            const failureSummary = (data.data?.failureSummary && typeof data.data.failureSummary === 'object')
              ? Object.entries(data.data.failureSummary as Record<string, unknown>)
                  .map(([reason, count]) => `${reason} (${Number(count) || 0})`)
                  .slice(0, 2)
              : [];
            const failureSummaryLabel = failureSummary.length > 0
              ? `reasons: ${failureSummary.join(' | ')}`
              : null;
            const extras = [attemptedLabel, skippedLabel, failedLabel, failureSummaryLabel].filter((value): value is string => !!value);
            const detail = extras.length > 0
              ? `${baseCountLabel} (${extras.join('; ')})`
              : baseCountLabel;
            addLog(`${job.artist} - ${job.title}`, 'info', detail);
          } else {
            const failedSample = Array.isArray(data?.data?.failedTracks) && data.data.failedTracks.length > 0
              ? String(data.data.failedTracks[0]?.error ?? '')
              : '';
            const reason = data?.error || failedSample || `HTTP ${res.status}`;
            addLog(`${job.artist} - ${job.title}`, 'skipped', `Lyrics enrichment failed: ${reason}`);
          }
        } catch (error) {
          addLog(`${job.artist} - ${job.title}`, 'skipped', `Lyrics enrichment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }));
      void lyricResults;
    }

    return { conflicts: newConflicts, summary: localBatchSummary };
  }
  
  async function saveTrackData(albumId: number, enrichedTracks: unknown[]) {
    const { data: inventoryRow, error } = await supabase
      .from('inventory')
      .select(`
        id,
        release:releases (
          id,
          release_tracks:release_tracks (
            id,
            position,
            title_override,
            recording:recordings ( id, title, credits )
          )
        )
      `)
      .eq('id', albumId)
      .single();

    if (error || !inventoryRow) return 0;
    const release = toSingle(inventoryRow.release);
    const releaseTracks = release?.release_tracks ?? [];

    const updates: Promise<unknown>[] = [];
    const enriched = enrichedTracks as Record<string, unknown>[];

    const normalize = (value: unknown) =>
      String(value ?? '')
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();

    const buildTrackCredits = (track: Record<string, unknown>) => {
      const credits: Record<string, unknown> = {};
      if (track.tempo_bpm) credits.tempo_bpm = track.tempo_bpm;
      if (track.musical_key) credits.musical_key = track.musical_key;
      if (track.lyrics) credits.lyrics = track.lyrics;
      if (track.lyrics_url) credits.lyrics_url = track.lyrics_url;
      if (track.lyrics_source) credits.lyrics_source = track.lyrics_source;
      if (track.artist) credits.track_artist = track.artist;
      if (track.note) credits.track_note = track.note;
      if (track.is_cover !== undefined) credits.is_cover = track.is_cover;
      if (track.original_artist) credits.original_artist = track.original_artist;
      if (track.original_year) credits.original_year = track.original_year;
      if (track.mb_work_id) credits.mb_work_id = track.mb_work_id;
      return credits;
    };

    if (releaseTracks.length === 0) {
      if (!release?.id) return 0;
      const payloads = enriched
        .map((track) => ({
          title: String(track.title ?? '').trim(),
          duration_seconds: parseDurationToSeconds(track.duration),
          track_artist: track.artist ? String(track.artist) : null,
          lyrics: track.lyrics ? String(track.lyrics) : null,
          lyrics_url: track.lyrics_url ? String(track.lyrics_url) : null,
          is_cover: typeof track.is_cover === 'boolean' ? track.is_cover : null,
          original_artist: track.original_artist ? String(track.original_artist) : null,
          credits: (() => {
            const credits = buildTrackCredits(track);
            return Object.keys(credits).length > 0
              ? (credits as unknown as import('types/supabase').Json)
              : undefined;
          })(),
        }))
        .filter((track) => track.title.length > 0);

      if (payloads.length === 0) return 0;

      const { data: recordings, error: insertError } = await supabase
        .from('recordings')
        .insert(payloads)
        .select('id');

      if (insertError || !recordings) return 0;

      const releaseTrackRows = recordings.map((recording, index) => {
        const src = enriched[index] || {};
        const position = String(src.position ?? index + 1);
        return {
          release_id: release.id,
          recording_id: recording.id,
          position,
          side: extractSide(position),
          title_override: null,
        };
      });

      const { error: releaseTrackError } = await supabase
        .from('release_tracks')
        .insert(releaseTrackRows);

      if (releaseTrackError) return 0;
      return releaseTrackRows.length;
    }

    for (const track of releaseTracks) {
      const recording = toSingle(track.recording);
      if (!recording?.id) continue;
      const title = track.title_override || recording.title || '';

      const match = enriched.find((et) => {
        const etTitle = normalize(et.title);
        const etPos = et.position ? String(et.position) : '';
        return (etTitle && etTitle === normalize(title)) || (etPos && etPos === track.position);
      });

      if (!match) continue;

      const currentCredits = (recording.credits && typeof recording.credits === 'object' && !Array.isArray(recording.credits))
        ? (recording.credits as Record<string, unknown>)
        : {};

      const nextCredits: Record<string, unknown> = { ...currentCredits, ...buildTrackCredits(match) };
      const updatePayload: Record<string, unknown> = {
        credits: nextCredits as unknown as import('types/supabase').Json,
      };
      if (match.artist) updatePayload.track_artist = String(match.artist);
      if (match.lyrics) updatePayload.lyrics = String(match.lyrics);
      if (match.lyrics_url) updatePayload.lyrics_url = String(match.lyrics_url);
      if (typeof match.is_cover === 'boolean') updatePayload.is_cover = match.is_cover;
      if (match.original_artist) updatePayload.original_artist = String(match.original_artist);

      updates.push(
        Promise.resolve(
          supabase
            .from('recordings')
            .update(updatePayload)
            .eq('id', recording.id)
        )
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      return updates.length;
    }
    return 0;
  }

  // --- NEW: SKIP HANDLER (SNOOZE) ---
  async function handleSkip(
    albumId: number,
    mode: 'snooze' | 'ignore' = 'snooze',
    note?: string
  ) {
    const albumConflicts = conflicts.filter(c => c.album_id === albumId);
    const conflictSeed = albumConflicts[0];
    const albumLabel = conflictSeed
      ? `${conflictSeed.artist ?? 'Unknown Artist'} - ${conflictSeed.title ?? 'Untitled'}`
      : `Album ${albumId}`;
    const reason = note ?? (mode === 'ignore' ? 'Manually ignored due to unavailable source data' : 'Skipped for later review');
    addLog(albumLabel, 'skipped', reason);

    const runId = currentRunId ?? createEnrichmentRunId();
    if (!currentRunId) {
      setCurrentRunId(runId);
    }
    const checkedSources = Array.from(new Set(
      albumConflicts.flatMap(c => Object.keys(c.candidates ?? {}).map(normalizeSourceForLog))
    ));
    await persistEnrichmentRunLogs([{
      run_id: runId,
      album_id: albumId,
      album_artist: conflictSeed?.artist ?? null,
      album_title: conflictSeed?.title ?? null,
      phase: 'review',
      selected_fields: Object.keys(fieldConfig),
      checked_sources: checkedSources,
      returned_sources: checkedSources,
      returned_fields: albumConflicts.map(c => c.field_name),
      source_payload: toJsonValue(albumConflicts.reduce<Record<string, unknown>>((acc, c) => {
        if (c.candidates) acc[c.field_name] = c.candidates;
        return acc;
      }, {})),
      proposed_updates: null,
      applied_updates: null,
      conflict_fields: albumConflicts.map(c => c.field_name),
      update_status: mode === 'ignore' ? 'ignored_manual' : 'skipped_snooze',
      notes: reason,
    }]);

    setConflicts(prev => {
        const nextQueue = prev.filter(c => c.album_id !== albumId);
        if (nextQueue.length === 0) {
             if (isLoopingRef.current && hasMoreRef.current) {
                 setStatus('Scanning for the next batch of reviews...');
                 setTimeout(() => runScanLoop(), 500);
             } else {
                 setShowReview(false);
                 setStatus('All conflicts resolved or skipped.');
                 if (onImportComplete) onImportComplete();
                 loadStats();
             }
        }
        return nextQueue;
    });
  }

  async function handleSingleAlbumSave(
    resolutions: Record<string, { value: unknown; source: string; selectedSources?: string[] }>,
    finalizedFields: Record<string, boolean>,
    albumId: number
  ) {
    const updates: Record<string, unknown> = {};
    const resolutionRecords: { album_id: number; field_name: string; source: string; resolution: string; kept_value: import('types/supabase').Json | null; resolved_at: string }[] = [];
    const timestamp = new Date().toISOString();
    const trackSavePromises: Promise<number>[] = [];

    // 1. Process resolutions
    Object.keys(resolutions).forEach((key) => {
        if (!key.startsWith(`${albumId}-`)) return;
        
        const fieldName = key.split('-').slice(1).join('-');
        const decision = resolutions[key];
        
        updates[fieldName] = decision.value;

        const conflict = conflicts.find(c => c.album_id === albumId && c.field_name === fieldName);
        if (conflict && conflict.candidates) {
             Object.entries(conflict.candidates).forEach(([src]) => {
                const isChosenSource = decision.source === src || decision.selectedSources?.includes(src);
                const isMerge = decision.source === 'custom_merge';
                resolutionRecords.push({
                    album_id: albumId, 
                    field_name: fieldName,
                    source: src, 
                    resolution: isChosenSource ? (isMerge ? 'merge' : 'use_new') : 'keep_current',
                    kept_value: toJsonValue(decision.value ?? conflict.current_value),
                    resolved_at: timestamp
                });
             });
             
             const trackSource = (decision.source === 'current' || decision.source === 'merge' || decision.source === 'custom_merge') ? null : decision.source;
             if (trackSource && conflict.candidates[trackSource]) {
                const cand = conflict.candidates[trackSource] as { tracks?: unknown[] };
                if (cand.tracks) {
                    trackSavePromises.push(saveTrackData(albumId, cand.tracks));
                }
             }
        }
    });

    // 2. Process Finalized Fields
    Object.keys(finalizedFields).forEach((key) => {
        if (!key.startsWith(`${albumId}-`) || !finalizedFields[key]) return;
        const fieldName = key.split('-').slice(1).join('-');
        
        const conflict = conflicts.find(c => c.album_id === albumId && c.field_name === fieldName);
        const currentList = conflict?.existing_finalized || [];
        if (!currentList.includes(fieldName)) {
            const existing = (updates.finalized_fields as string[]) || currentList;
            updates.finalized_fields = [...new Set([...existing, fieldName])];
        }
    });

    // 3. Database Updates
    const conflictSeed = conflicts.find(c => c.album_id === albumId);
    const albumStub: Album = {
        id: albumId,
        release_id: conflictSeed?.release_id ?? null,
        master_id: conflictSeed?.master_id ?? null,
        artist: conflictSeed?.artist ?? 'Unknown Artist',
        title: conflictSeed?.title ?? 'Untitled',
        image_url: null,
    };

    if (trackSavePromises.length > 0) {
        await Promise.all(trackSavePromises);
    }

    if (Object.keys(updates).length > 0) {
        ['labels', 'genres', 'styles'].forEach(field => {
            if (updates[field] !== undefined && !Array.isArray(updates[field])) {
                updates[field] = [updates[field]];
            }
        });

        try {
            await applyAlbumUpdates(albumStub, updates);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Failed to save album ${albumId}:`, error);
            addLog(String(albumId), 'skipped', `Save Error: ${message}`);
            return;
        }
    }

    if (resolutionRecords.length > 0 && historyWriteEnabled) {
      await persistConflictResolutionHistory(resolutionRecords, 'manual review');
    }

    const runId = currentRunId ?? createEnrichmentRunId();
    if (!currentRunId) {
      setCurrentRunId(runId);
    }
    const albumConflicts = conflicts.filter(c => c.album_id === albumId);
    const sourcePayload = albumConflicts.reduce<Record<string, unknown>>((acc, conflict) => {
      if (conflict.candidates) {
        acc[conflict.field_name] = conflict.candidates;
      }
      return acc;
    }, {});
    const checkedSources = Array.from(new Set(
      albumConflicts.flatMap(c => Object.keys(c.candidates ?? {}).map(normalizeSourceForLog))
    ));

    await persistEnrichmentRunLogs([{
      run_id: runId,
      album_id: albumId,
      album_artist: albumStub.artist,
      album_title: albumStub.title,
      phase: 'review',
      selected_fields: Object.keys(updates),
      checked_sources: checkedSources,
      returned_sources: checkedSources,
      returned_fields: Object.keys(updates),
      source_payload: toJsonValue(sourcePayload),
      proposed_updates: toJsonValue(updates),
      applied_updates: toJsonValue(updates),
      conflict_fields: albumConflicts.map(c => c.field_name),
      update_status: 'manual_applied',
      notes: null,
    }]);

    // 4. Remove from Queue
    setConflicts(prev => {
        const nextQueue = prev.filter(c => c.album_id !== albumId);
        
        if (nextQueue.length === 0) {
             if (isLoopingRef.current && hasMoreRef.current) {
                 setStatus('Scanning for the next batch of reviews...');
                 setTimeout(() => runScanLoop(), 500);
             } else {
                 setShowReview(false);
                 setStatus('All conflicts resolved.');
                 if (onImportComplete) onImportComplete();
                 loadStats();
             }
        }
        return nextQueue;
    });
  }

  async function showCategory(category: string, title: string) {
    setShowCategoryModal(true);
    setCategoryTitle(title);
    setCategoryAlbums([]);
    setLoadingCategory(true);
    try {
      const res = await fetch(`/api/enrich-sources/albums?category=${category}&limit=100`);
      const data = await res.json();
      if (data.success) setCategoryAlbums(data.albums || []);
    } catch (error) {
      console.error('Failed to load albums:', error);
    } finally {
      setLoadingCategory(false);
    }
  }

  if (!isOpen) return null;

  if (showReview) {
    return (
      <EnrichmentReviewModal 
        conflicts={conflicts} 
        batchSummary={batchSummary}
        statusMessage={status}
        onSave={handleSingleAlbumSave}
        onSkip={handleSkip}
        onCancel={() => { 
          setShowReview(false); 
          isLoopingRef.current = false; 
          setStatus('Review cancelled. Scanning stopped.'); 
        }}
      />
    );
  }

  if (batchSummary) {
    return (
      <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[10000]">
        <div className="bg-white p-8 rounded-xl w-[500px] text-gray-900">
          <h3 className="mb-4 font-bold text-lg">Batch Review Summary</h3>
          <div className="max-h-[300px] overflow-y-auto border border-gray-200 mb-5 rounded-md">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-2.5 border-b border-gray-200">Album / Field</th>
                  <th className="p-2.5 border-b border-gray-200">Action</th>
                </tr>
              </thead>
              <tbody>
                {batchSummary.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-none">
                    <td className="p-2.5">
                      <div className="font-semibold text-gray-900">{s.album}</div>
                      <div className="text-gray-500 text-[11px]">{s.field.replace(/_/g, ' ').toUpperCase()}</div>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[11px] ${
                        s.action.includes('Auto') ? 'bg-emerald-50 text-emerald-700' : 
                        s.action.includes('No') ? 'bg-red-50 text-red-800' : 
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {s.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button 
            onClick={() => {
              setBatchSummary(null);
              if (isLoopingRef.current && hasMoreRef.current) {
                runScanLoop();
              } else {
                loadStats();
                if (onImportComplete) onImportComplete();
              }
            }} 
            className="w-full bg-[#4FC3F7] text-white border-none py-3 rounded-md text-[15px] font-medium cursor-pointer shadow hover:bg-[#29B6F6] hover:shadow-md transition-all"
          >
            Continue to Next Batch
          </button>
        </div>
      </div>
    );
  }

  const hasRunnableCategory = (category: DataCategory) => {
    const validFields = (DATA_CATEGORY_CHECK_FIELDS[category] || []).filter(f => ALLOWED_COLUMNS.has(f));
    if (validFields.length === 0) return false;
    return validFields.some((field) => (FIELD_TO_SERVICES[field] || []).length > 0);
  };

  // --- UPDATED CONFIG WITH NEW CATEGORIES ---
  const rawCategoryConfig: { category: DataCategory; count: number; subcounts?: { label: string; count: number }[] }[] = stats ? [
    { category: 'artwork', count: stats.missingArtwork, subcounts: [
        { label: 'Back covers', count: stats.missingBackCover },
        { label: 'Spine', count: stats.missingSpine || 0 },
    ]},
    { category: 'credits', count: stats.missingCredits, subcounts: [
        { label: 'Musicians', count: stats.missingMusicians },
        { label: 'Producers', count: stats.missingProducers },
    ]},
    { category: 'tracklists', count: stats.missingTracklists, subcounts: [
        { label: 'Missing Durations', count: stats.missingDurations || 0 }
    ]},
    { category: 'sonic_domain', count: stats.missingAudioAnalysis, subcounts: [
        { label: 'Tempo', count: stats.missingTempo },
        { label: 'Key', count: stats.missingMusicalKey || 0 },
    ]},
    { category: 'genres', count: stats.missingGenres, subcounts: [
        { label: 'Styles', count: stats.missingStyles || 0 }
    ]},
    { category: 'streaming_links', count: stats.missingStreamingLinks, subcounts: [
        { label: 'Spotify', count: stats.missingSpotify },
    ]},
    { category: 'release_metadata', count: stats.missingReleaseMetadata, subcounts: [
        { label: 'Barcodes', count: stats.missingBarcode || 0 },
        { label: 'Labels', count: stats.missingLabels || 0 },
    ]},
    { category: 'lyrics', count: stats.missingLyrics || 0, subcounts: [] },
    { category: 'reviews', count: stats.missingReviews || 0, subcounts: [] },
    { category: 'chart_data', count: stats.missingChartData || 0, subcounts: [] },
    { category: 'cultural_context', count: stats.missingContext || 0, subcounts: [] },
    { category: 'similar_albums', count: stats.missingSimilar || 0, subcounts: [] },
  ] : [];
  const dataCategoriesConfig = rawCategoryConfig.filter(({ category }) => hasRunnableCategory(category));
  const deferredCategories = rawCategoryConfig
    .map(({ category }) => category)
    .filter((category) => !hasRunnableCategory(category));

  return (
    <div className="fixed inset-0 bg-white z-[10000] flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto bg-white p-6">
        <div className="w-[1200px] max-w-[95vw] h-[90vh] mx-auto flex flex-col overflow-hidden bg-white border border-gray-200 rounded-lg shadow-xl">
        
        {/* HEADER */}
        <div className="bg-[#2A2A2A] text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <h2 className="text-base font-medium text-white">⚡ Collection Data Enrichment</h2>
          <button onClick={onClose} disabled={enriching} className="bg-transparent border-none text-white text-[28px] cursor-pointer leading-none p-0 hover:text-gray-300">×</button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="text-center p-10">Loading statistics...</div>
          ) : stats ? (
            <>
              {/* 1. OVERVIEW STATS */}
              <div className="mb-6">
                <h3 className="text-base font-semibold mb-3">Collection Overview</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="Total Albums" value={stats.total} color="#3b82f6" onClick={() => {}} disabled />
                  <StatBox label="Fully Enriched" value={stats.fullyEnriched} color="#10b981" onClick={() => showCategory('fully-enriched', 'Fully Enriched')} />
                  <div className="relative">
                    <StatBox label="Needs Enrichment" value={stats.needsEnrichment} color="#f59e0b" onClick={() => showCategory('needs-enrichment', 'Needs Enrichment')} />
                    {/* AUTO-SNOOZE TOGGLE */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setAutoSnooze(!autoSnooze); }}
                      className={`absolute -top-2.5 right-2.5 px-2 py-0.5 rounded-xl text-[10px] border font-bold cursor-pointer transition-all ${
                        autoSnooze 
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' 
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                      title={autoSnooze ? "Skipping items reviewed in last 30 days" : "Checking ALL items (ignoring recent reviews)"}
                    >
                      {autoSnooze ? '💤 Snooze Active' : '⚡ Snooze OFF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. DATA CATEGORY SELECTION */}
              <div className="bg-white border-2 border-[#D8D8D8] rounded-md p-5 mb-6">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold text-green-700 mb-2">Select Data to Enrich</h3>
                {deferredCategories.length > 0 && (
                  <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span className="font-semibold">Temporarily unavailable:</span>{' '}
                    {deferredCategories.map((category) => DATA_CATEGORY_LABELS[category]).join(', ')}.
                    {deferredCategories
                      .map((category) => DEFERRED_CATEGORY_REASONS[category])
                      .filter((reason): reason is string => !!reason)
                      .map((reason, index) => (
                        <span key={`${reason}-${index}`}> {reason}</span>
                      ))}
                  </div>
                )}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
                  {/* Note: dataCategoriesConfig is used for sorting/structure, but props are new */}
                  {dataCategoriesConfig.map(({ category }) => (
                    <DataCategoryCard
                      key={category} 
                      category={category} 
                      stats={stats}
                      fieldConfig={fieldConfig}
                      onToggleCategory={() => toggleCategory(category)}
                      onToggleField={toggleField}
                      onToggleFieldSource={toggleFieldSource}
                      disabled={enriching}
                    />
                  ))}
                </div>
              </div>

              {/* 3. FILTERS */}
              <div className="bg-white border-2 border-[#D8D8D8] rounded-md p-5 mb-6 flex gap-4 flex-wrap items-center">
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-sm">Folder:</label>
                  <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} disabled={enriching} className="p-1.5 rounded border border-gray-300 text-gray-900">
                    <option value="">All Folders</option>
                    {folders.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-sm text-gray-900">Batch Size:</label>
                  <select value={batchSize} onChange={(e) => setBatchSize(e.target.value)} disabled={enriching} className="p-1.5 rounded border border-gray-300 text-gray-900">
                    <option value="10">10 (Safe)</option>
                    <option value="25">25 (Standard)</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <input
                    type="checkbox"
                    checked={missingDataOnly}
                    onChange={(e) => setMissingDataOnly(e.target.checked)}
                    disabled={enriching}
                  />
                  Missing data only
                  <span className="text-[11px] font-medium text-gray-500">
                    (skip conflicts unless multiple options)
                  </span>
                </label>
              </div>

              {/* 4. SESSION LOG */}
              {sessionLog.length > 0 && (
                <div className="mb-4 border border-gray-200 rounded-md overflow-hidden">
                  <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-700">
                    Session Activity ({sessionLog.length})
                  </div>
                  <div className="max-h-[150px] overflow-y-auto p-2 bg-white">
                    {sessionLog.map(log => (
                      <div key={log.id} className="text-xs mb-1 flex gap-2">
                        <span className="text-gray-400">{log.timestamp.toLocaleTimeString()}</span>
                        <span className={`font-semibold ${log.action === 'auto-fill' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {log.action === 'auto-fill' ? '✅' : '✏️'}
                        </span>
                        <span className="flex-1 text-gray-900">
                          <b>{log.album}:</b> {log.details}
                        </span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}

              {/* STATUS */}
              {status && (
                <div className="p-3 rounded-md mb-4 bg-emerald-100 text-emerald-800 font-medium">
                  {status}
                </div>
              )}
            </>
          ) : (
            <div className="bg-red-50 border-2 border-red-400 rounded-md p-4 text-red-700 text-sm mt-6">Failed to load statistics.</div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-gray-200 flex justify-center gap-3">
          <button 
            onClick={onClose} 
            disabled={enriching} 
            className="bg-white text-gray-900 border-2 border-[#D8D8D8] px-8 py-3 rounded-md text-[15px] font-medium cursor-pointer transition-all hover:border-[#4FC3F7] hover:bg-[#F0F9FF]"
          >
            Close
          </button>
          <button 
            onClick={() => startEnrichment()} 
            disabled={enriching || !stats || Object.keys(fieldConfig).length === 0} 
            className={`text-white border-none px-8 py-3 rounded-md text-[15px] font-medium cursor-pointer shadow transition-all ${
              enriching 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-[#4FC3F7] hover:bg-[#29B6F6] hover:shadow-md'
            }`}
          >
            {enriching ? 'Scanning...' : '⚡ Start Scan & Review'}
          </button>
        </div>
        </div>
      </div>

      {/* DRILL DOWN MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000]">
           <div className="flex items-center justify-center p-6 w-full h-full">
            <div className="bg-white rounded-lg w-[1000px] max-w-[90vw] max-h-[90vh] flex flex-col overflow-hidden text-gray-900">
            <div className="bg-[#2A2A2A] text-white px-6 py-3.5 flex items-center justify-between shrink-0">
              <h3 className="text-base font-medium">{categoryTitle}</h3>
              <button onClick={() => setShowCategoryModal(false)} className="bg-transparent border-none text-white text-[28px] cursor-pointer leading-none p-0 hover:text-gray-300">×</button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {loadingCategory ? (
                <div className="text-center p-10">Loading...</div>
              ) : (
                <>
                  <button 
                     onClick={() => startEnrichment(categoryAlbums.map(a => a.id))}
                     disabled={enriching || categoryAlbums.length === 0}
                     className="w-full bg-[#4FC3F7] text-white border-none py-3 rounded-md text-[15px] font-medium cursor-pointer shadow hover:bg-[#29B6F6] hover:shadow-md transition-all mb-4 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Scan These {categoryAlbums.length} Albums
                  </button>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                    {categoryAlbums.map(album => (
                      <div key={album.id} className="border border-gray-200 rounded-md p-2">
                        <div className="relative w-full aspect-square mb-1.5 bg-gray-100">
                           {album.image_url && <Image src={album.image_url} alt="" fill style={{ objectFit: 'cover' }} unoptimized />}
                        </div>
                        <div className="font-semibold text-[11px] whitespace-nowrap overflow-hidden text-gray-900">{album.title}</div>
                        <div className="text-gray-500 text-[11px] whitespace-nowrap overflow-hidden">{album.artist}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function StatBox({ label, value, color, onClick, disabled }: { label: string; value: number; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div onClick={disabled ? undefined : onClick} className="bg-white rounded-md p-5 text-center" style={{ border: `2px solid ${color}`, cursor: disabled ? 'default' : 'pointer' }}>
      <div className="text-3xl font-bold mb-1" style={{ color }}>{value.toLocaleString()}</div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function DataCategoryCard({ 
  category, 
  stats,
  fieldConfig,
  onToggleCategory,
  onToggleField,
  onToggleFieldSource,
  disabled 
}: { 
  category: DataCategory; 
  stats: EnrichmentStats | null;
  fieldConfig: FieldConfigMap;
  onToggleCategory: () => void;
  onToggleField: (f: string) => void;
  onToggleFieldSource: (f: string, s: string) => void;
  disabled: boolean; 
}) {
  const fields = DATA_CATEGORY_CHECK_FIELDS[category] || [];
  const validFields = fields.filter(f => ALLOWED_COLUMNS.has(f));
  
  if (validFields.length === 0) return null;

  const activeCount = validFields.filter(f => !!fieldConfig[f]).length;
  const isAllSelected = activeCount === validFields.length;
  const isIndeterminate = activeCount > 0 && !isAllSelected;

  const formatLabel = (f: string) => f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const getCategoryMissing = () => {
    if (!stats) return 0;
    switch (category) {
      case 'artwork':
        return stats.missingArtwork;
      case 'credits':
        return stats.missingCredits;
      case 'tracklists':
        return stats.missingTracklists;
      case 'sonic_domain':
        return stats.missingAudioAnalysis;
      case 'genres':
        return stats.missingGenres;
      case 'streaming_links':
        return stats.missingStreamingLinks;
      case 'release_metadata':
        return stats.missingReleaseMetadata;
      case 'lyrics':
        return stats.missingLyrics || 0;
      case 'reviews':
        return stats.missingReviews || 0;
      case 'chart_data':
        return stats.missingChartData || 0;
      case 'cultural_context':
        return stats.missingContext || 0;
      case 'similar_albums':
        return stats.missingSimilar || 0;
      default:
        return 0;
    }
  };

  const isFieldTracked = (field: string) =>
    TRACKED_ENRICHMENT_CATEGORIES.has(category)
    && !!stats?.fieldMissing
    && Object.prototype.hasOwnProperty.call(stats.fieldMissing, field);

  const isCategoryTracked = () =>
    validFields.every((field) => isFieldTracked(field));

  const getMissing = (field: string) => {
    if (!stats) return 0;
    if (stats.fieldMissing && typeof stats.fieldMissing[field] === 'number') {
      return stats.fieldMissing[field];
    }
    if (field === 'image_url') return stats.missingFrontCover || 0;
    if (field === 'back_image_url') return stats.missingBackCover;
    if (field === 'spine_image_url') return stats.missingSpine || 0;
    if (field === 'inner_sleeve_images') return stats.missingInnerSleeve || 0;
    if (field === 'vinyl_label_images') return stats.missingVinylLabel || 0;
    if (field.includes('musicians')) return stats.missingMusicians;
    if (field.includes('producers')) return stats.missingProducers;
    if (field.includes('engineers')) return stats.missingEngineers || 0;
    if (field.includes('songwriters')) return stats.missingSongwriters || 0;
    if (field === 'tracks' || field === 'tracklists') return stats.missingTracklists;
    if (field.includes('bpm')) return stats.missingTempo;
    if (field.includes('musical_key')) return stats.missingMusicalKey || 0;
    if (field.includes('danceability')) return stats.missingDanceability || 0;
    if (field.includes('energy')) return stats.missingEnergy || 0;
    if (field === 'genres') return stats.missingGenres;
    if (field === 'styles') return stats.missingStyles || 0;
    if (field === 'spotify_id') return stats.missingSpotify;
    if (field === 'apple_music_id') return stats.missingAppleMusic || 0;
    if (field === 'lastfm_id') return stats.missingLastFM || 0;
    if (field === 'barcode') return stats.missingBarcode || 0;
    if (field === 'labels') return stats.missingLabels || 0;
    if (field === 'original_release_date') return stats.missingOriginalDate || 0;
    if (field === 'cat_no') return stats.missingCatalogNumber || 0;
    return 0;
  };

  return (
    // Removed hardcoded background/opacity styles to let CSS Modules handle theme
    <div className={`w-full text-left bg-white border-2 border-[#D8D8D8] rounded-md p-5 transition-all duration-200 ${disabled ? 'opacity-50 pointer-events-none' : 'hover:border-[#4FC3F7] hover:bg-[#F0F9FF]'}`}>
      {/* HEADER */}
      <div 
        className="flex items-center justify-between pb-2 border-b border-gray-200 mb-2"
      >
         <div className="flex items-center gap-2">
           <input 
              type="checkbox" 
              checked={isAllSelected}
              ref={el => { if(el) el.indeterminate = isIndeterminate; }}
              onChange={onToggleCategory}
              disabled={disabled}
              className="cursor-pointer"
           />
           <span className="text-base">{DATA_CATEGORY_ICONS[category]}</span>
           <span className="text-base font-semibold text-[#1a1a1a]">{DATA_CATEGORY_LABELS[category]}</span>
         </div>
         <span
           className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
             isCategoryTracked()
               ? (getCategoryMissing() > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
               : (getCategoryMissing() > 0 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')
           }`}
           title={isCategoryTracked() ? 'Tracked category count' : 'Untracked category count'}
         >
           {getCategoryMissing()}
         </span>
      </div>

      {/* FIELD ROWS (Dashboard Style) */}
      <div className="flex flex-col gap-2">
         {validFields.map(field => {
            const isEnabled = !!fieldConfig[field];
            const activeSources = fieldConfig[field] || new Set();
            const services = FIELD_TO_SERVICES[field] || [];
            const missing = getMissing(field);

            return (
               <div key={field} className={isEnabled ? "p-2 bg-blue-50 border border-blue-200 rounded" : "p-2 border border-transparent"}>
                  {/* Row Top: Checkbox + Name + Stats */}
                  <div className="flex items-center justify-between">
                     <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={isEnabled} 
                           onChange={() => onToggleField(field)}
                           disabled={disabled}
                        />
                        {formatLabel(field)}
                     </label>
                     <span
                       className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                         isFieldTracked(field)
                           ? (missing > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
                           : (missing > 0 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')
                       }`}
                       title={isFieldTracked(field) ? 'Tracked field count' : 'Untracked field count'}
                     >
                       {missing}
                     </span>
                  </div>

                  {/* Row Bottom: Source Toggles (Only if enabled) */}
                  {isEnabled && services.length > 0 && (
                     <div className="flex flex-wrap gap-1.5 ml-5 mt-1">
                        {services.map(srv => {
                           const isActive = activeSources.has(srv);
                           return (
                              <label 
                                key={srv} 
                                title={srv}
                                className={`flex items-center px-1.5 py-0.5 rounded border text-[10px] cursor-pointer select-none transition-colors ${
                                  isActive 
                                    ? "bg-white border-blue-400 text-blue-700 shadow-sm" 
                                    : "bg-gray-100 border-gray-200 text-gray-500 opacity-60 hover:opacity-100"
                                }`}
                              >
                                 <input 
                                    type="checkbox" 
                                    checked={isActive} 
                                    onChange={() => onToggleFieldSource(field, srv)}
                                    disabled={disabled}
                                    className="hidden"
                                 />
                                 <span>{SERVICE_ICONS[srv as EnrichmentService]}</span>
                                 <span className="ml-1">{srv}</span>
                              </label>
                           );
                        })}
                     </div>
                  )}
               </div>
            );
         })}
      </div>
    </div>
  );
}
// AUDIT: updated for V3 alignment, UI parity, and build stability.

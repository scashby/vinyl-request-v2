// src/app/edit-collection/components/ImportDiscogsModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { parseDiscogsFormat } from '../../../lib/formatParser';
import type { Database } from '../../../types/supabase';
import { normalizeArtist, normalizeTitle, normalizeArtistAlbum } from '../../../lib/importUtils';

type SyncMode = 'full_replacement' | 'full_sync' | 'partial_sync' | 'new_only';
type ImportStage = 'select_mode' | 'fetching_definitions' | 'fetching' | 'preview' | 'importing' | 'complete';
type AlbumStatus = 'NEW' | 'CHANGED' | 'UNCHANGED' | 'REMOVED' | 'REVIEW';
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
interface DiscogsReleaseImage {
  uri: string;
  type?: 'primary' | 'secondary';
}

interface DiscogsReleaseData {
  images?: DiscogsReleaseImage[];
  genres?: string[];
  styles?: string[];
  notes?: string;
  country?: string;
  released?: string;
  identifiers?: { type: string; value: string; description?: string }[];
  labels?: { name?: string; catno?: string }[];
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

const normalizeReleaseDate = (released?: string | null): string | null => {
  if (!released) return null;
  const value = released.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  return null;
};

const buildFormatLabel = (release?: { media_type?: string | null; format_details?: string[] | null; qty?: number | null } | null) => {
  if (!release) return '';
  const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
  const base = parts.join(', ');
  const qty = release.qty ?? 1;
  if (!base) return '';
  return qty > 1 ? `${qty}x${base}` : base;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const applyAlbumDetailsToReleaseRecordings = async (
  releaseId: number,
  albumDetails: Record<string, unknown>
) => {
  if (!releaseId || Object.keys(albumDetails).length === 0) return;

  const { data: tracks, error } = await supabase
    .from('release_tracks')
    .select('recording:recordings ( id, credits )')
    .eq('release_id', releaseId);

  if (error || !tracks) return;

  const updates = tracks
    .map((track) => {
      const recording = Array.isArray(track.recording) ? track.recording[0] : track.recording;
      if (!recording?.id) return null;
      const credits = asRecord(recording.credits);
      const merged = {
        ...credits,
        album_details: {
          ...(asRecord(credits.album_details ?? credits.albumDetails ?? credits.album_metadata)),
          ...albumDetails,
        },
      };
      return supabase
        .from('recordings')
        .update({ credits: merged as Database['public']['Tables']['recordings']['Update']['credits'] })
        .eq('id', recording.id);
    })
    .filter(Boolean);

  if (updates.length > 0) {
    await Promise.all(updates);
  }
};

const applyArtworkToReleaseRecordings = async (
  releaseId: number,
  artwork: Record<string, unknown>
) => {
  if (!releaseId || Object.keys(artwork).length === 0) return;

  const { data: tracks, error } = await supabase
    .from('release_tracks')
    .select('recording:recordings ( id, credits )')
    .eq('release_id', releaseId);

  if (error || !tracks) return;

  const updates = tracks
    .map((track) => {
      const recording = Array.isArray(track.recording) ? track.recording[0] : track.recording;
      if (!recording?.id) return null;
      const credits = asRecord(recording.credits);
      const merged = {
        ...credits,
        artwork: {
          ...(asRecord(credits.artwork ?? credits.album_artwork ?? credits.albumArtwork)),
          ...artwork,
        },
      };
      return supabase
        .from('recordings')
        .update({ credits: merged as Database['public']['Tables']['recordings']['Update']['credits'] })
        .eq('id', recording.id);
    })
    .filter(Boolean);

  if (updates.length > 0) {
    await Promise.all(updates);
  }
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
      case 'release_date':
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
  label?: string | null;
  barcode?: string | null;
  media_condition?: string | null;
  sleeve_condition?: string | null;
  country?: string | null;
  release_date?: string | null;
  year?: string | null;
  date_added?: string | null;
  image_url?: string | null;
  cover_image?: string | null;
  tracks?: boolean | null;
  genres?: string[] | null;
  styles?: string[] | null;
}

interface CandidateMatch {
  id: number;
  release_id?: number | null;
  master_id?: number | null;
  artist: string;
  title: string;
  discogs_release_id?: string | null;
  discogs_master_id?: string | null;
  year?: string | null;
  format?: string | null;
  catalog_number?: string | null;
  country?: string | null;
  score: number;
}

interface ComparedAlbum extends ParsedAlbum {
  status: AlbumStatus;
  existingId?: number;
  existingReleaseId?: number | null;
  existingMasterId?: number | null;
  needsEnrichment: boolean;
  missingFields: string[];
  matchType?: 'discogs_id' | 'master_id' | 'artist_title' | 'unmatched';
  discogsIdMismatch?: boolean;
  weakMatch?: boolean;
  matchScore?: number;
  candidateCount?: number;
  candidateMatches?: CandidateMatch[];
  matchedSummary?: Pick<ExistingAlbum, 'id' | 'release_id' | 'master_id' | 'artist' | 'title' | 'discogs_release_id' | 'discogs_master_id' | 'year' | 'format' | 'catalog_number' | 'country'>;
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

const formatKeyFromString = (format?: string | null): string => {
  if (!format) return '';
  const parsed = parseDiscogsFormat(format);
  const details = (parsed.format_details ?? []).map((d) => d.toLowerCase()).sort().join('|');
  const mediaType = parsed.media_type?.toLowerCase() ?? '';
  const qty = parsed.qty ? String(parsed.qty) : '';
  return [qty, mediaType, details].filter(Boolean).join('|');
};

function scoreCandidateMatch(parsed: ParsedAlbum, candidate: ExistingAlbum): number {
  let score = 0;
  if (parsed.catalog_number && candidate.catalog_number && normalizeComparable(parsed.catalog_number) === normalizeComparable(candidate.catalog_number)) {
    score += 3;
  }
  if (parsed.label && candidate.label && normalizeComparable(parsed.label) === normalizeComparable(candidate.label)) {
    score += 2;
  }
  if (parsed.discogs_master_id && candidate.discogs_master_id && normalizeComparable(parsed.discogs_master_id) === normalizeComparable(candidate.discogs_master_id)) {
    score += 2;
  }
  if (parsed.barcode && candidate.barcode && normalizeComparable(parsed.barcode) === normalizeComparable(candidate.barcode)) {
    score += 2;
  }
  if (parsed.year && candidate.year && normalizeComparable(parsed.year) === normalizeComparable(candidate.year)) {
    score += 1;
  }
  if (parsed.country && candidate.country && normalizeComparable(parsed.country) === normalizeComparable(candidate.country)) {
    score += 1;
  }
  if (parsed.format && candidate.format && normalizeComparable(parsed.format) === normalizeComparable(candidate.format)) {
    score += 1;
  }
  if (parsed.media_condition && candidate.media_condition && normalizeComparable(parsed.media_condition) === normalizeComparable(candidate.media_condition)) {
    score += 1;
  }
  if (parsed.sleeve_condition && candidate.sleeve_condition && normalizeComparable(parsed.sleeve_condition) === normalizeComparable(candidate.sleeve_condition)) {
    score += 1;
  }
  if (parsed.date_added && candidate.date_added && normalizeComparable(parsed.date_added) === normalizeComparable(candidate.date_added)) {
    score += 1;
  }
  return score;
}

// Compare albums logic
function compareAlbums(
  parsed: ParsedAlbum[],
  existing: ExistingAlbum[],
  sourceType: DiscogsSourceType
): ComparedAlbum[] {
  const releaseIdMap = new Map<string, ExistingAlbum[]>();
  const masterIdMap = new Map<string, ExistingAlbum[]>();
  const artistAlbumMap = new Map<string, ExistingAlbum[]>();
  const matchedDbIds = new Set<number>();
  
  existing.forEach(album => {
    if (album.discogs_release_id) {
      const entries = releaseIdMap.get(album.discogs_release_id) ?? [];
      entries.push(album);
      releaseIdMap.set(album.discogs_release_id, entries);
    }
    if (album.discogs_master_id) {
      const entries = masterIdMap.get(album.discogs_master_id) ?? [];
      entries.push(album);
      masterIdMap.set(album.discogs_master_id, entries);
    }
    const normalizedKey = normalizeArtistAlbum(album.artist, album.title);
    const entries = artistAlbumMap.get(normalizedKey) ?? [];
    entries.push(album);
    artistAlbumMap.set(normalizedKey, entries);
  });

  const compared: ComparedAlbum[] = [];

  for (const parsedAlbum of parsed) {
    let existingAlbum: ExistingAlbum | undefined;
    let matchType: ComparedAlbum['matchType'] = 'unmatched';
    let weakMatch = false;
    let ambiguousCandidates = false;
    let matchScore = 0;
    let candidateCount = 0;
    let candidateMatches: CandidateMatch[] = [];
    const parsedFormatKey = formatKeyFromString(parsedAlbum.format);
    
    if (parsedAlbum.discogs_release_id) {
      const candidates = releaseIdMap.get(parsedAlbum.discogs_release_id) ?? [];
      if (candidates.length === 1) {
        existingAlbum = candidates[0];
        matchType = 'discogs_id';
      } else if (candidates.length > 1) {
        const exactMatches = candidates.filter((candidate) => {
          const candidateFormatKey = formatKeyFromString(candidate.format);
          const formatMatches = parsedFormatKey && candidateFormatKey ? parsedFormatKey === candidateFormatKey : true;
          const catalogMatches =
            !parsedAlbum.catalog_number ||
            !candidate.catalog_number ||
            normalizeComparable(parsedAlbum.catalog_number) === normalizeComparable(candidate.catalog_number);
          const labelMatches =
            !parsedAlbum.label ||
            !candidate.label ||
            normalizeComparable(parsedAlbum.label) === normalizeComparable(candidate.label);
          const barcodeMatches =
            !parsedAlbum.barcode ||
            !candidate.barcode ||
            normalizeComparable(parsedAlbum.barcode) === normalizeComparable(candidate.barcode);
          const mediaMatches =
            !parsedAlbum.media_condition ||
            !candidate.media_condition ||
            normalizeComparable(parsedAlbum.media_condition) === normalizeComparable(candidate.media_condition);
          const sleeveMatches =
            !parsedAlbum.sleeve_condition ||
            !candidate.sleeve_condition ||
            normalizeComparable(parsedAlbum.sleeve_condition) === normalizeComparable(candidate.sleeve_condition);
          const countryMatches =
            !parsedAlbum.country ||
            !candidate.country ||
            normalizeComparable(parsedAlbum.country) === normalizeComparable(candidate.country);
          const yearMatches =
            !parsedAlbum.year ||
            !candidate.year ||
            normalizeComparable(parsedAlbum.year) === normalizeComparable(candidate.year);
          const dateMatches =
            !parsedAlbum.date_added ||
            !candidate.date_added ||
            normalizeComparable(parsedAlbum.date_added) === normalizeComparable(candidate.date_added);
          return formatMatches && catalogMatches && labelMatches && barcodeMatches && mediaMatches && sleeveMatches && countryMatches && yearMatches && dateMatches;
        });

        candidateMatches = candidates.map((candidate) => ({
          id: candidate.id,
          release_id: candidate.release_id ?? null,
          master_id: candidate.master_id ?? null,
          artist: candidate.artist,
          title: candidate.title,
          discogs_release_id: candidate.discogs_release_id ?? null,
          discogs_master_id: candidate.discogs_master_id ?? null,
          year: candidate.year ?? null,
          format: candidate.format ?? null,
          catalog_number: candidate.catalog_number ?? null,
          country: candidate.country ?? null,
          score: scoreCandidateMatch(parsedAlbum, candidate),
        })).sort((a, b) => b.score - a.score);
        ambiguousCandidates = true;
        candidateCount = candidates.length;
        if (exactMatches.length === 1) {
          existingAlbum = exactMatches[0];
          matchType = 'discogs_id';
          weakMatch = false;
          matchScore = scoreCandidateMatch(parsedAlbum, exactMatches[0]);
        }
      }
    }

    if (!existingAlbum && parsedAlbum.discogs_master_id) {
      const masterCandidates = masterIdMap.get(parsedAlbum.discogs_master_id) ?? [];
      if (masterCandidates.length > 0) {
        ambiguousCandidates = masterCandidates.length > 1;
        candidateCount = masterCandidates.length;
        candidateMatches = masterCandidates.map((candidate) => ({
          id: candidate.id,
          release_id: candidate.release_id ?? null,
          master_id: candidate.master_id ?? null,
          artist: candidate.artist,
          title: candidate.title,
          discogs_release_id: candidate.discogs_release_id ?? null,
          discogs_master_id: candidate.discogs_master_id ?? null,
          year: candidate.year ?? null,
          format: candidate.format ?? null,
          catalog_number: candidate.catalog_number ?? null,
          country: candidate.country ?? null,
          score: scoreCandidateMatch(parsedAlbum, candidate),
        })).sort((a, b) => b.score - a.score);
        let bestIndex = 0;
        let bestScore = -1;
        masterCandidates.forEach((candidate, index) => {
          const score = scoreCandidateMatch(parsedAlbum, candidate);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
          }
        });
        const candidate = masterCandidates[bestIndex];
        if (candidate) {
          const candidateFormatKey = formatKeyFromString(candidate.format);
          const formatMismatch = parsedFormatKey && candidateFormatKey && parsedFormatKey !== candidateFormatKey;
          if (formatMismatch) {
            ambiguousCandidates = true;
          } else {
            const ambiguous = masterCandidates.length > 1 && bestScore < 3;
            if (!ambiguous) {
              existingAlbum = candidate;
              matchType = 'master_id';
              weakMatch = bestScore < 3 || masterCandidates.length > 1;
              matchScore = bestScore;
              masterCandidates.splice(bestIndex, 1);
              if (masterCandidates.length === 0) {
                masterIdMap.delete(parsedAlbum.discogs_master_id);
              } else {
                masterIdMap.set(parsedAlbum.discogs_master_id, masterCandidates);
              }
            }
          }
        }
      }
    }
    
    if (!existingAlbum) {
      if (parsedAlbum.discogs_release_id) {
        compared.push({
          ...parsedAlbum,
          status: ambiguousCandidates ? 'REVIEW' : 'NEW',
          needsEnrichment: true,
          missingFields: ['all'],
          matchType,
          matchScore,
          candidateCount,
          candidateMatches,
        });
        continue;
      }
      const candidates = artistAlbumMap.get(parsedAlbum.artist_album_norm);
      if (candidates && candidates.length > 0) {
        ambiguousCandidates = candidates.length > 1;
        candidateCount = candidates.length;
        let bestIndex = 0;
        let bestScore = -1;
        candidateMatches = candidates.map((candidate) => ({
          id: candidate.id,
          release_id: candidate.release_id ?? null,
          master_id: candidate.master_id ?? null,
          artist: candidate.artist,
          title: candidate.title,
          discogs_release_id: candidate.discogs_release_id ?? null,
          discogs_master_id: candidate.discogs_master_id ?? null,
          year: candidate.year ?? null,
          format: candidate.format ?? null,
          catalog_number: candidate.catalog_number ?? null,
          country: candidate.country ?? null,
          score: scoreCandidateMatch(parsedAlbum, candidate),
        })).sort((a, b) => b.score - a.score);
        candidates.forEach((candidate, index) => {
          const score = scoreCandidateMatch(parsedAlbum, candidate);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
          }
        });
        const candidate = candidates[bestIndex];
        if (candidate) {
          const candidateFormatKey = formatKeyFromString(candidate.format);
          const formatMismatch = parsedFormatKey && candidateFormatKey && parsedFormatKey !== candidateFormatKey;
          if (formatMismatch) {
            ambiguousCandidates = true;
          } else {
          const ambiguous = candidates.length > 1 && bestScore < 3;
          if (!ambiguous) {
            existingAlbum = candidate;
            matchType = 'artist_title';
            weakMatch = bestScore < 3 || candidates.length > 1;
            matchScore = bestScore;
            candidates.splice(bestIndex, 1);
            if (candidates.length === 0) {
              artistAlbumMap.delete(parsedAlbum.artist_album_norm);
            }
          }
          }
        }
      }
    }

    if (!existingAlbum) {
      compared.push({
        ...parsedAlbum,
        status: ambiguousCandidates ? 'REVIEW' : 'NEW',
        needsEnrichment: true,
        missingFields: ['all'],
        matchType,
        matchScore,
        candidateCount,
        candidateMatches,
      });
    } else {
      const missingFields: string[] = [];
      
      const existingCoverImage = existingAlbum.image_url ?? existingAlbum.cover_image;
      if (!existingCoverImage) missingFields.push('cover images');
      if (sourceType === 'collection') {
        if (!existingAlbum.tracks) missingFields.push('tracks');
        if (!existingAlbum.genres || existingAlbum.genres.length === 0) missingFields.push('genres');
        if (!existingAlbum.styles || existingAlbum.styles.length === 0) missingFields.push('styles');
        if (!existingAlbum.label) missingFields.push('label');
        if (!existingAlbum.catalog_number) missingFields.push('catalog');
        if (!existingAlbum.barcode) missingFields.push('barcode');
        if (!existingAlbum.country) missingFields.push('country');
        if (!existingAlbum.release_date) missingFields.push('release date');
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
        matchType,
        discogsIdMismatch: isChanged,
        weakMatch,
        matchScore,
        candidateCount,
        candidateMatches,
        matchedSummary: {
          id: existingAlbum.id,
          release_id: existingAlbum.release_id ?? null,
          master_id: existingAlbum.master_id ?? null,
          artist: existingAlbum.artist,
          title: existingAlbum.title,
          discogs_release_id: existingAlbum.discogs_release_id,
          discogs_master_id: existingAlbum.discogs_master_id ?? null,
          year: existingAlbum.year ?? null,
          format: existingAlbum.format ?? null,
          catalog_number: existingAlbum.catalog_number ?? null,
          country: existingAlbum.country ?? null,
        },
      });

      matchedDbIds.add(existingAlbum.id);

      if (existingAlbum.discogs_release_id) {
        const remaining = (releaseIdMap.get(existingAlbum.discogs_release_id) ?? []).filter((candidate) => candidate.id !== existingAlbum.id);
        if (remaining.length > 0) {
          releaseIdMap.set(existingAlbum.discogs_release_id, remaining);
        } else {
          releaseIdMap.delete(existingAlbum.discogs_release_id);
        }
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
        matchType: 'unmatched',
        discogsIdMismatch: false,
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
  const primaryImage = data.images?.find((img) => img.type === 'primary')?.uri ?? data.images?.[0]?.uri ?? null;
  const secondaryImages = (data.images ?? []).filter((img) => img.type !== 'primary');
  const backImage = secondaryImages[0]?.uri ?? null;
  const galleryImages = secondaryImages.slice(1).map((img) => img.uri).filter(Boolean);

  const enriched: Record<string, unknown> = {
    image_url: primaryImage,
    back_image_url: backImage,
    inner_sleeve_images: galleryImages.length > 0 ? galleryImages : null,
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

  const releaseDate = normalizeReleaseDate(data.released ?? null);
  if (releaseDate) {
    enriched.release_date = releaseDate;
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

  if (data.labels && Array.isArray(data.labels) && data.labels[0]) {
    if (!enriched.label && data.labels[0].name) {
      enriched.label = data.labels[0].name;
    }
    if (data.labels[0].catno) {
      enriched.catalog_number = data.labels[0].catno;
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
  const [previewLimit, setPreviewLimit] = useState<number>(50);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'new' | 'changed' | 'unchanged' | 'removed' | 'review'>('all');
  const [previewSearch, setPreviewSearch] = useState('');

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
          const pageSize = 1000;
          let from = 0;
          let hasMore = true;
          const fetched: ExistingAlbum[] = [];

          while (hasMore) {
            const { data: existingRaw, error: dbError } = await supabase
              .from('inventory')
              .select(`
                id,
                location,
                media_condition,
                sleeve_condition,
                personal_notes,
                date_added,
                release:releases (
                  id,
                  label,
                  catalog_number,
                  barcode,
                  country,
                  release_year,
                  release_date,
                  discogs_release_id,
                  media_type,
                  format_details,
                  qty,
                  release_tracks ( id ),
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
              `)
              .range(from, from + pageSize - 1);

            if (dbError) throw dbError;

            const mapped = (existingRaw ?? []).map((row) => {
              const release = row.release as {
                id?: number | null;
                label?: string | null;
                catalog_number?: string | null;
                barcode?: string | null;
                country?: string | null;
                release_year?: number | null;
                release_date?: string | null;
                discogs_release_id?: string | null;
                media_type?: string | null;
                format_details?: string[] | null;
                qty?: number | null;
                release_tracks?: Array<{ id?: number | null }> | null;
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
                label: release?.label ?? null,
                barcode: release?.barcode ?? null,
                media_condition: row.media_condition ?? null,
                sleeve_condition: row.sleeve_condition ?? null,
                country: release?.country ?? null,
                release_date: release?.release_date ?? null,
                year: (release?.release_year ?? master?.original_release_year)?.toString() ?? null,
                date_added: row.date_added ?? null,
                image_url: master?.cover_image_url ?? null,
                cover_image: master?.cover_image_url ?? null,
                tracks: (release?.release_tracks?.length ?? 0) > 0,
                genres: master?.genres ?? null,
                styles: master?.styles ?? null,
              } satisfies ExistingAlbum;
            });

            fetched.push(...mapped);

            if (!existingRaw || existingRaw.length < pageSize) {
              hasMore = false;
            } else {
              from += pageSize;
            }
          }

          existing = fetched;
        } else {
          const pageSize = 1000;
          let from = 0;
          let hasMore = true;
          const fetched: ExistingAlbum[] = [];

          while (hasMore) {
            const { data: existingRaw, error: dbError } = await supabase
              .from('wantlist')
              .select('id, artist, title, artist_norm, title_norm, artist_album_norm, discogs_release_id, discogs_master_id, format, year, cover_image')
              .range(from, from + pageSize - 1);
            if (dbError) throw dbError;
            const mapped = (existingRaw ?? []).map((album) => {
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
            fetched.push(...mapped);

            if (!existingRaw || existingRaw.length < pageSize) {
              hasMore = false;
            } else {
              from += pageSize;
            }
          }

          existing = fetched;
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

              const albumDetailsUpdate = {
                rpm: formatData.rpm ?? null,
                vinyl_weight: formatData.weight ?? null,
                vinyl_color: formatData.color ? [formatData.color] : null,
                extra: formatData.extraText || null,
                packaging: formatData.packaging ?? null,
                is_box_set: formatData.is_box_set ?? false,
                box_set: formatData.box_set ?? null,
              };

              // Enrichment Logic (Only if NEW or Full Sync/Partial Sync needs it)
              let enrichedData: Record<string, unknown> | null = null;

              if (
                album.status === 'NEW' ||
                syncMode === 'full_sync' ||
                (syncMode === 'partial_sync' && album.needsEnrichment)
              ) {
                enrichedData = await enrichFromDiscogs(album.discogs_release_id);

                if (syncMode === 'full_sync' || album.status === 'NEW') {
                  const enrichedSplit = splitDiscogsUpdates({ ...payload, ...(enrichedData ?? {}) });
                  Object.assign(inventoryUpdates, enrichedSplit.inventoryUpdates);
                  Object.assign(releaseUpdates, enrichedSplit.releaseUpdates);
                  Object.assign(masterUpdates, enrichedSplit.masterUpdates);
                } else {
                  album.missingFields.forEach((field) => {
                    if (enrichedData && enrichedData[field]) {
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

              await applyAlbumDetailsToReleaseRecordings(releaseRow.id, albumDetailsUpdate);
              if (enrichedData) {
                const artworkUpdate = {
                  back_image_url: enrichedData.back_image_url ?? null,
                  inner_sleeve_images: enrichedData.inner_sleeve_images ?? null,
                };
                await applyArtworkToReleaseRecordings(releaseRow.id, artworkUpdate);
              }

              const shouldFetchTracks =
                Boolean(album.discogs_release_id) &&
                (album.status === 'NEW' || album.missingFields.includes('tracks'));
              if (shouldFetchTracks) {
                try {
                  const trackRes = await fetch('/api/enrich-sources/discogs-tracklist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ albumId: inventoryRow.id }),
                  });
                  if (!trackRes.ok) {
                    const errText = await trackRes.text();
                    console.warn('Discogs tracklist enrichment failed:', errText);
                    setImportErrors(prev => ([
                      ...prev,
                      `${album.artist} — ${album.title}: Tracklist enrichment failed (${trackRes.status})`
                    ]));
                  }
                } catch (trackErr) {
                  console.warn('Discogs tracklist enrichment exception:', trackErr);
                  setImportErrors(prev => ([
                    ...prev,
                    `${album.artist} — ${album.title}: Tracklist enrichment exception`
                  ]));
                }
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

  const newCount = comparedAlbums.filter(a => a.status === 'NEW').length;
  const reviewCount = comparedAlbums.filter(a => a.status === 'REVIEW').length;
  const unchangedCount = syncMode === 'full_replacement'
    ? 0
    : comparedAlbums.filter(a => a.status === 'UNCHANGED').length;
  const removedCount = syncMode === 'full_replacement'
    ? totalDatabaseCount
    : syncMode === 'full_sync'
      ? comparedAlbums.filter(a => a.status === 'REMOVED').length
      : 0;
  const changedCount = comparedAlbums.filter(a => a.status === 'CHANGED').length;
  const enrichmentCount = comparedAlbums.filter(a => a.status === 'CHANGED' && a.needsEnrichment).length;
  const matchedByDiscogsId = comparedAlbums.filter(a => a.matchType === 'discogs_id').length;
  const matchedByMasterId = comparedAlbums.filter(a => a.matchType === 'master_id').length;
  const matchedByArtistTitle = comparedAlbums.filter(a => a.matchType === 'artist_title').length;

  const missingFieldCounts = comparedAlbums.reduce<Record<string, number>>((acc, album) => {
    if (!album.missingFields || album.missingFields.length === 0) return acc;
    album.missingFields.forEach((field) => {
      if (field === 'all') return;
      acc[field] = (acc[field] || 0) + 1;
    });
    return acc;
  }, {});

  const topMissingFields = Object.entries(missingFieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const shouldProcess = (album: ComparedAlbum) => {
    if (album.status === 'REVIEW') return false;
    if (syncMode === 'full_replacement') return album.status !== 'REMOVED';
    if (syncMode === 'full_sync') return true;
    if (syncMode === 'new_only') return album.status === 'NEW';
    if (syncMode === 'partial_sync') return album.status === 'NEW' || (album.status === 'CHANGED' && album.needsEnrichment);
    return true;
  };

  const actionLabel = (album: ComparedAlbum) => {
    if (album.status === 'REVIEW') return 'REVIEW';
    if (album.status === 'NEW') return 'ADD';
    if (album.status === 'REMOVED') return 'REMOVE';
    if (album.status === 'CHANGED') return album.needsEnrichment ? 'ENRICH' : 'UPDATE';
    return 'SKIP';
  };

  const filteredPreview = comparedAlbums.filter((album) => {
    if (previewFilter !== 'all' && album.status !== previewFilter.toUpperCase()) return false;
    if (previewSearch.trim()) {
      const term = previewSearch.trim().toLowerCase();
      return `${album.artist} ${album.title}`.toLowerCase().includes(term);
    }
    return true;
  });

  const previewRows = previewLimit > 0 ? filteredPreview.slice(0, previewLimit) : filteredPreview;

  const willAdd = comparedAlbums.filter(a => actionLabel(a) === 'ADD' && shouldProcess(a)).length;
  const willUpdate = comparedAlbums.filter(a => actionLabel(a) === 'UPDATE' && shouldProcess(a)).length;
  const willEnrich = comparedAlbums.filter(a => actionLabel(a) === 'ENRICH' && shouldProcess(a)).length;
  const willRemove = comparedAlbums.filter(a => actionLabel(a) === 'REMOVE' && shouldProcess(a)).length;
  const willSkip = comparedAlbums.filter(a => actionLabel(a) === 'SKIP' && shouldProcess(a)).length;
  const willReview = comparedAlbums.filter(a => actionLabel(a) === 'REVIEW').length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30000]">
      {/* FIXED: Added text-gray-900 to ensure text is visible on white background */}
      <div className="bg-white text-gray-900 rounded-lg w-[1280px] max-w-[96vw] max-h-[90vh] flex flex-col overflow-hidden">
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
                <div className="text-[12px] text-blue-700 mt-1">
                  “NEW” means not found in your collection. “CHANGED” means an existing album will be updated or enriched.
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-center">
                <div className="bg-green-50 p-2 rounded border border-green-200">
                  <div className="text-xl font-bold text-green-700">{newCount}</div>
                  <div className="text-[11px] text-green-600 font-semibold">NEW IMPORTS</div>
                </div>
                <div className="bg-amber-50 p-2 rounded border border-amber-200">
                  <div className="text-xl font-bold text-amber-700">{changedCount}</div>
                  <div className="text-[11px] text-amber-600 font-semibold">CHANGED</div>
                </div>
                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                  <div className="text-xl font-bold text-blue-700">{enrichmentCount}</div>
                  <div className="text-[11px] text-blue-600 font-semibold">NEEDS ENRICHMENT</div>
                </div>
                <div className="bg-gray-50 p-2 rounded border border-gray-200">
                  <div className="text-xl font-bold text-gray-700">{unchangedCount}</div>
                  <div className="text-[11px] text-gray-600 font-semibold">UNCHANGED</div>
                </div>
                {reviewCount > 0 && (
                  <div className="bg-yellow-50 p-2 rounded border border-yellow-200 sm:col-span-2">
                    <div className="text-xl font-bold text-yellow-800">{reviewCount}</div>
                    <div className="text-[11px] text-yellow-700 font-semibold">REVIEW REQUIRED</div>
                  </div>
                )}
                {(syncMode === 'full_sync' || syncMode === 'full_replacement') && (
                  <div className="bg-red-50 p-2 rounded border border-red-200 sm:col-span-2">
                    <div className="text-xl font-bold text-red-700">{removedCount}</div>
                    <div className="text-[11px] text-red-600 font-semibold">REMOVED</div>
                  </div>
                )}
              </div>

              <div className="text-[12px] text-gray-600 mb-4">
                <div className="mb-1">
                  Matched by Discogs ID: <strong>{matchedByDiscogsId}</strong> · Matched by Master ID: <strong>{matchedByMasterId}</strong> · Matched by Artist/Title: <strong>{matchedByArtistTitle}</strong>
                </div>
                <div className="mb-1">
                  Existing albums loaded from DB: <strong>{totalDatabaseCount}</strong> · Discogs items pulled: <strong>{comparedAlbums.length}</strong>
                </div>
                <div className="mb-1">
                  Will add: <strong>{willAdd}</strong> · Will update: <strong>{willUpdate}</strong> · Will enrich: <strong>{willEnrich}</strong> · Will remove: <strong>{willRemove}</strong> · Will skip: <strong>{willSkip}</strong> · Needs review: <strong>{willReview}</strong>
                </div>
                {topMissingFields.length > 0 && (
                  <div>
                    Top missing fields: {topMissingFields.map(([field, count]) => (
                      <span key={field} className="inline-flex items-center gap-1 mr-2">
                        <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[11px]">
                          {field}
                        </span>
                        <span className="text-[11px] text-gray-500">({count})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-[13px] text-gray-500">
                      Preview ({previewRows.length} of {filteredPreview.length} shown)
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={previewFilter}
                        onChange={(e) => setPreviewFilter(e.target.value as typeof previewFilter)}
                        className="text-[12px] px-2 py-1 border border-gray-300 rounded bg-white"
                      >
                        <option value="all">All</option>
                        <option value="new">New</option>
                        <option value="changed">Changed</option>
                        <option value="unchanged">Unchanged</option>
                        <option value="removed">Removed</option>
                        <option value="review">Review</option>
                      </select>
                      <select
                        value={previewLimit}
                        onChange={(e) => setPreviewLimit(Number(e.target.value))}
                        className="text-[12px] px-2 py-1 border border-gray-300 rounded bg-white"
                      >
                        <option value={10}>10</option>
                        <option value={50}>50</option>
                        <option value={200}>200</option>
                        <option value={0}>All</option>
                      </select>
                      <input
                        type="text"
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                        placeholder="Search..."
                        className="text-[12px] px-2 py-1 border border-gray-300 rounded bg-white"
                      />
                    </div>
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-[13px] border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-[1]">
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Artist</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Title</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Action</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Reason</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((album, idx) => {
                          let statusColor = 'text-gray-500';
                          if (album.status === 'NEW') statusColor = 'text-emerald-600';
                          if (album.status === 'REMOVED') statusColor = 'text-red-600';
                          if (album.status === 'CHANGED') statusColor = 'text-amber-600';
                          const action = actionLabel(album);
                          const reasons: string[] = [];
                          if (album.status === 'NEW') reasons.push('Not found in collection');
                          if (album.status === 'REMOVED') reasons.push('Missing from Discogs');
                          if (album.status === 'REVIEW') reasons.push('Multiple possible matches');
                          if (album.discogsIdMismatch) reasons.push('Discogs ID differs');
                          if (album.matchType === 'artist_title') {
                            reasons.push(album.weakMatch ? 'Matched by artist/title (weak)' : 'Matched by artist/title');
                          }
                          if (album.missingFields?.length) {
                            const filtered = album.missingFields.filter((field) => field !== 'all');
                            if (filtered.length > 0) reasons.push(`Missing ${filtered.join(', ')}`);
                          }
                          if (reasons.length === 0 && album.status === 'UNCHANGED') reasons.push('No changes detected');

                          return (
                            <tr key={idx} className="border-b border-gray-100 last:border-none">
                              <td className="px-3 py-2 text-gray-900">{album.artist}</td>
                              <td className="px-3 py-2 text-gray-900">{album.title}</td>
                              <td className={`px-3 py-2 font-semibold ${statusColor}`}>{action}</td>
                              <td className="px-3 py-2 text-gray-600 text-[12px]">{reasons.join(' • ')}</td>
                              <td className="px-3 py-2">
                                <details className="text-[12px] text-gray-600">
                                  <summary className="cursor-pointer text-blue-600">View</summary>
                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px] text-gray-700">
                                    <div className="border border-gray-200 rounded p-2 bg-gray-50">
                                      <div className="font-semibold mb-1">Discogs Pulled</div>
                                      <div>Release ID: {album.discogs_release_id || '—'}</div>
                                      <div>Master ID: {album.discogs_master_id || '—'}</div>
                                      <div>Artist: {album.artist}</div>
                                      <div>Title: {album.title}</div>
                                      <div>Year: {album.year || '—'}</div>
                                      <div>Label: {album.label || '—'}</div>
                                      <div>Cat No: {album.catalog_number || '—'}</div>
                                      <div>Country: {album.country || '—'}</div>
                                      <div>Format: {album.format || '—'}</div>
                                      <div>Media Cond: {album.media_condition || '—'}</div>
                                      <div>Sleeve Cond: {album.sleeve_condition || '—'}</div>
                                      <div>Date Added: {album.date_added || '—'}</div>
                                      <div>Cover: {album.cover_image ? 'yes' : 'no'}</div>
                                      {album.discogs_release_id && (
                                        <div>
                                          Discogs URL:{' '}
                                          <a
                                            href={`https://www.discogs.com/release/${album.discogs_release_id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-blue-600 underline"
                                          >
                                            View release
                                          </a>
                                        </div>
                                      )}
                                      <div>Normalized key: {album.artist_album_norm || '—'}</div>
                                    </div>
                                    <div className="border border-gray-200 rounded p-2 bg-white">
                                      <div className="font-semibold mb-1">Matched Existing</div>
                                      {album.matchedSummary ? (
                                        <>
                                          <div>ID: {album.matchedSummary.id}</div>
                                          <div>Release ID: {album.matchedSummary.release_id ?? '—'}</div>
                                          <div>Master ID: {album.matchedSummary.master_id ?? '—'}</div>
                                          <div>Discogs ID: {album.matchedSummary.discogs_release_id || '—'}</div>
                                          <div>Master Discogs ID: {album.matchedSummary.discogs_master_id || '—'}</div>
                                          <div>Artist: {album.matchedSummary.artist}</div>
                                          <div>Title: {album.matchedSummary.title}</div>
                                          <div>Year: {album.matchedSummary.year || '—'}</div>
                                          <div>Country: {album.matchedSummary.country || '—'}</div>
                                          <div>Format: {album.matchedSummary.format || '—'}</div>
                                          <div>Cat No: {album.matchedSummary.catalog_number || '—'}</div>
                                          <div>Match score: {album.matchScore ?? 0}</div>
                                          <div>Candidate count: {album.candidateCount ?? 0}</div>
                                        </>
                                      ) : (
                                        <div>None</div>
                                      )}
                                    </div>
                                    {album.candidateMatches && album.candidateMatches.length > 0 && (
                                      <div className="border border-gray-200 rounded p-2 bg-white md:col-span-2">
                                        <div className="font-semibold mb-1">Candidate Matches (Top 5)</div>
                                        <div className="space-y-1">
                                          {album.candidateMatches.slice(0, 5).map((candidate) => (
                                            <div key={candidate.id} className="flex flex-wrap gap-2 text-[12px] text-gray-600">
                                              <span className="font-semibold text-gray-800">#{candidate.id}</span>
                                              <span>{candidate.artist} — {candidate.title}</span>
                                              <span>Score: {candidate.score}</span>
                                              <span>Discogs: {candidate.discogs_release_id || '—'}</span>
                                              <span>Year: {candidate.year || '—'}</span>
                                              <span>Format: {candidate.format || '—'}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </details>
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

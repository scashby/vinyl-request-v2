// src/lib/conflictDetection.ts

export type ResolutionStrategy = 'keep_current' | 'use_new' | 'merge';
export type ImportSource = 'clz' | 'discogs';

export const IDENTIFYING_FIELDS = [
  'artist',
  'title',
  'format',
  'labels',
  'cat_no',
  'barcode',
  'country',
  'year',
  'folder',
  'discogs_release_id',
  'discogs_master_id',
  'date_added',
] as const;

export const CONFLICTABLE_FIELDS = [
  'tracks',
  'disc_metadata',
  'discs',
  'musicians',
  'producers',
  'engineers',
  'songwriters',
  'packaging',
  'sound',
  'spars_code',
  'rpm',
  'vinyl_color',
  'vinyl_weight',
  'matrix_numbers',
  'image_url',
  'back_image_url',
  'discogs_genres',
  'discogs_styles',
  'notes',
  'studio',
  'my_rating',
  'media_condition',
  'package_sleeve_condition',
  'composer',
  'conductor',
  'orchestra',
  'chorus',
  'length_seconds',
  'is_live',
] as const;

export interface Track {
  id?: string;
  position: string;
  title: string;
  artist?: string | null;
  duration?: string;
  disc_number?: number;
  side?: string | null;
  type?: string;
  lyrics_url?: string;
  lyrics?: string;
  lyrics_source?: string;
}

export interface CollectionRow extends Record<string, unknown> {
  id: number;
  artist: string;
  title: string;
  year?: string;
  format: string;
  folder: string;
  media_condition: string;
  barcode?: string;
  cat_no?: string;
  country?: string;
  labels?: string[];
  notes?: string;
  index_number?: number;
  package_sleeve_condition?: string;
  vinyl_weight?: string;
  rpm?: string;
  vinyl_color?: string;
  packaging?: string;
  sound?: string;
  spars_code?: string;
  discs: number;
  date_added?: Date | string;
  modified_date?: Date | string;
  collection_status?: string;
  is_live?: boolean;
  my_rating?: number;
  custom_tags?: string[];
  musicians?: unknown;
  producers?: unknown;
  engineers?: unknown;
  songwriters?: unknown;
  composer?: string;
  conductor?: string;
  orchestra?: string;
  chorus?: string;
  tracks?: unknown;
  disc_metadata?: unknown;
  studio?: string;
  extra?: string;
  length_seconds?: number;
  image_url?: string;
  back_image_url?: string;
  discogs_genres?: string[];
  discogs_styles?: string[];
  matrix_numbers?: unknown;
  discogs_release_id?: string;
  discogs_master_id?: string;
}

export interface TrackDiff {
  position: string;
  status: 'same' | 'changed' | 'added' | 'removed';
  current?: Track;
  new?: Track;
  changes?: string[];
}

export interface FieldConflict {
  album_id: number;
  field_name: string;
  current_value: unknown;
  new_value: unknown;
  source?: string;
  candidates?: Record<string, unknown>;
  artist: string;
  title: string;
  format: string;
  cat_no: string | null;
  barcode: string | null;
  country: string | null;
  year: string | null;
  labels: string[];
}

export interface PreviousResolution {
  album_id: number;
  field_name: string;
  kept_value: unknown;
  rejected_value: unknown;
  resolution: ResolutionStrategy;
  source: ImportSource;
}

export interface IdentifyingFieldUpdate {
  [field: string]: unknown;
}

export interface ConflictDetectionResult {
  safeUpdates: Record<string, unknown>;
  conflicts: FieldConflict[];
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => isEqual(val, b[idx]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }
  return false;
}

/**
 * Normalizes string arrays for case-insensitive comparison (e.g., "Blues" vs "blues")
 */
function areStringArraysEqual(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  
  const normA = a.map(s => String(s).toLowerCase()).sort();
  const normB = b.map(s => String(s).toLowerCase()).sort();
  
  return normA.every((val, idx) => val === normB[idx]);
}

function normalizeEmptyValue(value: unknown): unknown | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && (value.trim() === '' || value === '0:00')) return null;
  if (Array.isArray(value) && value.length === 0) return null;
  return value;
}

function normalizeTrack(track: unknown): Record<string, unknown> {
  if (!track || typeof track !== 'object') return {};
  const t = track as Record<string, unknown>;
  if (t.type && String(t.type) !== 'track') return { _skip: true };
  
  let normalizedDuration: string | undefined;
  if (t.duration) {
    const dur = String(t.duration).trim();
    normalizedDuration = (dur === '' || dur === '0:00') ? undefined : dur;
  }
  
  return {
    title: String(t.title || '').trim(),
    artist: t.artist ? String(t.artist).trim() : undefined,
    duration: normalizedDuration
  };
}

function normalizeDiscMetadata(disc: unknown): Record<string, unknown> {
  if (!disc || typeof disc !== 'object') return {};
  const d = disc as Record<string, unknown>;
  return {
    disc_number: d.disc_number ? Number(d.disc_number) : d.index ? Number(d.index) : undefined,
    track_count: d.track_count ? Number(d.track_count) : undefined
  };
}

function areDiscMetadataEqual(current: unknown, incoming: unknown): boolean {
  if (!Array.isArray(current) || !Array.isArray(incoming)) return isEqual(current, incoming);
  if (current.length !== incoming.length) return false;
  return isEqual(current.map(normalizeDiscMetadata), incoming.map(normalizeDiscMetadata));
}

function areTracksEqual(current: unknown, incoming: unknown): boolean {
  if (!Array.isArray(current) || !Array.isArray(incoming)) return isEqual(current, incoming);
  
  const filterAndNormalize = (tracks: unknown[]) => tracks.map(normalizeTrack).filter(t => !t._skip);
  const normalizedCurrent = filterAndNormalize(current);
  const normalizedIncoming = filterAndNormalize(incoming);
  
  if (normalizedCurrent.length !== normalizedIncoming.length) return false;
  
  for (let i = 0; i < normalizedCurrent.length; i++) {
    const curr = { ...normalizedCurrent[i] };
    const inc = { ...normalizedIncoming[i] };
    delete curr._skip;
    delete inc._skip;
    
    if (curr.duration !== inc.duration) {
      if (curr.duration && !inc.duration) inc.duration = curr.duration;
      else if (!curr.duration && inc.duration) curr.duration = inc.duration;
    }
    
    if (!isEqual(curr, inc)) return false;
  }
  return true;
}

export function buildIdentifyingFieldUpdates(existingAlbum: Record<string, unknown>, importedData: Record<string, unknown>): IdentifyingFieldUpdate {
  const updates: IdentifyingFieldUpdate = {};
  for (const field of IDENTIFYING_FIELDS) {
    if ((existingAlbum[field] === null || existingAlbum[field] === undefined) && (importedData[field] !== null && importedData[field] !== undefined)) {
      updates[field] = importedData[field];
    }
  }
  return updates;
}

export function detectConflicts(existingAlbum: Record<string, unknown>, importedData: Record<string, unknown>, source: ImportSource, previousResolutions: PreviousResolution[]): ConflictDetectionResult {
  const conflicts: FieldConflict[] = [];
  const safeUpdates: Record<string, unknown> = {};
  const resolutionMap = new Map<string, PreviousResolution>();
  for (const res of previousResolutions) resolutionMap.set(res.field_name, res);
  
  const TAG_LIKE_FIELDS = ['genres', 'styles', 'tags', 'discogs_genres', 'discogs_styles', 'custom_tags', 'labels', 'musicians', 'producers', 'engineers', 'songwriters'];

  for (const field of CONFLICTABLE_FIELDS) {
    const existingValue = existingAlbum[field];
    const newValue = importedData[field];
    const normalizedExisting = normalizeEmptyValue(existingValue);
    const normalizedNew = normalizeEmptyValue(newValue);
    
    if (normalizedExisting === null && normalizedNew === null) continue;
    if (normalizedExisting === null && normalizedNew !== null) { safeUpdates[field] = newValue; continue; }
    if (normalizedExisting !== null && normalizedNew === null) continue;
    
    let valuesAreDifferent = false;
    if (field === 'tracks') valuesAreDifferent = !areTracksEqual(existingValue, newValue);
    else if (field === 'disc_metadata') valuesAreDifferent = !areDiscMetadataEqual(existingValue, newValue);
    else if (TAG_LIKE_FIELDS.includes(field)) valuesAreDifferent = !areStringArraysEqual(existingValue, newValue);
    else valuesAreDifferent = !isEqual(existingValue, newValue);
      
    if (valuesAreDifferent) {
      const previousResolution = resolutionMap.get(field);
      if (previousResolution && isEqual(previousResolution.kept_value, existingValue) && isEqual(previousResolution.rejected_value, newValue)) continue;
      
      conflicts.push({
        album_id: existingAlbum.id as number,
        field_name: field,
        current_value: existingValue,
        new_value: newValue,
        artist: existingAlbum.artist as string,
        title: existingAlbum.title as string,
        format: existingAlbum.format as string,
        cat_no: existingAlbum.cat_no as string | null,
        barcode: existingAlbum.barcode as string | null,
        country: existingAlbum.country as string | null,
        year: existingAlbum.year as string | null,
        labels: (existingAlbum.labels as string[]) || [],
      });
    }
  }
  return { safeUpdates, conflicts };
}
// (Remaining helper functions smartMergeTracks, compareTrackArrays, etc. omitted for brevity but remain unchanged)
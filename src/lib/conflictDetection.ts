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
  'location', // FIXED: Was 'folder'
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
  'genres', // FIXED: Was discogs_genres
  'styles', // FIXED: Was discogs_styles
  'personal_notes', // FIXED: Was notes
  'release_notes',
  'master_notes',
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
  location: string;
  media_condition: string;
  barcode?: string;
  cat_no?: string;
  country?: string;
  labels?: string[];
  personal_notes?: string;
  release_notes?: string;
  master_notes?: string;
  index_number?: number;
  package_sleeve_condition?: string;
  vinyl_weight?: string;
  rpm?: string;
  vinyl_color?: string[]; 
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
  genres?: string[];
  styles?: string[];
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
  catalog_number?: string | null;
  barcode: string | null;
  country: string | null;
  year: string | null;
  labels: string[];
  label?: string | null;
  release_id?: number | null;
  master_id?: number | null;
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

function canonicalizeString(value: string): string {
  return value
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\s*([,;:.!?])\s*/g, '$1 ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

function normalizeNotesForComparison(value: string): string {
  return canonicalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function areLooselyEqual(a: unknown, b: unknown): boolean {
  if (isEqual(a, b)) return true;

  if (typeof a === 'string' && typeof b === 'string') {
    return canonicalizeString(a) === canonicalizeString(b);
  }

  const aIsNumberLike = (typeof a === 'number') || (typeof a === 'string' && a.trim() !== '' && !Number.isNaN(Number(a)));
  const bIsNumberLike = (typeof b === 'number') || (typeof b === 'string' && b.trim() !== '' && !Number.isNaN(Number(b)));
  if (aIsNumberLike && bIsNumberLike) {
    return Number(a) === Number(b);
  }

  return false;
}

function arePersonalNotesEquivalent(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return areLooselyEqual(a, b);
  return normalizeNotesForComparison(a) === normalizeNotesForComparison(b);
}

/**
 * Normalizes string arrays for case-insensitive comparison
 */
function areStringArraysEqual(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  
  const normA = a.map(s => canonicalizeString(String(s).toLowerCase())).sort();
  const normB = b.map(s => canonicalizeString(String(s).toLowerCase())).sort();
  
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
    title: canonicalizeString(String(t.title || '')),
    artist: t.artist ? canonicalizeString(String(t.artist)) : undefined,
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

const normalizeAlbumForConflicts = (album: Record<string, unknown>) => {
  const next = { ...album };
  if (!next.labels && next.label) next.labels = [next.label];
  if (!next.cat_no && next.catalog_number) next.cat_no = next.catalog_number;
  if (!next.package_sleeve_condition && next.sleeve_condition) next.package_sleeve_condition = next.sleeve_condition;
  if (!next.personal_notes && next.notes) next.personal_notes = next.notes;
  if (!next.custom_tags && next.tags) next.custom_tags = next.tags;
  return next;
};

export function detectConflicts(existingAlbum: Record<string, unknown>, importedData: Record<string, unknown>, source: ImportSource, previousResolutions: PreviousResolution[]): ConflictDetectionResult {
  const conflicts: FieldConflict[] = [];
  const safeUpdates: Record<string, unknown> = {};
  const resolutionMap = new Map<string, PreviousResolution>();
  for (const res of previousResolutions) resolutionMap.set(res.field_name, res);
  
  const TAG_LIKE_FIELDS = ['genres', 'styles', 'tags', 'custom_tags', 'labels', 'musicians', 'producers', 'engineers', 'songwriters'];
  const normalizedExistingAlbum = normalizeAlbumForConflicts(existingAlbum);
  const normalizedImportedData = normalizeAlbumForConflicts(importedData);

  for (const field of CONFLICTABLE_FIELDS) {
    const existingValue = normalizedExistingAlbum[field];
    const newValue = normalizedImportedData[field];
    const normalizedExisting = normalizeEmptyValue(existingValue);
    const normalizedNew = normalizeEmptyValue(newValue);
    
    if (normalizedExisting === null && normalizedNew === null) continue;
    if (normalizedExisting === null && normalizedNew !== null) { safeUpdates[field] = newValue; continue; }
    if (normalizedExisting !== null && normalizedNew === null) continue;
    
    let valuesAreDifferent = false;
    if (field === 'tracks') valuesAreDifferent = !areTracksEqual(existingValue, newValue);
    else if (field === 'disc_metadata') valuesAreDifferent = !areDiscMetadataEqual(existingValue, newValue);
    else if (TAG_LIKE_FIELDS.includes(field)) valuesAreDifferent = !areStringArraysEqual(existingValue, newValue);
    else if (field === 'personal_notes') valuesAreDifferent = !arePersonalNotesEquivalent(existingValue, newValue);
    else valuesAreDifferent = !areLooselyEqual(existingValue, newValue);
      
    if (valuesAreDifferent) {
      const previousResolution = resolutionMap.get(field);
      if (previousResolution && isEqual(previousResolution.kept_value, existingValue) && isEqual(previousResolution.rejected_value, newValue)) continue;
      
      conflicts.push({
        album_id: normalizedExistingAlbum.id as number,
        field_name: field,
        current_value: existingValue,
        new_value: newValue,
        artist: normalizedExistingAlbum.artist as string,
        title: normalizedExistingAlbum.title as string,
        format: normalizedExistingAlbum.format as string,
        cat_no: normalizedExistingAlbum.cat_no as string | null,
        catalog_number: normalizedExistingAlbum.catalog_number as string | null,
        barcode: normalizedExistingAlbum.barcode as string | null,
        country: normalizedExistingAlbum.country as string | null,
        year: normalizedExistingAlbum.year as string | null,
        labels: (normalizedExistingAlbum.labels as string[]) || [],
        label: (normalizedExistingAlbum.label as string | null) || null,
        release_id: normalizedExistingAlbum.release_id as number | null,
        master_id: normalizedExistingAlbum.master_id as number | null,
      });
    }
  }
  return { safeUpdates, conflicts };
}

/**
 * Smart track merging - preserves enriched data from current DB
 */
export function smartMergeTracks(
  currentTracks: Track[] | null,
  newTracks: Track[] | null
): Track[] {
  if (!currentTracks && !newTracks) return [];
  if (!currentTracks) return newTracks || [];
  if (!newTracks) return currentTracks;
  const currentMap = new Map<string, Track>();
  currentTracks.forEach(track => currentMap.set(track.position, track));
  const merged: Track[] = [];
  newTracks.forEach(newTrack => {
    const currentTrack = currentMap.get(newTrack.position);
    if (currentTrack) {
      merged.push({
        ...newTrack,
        id: currentTrack.id || newTrack.id,
        lyrics_url: currentTrack.lyrics_url || newTrack.lyrics_url,
        lyrics: currentTrack.lyrics || newTrack.lyrics,
        lyrics_source: currentTrack.lyrics_source || newTrack.lyrics_source,
        title: newTrack.title,
        artist: newTrack.artist || currentTrack.artist,
        duration: newTrack.duration || currentTrack.duration,
      });
      currentMap.delete(newTrack.position);
    } else {
      merged.push(newTrack);
    }
  });
  currentMap.forEach(track => merged.push(track));
  merged.sort((a, b) => {
    const aNum = parseInt(a.position);
    const bNum = parseInt(b.position);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return a.position.localeCompare(b.position);
  });
  return merged;
}

/**
 * Merge two arrays - combines both and removes duplicates
 */
export function mergeArrays(current: string[], incoming: string[]): string[] {
  const merged = [...incoming];
  for (const item of current) {
    if (!merged.includes(item)) merged.push(item);
  }
  return merged;
}

/**
 * Apply a resolution to get the final value
 */
export function applyResolution(
  currentValue: unknown,
  newValue: unknown,
  resolution: ResolutionStrategy
): unknown {
  switch (resolution) {
    case 'keep_current': return currentValue;
    case 'use_new': return newValue;
    case 'merge':
      if (Array.isArray(currentValue) && Array.isArray(newValue)) {
        if (currentValue.length > 0 && typeof currentValue[0] === 'string') {
          return mergeArrays(currentValue as string[], newValue as string[]);
        }
      }
      return newValue;
    default: return currentValue;
  }
}

/**
 * Get the rejected value for resolution tracking
 */
export function getRejectedValue(
  currentValue: unknown,
  newValue: unknown,
  resolution: ResolutionStrategy
): unknown {
  switch (resolution) {
    case 'keep_current': return newValue;
    case 'use_new': return currentValue;
    default: return null;
  }
}

/**
 * Get human-readable field name for display
 */
export function getFieldDisplayName(fieldName: string): string {
  const nameMap: Record<string, string> = {
    tracks: 'Tracks',
    disc_metadata: 'Disc Metadata',
    discs: 'Number of Discs',
    musicians: 'Musicians',
    producers: 'Producers',
    engineers: 'Engineers',
    songwriters: 'Songwriters',
    packaging: 'Packaging',
    sound: 'Sound',
    spars_code: 'SPARS Code',
    rpm: 'RPM',
    vinyl_color: 'Vinyl Color',
    vinyl_weight: 'Vinyl Weight',
    matrix_numbers: 'Matrix Numbers',
    image_url: 'Cover Image',
    back_image_url: 'Back Cover Image',
    genres: 'Genres',
    styles: 'Styles',
    personal_notes: 'My Notes', // FIXED
    release_notes: 'Release Notes',
    studio: 'Studio',
    my_rating: 'Rating',
    media_condition: 'Media Condition',
    package_sleeve_condition: 'Sleeve Condition',
    composer: 'Composer',
    conductor: 'Conductor',
    orchestra: 'Orchestra',
    chorus: 'Chorus',
    length_seconds: 'Length',
    is_live: 'Live Recording',
  };
  return nameMap[fieldName] || fieldName;
}

/**
 * Check if a field can be merged
 */
export function canMergeField(value: unknown): boolean {
  return Array.isArray(value);
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find matching album in collection by artist + title + format
 * Used for CLZ/Discogs import matching
 */
export function findMatchingAlbum<T extends { artist: string; title: string; format: string }>(
  importedAlbum: { artist: string; title: string; format: string },
  existingAlbums: T[]
): T | undefined {
  const importArtistNorm = normalizeText(importedAlbum.artist);
  const importTitleNorm = normalizeText(importedAlbum.title);
  const importFormatNorm = normalizeText(importedAlbum.format);
  
  return existingAlbums.find(album => {
    const albumArtistNorm = normalizeText(album.artist);
    const albumTitleNorm = normalizeText(album.title);
    const albumFormatNorm = normalizeText(album.format);
    
    return (
      albumArtistNorm === importArtistNorm &&
      albumTitleNorm === importTitleNorm &&
      albumFormatNorm === importFormatNorm
    );
  });
}

/**
 * Get safe updates for an album (combining identifying field updates and non-conflicting updates)
 * This is a convenience wrapper combining buildIdentifyingFieldUpdates and the safeUpdates from detectConflicts
 */
export function getSafeUpdates(
  existingAlbum: Record<string, unknown>,
  importedData: Record<string, unknown>,
  source: ImportSource,
  previousResolutions: PreviousResolution[] = []
): Record<string, unknown> {
  // Get identifying field updates (NULL -> value)
  const identifyingUpdates = buildIdentifyingFieldUpdates(existingAlbum, importedData);
  
  // Get safe updates for conflictable fields
  const { safeUpdates } = detectConflicts(existingAlbum, importedData, source, previousResolutions);
  
  // Combine both
  return {
    ...identifyingUpdates,
    ...safeUpdates
  };
}
// AUDIT: inspected, no changes.

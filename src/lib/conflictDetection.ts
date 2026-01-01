// src/lib/conflictDetection.ts
// Shared conflict detection logic for CLZ and Discogs imports

export type ResolutionStrategy = 'keep_current' | 'use_new' | 'merge';
export type ImportSource = 'clz' | 'discogs';

/**
 * IDENTIFYING FIELDS - Immutable after initial import
 * These fields uniquely identify a specific pressing/edition
 * Only updated if current value is NULL/undefined
 */
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

/**
 * CONFLICTABLE FIELDS - Can generate conflicts
 * These fields can differ between imports and require user decision
 */
export const CONFLICTABLE_FIELDS = [
  // Tracks & Structure
  'tracks',
  'disc_metadata',
  'discs',
  
  // Credits (arrays)
  'musicians',
  'producers',
  'engineers',
  'songwriters',
  
  // Technical
  'packaging',
  'sound',
  'spars_code',
  'rpm',
  'vinyl_color',
  'vinyl_weight',
  'matrix_numbers',
  
  // Images
  'image_url',
  'back_image_url',
  
  // Genres/Styles
  'discogs_genres',
  'discogs_styles',
  
  // Other metadata
  'notes',
  'studio',
  'my_rating',
  'media_condition',
  'package_sleeve_condition',
  
  // Classical
  'composer',
  'conductor',
  'orchestra',
  'chorus',
  
  // Misc
  'length_seconds',
  'is_live',
] as const;

/**
 * Track type definition
 */
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

/**
 * Collection row from database
 */
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

/**
 * Track difference for comparison display
 */
export interface TrackDiff {
  position: string;
  status: 'same' | 'changed' | 'added' | 'removed';
  current?: Track;
  new?: Track;
  changes?: string[];
}

/**
 * Field conflict detected during import
 */
export interface FieldConflict {
  album_id: number;
  field_name: string;
  current_value: unknown;
  new_value: unknown;
  
  // Identifying information for display
  artist: string;
  title: string;
  format: string;
  cat_no: string | null;
  barcode: string | null;
  country: string | null;
  year: string | null;
  labels: string[];
}

/**
 * Previous resolution from database
 */
export interface PreviousResolution {
  album_id: number;
  field_name: string;
  kept_value: unknown;
  rejected_value: unknown;
  resolution: ResolutionStrategy;
  source: ImportSource;
}

/**
 * Result of applying identifying field logic
 */
export interface IdentifyingFieldUpdate {
  [field: string]: unknown;
}

/**
 * Result of conflict detection
 */
export interface ConflictDetectionResult {
  safeUpdates: Record<string, unknown>;
  conflicts: FieldConflict[];
}

/**
 * Check if two values are equal (deep comparison for objects/arrays)
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  
  // For arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => isEqual(val, b[idx]));
  }
  
  // For objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => 
      isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }
  
  return false;
}

/**
 * Build update object for identifying fields
 * Only updates fields that are NULL/undefined in existing album
 */
export function buildIdentifyingFieldUpdates(
  existingAlbum: Record<string, unknown>,
  importedData: Record<string, unknown>
): IdentifyingFieldUpdate {
  const updates: IdentifyingFieldUpdate = {};
  
  for (const field of IDENTIFYING_FIELDS) {
    const existingValue = existingAlbum[field];
    const newValue = importedData[field];
    
    // Only update if existing is null/undefined AND new has a value
    if (
      (existingValue === null || existingValue === undefined) &&
      (newValue !== null && newValue !== undefined)
    ) {
      updates[field] = newValue;
    }
    // If existing has a value, NEVER overwrite - it's locked
  }
  
  return updates;
}

/**
 * Detect conflicts for conflictable fields
 * Skips conflicts that were already resolved with the same values
 */
export function detectConflicts(
  existingAlbum: Record<string, unknown>,
  importedData: Record<string, unknown>,
  source: ImportSource,
  previousResolutions: PreviousResolution[]
): ConflictDetectionResult {
  const conflicts: FieldConflict[] = [];
  const safeUpdates: Record<string, unknown> = {};
  
  // Build lookup map of previous resolutions
  const resolutionMap = new Map<string, PreviousResolution>();
  for (const res of previousResolutions) {
    resolutionMap.set(res.field_name, res);
  }
  
  for (const field of CONFLICTABLE_FIELDS) {
    const existingValue = existingAlbum[field];
    const newValue = importedData[field];
    
    // Case 1: Both have values and they differ
    if (
      existingValue !== null && existingValue !== undefined &&
      newValue !== null && newValue !== undefined &&
      !isEqual(existingValue, newValue)
    ) {
      // Check if we already resolved this exact conflict
      const previousResolution = resolutionMap.get(field);
      
      if (previousResolution) {
        // Check if it's the EXACT same conflict (same values)
        const sameKept = isEqual(previousResolution.kept_value, existingValue);
        const sameRejected = isEqual(previousResolution.rejected_value, newValue);
        
        if (sameKept && sameRejected) {
          // Already decided on this exact conflict - skip
          continue;
        }
        // Different values than before - need new decision
      }
      
      // New conflict - queue it
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
    // Case 2: Existing is null, new has value - safe to update
    else if (
      (existingValue === null || existingValue === undefined) &&
      (newValue !== null && newValue !== undefined)
    ) {
      safeUpdates[field] = newValue;
    }
    // Case 3: New is null - keep existing (no action)
    // Case 4: Both null - no action
  }
  
  return { safeUpdates, conflicts };
}

/**
 * Smart track merging - preserves enriched data from current DB
 * Merges by position, keeping lyrics and other enrichment
 */
export function smartMergeTracks(
  currentTracks: Track[] | null,
  newTracks: Track[] | null
): Track[] {
  if (!currentTracks && !newTracks) return [];
  if (!currentTracks) return newTracks || [];
  if (!newTracks) return currentTracks;
  
  // Build map of current tracks by position for quick lookup
  const currentMap = new Map<string, Track>();
  currentTracks.forEach(track => {
    currentMap.set(track.position, track);
  });
  
  // Start with all new tracks as base
  const merged: Track[] = [];
  
  newTracks.forEach(newTrack => {
    const currentTrack = currentMap.get(newTrack.position);
    
    if (currentTrack) {
      // Track exists in both - merge keeping enriched data
      merged.push({
        ...newTrack,
        // Preserve enriched data from current DB
        id: currentTrack.id || newTrack.id,
        lyrics_url: currentTrack.lyrics_url || newTrack.lyrics_url,
        lyrics: currentTrack.lyrics || newTrack.lyrics,
        lyrics_source: currentTrack.lyrics_source || newTrack.lyrics_source,
        // Use new track data for basic info
        title: newTrack.title,
        artist: newTrack.artist || currentTrack.artist,
        duration: newTrack.duration || currentTrack.duration,
      });
      
      // Remove from current map since we've processed it
      currentMap.delete(newTrack.position);
    } else {
      // New track that doesn't exist in current
      merged.push(newTrack);
    }
  });
  
  // Add any remaining current tracks that weren't in new tracks
  // (This handles cases where new import is missing some tracks)
  currentMap.forEach(track => {
    merged.push(track);
  });
  
  // Sort by position
  merged.sort((a, b) => {
    // Try numeric sort first
    const aNum = parseInt(a.position);
    const bNum = parseInt(b.position);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    
    // Fall back to string sort
    return a.position.localeCompare(b.position);
  });
  
  return merged;
}

/**
 * Compare two track arrays and return differences
 * Used for visual diff display
 */
export function compareTrackArrays(
  currentTracks: Track[],
  newTracks: Track[]
): TrackDiff[] {
  const diffs: TrackDiff[] = [];
  
  // Build maps for quick lookup
  const currentMap = new Map<string, Track>();
  const newMap = new Map<string, Track>();
  
  currentTracks.forEach(track => currentMap.set(track.position, track));
  newTracks.forEach(track => newMap.set(track.position, track));
  
  // Get all positions from both arrays
  const allPositions = new Set([
    ...currentTracks.map(t => t.position),
    ...newTracks.map(t => t.position)
  ]);
  
  // Sort positions
  const sortedPositions = Array.from(allPositions).sort((a, b) => {
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    
    return a.localeCompare(b);
  });
  
  sortedPositions.forEach(position => {
    const current = currentMap.get(position);
    const newTrack = newMap.get(position);
    
    if (!current && newTrack) {
      // Added track
      diffs.push({
        position,
        status: 'added',
        new: newTrack,
      });
    } else if (current && !newTrack) {
      // Removed track
      diffs.push({
        position,
        status: 'removed',
        current,
      });
    } else if (current && newTrack) {
      // Check if changed
      const changes: string[] = [];
      
      if (current.title !== newTrack.title) {
        changes.push('title');
      }
      if (current.artist !== newTrack.artist) {
        changes.push('artist');
      }
      if (current.duration !== newTrack.duration) {
        changes.push('duration');
      }
      
      if (changes.length > 0) {
        diffs.push({
          position,
          status: 'changed',
          current,
          new: newTrack,
          changes,
        });
      } else {
        diffs.push({
          position,
          status: 'same',
          current,
          new: newTrack,
        });
      }
    }
  });
  
  return diffs;
}

/**
 * Merge two arrays - combines both and removes duplicates
 * Preserves order from new array, then adds unique items from current
 */
export function mergeArrays(current: string[], incoming: string[]): string[] {
  // Start with incoming order (import data)
  const merged = [...incoming];
  
  // Add any from current that aren't in incoming
  for (const item of current) {
    if (!merged.includes(item)) {
      merged.push(item);
    }
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
    case 'keep_current':
      return currentValue;
    
    case 'use_new':
      return newValue;
    
    case 'merge':
      // String arrays - merge
      if (Array.isArray(currentValue) && Array.isArray(newValue)) {
        // Check if string array
        if (currentValue.length > 0 && typeof currentValue[0] === 'string') {
          return mergeArrays(currentValue as string[], newValue as string[]);
        }
      }
      
      // For tracks, this should use smartMergeTracks (handled in modal)
      // Fallback to new value
      return newValue;
    
    default:
      return currentValue;
  }
}

/**
 * Get the "opposite" value for resolution
 * When user chooses to keep current, the rejected value is new
 * When user chooses to use new, the rejected value is current
 */
export function getRejectedValue(
  currentValue: unknown,
  newValue: unknown,
  resolution: ResolutionStrategy
): unknown {
  switch (resolution) {
    case 'keep_current':
      return newValue; // Rejected the new value
    
    case 'use_new':
      return currentValue; // Rejected the current value
    
    case 'merge':
      return null; // No rejection for merge
    
    default:
      return null;
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
    discogs_genres: 'Genres',
    discogs_styles: 'Styles',
    notes: 'Notes',
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
 * Format value for display in UI
 */
export function formatValueForDisplay(value: unknown): string {
  if (value === null || value === undefined) {
    return '(none)';
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty)';
    if (typeof value[0] === 'string') {
      return value.join(', ');
    }
    return `[${value.length} items]`;
  }
  
  if (typeof value === 'object') {
    return `[${Object.keys(value).length} entries]`;
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  return String(value);
}

/**
 * Check if a field can be merged (arrays only)
 */
export function canMergeField(value: unknown): boolean {
  return Array.isArray(value);
}

/**
 * Normalize text for matching (lowercase, no punctuation, trimmed)
 */
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
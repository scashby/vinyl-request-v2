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
      // Only works for arrays
      if (Array.isArray(currentValue) && Array.isArray(newValue)) {
        return mergeArrays(currentValue, newValue);
      }
      // Fallback to new value if not arrays
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
// lib/discogs-validation.ts
// Shared validation logic for Discogs release IDs across the application

/**
 * Checks if a Discogs release ID is valid
 * 
 * Invalid values include:
 * - null
 * - undefined
 * - empty string ''
 * - string literal 'null'
 * - string literal 'undefined'
 * - string '0'
 * 
 * @param releaseId - The release ID to validate
 * @returns true if valid, false otherwise
 */
export function hasValidDiscogsId(releaseId: string | null | undefined): boolean {
  const trimmed = releaseId?.trim();
  return !!(
    trimmed && 
    trimmed !== '' && 
    trimmed !== 'null' && 
    trimmed !== 'undefined' && 
    trimmed !== '0'
  );
}

/**
 * Supabase query filter for finding albums with invalid Discogs release IDs
 * Use with: query.or(INVALID_DISCOGS_ID_FILTER)
 */
export const INVALID_DISCOGS_ID_FILTER = 
  'discogs_release_id.is.null,' +
  'discogs_release_id.eq.,' +
  'discogs_release_id.eq.null,' +
  'discogs_release_id.eq.undefined,' +
  'discogs_release_id.eq.0';
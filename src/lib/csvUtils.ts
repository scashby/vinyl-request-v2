// src/lib/importUtils.ts
// Updated for Phase 2: Strict Normalization & Rules

/**
 * Clean artist names by removing Discogs disambiguation numbers.
 * Example: "John Williams (4)" -> "John Williams"
 * Example: "Chicago (2)" -> "Chicago"
 */
export function cleanArtistName(rawName: string): string {
  if (!rawName) return '';
  // 1. Regex to strip " (2)", " (12)", etc. at the end of the string
  // Matches space + parenthesis + digits + parenthesis + end of string
  let cleaned = rawName.replace(/\s\(\d+\)$/, '');
  
  // 2. Normalize " and " to " & " for consistency
  cleaned = cleaned.replace(/\s+and\s+/gi, ' & ');
  
  return cleaned.trim();
}

/**
 * Generate a sort name based on rules.
 * Default: Moves "The" to the end.
 * Exception: Returns original name if it's in the exception list (e.g., "The The").
 */
export function generateSortName(name: string, exceptions: string[] = []): string {
  if (!name) return '';
  
  // Check strict exceptions (like "The The")
  if (exceptions.includes(name)) {
    return name;
  }

  // Standard Logic: Move leading "The" to the end
  if (name.match(/^The\s/i)) {
    return name.substring(4) + ', The';
  }
  
  // Standard Logic: Move leading "A" to the end (Optional, standard library practice)
  if (name.match(/^A\s/i)) {
    return name.substring(2) + ', A';
  }

  return name;
}

/**
 * Extract "Featuring" artists from a string.
 * Returns the main artist and an array of featuring artists.
 * Example: "Santana feat. Rob Thomas" -> { primary: "Santana", secondary: ["Rob Thomas"] }
 */
export function extractSecondaryArtists(artistString: string): { 
  primary: string; 
  secondary: string[] 
} {
  if (!artistString) return { primary: '', secondary: [] };

  const feats = [' feat. ', ' ft. ', ' featuring ', ' with '];
  let primary = artistString;
  const secondary: string[] = [];

  for (const separator of feats) {
    if (primary.toLowerCase().includes(separator)) {
      const parts = primary.split(new RegExp(separator, 'i'));
      primary = parts[0].trim();
      
      // Split the remainder by commas or & to get individual artists
      // Example: " feat. Artist A, Artist B & Artist C"
      if (parts[1]) {
        const guests = parts[1].split(/,|&/).map(s => cleanArtistName(s.trim()));
        secondary.push(...guests);
      }
      break; // Only handle the first separator found
    }
  }

  return { primary: cleanArtistName(primary), secondary };
}

// Re-export SyncMode types if needed by other components
export type SyncMode = 'full_replacement' | 'full_sync' | 'partial_sync' | 'new_only';

export function isSameAlbum(
  album1: { artist: string; title: string },
  album2: { artist: string; title: string }
): boolean {
  return (
    cleanArtistName(album1.artist).toLowerCase() === cleanArtistName(album2.artist).toLowerCase() &&
    album1.title.toLowerCase() === album2.title.toLowerCase()
  );
}
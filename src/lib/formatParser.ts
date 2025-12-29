// src/lib/formatParser.ts
// Database-driven Discogs format string parser

import { supabase } from './supabaseClient';

export interface ParsedFormat {
  // Database fields
  format: string;                 // Cleaned format (e.g., "2xLP, Album")
  discs: number;                  // Disc count (1, 2, 3, etc.)
  rpm: string;                    // "33", "45", "78"
  sound: string;                  // "Mono", "Stereo" (default), "Quadraphonic"
  vinyl_weight: string | null;    // "180g", "140g", etc.
  vinyl_color: string | null;     // "Blue", "Red", etc.
  packaging: string | null;       // "Gatefold", "Digipak", etc.
  
  // Text to append to extra field
  extraText: string;              // Sentences about edition, pressing plant, etc.
  
  // Unknown elements that need user input
  unknownElements: UnknownElement[];
}

export interface UnknownElement {
  element: string;
  fullFormatString: string;
  albumInfo?: {
    artist: string;
    title: string;
    discogsReleaseId?: string;
  };
}

export interface FormatAbbreviation {
  id: number;
  abbreviation: string;
  full_name: string;
  category: string;
}

// Cache for abbreviations to avoid repeated database calls
let abbreviationsCache: FormatAbbreviation[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load format abbreviations from database with caching
 */
async function loadAbbreviations(): Promise<FormatAbbreviation[]> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (abbreviationsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return abbreviationsCache;
  }
  
  const { data, error } = await supabase
    .from('format_abbreviations')
    .select('*');
  
  if (error) {
    console.error('Error loading format abbreviations:', error);
    return [];
  }
  
  abbreviationsCache = data as FormatAbbreviation[];
  cacheTimestamp = now;
  
  return abbreviationsCache;
}

/**
 * Clear the abbreviations cache (call after adding new abbreviations)
 */
export function clearAbbreviationsCache(): void {
  abbreviationsCache = null;
  cacheTimestamp = 0;
}

/**
 * Add a new format abbreviation to the database
 */
export async function addFormatAbbreviation(
  abbreviation: string,
  fullName: string,
  category: string,
  createdBy?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('format_abbreviations')
    .insert({
      abbreviation,
      full_name: fullName,
      category,
      created_by: createdBy,
      use_count: 1,
    });
  
  if (error) {
    console.error('Error adding format abbreviation:', error);
    return false;
  }
  
  // Clear cache so new abbreviation is picked up
  clearAbbreviationsCache();
  return true;
}

/**
 * Known media types (always in format)
 */
const MEDIA_TYPES = ['Cass', 'CD', '7"', '10"', '12"', 'LP', 'EP', 'Single', 'Maxi-Single', 'Mini-Album'];

/**
 * Known album types (always in format)
 */
const ALBUM_TYPES = ['Album', 'Comp', 'Compilation'];

/**
 * Parses a Discogs format string into structured database fields
 * Uses database lookups for abbreviations
 * 
 * @param formatString - The raw format string from Discogs
 * @param albumInfo - Optional album info for unknown element modals
 * @returns ParsedFormat object with database fields, extra text, and unknown elements
 */
export async function parseDiscogsFormat(
  formatString: string,
  albumInfo?: { artist: string; title: string; discogsReleaseId?: string }
): Promise<ParsedFormat> {
  if (!formatString || formatString.trim() === '') {
    return {
      format: '',
      discs: 1,
      rpm: '33',
      sound: 'Stereo',
      vinyl_weight: null,
      vinyl_color: null,
      packaging: null,
      extraText: '',
      unknownElements: [],
    };
  }

  // Load abbreviations from database
  const abbreviations = await loadAbbreviations();
  
  // Create lookup maps by category
  const lookupByCategory = abbreviations.reduce((acc, abbr) => {
    if (!acc[abbr.category]) {
      acc[abbr.category] = new Map();
    }
    acc[abbr.category].set(abbr.abbreviation, abbr.full_name);
    return acc;
  }, {} as Record<string, Map<string, string>>);

  // Split by comma and clean up
  const parts = formatString.split(',').map(p => p.trim()).filter(p => p !== 'Vinyl' && p !== '');

  // Initialize result
  const result: ParsedFormat = {
    format: '',
    discs: 1,
    rpm: '33',
    sound: 'Stereo',
    vinyl_weight: null,
    vinyl_color: null,
    packaging: null,
    extraText: '',
    unknownElements: [],
  };

  const extraParts: string[] = [];
  const formatParts: string[] = [];
  const unknownElements: string[] = [];

  for (const part of parts) {
    let matched = false;

    // Disc count (e.g., "2xLP", "3xCD")
    const discMatch = part.match(/^(\d+)x(LP|CD|Vinyl)/i);
    if (discMatch) {
      result.discs = parseInt(discMatch[1], 10);
      const mediaType = discMatch[2].toUpperCase();
      if (mediaType === 'LP') {
        formatParts.push(`${result.discs}xLP`);
      } else if (mediaType === 'CD') {
        formatParts.push(`${result.discs}xCD`);
      }
      matched = true;
      continue;
    }

    // Media types for format
    if (MEDIA_TYPES.includes(part)) {
      formatParts.push(part);
      matched = true;
      continue;
    }

    // Album types for format
    if (ALBUM_TYPES.includes(part)) {
      const albumType = part === 'Comp' ? 'Compilation' : part;
      formatParts.push(albumType);
      matched = true;
      continue;
    }

    // RPM (explicit)
    if (part.includes('RPM') || ['33', '45', '78', '16⅔', '33⅓'].includes(part)) {
      const rpmMatch = part.match(/(\d+)/);
      if (rpmMatch) {
        result.rpm = rpmMatch[1];
        matched = true;
        continue;
      }
    }

    // Sound - Mono/Stereo/Quad
    if (part === 'Mono' || part.toLowerCase() === 'mono') {
      result.sound = 'Mono';
      matched = true;
      continue;
    }
    if (part === 'Quad' || part === 'Quadraphonic') {
      result.sound = 'Quadraphonic';
      matched = true;
      continue;
    }
    if (part === 'Stereo' || part.toLowerCase() === 'stereo') {
      result.sound = 'Stereo';
      matched = true;
      continue;
    }

    // Weight (e.g., "180", "140g", "200 gram")
    const weightMatch = part.match(/^(\d+)\s*(g|gram|grams)?$/i);
    if (weightMatch) {
      result.vinyl_weight = `${weightMatch[1]}g`;
      matched = true;
      continue;
    }

    // Try to match against database abbreviations
    // Check each category in priority order
    
    // 1. Packaging
    if (lookupByCategory.packaging?.has(part)) {
      const packaging = lookupByCategory.packaging.get(part)!;
      result.packaging = packaging;
      if (part === 'Pic') {
        extraParts.push('Picture disc');
      }
      matched = true;
      continue;
    }

    // 2. Pressing Plants
    if (lookupByCategory.pressing_plant?.has(part)) {
      extraParts.push(lookupByCategory.pressing_plant.get(part)!);
      matched = true;
      continue;
    }

    // 3. Colors - check if abbreviation OR if part contains color words
    if (lookupByCategory.color?.has(part)) {
      result.vinyl_color = lookupByCategory.color.get(part)!;
      matched = true;
      continue;
    }
    
    // Check if part contains common color words (for multi-word colors like "Splatter Red Blue")
    const colorWords = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 'Black', 'White', 
                        'Clear', 'Gold', 'Silver', 'Marble', 'Splatter', 'Translucent', 'Opaque'];
    if (colorWords.some(color => part.includes(color))) {
      result.vinyl_color = part;
      matched = true;
      continue;
    }

    // 4. Editions
    if (lookupByCategory.edition?.has(part)) {
      extraParts.push(lookupByCategory.edition.get(part)!);
      matched = true;
      continue;
    }

    // 5. Cassette Features
    if (lookupByCategory.cassette_feature?.has(part)) {
      extraParts.push(lookupByCategory.cassette_feature.get(part)!);
      matched = true;
      continue;
    }

    // 6. CD Features
    if (lookupByCategory.cd_feature?.has(part)) {
      extraParts.push(lookupByCategory.cd_feature.get(part)!);
      matched = true;
      continue;
    }

    // 7. Vinyl Material
    if (lookupByCategory.vinyl_material?.has(part)) {
      extraParts.push(lookupByCategory.vinyl_material.get(part)!);
      matched = true;
      continue;
    }

    // If we get here, this element is unknown
    if (!matched) {
      unknownElements.push(part);
    }
  }

  // Build format string
  result.format = formatParts.join(', ');

  // Infer RPM if not explicitly set
  if (!parts.some(p => p.includes('RPM') || ['33', '45', '78'].includes(p))) {
    if (parts.includes('7"')) {
      result.rpm = '45';
    } else if (parts.includes('10"') || parts.includes('LP') || parts.includes('12"')) {
      result.rpm = '33';
    }
  }

  // Build extra text
  result.extraText = extraParts.length > 0 ? extraParts.join('. ') + '.' : '';

  // Build unknown elements array
  result.unknownElements = unknownElements.map(element => ({
    element,
    fullFormatString: formatString,
    albumInfo,
  }));

  return result;
}

/**
 * Appends parsed format details to existing extra field
 * 
 * @param existingExtra - Current value of the extra field (may be null or empty)
 * @param newDetails - New details to append from parseDiscogsFormat
 * @returns Combined extra text
 */
export function appendToExtra(existingExtra: string | null, newDetails: string): string {
  if (!newDetails || newDetails.trim() === '') {
    return existingExtra || '';
  }

  if (!existingExtra || existingExtra.trim() === '') {
    return newDetails;
  }

  // Add separator if existing text doesn't end with punctuation
  const separator = /[.!?]$/.test(existingExtra.trim()) ? ' ' : '. ';
  return existingExtra.trim() + separator + newDetails;
}
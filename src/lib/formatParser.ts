// src/lib/formatParser.ts
// Updated for V3: Strictly separates Quantity, Media Type, and Descriptors

export interface ParsedFormat {
  qty: number;                    // 1, 2, 3...
  media_type: string;             // "Vinyl", "CD", "Cassette"
  format_details: string[];       // ["LP", "Album", "Stereo", "Gatefold"]
  
  // Extracted physical attributes (still useful for filtering)
  rpm: string | null;
  weight: string | null;          // "180g"
  color: string | null;           // "Blue"
  
  // Descriptions meant for the "Extra" text field (pressing info, etc)
  extraText: string;
}

// 1. Base Formats (The "Media Type")
const BASE_FORMATS = new Set([
  'Vinyl', 'CD', 'CDr', 'Cassette', 'Cass', 'File', 'Box Set', 'All Media',
  '8-Track Cartridge', 'Flexi-disc', 'Lathe Cut', 'Shellac', 'SACD',
  'DVD', 'Blu-ray', 'Betamax', 'VHS'
]);

// 2. Format Descriptions (Goes into format_details array)
const KNOWN_DESCRIPTIONS = new Set([
  'Album', 'Compilation', 'Comp', 'EP', 'LP', 'Mini-Album', 'Maxi-Single', 'Single',
  'Remastered', 'Reissue', 'Repress', 'Mono', 'Stereo', 'Quadraphonic', 'Mixed',
  'Limited Edition', 'Promo', 'Test Pressing', 'Unofficial Release', 'Gatefold',
  'Digipak', 'Club Edition', 'Jukebox'
]);

// Normalize helper (Discogs sometimes uses "Cass" for "Cassette")
function normalizeMediaType(type: string): string {
  if (type === 'Cass') return 'Cassette';
  if (type === '7"' || type === '10"' || type === '12"') return 'Vinyl'; // Infer Vinyl from size if missing
  return type;
}

export function parseDiscogsFormat(
  formatString: string
): ParsedFormat {
  const result: ParsedFormat = {
    qty: 1,
    media_type: 'Vinyl', // Default fallback
    format_details: [],
    rpm: null,
    weight: null,
    color: null,
    extraText: ''
  };

  if (!formatString) return result;

  // Step 1: Split string by comma and clean up
  // Example: "2 x Vinyl, LP, Album, Limited Edition, 180g"
  const rawParts = formatString.split(',').map(p => p.trim());

  const extraParts: string[] = [];

  for (const part of rawParts) {
    // A. Check for Quantity + Media Type (e.g., "2 x Vinyl")
    // Regex matches "2xVinyl", "2 x Vinyl", "Vinyl"
    const qtyMatch = part.match(/^(\d+)\s*x\s*(.+)$/i);
    
    if (qtyMatch) {
      result.qty = parseInt(qtyMatch[1], 10);
      result.media_type = normalizeMediaType(qtyMatch[2].trim());
      continue;
    }

    // B. Check for strict Media Type match if no qty prefix (e.g. "CD")
    if (BASE_FORMATS.has(part)) {
      result.media_type = normalizeMediaType(part);
      continue;
    }

    // C. Check for Size implies Vinyl (e.g. 7", 12")
    if (['7"', '10"', '12"'].includes(part)) {
      if (result.media_type === 'Vinyl') { // Only add as detail if we know it's vinyl
         result.format_details.push(part);
      }
      // Infer RPM defaults based on size
      if (!result.rpm) {
        if (part === '7"') result.rpm = '45';
        else result.rpm = '33';
      }
      continue;
    }

    // D. Extract RPM explicitly
    if (part.includes('RPM')) {
      result.rpm = part.replace('RPM', '').trim();
      continue;
    }
    if (['33', '45', '78'].includes(part)) {
      result.rpm = part;
      continue;
    }

    // E. Extract Weight
    const weightMatch = part.match(/^(\d+)\s*(g|gram|grams)$/i);
    if (weightMatch) {
      result.weight = `${weightMatch[1]}g`;
      result.format_details.push(result.weight); // Also add to details
      continue;
    }

    // F. Extract Known Descriptions (LP, Album, etc.)
    if (KNOWN_DESCRIPTIONS.has(part)) {
      // Expand abbreviations
      let desc = part;
      if (part === 'Comp') desc = 'Compilation';
      if (part === 'Pic') desc = 'Picture Disc';
      
      result.format_details.push(desc);
      continue;
    }

    // G. Color Detection (Simple list)
    const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 
                    'White', 'Clear', 'Gold', 'Silver', 'Splatter', 'Marble'];
    if (colors.some(c => part.includes(c))) {
      result.color = part;
      extraParts.push(part); // Colors usually go to extra text or details
      continue;
    }

    // H. Everything else goes to "Extra" (Unknown stuff)
    extraParts.push(part);
  }

  // Final cleanup: If we have "LP" in details but media_type is unknown/default, ensure it's Vinyl
  if (result.format_details.includes('LP') || result.format_details.includes('EP')) {
    if (result.media_type === 'Unknown') result.media_type = 'Vinyl';
  }

  result.extraText = extraParts.join(', ');

  return result;
}
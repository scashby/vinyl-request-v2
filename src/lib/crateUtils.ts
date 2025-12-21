// src/lib/crateUtils.ts
import type { Album } from '../types/album';
import type { SmartRule, Crate } from '../types/crate';

/**
 * Evaluate if an album matches a smart crate's rules
 */
export function albumMatchesSmartCrate(album: Album, crate: Crate): boolean {
  if (!crate.is_smart || !crate.smart_rules) return false;

  const { rules } = crate.smart_rules;
  const matchType = crate.match_rules;

  if (matchType === 'all') {
    // ALL rules must match
    return rules.every(rule => albumMatchesRule(album, rule));
  } else {
    // ANY rule must match
    return rules.some(rule => albumMatchesRule(album, rule));
  }
}

/**
 * Check if an album matches a single rule
 */
function albumMatchesRule(album: Album, rule: SmartRule): boolean {
  const { field, operator, value } = rule;
  const albumValue = getAlbumFieldValue(album, field);

  // Handle null/undefined values
  if (albumValue === null || albumValue === undefined) return false;

  switch (operator) {
    // Text operators
    case 'contains':
      return String(albumValue).toLowerCase().includes(String(value).toLowerCase());
    case 'is':
      return String(albumValue).toLowerCase() === String(value).toLowerCase();
    case 'is_not':
      return String(albumValue).toLowerCase() !== String(value).toLowerCase();
    case 'does_not_contain':
      return !String(albumValue).toLowerCase().includes(String(value).toLowerCase());

    // Number operators
    case 'greater_than':
      return Number(albumValue) > Number(value);
    case 'less_than':
      return Number(albumValue) < Number(value);
    case 'greater_than_or_equal_to':
      return Number(albumValue) >= Number(value);
    case 'less_than_or_equal_to':
      return Number(albumValue) <= Number(value);

    // Date operators
    case 'before':
      return new Date(String(albumValue)) < new Date(String(value));
    case 'after':
      return new Date(String(albumValue)) > new Date(String(value));

    // Array operators
    case 'includes':
      if (Array.isArray(albumValue)) {
        return albumValue.some(item => 
          String(item).toLowerCase() === String(value).toLowerCase()
        );
      }
      return false;
    case 'excludes':
      if (Array.isArray(albumValue)) {
        return !albumValue.some(item => 
          String(item).toLowerCase() === String(value).toLowerCase()
        );
      }
      return true;

    default:
      return false;
  }
}

/**
 * Get the value of a field from an album
 */
function getAlbumFieldValue(album: Album, field: string): unknown {
  // Direct field access
  if (field in album) {
    return album[field as keyof Album];
  }

  // Derived fields
  if (field === 'decade') {
    return album.decade;
  }

  return null;
}

/**
 * Get albums that belong to a manual crate (from junction table)
 * This will be implemented when we add the ability to add albums to crates
 */
export async function getManualCrateAlbumIds(): Promise<number[]> {
  // Placeholder - will be implemented in Phase 2
  return [];
}
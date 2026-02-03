// src/lib/crateUtils.ts
import type { V3Album } from '../types/v3-types';
import type { SmartRule, Crate } from '../types/crate';

/**
 * Evaluate if an album matches a smart crate's rules
 */
export function albumMatchesSmartCrate(album: V3Album, crate: Crate): boolean {
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
function albumMatchesRule(album: V3Album, rule: SmartRule): boolean {
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
function getAlbumFieldValue(album: V3Album, field: string): unknown {
  const release = album.release;
  const master = release?.master;
  const artist = master?.artist;

  switch (field) {
    case 'artist':
      return artist?.name ?? null;
    case 'title':
      return master?.title ?? null;
    case 'year':
      return release?.release_year ?? master?.original_release_year ?? null;
    case 'format': {
      if (!release) return null;
      const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
      const base = parts.join(', ');
      const qty = release.qty ?? 1;
      return base ? (qty > 1 ? `${qty}x${base}` : base) : null;
    }
    case 'location':
      return album.location ?? null;
    case 'collection_status':
      return album.status ?? null;
    case 'genres':
      return master?.genres ?? null;
    case 'styles':
      return master?.styles ?? null;
    case 'labels':
      return release?.label ? [release.label] : null;
    case 'media_condition':
      return album.media_condition ?? null;
    case 'owner':
      return album.owner ?? null;
    case 'decade': {
      const year = release?.release_year ?? master?.original_release_year;
      return year ? Math.floor(year / 10) * 10 : null;
    }
    default:
      return null;
  }
}

/**
 * Get albums that belong to a manual crate (from junction table)
 * This will be implemented when we add the ability to add albums to crates
 */
export async function getManualCrateAlbumIds(): Promise<number[]> {
  // Placeholder - will be implemented in Phase 2
  return [];
}

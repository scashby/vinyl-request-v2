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
    case 'year_int': {
      const year = release?.release_year ?? master?.original_release_year;
      if (!year) return null;
      const parsed = typeof year === 'string' ? parseInt(year, 10) : year;
      return Number.isNaN(parsed) ? null : parsed;
    }
    case 'format': {
      if (!release) return null;
      const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
      const base = parts.join(', ');
      const qty = release.qty ?? 1;
      return base ? (qty > 1 ? `${qty}x${base}` : base) : null;
    }
    case 'country':
      return release?.country ?? album.country ?? null;
    case 'location':
      return album.location ?? null;
    case 'status':
      return album.status ?? null;
    case 'barcode':
      return release?.barcode ?? album.barcode ?? null;
    case 'catalog_number':
      return release?.catalog_number ?? album.catalog_number ?? null;
    case 'label':
      return release?.label ?? album.label ?? null;
    case 'genres':
      return master?.genres ?? null;
    case 'styles':
      return master?.styles ?? null;
    case 'tags': {
      const links = master?.master_tag_links ?? [];
      const tags = links
        .map((link) => link.master_tags?.name)
        .filter((name): name is string => Boolean(name));
      return tags.length > 0 ? tags : null;
    }
    case 'media_condition':
      return album.media_condition ?? null;
    case 'sleeve_condition':
      return album.sleeve_condition ?? null;
    case 'personal_notes':
      return album.personal_notes ?? null;
    case 'release_notes':
      return album.release_notes ?? null;
    case 'owner':
      return album.owner ?? null;
    case 'decade': {
      const year = release?.release_year ?? master?.original_release_year;
      return year ? Math.floor(year / 10) * 10 : null;
    }
    case 'play_count':
      return album.play_count ?? null;
    case 'last_played_at':
      return album.last_played_at ?? null;
    case 'date_added':
      return album.date_added ?? null;
    case 'purchase_date':
      return album.purchase_date ?? null;
    case 'purchase_price':
      return album.purchase_price ?? null;
    case 'current_value':
      return album.current_value ?? null;
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

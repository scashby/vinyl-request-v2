import type { CollectionTrackRow } from '../types/collectionTrackRow';
import type { CollectionPlaylist, SmartPlaylistRule } from '../types/collectionPlaylist';

export function trackMatchesSmartPlaylist(track: CollectionTrackRow, playlist: CollectionPlaylist): boolean {
  if (!playlist.isSmart || !playlist.smartRules || playlist.smartRules.rules.length === 0) return false;
  if (playlist.matchRules === 'all') {
    return playlist.smartRules.rules.every((rule) => trackMatchesRule(track, rule));
  }
  return playlist.smartRules.rules.some((rule) => trackMatchesRule(track, rule));
}

function trackMatchesRule(track: CollectionTrackRow, rule: SmartPlaylistRule): boolean {
  const trackValue = getTrackFieldValue(track, rule.field);
  if (trackValue === null || trackValue === undefined) return false;

  switch (rule.operator) {
    case 'contains':
      return String(trackValue).toLowerCase().includes(String(rule.value).toLowerCase());
    case 'is':
      return String(trackValue).toLowerCase() === String(rule.value).toLowerCase();
    case 'is_not':
      return String(trackValue).toLowerCase() !== String(rule.value).toLowerCase();
    case 'does_not_contain':
      return !String(trackValue).toLowerCase().includes(String(rule.value).toLowerCase());
    case 'greater_than':
      return Number(trackValue) > Number(rule.value);
    case 'less_than':
      return Number(trackValue) < Number(rule.value);
    case 'greater_than_or_equal_to':
      return Number(trackValue) >= Number(rule.value);
    case 'less_than_or_equal_to':
      return Number(trackValue) <= Number(rule.value);
    case 'before':
      return new Date(String(trackValue)) < new Date(String(rule.value));
    case 'after':
      return new Date(String(trackValue)) > new Date(String(rule.value));
    case 'includes':
      if (Array.isArray(trackValue)) {
        return trackValue.some((item) => String(item).toLowerCase() === String(rule.value).toLowerCase());
      }
      return false;
    case 'excludes':
      if (Array.isArray(trackValue)) {
        return !trackValue.some((item) => String(item).toLowerCase() === String(rule.value).toLowerCase());
      }
      return true;
    default:
      return false;
  }
}

function getTrackFieldValue(track: CollectionTrackRow, field: SmartPlaylistRule['field']): unknown {
  switch (field) {
    case 'track_title':
      return track.trackTitle;
    case 'track_artist':
      return track.trackArtist;
    case 'album_title':
      return track.albumTitle;
    case 'album_artist':
      return track.albumArtist;
    case 'position':
      return track.position;
    case 'side':
      return track.side ?? '';
    case 'album_format':
      return track.albumMediaType;
    case 'duration_seconds':
      return track.durationSeconds ?? 0;
    case 'format':
      return track.format ?? track.albumMediaType;
    case 'country':
      return track.country ?? '';
    case 'location':
      return track.location ?? '';
    case 'status':
      return track.status ?? '';
    case 'barcode':
      return track.barcode ?? '';
    case 'catalog_number':
      return track.catalogNumber ?? '';
    case 'label':
      return track.label ?? '';
    case 'owner':
      return track.owner ?? '';
    case 'personal_notes':
      return track.personalNotes ?? '';
    case 'release_notes':
      return track.releaseNotes ?? '';
    case 'master_notes':
      return track.masterNotes ?? '';
    case 'media_condition':
      return track.mediaCondition ?? '';
    case 'sleeve_condition':
      return track.sleeveCondition ?? '';
    case 'package_sleeve_condition':
      return track.packageSleeveCondition ?? '';
    case 'packaging':
      return track.packaging ?? '';
    case 'studio':
      return track.studio ?? '';
    case 'sound':
      return track.sound ?? '';
    case 'vinyl_weight':
      return track.vinylWeight ?? '';
    case 'rpm':
      return track.rpm ?? '';
    case 'spars_code':
      return track.sparsCode ?? '';
    case 'box_set':
      return track.boxSet ?? '';
    case 'purchase_store':
      return track.purchaseStore ?? '';
    case 'notes':
      return track.notes ?? '';
    case 'composer':
      return track.composer ?? '';
    case 'conductor':
      return track.conductor ?? '';
    case 'chorus':
      return track.chorus ?? '';
    case 'composition':
      return track.composition ?? '';
    case 'orchestra':
      return track.orchestra ?? '';
    case 'year_int':
      return track.yearInt ?? 0;
    case 'decade':
      return track.decade ?? 0;
    case 'my_rating':
      return track.myRating ?? 0;
    case 'play_count':
      return track.playCount ?? 0;
    case 'discs':
      return track.discs ?? 0;
    case 'sides':
      return track.sides ?? 0;
    case 'index_number':
      return track.indexNumber ?? 0;
    case 'purchase_price':
      return track.purchasePrice ?? 0;
    case 'current_value':
      return track.currentValue ?? 0;
    case 'date_added':
      return track.dateAdded ?? '';
    case 'purchase_date':
      return track.purchaseDate ?? '';
    case 'last_played_at':
      return track.lastPlayedAt ?? '';
    case 'last_cleaned_date':
      return track.lastCleanedDate ?? '';
    case 'original_release_date':
      return track.originalReleaseDate ?? '';
    case 'recording_date':
      return track.recordingDate ?? '';
    case 'for_sale':
      return track.forSale === true;
    case 'is_live':
      return track.isLive === true;
    case 'is_1001':
      return track.is1001 === true;
    case 'custom_tags':
      return track.customTags ?? [];
    case 'discogs_genres':
      return track.discogsGenres ?? [];
    case 'spotify_genres':
      return track.spotifyGenres ?? [];
    case 'labels':
      return track.labels ?? [];
    case 'signed_by':
      return track.signedBy ?? [];
    case 'songwriters':
      return track.songwriters ?? [];
    case 'producers':
      return track.producers ?? [];
    case 'engineers':
      return track.engineers ?? [];
    case 'musicians':
      return track.musicians ?? [];
    default:
      return null;
  }
}

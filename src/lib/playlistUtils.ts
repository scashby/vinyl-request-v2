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
    default:
      return null;
  }
}

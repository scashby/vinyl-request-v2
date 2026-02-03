import type { Database } from '../../types/supabase';
import type { Album } from '../../types/album';

type ReleaseRow = Database['public']['Tables']['releases']['Row'];

type MasterTagLinkRow = {
  master_tags?: { name: string | null } | null;
};

export const buildFormatLabel = (release?: ReleaseRow | null) => {
  if (!release) return '';
  const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
  const base = parts.join(', ');
  const qty = release.qty ?? 1;
  if (!base) return '';
  return qty > 1 ? `${qty}x${base}` : base;
};

export const extractTagNames = (links?: MasterTagLinkRow[] | null) => {
  if (!links) return [];
  return links
    .map((link) => link.master_tags?.name)
    .filter((name): name is string => Boolean(name));
};

export const getAlbumArtist = (album: Album) =>
  album.release?.master?.artist?.name ?? 'Unknown Artist';

export const getAlbumTitle = (album: Album) =>
  album.release?.master?.title ?? 'Untitled';

export const getAlbumYearValue = (album: Album) =>
  album.release?.release_year ?? album.release?.master?.original_release_year ?? null;

export const getAlbumYearInt = (album: Album) => {
  const yearValue = getAlbumYearValue(album);
  if (typeof yearValue === 'number') return yearValue;
  if (typeof yearValue === 'string') {
    const parsed = parseInt(yearValue, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

export const getAlbumDecade = (album: Album) => {
  const yearValue = getAlbumYearInt(album);
  return yearValue ? Math.floor(yearValue / 10) * 10 : null;
};

export const getAlbumFormat = (album: Album) =>
  buildFormatLabel(album.release ?? null);

export const getAlbumTags = (album: Album) =>
  extractTagNames(album.release?.master?.master_tag_links ?? null);

export const getAlbumGenres = (album: Album) =>
  album.release?.master?.genres ?? null;

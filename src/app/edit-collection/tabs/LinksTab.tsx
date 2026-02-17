'use client';

import type { Album } from 'types/album';

interface LinksTabProps {
  album: Album;
  onChange: (field: keyof Album, value: unknown) => void;
}

export function LinksTab({ album, onChange }: LinksTabProps) {
  const links = Array.isArray(album.custom_links) ? album.custom_links : [];
  const rows = links.length > 0 ? links : [{ url: '', description: '' }];

  const buildUrl = (value: string | null | undefined, prefix: string) => {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `${prefix}${trimmed}`;
  };

  const systemRows: Array<{
    key: keyof Album;
    label: string;
    value: string;
    placeholder?: string;
  }> = [
    {
      key: 'spotify_url',
      label: 'Spotify URL',
      value:
        album.spotify_url ??
        (album.spotify_id
          ? `https://open.spotify.com/album/${album.spotify_id}`
          : ''),
      placeholder: 'https://open.spotify.com/album/...',
    },
    {
      key: 'apple_music_url',
      label: 'Apple Music URL',
      value:
        album.apple_music_url ??
        (album.apple_music_id
          ? `https://music.apple.com/us/album/${album.apple_music_id}`
          : ''),
      placeholder: 'https://music.apple.com/album/...',
    },
    {
      key: 'lastfm_url',
      label: 'Last.fm URL',
      value: album.lastfm_url ?? '',
      placeholder: 'https://www.last.fm/...',
    },
    {
      key: 'wikipedia_url',
      label: 'Wikipedia URL',
      value: album.wikipedia_url ?? '',
      placeholder: 'https://en.wikipedia.org/...',
    },
    {
      key: 'genius_url',
      label: 'Genius URL',
      value: album.genius_url ?? '',
      placeholder: 'https://genius.com/...',
    },
    {
      key: 'musicbrainz_id',
      label: 'MusicBrainz ID',
      value: buildUrl(album.musicbrainz_id, 'https://musicbrainz.org/release-group/'),
      placeholder: 'https://musicbrainz.org/release-group/...',
    },
    {
      key: 'discogs_release_id',
      label: 'Discogs Release ID',
      value: buildUrl(album.discogs_release_id, 'https://www.discogs.com/release/'),
      placeholder: 'https://www.discogs.com/release/...',
    },
    {
      key: 'discogs_master_id',
      label: 'Discogs Master ID',
      value: buildUrl(album.discogs_master_id, 'https://www.discogs.com/master/'),
      placeholder: 'https://www.discogs.com/master/...',
    },
    {
      key: 'musicbrainz_url',
      label: 'MusicBrainz URL',
      value: album.musicbrainz_url ?? '',
      placeholder: 'https://musicbrainz.org/...',
    },
  ];

  const updateRow = (index: number, field: 'url' | 'description', value: string) => {
    const next = rows.map((row, idx) => (idx === index ? { ...row, [field]: value } : row));
    onChange('custom_links', next);
  };

  const handleAddRow = () => {
    const next = [...rows, { url: '', description: '' }];
    onChange('custom_links', next);
  };

  return (
    <div className="p-4">
      <div className="border border-gray-200 rounded-md overflow-hidden bg-white mb-4">
        <div className="px-3 py-2 text-[12px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
          Auto Links
        </div>
        <div className="grid grid-cols-[32px_1fr_1fr] bg-gray-100 border-b border-gray-200 text-[12px] font-semibold text-gray-500">
          <div className="px-2 py-2" />
          <div className="px-3 py-2">URL</div>
          <div className="px-3 py-2">Description</div>
        </div>
        <div className="divide-y divide-gray-200">
          {systemRows.map((row, idx) => (
            <div key={`sys-${row.key}-${idx}`} className="grid grid-cols-[32px_1fr_1fr] items-center">
              <div className="px-2 py-2 flex items-center justify-center">
                <input type="checkbox" disabled className="cursor-not-allowed opacity-40" />
              </div>
              <div className="px-2 py-2">
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => onChange(row.key, e.target.value)}
                  placeholder={row.placeholder ?? ''}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="px-2 py-2">
                <input
                  type="text"
                  value={row.label}
                  readOnly
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm text-gray-600 bg-gray-50"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
        <div className="px-3 py-2 text-[12px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
          Custom Links
        </div>
        <div className="grid grid-cols-[32px_1fr_1fr] bg-gray-100 border-b border-gray-200 text-[12px] font-semibold text-gray-500">
          <div className="px-2 py-2" />
          <div className="px-3 py-2">URL</div>
          <div className="px-3 py-2">Description</div>
        </div>

        <div className="divide-y divide-gray-200">
          {rows.map((row, idx) => (
            <div key={`${idx}`} className="grid grid-cols-[32px_1fr_1fr] items-center">
              <div className="px-2 py-2 flex items-center justify-center">
                <input type="checkbox" className="cursor-pointer" />
              </div>
              <div className="px-2 py-2">
                <input
                  type="text"
                  value={row.url || ''}
                  onChange={(e) => updateRow(idx, 'url', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="px-2 py-2">
                <input
                  type="text"
                  value={row.description || ''}
                  onChange={(e) => updateRow(idx, 'description', e.target.value)}
                  placeholder=""
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end mt-3">
        <button
          onClick={handleAddRow}
          className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded text-[12px] font-semibold text-gray-700 hover:bg-gray-200"
        >
          + New Link
        </button>
      </div>
    </div>
  );
}
// AUDIT: updated for CLZ-style links table and V3 storage.

'use client';

import type { Album } from 'types/album';

interface LinksTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | null) => void;
}

export function LinksTab({ album, onChange }: LinksTabProps) {
  return (
    <div className="p-5 space-y-5">
      <div>
        <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Discogs Release ID</label>
        <input
          type="text"
          value={album.discogs_release_id || ''}
          onChange={(e) => onChange('discogs_release_id', e.target.value || null)}
          className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 outline-none focus:border-blue-500"
          placeholder="e.g. 1234567"
        />
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Discogs Master ID</label>
        <input
          type="text"
          value={album.discogs_master_id || ''}
          onChange={(e) => onChange('discogs_master_id', e.target.value || null)}
          className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 outline-none focus:border-blue-500"
          placeholder="e.g. 12345"
        />
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Spotify Album ID</label>
        <input
          type="text"
          value={album.spotify_album_id || ''}
          onChange={(e) => onChange('spotify_album_id', e.target.value || null)}
          className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 outline-none focus:border-blue-500"
          placeholder="e.g. 6akEvsycLGftJxYudPjmqK"
        />
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">MusicBrainz Release Group ID</label>
        <input
          type="text"
          value={album.musicbrainz_release_group_id || ''}
          onChange={(e) => onChange('musicbrainz_release_group_id', e.target.value || null)}
          className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 outline-none focus:border-blue-500"
          placeholder="e.g. 5b2bb3f2-5a11-4dfb-8b9e-86e5b3a7d2b1"
        />
      </div>
    </div>
  );
}

'use client';

import type { Album } from 'types/album';

interface LinksTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | null) => void;
}

export function LinksTab({ album, onChange }: LinksTabProps) {
  
  const renderLinkInput = (label: string, field: keyof Album, icon?: React.ReactNode) => (
    <div className="mb-4">
      <label className="text-[13px] font-semibold text-gray-500 mb-1.5 flex items-center gap-2">
        {icon} {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={(album[field] as string) || ''}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={`https://...`}
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
        />
        <a
          href={(album[field] as string) || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`px-3 py-2 border border-gray-300 rounded bg-white flex items-center justify-center transition-colors ${
            album[field] ? 'text-blue-600 hover:bg-blue-50 cursor-pointer' : 'text-gray-300 cursor-not-allowed pointer-events-none'
          }`}
          title="Open Link"
        >
          ↗
        </a>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {/* Streaming Services */}
      <div className="flex flex-col">
        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Streaming</h3>
        
        {renderLinkInput('Spotify URL', 'spotify_url', (
           <span className="text-[#1DB954]">●</span>
        ))}
        {renderLinkInput('Apple Music URL', 'apple_music_url', (
           <span className="text-[#FA243C]">●</span>
        ))}
        {renderLinkInput('Last.fm URL', 'lastfm_url', (
           <span className="text-[#D51007]">●</span>
        ))}
      </div>

      {/* Database & Info */}
      <div className="flex flex-col">
        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Databases</h3>

        {renderLinkInput('Discogs Release ID', 'discogs_release_id')}
        {renderLinkInput('MusicBrainz ID', 'musicbrainz_id')}
        {renderLinkInput('AllMusic URL', 'allmusic_url')}
        {renderLinkInput('Wikipedia URL', 'wikipedia_url')}
      </div>
    </div>
  );
}
// src/app/edit-collection/enrichment/FindCoverModal.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { Album } from 'types/album';

interface FindCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: Album;
  coverType: 'front' | 'back';
  onSelectCover: (imageUrl: string) => void;
}

export function FindCoverModal({
  isOpen,
  onClose,
  album,
  coverType,
  onSelectCover,
}: FindCoverModalProps) {
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchSource, setSearchSource] = useState<'google' | 'discogs' | 'spotify'>('google');

  const handleSearch = async () => {
    setSearching(true);
    
    // TODO: Implement actual image search APIs
    // For now, show placeholder message
    setTimeout(() => {
      setSearchResults([]);
      setSearching(false);
      alert('Image search will be implemented with API integration.\n\nPlanned sources:\n- Google Images\n- Discogs\n- Spotify\n- MusicBrainz');
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[30005]">
      <div className="bg-[#2a2a2a] border border-[#555555] rounded-lg p-6 w-[800px] max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold text-[#e8e6e3]">
            Find {coverType === 'front' ? 'Front' : 'Back'} Cover Online
          </h2>
          <button
            type="button"
            className="text-[#999999] hover:text-[#e8e6e3] transition-colors"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Album Info */}
        <div className="mb-4 p-3 bg-[#1a1a1a] border border-[#555555] rounded">
          <div className="text-[14px] font-semibold text-[#e8e6e3] mb-1">
            {album.artist} - {album.title}
          </div>
          <div className="text-[12px] text-[#999999]">
            {album.year && `${album.year} • `}
            {album.format}
          </div>
        </div>

        {/* Search Source Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            className={`px-4 py-2 rounded text-[13px] transition-colors ${
              searchSource === 'google'
                ? 'bg-[#4a7ba7] text-white'
                : 'bg-[#3a3a3a] text-[#e8e6e3] hover:bg-[#444444]'
            }`}
            onClick={() => setSearchSource('google')}
          >
            Google Images
          </button>
          <button
            className={`px-4 py-2 rounded text-[13px] transition-colors ${
              searchSource === 'discogs'
                ? 'bg-[#4a7ba7] text-white'
                : 'bg-[#3a3a3a] text-[#e8e6e3] hover:bg-[#444444]'
            }`}
            onClick={() => setSearchSource('discogs')}
          >
            Discogs
          </button>
          <button
            className={`px-4 py-2 rounded text-[13px] transition-colors ${
              searchSource === 'spotify'
                ? 'bg-[#4a7ba7] text-white'
                : 'bg-[#3a3a3a] text-[#e8e6e3] hover:bg-[#444444]'
            }`}
            onClick={() => setSearchSource('spotify')}
          >
            Spotify
          </button>
        </div>

        {/* Search Button */}
        <button
          className="mb-4 px-4 py-2 bg-[#4a7ba7] hover:bg-[#5a8bc7] text-white text-[13px] rounded transition-colors disabled:opacity-50"
          onClick={handleSearch}
          disabled={searching}
        >
          {searching ? 'Searching...' : 'Search for Covers'}
        </button>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto border border-[#555555] rounded p-4 bg-[#1a1a1a]">
          {searchResults.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#666666] text-[13px] text-center">
              <div>
                <p className="mb-2">Click &quot;Search for Covers&quot; to find album artwork</p>
                <p className="text-[11px]">
                  Image search will retrieve covers from {searchSource === 'google' ? 'Google Images' : searchSource === 'discogs' ? 'Discogs' : 'Spotify'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {searchResults.map((imageUrl, index) => (
                <div
                  key={index}
                  className="cursor-pointer hover:opacity-80 transition-opacity border border-[#555555] rounded overflow-hidden"
                  onClick={() => onSelectCover(imageUrl)}
                >
                  <Image
                    src={imageUrl}
                    alt={`Cover option ${index + 1}`}
                    width={200}
                    height={200}
                    className="w-full h-auto"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-4 py-2 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] rounded transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
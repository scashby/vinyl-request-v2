'use client';

import { useState } from 'react';
import type { Album } from 'types/album';
import { FindCoverModal } from '../enrichment/FindCoverModal';
import { CropRotateModal } from '../enrichment/CropRotateModal';

interface CoverTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | null) => void;
}

export function CoverTab({ album, onChange }: CoverTabProps) {
  const [showFindCover, setShowFindCover] = useState(false);
  const [showCropRotate, setShowCropRotate] = useState(false);
  const [activeImageType, setActiveImageType] = useState<'front' | 'back'>('front');

  const handleOpenFindCover = (type: 'front' | 'back') => {
    setActiveImageType(type);
    setShowFindCover(true);
  };

  const handleOpenCropRotate = (type: 'front' | 'back') => {
    setActiveImageType(type);
    setShowCropRotate(true);
  };

  const handleSelectCover = (url: string) => {
    if (activeImageType === 'front') {
      onChange('image_url', url);
    } else {
      onChange('back_image_url', url);
    }
    setShowFindCover(false);
  };

  const handleCropRotateSave = (url: string) => {
    if (activeImageType === 'front') {
      onChange('image_url', url);
    } else {
      onChange('back_image_url', url);
    }
    setShowCropRotate(false);
  };

  const renderCoverSection = (title: string, imageUrl: string | null, type: 'front' | 'back') => (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-sm font-bold text-gray-700">{title}</h3>
      
      <div className="relative group w-full aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <>
            {/* Using img tag directly since Next.js Image requires domain whitelisting which might be dynamic here */}
            <img 
              src={imageUrl} 
              alt={`${title} Cover`}
              className="w-full h-full object-contain"
            />
            {/* Overlay Buttons */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <button
                onClick={() => handleOpenFindCover(type)}
                className="px-4 py-2 bg-white text-gray-900 rounded text-sm font-medium hover:bg-gray-100 cursor-pointer w-32"
              >
                Change
              </button>
              <button
                onClick={() => handleOpenCropRotate(type)}
                className="px-4 py-2 bg-white text-gray-900 rounded text-sm font-medium hover:bg-gray-100 cursor-pointer w-32"
              >
                Edit
              </button>
              <button
                onClick={() => onChange(type === 'front' ? 'image_url' : 'back_image_url', null)}
                className="px-4 py-2 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600 cursor-pointer w-32"
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <div className="text-center p-4">
            <div className="text-4xl text-gray-300 mb-2">📷</div>
            <div className="text-sm text-gray-400 mb-3">No image selected</div>
            <button
              onClick={() => handleOpenFindCover(type)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 cursor-pointer"
            >
              Find Cover
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={imageUrl || ''}
          onChange={(e) => onChange(type === 'front' ? 'image_url' : 'back_image_url', e.target.value)}
          placeholder="Or paste image URL..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          className="px-3 py-2 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-600"
          title="Browse Local Files (Not Implemented)"
        >
          📂
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {renderCoverSection('Front Cover', album.image_url, 'front')}
        {renderCoverSection('Back Cover', album.back_image_url, 'back')}
      </div>

      {showFindCover && (
        <FindCoverModal
          isOpen={true}
          onClose={() => setShowFindCover(false)}
          onSelect={handleSelectCover}
          artist={album.artist}
          album={album.title}
        />
      )}

      {showCropRotate && (
        <CropRotateModal
          isOpen={true}
          onClose={() => setShowCropRotate(false)}
          imageUrl={activeImageType === 'front' ? (album.image_url || '') : (album.back_image_url || '')}
          onSave={handleCropRotateSave}
        />
      )}
    </>
  );
}
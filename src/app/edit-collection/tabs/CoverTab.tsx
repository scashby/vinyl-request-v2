// src/app/edit-collection/tabs/CoverTab.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { Album } from 'types/album';
import { FindCoverModal } from '../enrichment/FindCoverModal';

interface CoverTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string) => void;
}

export default function CoverTab({ album, onChange }: CoverTabProps) {
  const [showFindCoverModal, setShowFindCoverModal] = useState(false);
  const [findCoverType, setFindCoverType] = useState<'front' | 'back'>('front');

  const handleFindOnline = (coverType: 'front' | 'back') => {
    setFindCoverType(coverType);
    setShowFindCoverModal(true);
  };

  const handleUpload = (coverType: 'front' | 'back') => {
    // TODO: Implement file upload
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // TODO: Upload to storage and update album
        console.log(`Upload ${coverType} cover:`, file.name);
      }
    };
    input.click();
  };

  const handleRemove = (coverType: 'front' | 'back') => {
    const field = coverType === 'front' ? 'image_url' : 'back_image_url';
    onChange(field as keyof Album, '');
  };

  const handleCropRotate = (coverType: 'front' | 'back') => {
    // TODO: Implement crop/rotate functionality
    console.log(`Crop/Rotate ${coverType} cover`);
    alert('Crop/Rotate functionality will be implemented in a future update');
  };

  const handleCoverSelect = (imageUrl: string) => {
    const field = findCoverType === 'front' ? 'image_url' : 'back_image_url';
    onChange(field as keyof Album, imageUrl);
    setShowFindCoverModal(false);
  };

  const renderCoverSection = (
    title: string,
    coverType: 'front' | 'back',
    imageUrl: string | null | undefined
  ) => {
    return (
      <div className="space-y-3">
        <h3 className="text-[13px] font-semibold text-[#e8e6e3]">{title}</h3>
        
        {/* Image Display Area */}
        <div className="w-[300px] h-[300px] bg-[#1a1a1a] border border-[#555555] rounded flex items-center justify-center relative overflow-hidden">
          {imageUrl ? (
            <Image 
              src={imageUrl} 
              alt={`${title} artwork`}
              fill
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="text-[#666666] text-[13px] text-center">
              No {coverType} cover
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[12px] border border-[#555555] rounded transition-colors"
            onClick={() => handleFindOnline(coverType)}
          >
            Find Online
          </button>
          <button
            type="button"
            className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[12px] border border-[#555555] rounded transition-colors"
            onClick={() => handleUpload(coverType)}
          >
            Upload
          </button>
          {imageUrl && (
            <>
              <button
                type="button"
                className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[12px] border border-[#555555] rounded transition-colors"
                onClick={() => handleRemove(coverType)}
              >
                Remove
              </button>
              <button
                type="button"
                className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[12px] border border-[#555555] rounded transition-colors"
                onClick={() => handleCropRotate(coverType)}
              >
                Crop/Rotate
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-8">
        {/* Front Cover */}
        {renderCoverSection('Front Cover', 'front', album.image_url)}
        
        {/* Back Cover */}
        {renderCoverSection('Back Cover', 'back', album.back_image_url)}
      </div>

      {/* Find Cover Modal */}
      {showFindCoverModal && (
        <FindCoverModal
          isOpen={showFindCoverModal}
          onClose={() => setShowFindCoverModal(false)}
          album={album}
          coverType={findCoverType}
          onSelectCover={handleCoverSelect}
        />
      )}
    </div>
  );
}
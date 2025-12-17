// src/app/edit-collection/components/CoverTab.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AlbumData } from '@/types/collection';

interface CoverTabProps {
  albumData: AlbumData;
  onFieldChange: (field: keyof AlbumData, value: string) => void;
}

export default function CoverTab({ albumData, onFieldChange }: CoverTabProps) {
  const [showFindCoverModal, setShowFindCoverModal] = useState(false);

  const handleFindOnline = (coverType: 'front' | 'back') => {
    console.log(`Find ${coverType} cover online`);
    setShowFindCoverModal(true);
    // TODO: Implement find cover modal
  };

  const handleUpload = (coverType: 'front' | 'back') => {
    console.log(`Upload ${coverType} cover`);
    // TODO: Implement file upload
  };

  const handleRemove = (coverType: 'front' | 'back') => {
    const field = coverType === 'front' ? 'cover_image_url' : 'back_cover_image_url';
    onFieldChange(field as keyof AlbumData, '');
  };

  const handleCropRotate = (coverType: 'front' | 'back') => {
    console.log(`Crop/Rotate ${coverType} cover`);
    // TODO: Implement crop/rotate functionality
  };

  const renderCoverSection = (
    title: string,
    coverType: 'front' | 'back',
    imageUrl: string | undefined
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
        {renderCoverSection('Front Cover', 'front', albumData.cover_image_url)}
        
        {/* Back Cover */}
        {renderCoverSection('Back Cover', 'back', albumData.back_cover_image_url)}
      </div>

      {/* Find Cover Modal - TODO: Implement full modal */}
      {showFindCoverModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#2a2a2a] border border-[#555555] rounded-lg p-6 w-[800px] max-h-[600px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-[#e8e6e3]">Find Cover Online</h2>
              <button
                type="button"
                className="text-[#999999] hover:text-[#e8e6e3] transition-colors"
                onClick={() => setShowFindCoverModal(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-[#999999] text-[13px]">
              Find Cover functionality coming soon...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
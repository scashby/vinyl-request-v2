// src/app/edit-collection/tabs/CoverTab.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { Album } from 'types/album';
import { supabase } from 'lib/supabaseClient';
import { CropRotateModal } from '../enrichment/CropRotateModal';

interface CoverTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

export function CoverTab({ album, onChange }: CoverTabProps) {
  const [uploading, setUploading] = useState<'front' | 'back' | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropCoverType, setCropCoverType] = useState<'front' | 'back'>('front');

  const handleUpload = async (coverType: 'front' | 'back') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setUploading(coverType);

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${album.id || Date.now()}-${coverType}-${Date.now()}.${fileExt}`;
        const filePath = `album-covers/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('album-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('album-images')
          .getPublicUrl(filePath);

        // Update album with new image URL
        const field = coverType === 'front' ? 'image_url' : 'back_image_url';
        onChange(field, publicUrl as Album[typeof field]);

        console.log(`✅ ${coverType} cover uploaded:`, publicUrl);
      } catch (error) {
        console.error(`Error uploading ${coverType} cover:`, error);
        alert(`Failed to upload ${coverType} cover. Please try again.`);
      } finally {
        setUploading(null);
      }
    };

    input.click();
  };

  const handleRemove = async (coverType: 'front' | 'back') => {
    const field = coverType === 'front' ? 'image_url' : 'back_image_url';
    const currentUrl = album[field];

    if (currentUrl && currentUrl.includes('album-images/')) {
      try {
        // Extract file path from URL
        const urlParts = currentUrl.split('/album-images/');
        if (urlParts.length > 1) {
          const filePath = `album-images/${urlParts[1].split('?')[0]}`;
          
          // Delete from storage
          const { error } = await supabase.storage
            .from('album-images')
            .remove([filePath]);

          if (error) console.error('Error deleting file:', error);
        }
      } catch (error) {
        console.error('Error removing file:', error);
      }
    }

    onChange(field, null as Album[typeof field]);
  };

  const handleFindOnline = () => {
    // Open search URL based on album info
    const searchQuery = encodeURIComponent(`${album.artist} ${album.title} ${album.year || ''} album cover`);
    const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${searchQuery}`;
    window.open(googleImagesUrl, '_blank');
  };

  const handleCropRotate = (coverType: 'front' | 'back') => {
    const imageUrl = coverType === 'front' ? album.image_url : album.back_image_url;
    if (imageUrl) {
      setCropImageUrl(imageUrl);
      setCropCoverType(coverType);
      setShowCropModal(true);
    }
  };

  const handleCropSave = (newImageUrl: string) => {
    const field = cropCoverType === 'front' ? 'image_url' : 'back_image_url';
    onChange(field, newImageUrl as Album[typeof field]);
  };

  const renderCoverSection = (
    title: string,
    coverType: 'front' | 'back',
    imageUrl: string | null | undefined
  ) => {
    const isUploading = uploading === coverType;

    return (
      <div className="space-y-3">
        <h3 className="text-[13px] font-semibold text-[#e8e6e3]">{title}</h3>
        
        {/* Image Display Area */}
        <div className="w-[300px] h-[300px] bg-[#1a1a1a] border border-[#555555] rounded flex items-center justify-center relative overflow-hidden">
          {isUploading ? (
            <div className="text-[#e8e6e3] text-[13px] text-center">
              <div className="mb-2">Uploading...</div>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e8e6e3] mx-auto"></div>
            </div>
          ) : imageUrl ? (
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
            className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[12px] border border-[#555555] rounded transition-colors disabled:opacity-50"
            onClick={handleFindOnline}
            disabled={isUploading}
          >
            Find Online
          </button>
          <button
            type="button"
            className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[12px] border border-[#555555] rounded transition-colors disabled:opacity-50"
            onClick={() => handleUpload(coverType)}
            disabled={isUploading}
          >
            Upload
          </button>
          {imageUrl && (
            <>
              <button
                type="button"
                className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[12px] border border-[#555555] rounded transition-colors disabled:opacity-50"
                onClick={() => handleRemove(coverType)}
                disabled={isUploading}
              >
                Remove
              </button>
              <button
                type="button"
                className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[12px] border border-[#555555] rounded transition-colors disabled:opacity-50"
                onClick={() => handleCropRotate(coverType)}
                disabled={isUploading}
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

      {/* Crop/Rotate Modal */}
      {showCropModal && cropImageUrl && (
        <CropRotateModal
          imageUrl={cropImageUrl}
          albumId={String(album.id || Date.now())}
          coverType={cropCoverType}
          onSave={handleCropSave}
          onClose={() => {
            setShowCropModal(false);
            setCropImageUrl(null);
          }}
        />
      )}
    </div>
  );
}
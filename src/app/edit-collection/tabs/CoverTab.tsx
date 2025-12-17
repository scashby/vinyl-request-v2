// src/app/edit-collection/tabs/CoverTab.tsx
'use client';

import React, { useState } from 'react';
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
      <div>
        <h3 style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#6b7280',
          marginBottom: '12px',
          marginTop: '0',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {title}
        </h3>
        
        {/* Image Display Area */}
        <div style={{
          width: '300px',
          height: '300px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {isUploading ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
              <div style={{ marginBottom: '8px' }}>Uploading...</div>
              <div style={{
                width: '32px',
                height: '32px',
                border: '2px solid #e5e7eb',
                borderTopColor: '#6b7280',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto',
              }}></div>
            </div>
          ) : imageUrl ? (
            <img 
              src={imageUrl} 
              alt={`${title} artwork`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>
              No {coverType} cover
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleFindOnline}
            disabled={isUploading}
            style={{
              padding: '6px 12px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              color: '#374151',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              opacity: isUploading ? 0.5 : 1,
            }}
          >
            Find Online
          </button>
          <button
            type="button"
            onClick={() => handleUpload(coverType)}
            disabled={isUploading}
            style={{
              padding: '6px 12px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              color: '#374151',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              opacity: isUploading ? 0.5 : 1,
            }}
          >
            Upload
          </button>
          {imageUrl && (
            <>
              <button
                type="button"
                onClick={() => handleRemove(coverType)}
                disabled={isUploading}
                style={{
                  padding: '6px 12px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  color: '#374151',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  opacity: isUploading ? 0.5 : 1,
                }}
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => handleCropRotate(coverType)}
                disabled={isUploading}
                style={{
                  padding: '6px 12px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  color: '#374151',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  opacity: isUploading ? 0.5 : 1,
                }}
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
    <div style={{ padding: '20px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '40px',
        maxWidth: '900px',
      }}>
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
// src/app/edit-collection/tabs/CoverTab.tsx
'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import type { Album } from 'types/album';
import { supabase } from 'lib/supabaseClient';
import { FindCoverModal } from '../enrichment/FindCoverModal';

interface CoverTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

interface CropState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function CoverTab({ album, onChange }: CoverTabProps) {
  const [uploading, setUploading] = useState<'front' | 'back' | null>(null);
  const [cropMode, setCropMode] = useState<'front' | 'back' | null>(null);
  const [rotation, setRotation] = useState(0);
  const [showFindCover, setShowFindCover] = useState(false);
  const [cropState, setCropState] = useState<CropState>({ x: 10, y: 10, width: 80, height: 80 });
  const imageRef = useRef<HTMLDivElement>(null);

  const handleUpload = async (coverType: 'front' | 'back') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setUploading(coverType);

        const fileExt = file.name.split('.').pop();
        const fileName = `${album.id || Date.now()}-${coverType}-${Date.now()}.${fileExt}`;
        const filePath = `album-covers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('album-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('album-images')
          .getPublicUrl(filePath);

        const field = coverType === 'front' ? 'image_url' : 'back_image_url';
        onChange(field, publicUrl as Album[typeof field]);
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
        const urlParts = currentUrl.split('/album-images/');
        if (urlParts.length > 1) {
          const filePath = `album-images/${urlParts[1].split('?')[0]}`;
          
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
    setShowFindCover(true);
  };

  const handleSelectImage = (imageUrl: string) => {
    // In real implementation, this would save the selected image
    console.log('Selected image:', imageUrl);
  };

  const handleCropRotate = (coverType: 'front' | 'back') => {
    setCropMode(coverType);
    setRotation(0);
    setCropState({ x: 10, y: 10, width: 80, height: 80 });
  };

  const handleCropReset = () => {
    setRotation(0);
    setCropState({ x: 10, y: 10, width: 80, height: 80 });
  };

  const handleCropRotateImage = () => {
    setRotation((rotation + 90) % 360);
  };

  const handleCropApply = () => {
    // In real implementation, apply crop and rotation
    console.log('Applying crop:', cropState, 'rotation:', rotation);
    setCropMode(null);
    setRotation(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    // In real implementation, handle crop resizing based on which handle was clicked
  };

  const renderCoverSection = (
    title: string,
    coverType: 'front' | 'back',
    imageUrl: string | null | undefined
  ) => {
    const isUploading = uploading === coverType;
    const isInCropMode = cropMode === coverType;

    return (
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        padding: '16px',
        backgroundColor: '#fafafa',
      }}>
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
        
        {/* Action Buttons - Black or Blue header bar */}
        {isInCropMode ? (
          <div style={{
            display: 'flex',
            marginBottom: '12px',
            backgroundColor: '#60a5fa',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={handleCropReset}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRight: '1px solid rgba(255,255,255,0.3)',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
              }}
            >
              × Reset
            </button>
            <button
              type="button"
              onClick={handleCropRotateImage}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRight: '1px solid rgba(255,255,255,0.3)',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
              }}
            >
              🔄 Rotate
            </button>
            <button
              type="button"
              onClick={handleCropApply}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
              }}
            >
              ✓ Apply
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            marginBottom: '12px',
            backgroundColor: '#1a1a1a',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={handleFindOnline}
              disabled={isUploading}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRight: '1px solid #333',
                fontSize: '13px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                opacity: isUploading ? 0.5 : 1,
              }}
            >
              🔍 Find Online
            </button>
            <button
              type="button"
              onClick={() => handleUpload(coverType)}
              disabled={isUploading}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRight: '1px solid #333',
                fontSize: '13px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                opacity: isUploading ? 0.5 : 1,
              }}
            >
              ⬆ Upload
            </button>
            <button
              type="button"
              onClick={() => handleRemove(coverType)}
              disabled={isUploading}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRight: '1px solid #333',
                fontSize: '13px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                opacity: isUploading ? 0.5 : 1,
              }}
            >
              🗑 Remove
            </button>
            <button
              type="button"
              onClick={() => handleCropRotate(coverType)}
              disabled={isUploading}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                fontSize: '13px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                opacity: isUploading ? 0.5 : 1,
              }}
            >
              ✂ Crop / Rotate
            </button>
          </div>
        )}

        {/* Image Display Area - FULL WIDTH */}
        <div 
          ref={imageRef}
          style={{
            width: '100%',
            aspectRatio: '1',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {isUploading ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
              <div style={{ marginBottom: '8px' }}>Uploading...</div>
            </div>
          ) : imageUrl ? (
            <>
              <div style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease',
              }}>
                <Image 
                  src={imageUrl} 
                  alt={`${title} artwork`}
                  fill
                  style={{
                    objectFit: 'contain',
                  }}
                  unoptimized
                />
              </div>
              
              {/* Crop handles - only show in crop mode */}
              {isInCropMode && (
                <div style={{
                  position: 'absolute',
                  left: `${cropState.x}%`,
                  top: `${cropState.y}%`,
                  width: `${cropState.width}%`,
                  height: `${cropState.height}%`,
                  border: '2px solid #3b82f6',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                }}>
                  {/* Corner handles */}
                  {['nw', 'ne', 'sw', 'se'].map(pos => (
                    <div
                      key={pos}
                      onMouseDown={handleMouseDown}
                      style={{
                        position: 'absolute',
                        width: '10px',
                        height: '10px',
                        backgroundColor: '#3b82f6',
                        border: '2px solid white',
                        borderRadius: '50%',
                        pointerEvents: 'all',
                        cursor: pos.includes('n') ? (pos.includes('w') ? 'nwse-resize' : 'nesw-resize') : (pos.includes('w') ? 'nesw-resize' : 'nwse-resize'),
                        ...(pos === 'nw' && { top: '-5px', left: '-5px' }),
                        ...(pos === 'ne' && { top: '-5px', right: '-5px' }),
                        ...(pos === 'sw' && { bottom: '-5px', left: '-5px' }),
                        ...(pos === 'se' && { bottom: '-5px', right: '-5px' }),
                      }}
                    />
                  ))}
                  
                  {/* Edge handles */}
                  {['n', 's', 'e', 'w'].map(pos => (
                    <div
                      key={pos}
                      onMouseDown={handleMouseDown}
                      style={{
                        position: 'absolute',
                        backgroundColor: '#3b82f6',
                        border: '2px solid white',
                        borderRadius: '3px',
                        pointerEvents: 'all',
                        ...(pos === 'n' && { top: '-5px', left: '50%', transform: 'translateX(-50%)', width: '30px', height: '10px', cursor: 'ns-resize' }),
                        ...(pos === 's' && { bottom: '-5px', left: '50%', transform: 'translateX(-50%)', width: '30px', height: '10px', cursor: 'ns-resize' }),
                        ...(pos === 'e' && { right: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '30px', cursor: 'ew-resize' }),
                        ...(pos === 'w' && { left: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '30px', cursor: 'ew-resize' }),
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>
              No {coverType} cover
            </div>
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

      {/* Find Cover Modal */}
      <FindCoverModal
        isOpen={showFindCover}
        onClose={() => setShowFindCover(false)}
        onSelectImage={handleSelectImage}
        defaultQuery={`${album.artist} ${album.title} ${album.year || ''} album cover`}
      />
    </div>
  );
}

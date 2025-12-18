// src/app/edit-collection/tabs/CoverTab.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { Album } from 'types/album';
import { supabase } from 'lib/supabaseClient';

interface CoverTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

export function CoverTab({ album, onChange }: CoverTabProps) {
  const [uploading, setUploading] = useState<'front' | 'back' | null>(null);
  const [cropMode, setCropMode] = useState<'front' | 'back' | null>(null);
  const [rotation, setRotation] = useState(0);
  const [showFindCover, setShowFindCover] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults] = useState<string[]>([
    'https://via.placeholder.com/300x300/ff6b6b/ffffff?text=Result+1',
    'https://via.placeholder.com/300x300/4ecdc4/ffffff?text=Result+2',
    'https://via.placeholder.com/300x300/45b7d1/ffffff?text=Result+3',
    'https://via.placeholder.com/300x300/96ceb4/ffffff?text=Result+4',
    'https://via.placeholder.com/300x300/ffeaa7/000000?text=Result+5',
    'https://via.placeholder.com/300x300/dfe6e9/000000?text=Result+6',
  ]);

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
    setSearchQuery(`${album.artist} ${album.title} ${album.year || ''} album cover`);
    setShowFindCover(true);
  };

  const handleCropRotate = (coverType: 'front' | 'back') => {
    setCropMode(coverType);
    setRotation(0);
  };

  const handleCropReset = () => {
    setRotation(0);
  };

  const handleCropRotateImage = () => {
    setRotation((rotation + 90) % 360);
  };

  const handleCropApply = () => {
    // In real implementation, this would apply the crop/rotation and upload the modified image
    setCropMode(null);
    setRotation(0);
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
        
        {/* Action Buttons - Connected horizontal bar */}
        {isInCropMode ? (
          <div style={{
            display: 'flex',
            marginBottom: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: 'white',
          }}>
            <button
              type="button"
              onClick={handleCropReset}
              style={{
                flex: 1,
                padding: '6px 12px',
                background: '#60a5fa',
                border: 'none',
                borderRight: '1px solid rgba(255,255,255,0.3)',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              × Reset
            </button>
            <button
              type="button"
              onClick={handleCropRotateImage}
              style={{
                flex: 1,
                padding: '6px 12px',
                background: '#60a5fa',
                border: 'none',
                borderRight: '1px solid rgba(255,255,255,0.3)',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              🔄 Rotate
            </button>
            <button
              type="button"
              onClick={handleCropApply}
              style={{
                flex: 1,
                padding: '6px 12px',
                background: '#22c55e',
                border: 'none',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              ✓ Apply
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            marginBottom: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: 'white',
          }}>
            <button
              type="button"
              onClick={handleFindOnline}
              disabled={isUploading}
              style={{
                flex: 1,
                padding: '6px 12px',
                background: '#f3f4f6',
                border: 'none',
                borderRight: '1px solid #d1d5db',
                fontSize: '13px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                color: '#374151',
                fontFamily: 'system-ui, -apple-system, sans-serif',
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
                padding: '6px 12px',
                background: '#f3f4f6',
                border: 'none',
                borderRight: '1px solid #d1d5db',
                fontSize: '13px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                color: '#374151',
                fontFamily: 'system-ui, -apple-system, sans-serif',
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
                padding: '6px 12px',
                background: '#f3f4f6',
                border: 'none',
                borderRight: '1px solid #d1d5db',
                fontSize: '13px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                color: '#374151',
                fontFamily: 'system-ui, -apple-system, sans-serif',
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
                padding: '6px 12px',
                background: '#f3f4f6',
                border: 'none',
                fontSize: '13px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                color: '#374151',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                opacity: isUploading ? 0.5 : 1,
              }}
            >
              ✂ Crop / Rotate
            </button>
          </div>
        )}

        {/* Image Display Area */}
        <div style={{
          width: '300px',
          height: '300px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {isUploading ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
              <div style={{ marginBottom: '8px' }}>Uploading...</div>
            </div>
          ) : imageUrl ? (
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
      {showFindCover && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 30000,
          paddingTop: '40px',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '1000px',
            width: '90%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              backgroundColor: '#f97316',
              color: 'white',
              padding: '16px 24px',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Find Cover</h2>
              <button
                onClick={() => setShowFindCover(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: '1',
                }}
              >
                ×
              </button>
            </div>

            {/* Search Bar */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for album cover..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#111827',
                  }}
                />
                <button
                  onClick={() => {
                    console.log('Searching for:', searchQuery);
                  }}
                  style={{
                    padding: '8px 24px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  Search
                </button>
              </div>
            </div>

            {/* Results Grid */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '24px',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '16px',
              }}>
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      // In real implementation, set the selected image
                      console.log('Selected image:', result);
                      setShowFindCover(false);
                    }}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      padding: '8px',
                      cursor: 'pointer',
                      backgroundColor: 'white',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      width: '100%',
                      paddingBottom: '100%',
                      position: 'relative',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}>
                      <Image
                        src={result}
                        alt={`Search result ${index + 1}`}
                        fill
                        style={{ objectFit: 'cover' }}
                        unoptimized
                      />
                    </div>
                    <div style={{
                      marginTop: '8px',
                      fontSize: '11px',
                      color: '#6b7280',
                      textAlign: 'center',
                    }}>
                      300 × 300
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// src/app/edit-collection/tabs/CoverTab.tsx
'use client';

import React, { useState, useRef, useCallback } from 'react';
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

type DragHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move';

export function CoverTab({ album, onChange }: CoverTabProps) {
  const [uploading, setUploading] = useState<'front' | 'back' | null>(null);
  const [cropMode, setCropMode] = useState<'front' | 'back' | null>(null);
  const [frontRotation, setFrontRotation] = useState(0);
  const [backRotation, setBackRotation] = useState(0);
  const [showFindCover, setShowFindCover] = useState(false);
  const [findCoverType, setFindCoverType] = useState<'front' | 'back'>('front');
  const [cropState, setCropState] = useState<CropState>({ x: 0, y: 0, width: 100, height: 100 });
  const [imageBounds, setImageBounds] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<DragHandle | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<CropState>({ x: 0, y: 0, width: 0, height: 0 });
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

  const handleFindOnline = (coverType: 'front' | 'back') => {
    setFindCoverType(coverType);
    setShowFindCover(true);
  };

  const handleSelectImage = (imageUrl: string) => {
    const field = findCoverType === 'front' ? 'image_url' : 'back_image_url';
    onChange(field, imageUrl as Album[typeof field]);
  };

  const handleCropRotate = (coverType: 'front' | 'back') => {
    setCropMode(coverType);
    
    // Reset rotation for this cover
    if (coverType === 'front') {
      setFrontRotation(0);
    } else {
      setBackRotation(0);
    }
    
    // Calculate actual image bounds within container
    if (imageRef.current) {
      const container = imageRef.current;
      const img = container.querySelector('img');
      
      if (img) {
        const containerRect = container.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        
        // Calculate image position and size as percentage of container
        const x = ((imgRect.left - containerRect.left) / containerRect.width) * 100;
        const y = ((imgRect.top - containerRect.top) / containerRect.height) * 100;
        const width = (imgRect.width / containerRect.width) * 100;
        const height = (imgRect.height / containerRect.height) * 100;
        
        setImageBounds({ x, y, width, height });
        setCropState({ x, y, width, height });
      } else {
        // Fallback if no image
        setImageBounds({ x: 0, y: 0, width: 100, height: 100 });
        setCropState({ x: 0, y: 0, width: 100, height: 100 });
      }
    }
  };

  const handleCropReset = () => {
    // Reset rotation for active cover
    if (cropMode === 'front') {
      setFrontRotation(0);
    } else if (cropMode === 'back') {
      setBackRotation(0);
    }
    
    // Exit crop mode
    setCropMode(null);
  };

  const handleCropRotateImage = () => {
    if (cropMode === 'front') {
      setFrontRotation((frontRotation + 90) % 360);
    } else if (cropMode === 'back') {
      setBackRotation((backRotation + 90) % 360);
    }
  };

  const handleCropApply = () => {
    const rotation = cropMode === 'front' ? frontRotation : backRotation;
    console.log('Applying crop:', cropState, 'rotation:', rotation);
    setCropMode(null);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: DragHandle) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setIsDragging(true);
    setDragHandle(handle);
    setDragStart({ x, y });
    setCropStart({ ...cropState });
  }, [cropState]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragHandle || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const dx = x - dragStart.x;
    const dy = y - dragStart.y;
    
    const newCrop = { ...cropStart };
    
    switch (dragHandle) {
      case 'nw':
        newCrop.x = Math.max(imageBounds.x, Math.min(cropStart.x + dx, cropStart.x + cropStart.width - 10));
        newCrop.y = Math.max(imageBounds.y, Math.min(cropStart.y + dy, cropStart.y + cropStart.height - 10));
        newCrop.width = cropStart.width - (newCrop.x - cropStart.x);
        newCrop.height = cropStart.height - (newCrop.y - cropStart.y);
        break;
      case 'ne':
        newCrop.y = Math.max(imageBounds.y, Math.min(cropStart.y + dy, cropStart.y + cropStart.height - 10));
        newCrop.width = Math.max(10, Math.min(cropStart.width + dx, imageBounds.x + imageBounds.width - cropStart.x));
        newCrop.height = cropStart.height - (newCrop.y - cropStart.y);
        break;
      case 'sw':
        newCrop.x = Math.max(imageBounds.x, Math.min(cropStart.x + dx, cropStart.x + cropStart.width - 10));
        newCrop.width = cropStart.width - (newCrop.x - cropStart.x);
        newCrop.height = Math.max(10, Math.min(cropStart.height + dy, imageBounds.y + imageBounds.height - cropStart.y));
        break;
      case 'se':
        newCrop.width = Math.max(10, Math.min(cropStart.width + dx, imageBounds.x + imageBounds.width - cropStart.x));
        newCrop.height = Math.max(10, Math.min(cropStart.height + dy, imageBounds.y + imageBounds.height - cropStart.y));
        break;
      case 'n':
        newCrop.y = Math.max(imageBounds.y, Math.min(cropStart.y + dy, cropStart.y + cropStart.height - 10));
        newCrop.height = cropStart.height - (newCrop.y - cropStart.y);
        break;
      case 's':
        newCrop.height = Math.max(10, Math.min(cropStart.height + dy, imageBounds.y + imageBounds.height - cropStart.y));
        break;
      case 'e':
        newCrop.width = Math.max(10, Math.min(cropStart.width + dx, imageBounds.x + imageBounds.width - cropStart.x));
        break;
      case 'w':
        newCrop.x = Math.max(imageBounds.x, Math.min(cropStart.x + dx, cropStart.x + cropStart.width - 10));
        newCrop.width = cropStart.width - (newCrop.x - cropStart.x);
        break;
      case 'move':
        newCrop.x = Math.max(imageBounds.x, Math.min(cropStart.x + dx, imageBounds.x + imageBounds.width - cropStart.width));
        newCrop.y = Math.max(imageBounds.y, Math.min(cropStart.y + dy, imageBounds.y + imageBounds.height - cropStart.height));
        break;
    }
    
    setCropState(newCrop);
  }, [isDragging, dragHandle, dragStart, cropStart, imageBounds]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragHandle(null);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const renderCoverSection = (
    title: string,
    coverType: 'front' | 'back'
  ) => {
    const isUploading = uploading === coverType;
    const isInCropMode = cropMode === coverType;
    const imageUrl = coverType === 'front' ? album.image_url : album.back_image_url;

    return (
      <div style={{ 
        flex: 1, 
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '10px',
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}>
          <h3 style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '6px',
            marginTop: '0',
          }}>
            {title}
          </h3>
          
          {isInCropMode ? (
            <div style={{
              display: 'flex',
              marginBottom: '6px',
              backgroundColor: '#60a5fa',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <button type="button" onClick={handleCropReset} style={{
                  flex: 1, padding: '3px 4px', background: 'transparent', border: 'none',
                  borderRight: '1px solid rgba(255,255,255,0.3)', fontSize: '10px', cursor: 'pointer',
                  color: 'white', fontWeight: '500', whiteSpace: 'nowrap',
                }}>× Reset</button>
              <button type="button" onClick={handleCropRotateImage} style={{
                  flex: 1, padding: '3px 4px', background: 'transparent', border: 'none',
                  borderRight: '1px solid rgba(255,255,255,0.3)', fontSize: '10px', cursor: 'pointer',
                  color: 'white', fontWeight: '500', whiteSpace: 'nowrap',
                }}>🔄 Rotate</button>
              <button type="button" onClick={handleCropApply} style={{
                  flex: 1, padding: '3px 4px', background: 'transparent', border: 'none',
                  fontSize: '10px', cursor: 'pointer', color: 'white', fontWeight: '500', whiteSpace: 'nowrap',
                }}>✓ Apply</button>
            </div>
          ) : (
            <div style={{
              display: 'flex', marginBottom: '6px', backgroundColor: '#1a1a1a',
              borderRadius: '4px', overflow: 'hidden',
            }}>
              <button type="button" onClick={() => handleFindOnline(coverType)} disabled={isUploading} style={{
                  flex: '1 1 0', padding: '3px 4px', background: 'transparent', border: 'none',
                  borderRight: '1px solid #333', fontSize: '10px',
                  cursor: isUploading ? 'not-allowed' : 'pointer', color: 'white',
                  fontWeight: '500', opacity: isUploading ? 0.5 : 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>🔍 Find Online</button>
              <button type="button" onClick={() => handleUpload(coverType)} disabled={isUploading} style={{
                  flex: '1 1 0', padding: '3px 4px', background: 'transparent', border: 'none',
                  borderRight: '1px solid #333', fontSize: '10px',
                  cursor: isUploading ? 'not-allowed' : 'pointer', color: 'white',
                  fontWeight: '500', opacity: isUploading ? 0.5 : 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>⬆ Upload</button>
              <button type="button" onClick={() => handleRemove(coverType)} disabled={isUploading} style={{
                  flex: '1 1 0', padding: '3px 4px', background: 'transparent', border: 'none',
                  borderRight: '1px solid #333', fontSize: '10px',
                  cursor: isUploading ? 'not-allowed' : 'pointer', color: 'white',
                  fontWeight: '500', opacity: isUploading ? 0.5 : 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>🗑 Remove</button>
              <button type="button" onClick={() => handleCropRotate(coverType)} disabled={isUploading} style={{
                  flex: '1 1 0', padding: '3px 4px', background: 'transparent', border: 'none',
                  fontSize: '10px', cursor: isUploading ? 'not-allowed' : 'pointer', color: 'white',
                  fontWeight: '500', opacity: isUploading ? 0.5 : 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>✂ Crop / Rotate</button>
            </div>
          )}

          <div ref={imageRef} style={{
              flex: 1,
              minHeight: 0,
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
              <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center' }}>Uploading...</div>
            ) : imageUrl ? (
              <>
                <div style={{
                  width: '100%', height: '100%', position: 'relative',
                  transform: `rotate(${coverType === 'front' ? frontRotation : backRotation}deg)`, 
                  transition: 'transform 0.3s ease',
                }}>
                  <Image src={imageUrl} alt={`${title} artwork`} fill
                    style={{ objectFit: 'contain' }} unoptimized />
                </div>
                
                {isInCropMode && (
                  <>
                    <div style={{
                      position: 'absolute', 
                      inset: 0, 
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      pointerEvents: 'none',
                      clipPath: `polygon(
                        0% 0%, 
                        0% 100%, 
                        ${cropState.x}% 100%, 
                        ${cropState.x}% ${cropState.y}%, 
                        ${cropState.x + cropState.width}% ${cropState.y}%, 
                        ${cropState.x + cropState.width}% ${cropState.y + cropState.height}%, 
                        ${cropState.x}% ${cropState.y + cropState.height}%, 
                        ${cropState.x}% 100%, 
                        100% 100%, 
                        100% 0%
                      )`
                    }} />
                    
                    <div onMouseDown={(e) => handleMouseDown(e, 'move')} style={{
                        position: 'absolute',
                        left: `${cropState.x}%`, top: `${cropState.y}%`,
                        width: `${cropState.width}%`, height: `${cropState.height}%`,
                        border: '2px solid #3b82f6', backgroundColor: 'transparent',
                        cursor: 'move',
                      }}>
                      {/* Corner handles - exactly on corners */}
                      {[
                        { pos: 'nw' as DragHandle, style: { top: '-7px', left: '-7px' }, cursor: 'nwse-resize' },
                        { pos: 'ne' as DragHandle, style: { top: '-7px', right: '-7px' }, cursor: 'nesw-resize' },
                        { pos: 'sw' as DragHandle, style: { bottom: '-7px', left: '-7px' }, cursor: 'nesw-resize' },
                        { pos: 'se' as DragHandle, style: { bottom: '-7px', right: '-7px' }, cursor: 'nwse-resize' },
                      ].map(({ pos, style, cursor }) => (
                        <div key={pos} onMouseDown={(e) => handleMouseDown(e, pos)} style={{
                            position: 'absolute', width: '12px', height: '12px',
                            backgroundColor: '#3b82f6', border: '2px solid white',
                            borderRadius: '50%', cursor, ...style,
                          }} />
                      ))}
                      
                      {/* Edge handles - exactly on edges */}
                      {[
                        { pos: 'n' as DragHandle, style: { top: '-7px', left: '50%', transform: 'translateX(-50%)', width: '40px', height: '12px' }, cursor: 'ns-resize' },
                        { pos: 's' as DragHandle, style: { bottom: '-7px', left: '50%', transform: 'translateX(-50%)', width: '40px', height: '12px' }, cursor: 'ns-resize' },
                        { pos: 'e' as DragHandle, style: { right: '-7px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '40px' }, cursor: 'ew-resize' },
                        { pos: 'w' as DragHandle, style: { left: '-7px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '40px' }, cursor: 'ew-resize' },
                      ].map(({ pos, style, cursor }) => (
                        <div key={pos} onMouseDown={(e) => handleMouseDown(e, pos)} style={{
                            position: 'absolute', backgroundColor: '#3b82f6',
                            border: '2px solid white', borderRadius: '2px', cursor, ...style,
                          }} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>
                No {coverType} cover
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '12px',
    }}>
      <div style={{
        display: 'flex', 
        gap: '16px', 
        flex: 1,
        minHeight: 0,
      }}>
        {renderCoverSection('Front Cover', 'front')}
        {renderCoverSection('Back Cover', 'back')}
      </div>

      <FindCoverModal
        isOpen={showFindCover}
        onClose={() => setShowFindCover(false)}
        onSelectImage={handleSelectImage}
        defaultQuery={`${album.artist} ${album.title} ${album.year || ''} album cover`}
        artist={album.artist}
        title={album.title}
        barcode={album.barcode || undefined}
        year={album.year || undefined}
        discogsId={album.discogs_release_id || album.discogs_id || undefined}
        coverType={findCoverType}
      />
    </div>
  );
}

export default CoverTab;
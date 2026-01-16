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
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <div className="flex flex-col h-full border border-gray-200 rounded-md p-2.5 bg-gray-50">
          <h3 className="text-xs font-semibold text-gray-500 mb-1.5 mt-0">
            {title}
          </h3>
          
          {isInCropMode ? (
            <div className="flex mb-1.5 bg-blue-400 rounded overflow-hidden">
              <button type="button" onClick={handleCropReset} className="flex-1 px-1 py-0.5 bg-transparent border-none border-r border-white/30 text-[10px] cursor-pointer text-white font-medium whitespace-nowrap hover:bg-blue-500">
                × Reset
              </button>
              <button type="button" onClick={handleCropRotateImage} className="flex-1 px-1 py-0.5 bg-transparent border-none border-r border-white/30 text-[10px] cursor-pointer text-white font-medium whitespace-nowrap hover:bg-blue-500">
                🔄 Rotate
              </button>
              <button type="button" onClick={handleCropApply} className="flex-1 px-1 py-0.5 bg-transparent border-none text-[10px] cursor-pointer text-white font-medium whitespace-nowrap hover:bg-blue-500">
                ✓ Apply
              </button>
            </div>
          ) : (
            <div className="flex mb-1.5 bg-[#1a1a1a] rounded overflow-hidden">
              <button type="button" onClick={() => handleFindOnline(coverType)} disabled={isUploading} className={`flex-1 px-1 py-0.5 bg-transparent border-none border-r border-[#333] text-[10px] font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-black'}`}>
                🔍 Find Online
              </button>
              <button type="button" onClick={() => handleUpload(coverType)} disabled={isUploading} className={`flex-1 px-1 py-0.5 bg-transparent border-none border-r border-[#333] text-[10px] font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-black'}`}>
                ⬆ Upload
              </button>
              <button type="button" onClick={() => handleRemove(coverType)} disabled={isUploading} className={`flex-1 px-1 py-0.5 bg-transparent border-none border-r border-[#333] text-[10px] font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-black'}`}>
                🗑 Remove
              </button>
              <button type="button" onClick={() => handleCropRotate(coverType)} disabled={isUploading} className={`flex-1 px-1 py-0.5 bg-transparent border-none text-[10px] font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-black'}`}>
                ✂ Crop / Rotate
              </button>
            </div>
          )}

          <div ref={imageRef} className="flex-1 min-h-0 border border-gray-300 rounded flex items-center justify-center bg-white overflow-hidden relative">
            {isUploading ? (
              <div className="text-gray-500 text-xs text-center">Uploading...</div>
            ) : imageUrl ? (
              <>
                <div 
                  className="w-full h-full relative transition-transform duration-300 ease-out"
                  style={{ transform: `rotate(${coverType === 'front' ? frontRotation : backRotation}deg)` }}
                >
                  <Image src={imageUrl} alt={`${title} artwork`} fill
                    style={{ objectFit: 'contain' }} unoptimized />
                </div>
                
                {isInCropMode && (
                  <>
                    <div 
                      className="absolute inset-0 bg-black/50 pointer-events-none"
                      style={{
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
                      }} 
                    />
                    
                    <div 
                      onMouseDown={(e) => handleMouseDown(e, 'move')} 
                      className="absolute border-2 border-blue-500 bg-transparent cursor-move"
                      style={{
                        left: `${cropState.x}%`, top: `${cropState.y}%`,
                        width: `${cropState.width}%`, height: `${cropState.height}%`,
                      }}
                    >
                      {/* Corner handles - exactly on corners */}
                      {[
                        { pos: 'nw' as DragHandle, style: { top: '-7px', left: '-7px' }, cursor: 'nwse-resize' },
                        { pos: 'ne' as DragHandle, style: { top: '-7px', right: '-7px' }, cursor: 'nesw-resize' },
                        { pos: 'sw' as DragHandle, style: { bottom: '-7px', left: '-7px' }, cursor: 'nesw-resize' },
                        { pos: 'se' as DragHandle, style: { bottom: '-7px', right: '-7px' }, cursor: 'nwse-resize' },
                      ].map(({ pos, style, cursor }) => (
                        <div key={pos} onMouseDown={(e) => handleMouseDown(e, pos)} 
                          className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full"
                          style={{ cursor, ...style }} 
                        />
                      ))}
                      
                      {/* Edge handles - exactly on edges */}
                      {[
                        { pos: 'n' as DragHandle, style: { top: '-7px', left: '50%', transform: 'translateX(-50%)', width: '40px', height: '12px' }, cursor: 'ns-resize' },
                        { pos: 's' as DragHandle, style: { bottom: '-7px', left: '50%', transform: 'translateX(-50%)', width: '40px', height: '12px' }, cursor: 'ns-resize' },
                        { pos: 'e' as DragHandle, style: { right: '-7px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '40px' }, cursor: 'ew-resize' },
                        { pos: 'w' as DragHandle, style: { left: '-7px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '40px' }, cursor: 'ew-resize' },
                      ].map(({ pos, style, cursor }) => (
                        <div key={pos} onMouseDown={(e) => handleMouseDown(e, pos)} 
                          className="absolute bg-blue-500 border-2 border-white rounded-sm"
                          style={{ cursor, ...style }} 
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-gray-400 text-xs text-center">
                No {coverType} cover
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-3">
      <div className="flex gap-4 flex-1 min-h-0">
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
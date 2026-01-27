// src/app/edit-collection/tabs/CoverTab.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { Album } from 'types/album';
import { supabase } from 'lib/supabaseClient';
import { FindCoverModal } from '../enrichment/FindCoverModal';

interface CoverTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

// Extend Album locally to include Inner Sleeve Images until global types are updated
interface ExtendedAlbum extends Album {
  inner_sleeve_images?: string[] | null;
}

export function CoverTab({ album: baseAlbum, onChange }: CoverTabProps) {
  const album = baseAlbum as ExtendedAlbum;
  const [uploading, setUploading] = useState<'front' | 'back' | 'inner' | null>(null);
  const [showFindCover, setShowFindCover] = useState(false);
  const [findCoverType, setFindCoverType] = useState<'front' | 'back'>('front');

  const handleUpload = async (coverType: 'front' | 'back' | 'inner') => {
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

        if (coverType === 'inner') {
          const currentImages = album.inner_sleeve_images || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange('inner_sleeve_images' as any, [...currentImages, publicUrl]);
        } else {
          const field = coverType === 'front' ? 'image_url' : 'back_image_url';
          onChange(field, publicUrl as Album[typeof field]);
        }
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

  const handleRemoveInner = async (index: number) => {
    const currentImages = album.inner_sleeve_images || [];
    const imageUrl = currentImages[index];

    if (imageUrl && imageUrl.includes('album-images/')) {
      try {
        const urlParts = imageUrl.split('/album-images/');
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

    const newImages = [...currentImages];
    newImages.splice(index, 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange('inner_sleeve_images' as any, newImages);
  };

  const handleFindOnline = (coverType: 'front' | 'back') => {
    setFindCoverType(coverType);
    setShowFindCover(true);
  };

  const handleSelectImage = (imageUrl: string) => {
    const field = findCoverType === 'front' ? 'image_url' : 'back_image_url';
    onChange(field, imageUrl as Album[typeof field]);
  };

  // Legacy cropping logic removed

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 gap-4">
      {/* FRONT & BACK ROW */}
      <div className="flex gap-4 h-[350px]">
        {/* FRONT COVER */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded-md p-3 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-gray-700 m-0">Front Cover</h3>
            <div className="flex gap-1">
              {album.image_url ? (
                <>
                  <button 
                    onClick={() => handleFindOnline('front')}
                    className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Replace
                  </button>
                  <button 
                    onClick={() => handleRemove('front')}
                    className="px-2 py-1 text-[10px] bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => handleFindOnline('front')}
                    className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Search
                  </button>
                  <button 
                    onClick={() => handleUpload('front')}
                    className="px-2 py-1 text-[10px] bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Upload
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 relative bg-white border border-gray-300 rounded overflow-hidden flex items-center justify-center">
            {album.image_url ? (
              <Image src={album.image_url} alt="Front Cover" fill style={{ objectFit: 'contain' }} unoptimized />
            ) : (
              <span className="text-gray-400 text-xs">No Front Cover</span>
            )}
          </div>
        </div>

        {/* BACK COVER */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded-md p-3 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-gray-700 m-0">Back Cover</h3>
            <div className="flex gap-1">
              <button 
                onClick={() => handleFindOnline('back')}
                className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {album.back_image_url ? 'Replace' : 'Search'}
              </button>
              <button 
                onClick={() => handleUpload('back')}
                className="px-2 py-1 text-[10px] bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                {album.back_image_url ? 'Upload New' : 'Upload'}
              </button>
              {album.back_image_url && (
                <button 
                  onClick={() => handleRemove('back')}
                  className="px-2 py-1 text-[10px] bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 relative bg-white border border-gray-300 rounded overflow-hidden flex items-center justify-center">
            {album.back_image_url ? (
              <Image src={album.back_image_url} alt="Back Cover" fill style={{ objectFit: 'contain' }} unoptimized />
            ) : (
              <span className="text-gray-400 text-xs">No Back Cover</span>
            )}
          </div>
        </div>
      </div>

      {/* INNER SLEEVES GALLERY */}
      <div className="flex flex-col border border-gray-200 rounded-md p-3 bg-gray-50">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-gray-700 m-0">Inner Sleeves</h3>
          <button 
            onClick={() => handleUpload('inner')}
            disabled={uploading === 'inner'}
            className="px-3 py-1.5 text-xs bg-gray-800 text-white rounded hover:bg-black disabled:opacity-50"
          >
            {uploading === 'inner' ? 'Uploading...' : '+ Add Image'}
          </button>
        </div>

        {(!album.inner_sleeve_images || album.inner_sleeve_images.length === 0) ? (
          <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded bg-gray-50/50">
            <span className="text-gray-400 text-sm">No inner sleeves added</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {album.inner_sleeve_images.map((imgUrl, idx) => (
              <div key={idx} className="group relative aspect-square bg-white border border-gray-200 rounded overflow-hidden">
                <Image src={imgUrl} alt={`Inner ${idx + 1}`} fill style={{ objectFit: 'cover' }} unoptimized />
                <button
                  onClick={() => handleRemoveInner(idx)}
                  className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  title="Remove Image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
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
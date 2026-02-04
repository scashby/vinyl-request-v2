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

export function CoverTab({ album, onChange }: CoverTabProps) {
  const [uploading, setUploading] = useState(false);
  const [showFindCover, setShowFindCover] = useState(false);

  const handleUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setUploading(true);

        const fileExt = file.name.split('.').pop();
        const fileName = `${album.id || Date.now()}-front-${Date.now()}.${fileExt}`;
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

        onChange('image_url', publicUrl as Album['image_url']);
      } catch (error) {
        console.error('Error uploading cover:', error);
        alert('Failed to upload cover. Please try again.');
      } finally {
        setUploading(false);
      }
    };

    input.click();
  };

  const handleRemove = async () => {
    const currentUrl = album.image_url;

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

    onChange('image_url', null as Album['image_url']);
  };

  const handleSelectImage = (imageUrl: string) => {
    onChange('image_url', imageUrl as Album['image_url']);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 gap-4">
      <div className="flex gap-4 h-[350px]">
        <div className="flex-1 flex flex-col border border-gray-200 rounded-md p-3 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-gray-700 m-0">Front Cover</h3>
            <div className="flex gap-1">
              {album.image_url ? (
                <>
                  <button
                    onClick={() => setShowFindCover(true)}
                    className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Replace
                  </button>
                  <button
                    onClick={handleRemove}
                    className="px-2 py-1 text-[10px] bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowFindCover(true)}
                    className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Search
                  </button>
                  <button
                    onClick={handleUpload}
                    className="px-2 py-1 text-[10px] bg-gray-600 text-white rounded hover:bg-gray-700"
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
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
      </div>

      <FindCoverModal
        isOpen={showFindCover}
        onClose={() => setShowFindCover(false)}
        onSelectImage={handleSelectImage}
        defaultQuery={`${album.artist ?? ''} ${album.title ?? ''}`.trim()}
        artist={album.artist ?? undefined}
        title={album.title ?? undefined}
      />
    </div>
  );
}

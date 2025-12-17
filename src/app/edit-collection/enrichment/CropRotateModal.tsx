// src/app/edit-collection/enrichment/CropRotateModal.tsx
'use client';

import React, { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { supabase } from 'lib/supabaseClient';

interface CropRotateModalProps {
  imageUrl: string;
  albumId: string;
  coverType: 'front' | 'back';
  onSave: (newImageUrl: string) => void;
  onClose: () => void;
}

export function CropRotateModal({
  imageUrl,
  albumId,
  coverType,
  onSave,
  onClose,
}: CropRotateModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation: number
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(
      data,
      Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
      Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg');
    });
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      setSaving(true);

      // Create cropped image blob
      const croppedBlob = await getCroppedImg(imageUrl, croppedAreaPixels, rotation);

      // Generate unique filename
      const fileName = `${albumId}-${coverType}-${Date.now()}.jpg`;
      const filePath = `album-covers/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('album-images')
        .upload(filePath, croppedBlob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('album-images').getPublicUrl(filePath);

      // Delete old image if it exists and is in our storage
      if (imageUrl.includes('album-images/')) {
        const urlParts = imageUrl.split('/album-images/');
        if (urlParts.length > 1) {
          const oldFilePath = `album-images/${urlParts[1].split('?')[0]}`;
          await supabase.storage.from('album-images').remove([oldFilePath]);
        }
      }

      onSave(publicUrl);
      onClose();
    } catch (error) {
      console.error('Error saving cropped image:', error);
      alert('Failed to save cropped image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[30006]">
      <div className="bg-[#2a2a2a] border border-[#555555] rounded-lg w-[800px] h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#555555]">
          <h2 className="text-[16px] font-semibold text-[#e8e6e3]">Crop & Rotate Cover</h2>
          <button
            type="button"
            className="text-[#999999] hover:text-[#e8e6e3] transition-colors"
            onClick={onClose}
            disabled={saving}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Cropper Area */}
        <div className="flex-1 relative bg-[#1a1a1a]">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-[#555555] space-y-4">
          {/* Zoom Control */}
          <div className="space-y-2">
            <label className="text-[13px] text-[#e8e6e3]">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Rotation Control */}
          <div className="space-y-2">
            <label className="text-[13px] text-[#e8e6e3]">Rotation</label>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-4 py-2 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] rounded transition-colors disabled:opacity-50"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-[#4a7ba7] hover:bg-[#5a8bc7] text-white text-[13px] rounded transition-colors disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
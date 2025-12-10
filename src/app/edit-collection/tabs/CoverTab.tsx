// src/app/edit-collection/tabs/CoverTab.tsx
'use client';

import Image from 'next/image';
import type { Album } from 'types/album';

interface CoverTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null) => void;
}

export function CoverTab({ album, onChange: _onChange }: CoverTabProps) {
  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: '#f9fafb',
        borderRadius: '12px',
        border: '2px dashed #d1d5db',
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏗️</div>
        <h3 style={{ 
          fontSize: '20px', 
          fontWeight: '700', 
          marginBottom: '12px',
          color: '#111',
        }}>
          Cover Tab - Coming in Phase 6
        </h3>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
          This tab will include:
        </p>
        <ul style={{ 
          listStyle: 'none', 
          padding: 0, 
          color: '#374151',
          display: 'inline-block',
          textAlign: 'left',
        }}>
          <li style={{ marginBottom: '8px' }}>🔍 &ldquo;Find Online&rdquo; search with auto-cropping</li>
          <li style={{ marginBottom: '8px' }}>📤 Upload from device</li>
          <li style={{ marginBottom: '8px' }}>✂️ Crop tool</li>
          <li style={{ marginBottom: '8px' }}>🗑️ Remove cover</li>
          <li>🎨 Front & back cover management</li>
        </ul>
      </div>

      {album.image_url && (
        <div style={{ textAlign: 'center' }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#111' }}>
            Current Cover
          </h4>
          <Image
            src={album.image_url}
            alt={`${album.artist} - ${album.title}`}
            width={300}
            height={300}
            className="rounded-lg shadow-lg"
            style={{ margin: '0 auto' }}
            unoptimized
          />
        </div>
      )}
    </div>
  );
}
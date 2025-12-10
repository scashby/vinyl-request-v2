// src/app/edit-collection/tabs/LinksTab.tsx
'use client';

import type { Album } from 'types/album';

interface LinksTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null) => void;
}

export function LinksTab({ album: _album, onChange: _onChange }: LinksTabProps) {
  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: '#f9fafb',
        borderRadius: '12px',
        border: '2px dashed #d1d5db',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏗️</div>
        <h3 style={{ 
          fontSize: '20px', 
          fontWeight: '700', 
          marginBottom: '12px',
          color: '#111',
        }}>
          Links Tab - Coming in Phase 6
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
          <li style={{ marginBottom: '8px' }}>🔗 URL list with descriptions</li>
          <li style={{ marginBottom: '8px' }}>↕️ Drag-drop reordering</li>
          <li style={{ marginBottom: '8px' }}>➕ Add/Edit/Remove links</li>
          <li>🤖 Auto-populate from APIs (Spotify, Apple Music, Discogs)</li>
        </ul>
      </div>
    </div>
  );
}
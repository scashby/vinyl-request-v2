// src/app/edit-collection/tabs/DetailsTab.tsx
'use client';

import type { Album } from 'types/album';

interface DetailsTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null) => void;
}

export function DetailsTab() {
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
          Details Tab - Coming in Phase 6
        </h3>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
          This tab will include pickers for:
        </p>
        <ul style={{ 
          listStyle: 'none', 
          padding: 0, 
          color: '#374151',
          display: 'inline-block',
          textAlign: 'left',
        }}>
          <li style={{ marginBottom: '8px' }}>📦 Packaging (Gatefold, Jewel Case, etc.)</li>
          <li style={{ marginBottom: '8px' }}>✨ Condition (Package & Media grading)</li>
          <li style={{ marginBottom: '8px' }}>🌍 Country</li>
          <li style={{ marginBottom: '8px' }}>🎨 Vinyl Color</li>
          <li style={{ marginBottom: '8px' }}>⚖️ Vinyl Weight (180g, etc.)</li>
          <li style={{ marginBottom: '8px' }}>🎚️ RPM (33⅓, 45, 78)</li>
          <li style={{ marginBottom: '8px' }}>🔊 Sound (Mono, Stereo, Quad)</li>
          <li style={{ marginBottom: '8px' }}>💿 SPARS Code</li>
          <li style={{ marginBottom: '8px' }}>🏢 Studio</li>
          <li style={{ marginBottom: '8px' }}>📦 Box Set toggle</li>
          <li>🎤 Is Live toggle</li>
        </ul>
      </div>
    </div>
  );
}
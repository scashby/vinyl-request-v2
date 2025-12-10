// src/app/edit-collection/tabs/PersonalTab.tsx
'use client';

import type { Album } from 'types/album';

interface PersonalTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null) => void;
}

export function PersonalTab() {
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
          Personal Tab - Coming in Phase 6
        </h3>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
          This tab will include fields and pickers for:
        </p>
        <ul style={{ 
          listStyle: 'none', 
          padding: 0, 
          color: '#374151',
          display: 'inline-block',
          textAlign: 'left',
        }}>
          <li style={{ marginBottom: '8px' }}>💰 Purchase Date/Store/Price</li>
          <li style={{ marginBottom: '8px' }}>📈 Current Value</li>
          <li style={{ marginBottom: '8px' }}>👤 Owner (picker)</li>
          <li style={{ marginBottom: '8px' }}>⭐ My Rating (10 stars)</li>
          <li style={{ marginBottom: '8px' }}>🏷️ Tags (multi-select picker)</li>
          <li style={{ marginBottom: '8px' }}>📝 Notes</li>
          <li style={{ marginBottom: '8px' }}>🧼 Last Cleaned</li>
          <li style={{ marginBottom: '8px' }}>✒️ Signed By (add/picker)</li>
          <li>📊 Play Count & Last Played</li>
        </ul>
      </div>
    </div>
  );
}
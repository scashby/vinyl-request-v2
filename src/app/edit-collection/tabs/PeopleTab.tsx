// src/app/edit-collection/tabs/PeopleTab.tsx
'use client';

import type { Album } from 'types/album';

interface PeopleTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null) => void;
}

export function PeopleTab({ album: _album, onChange: _onChange }: PeopleTabProps) {
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
          People Tab - Coming in Phase 6
        </h3>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
          This tab will include add/picker functionality for:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <p style={{ fontWeight: '600', marginBottom: '8px', color: '#111' }}>Credits:</p>
            <ul style={{ listStyle: 'none', padding: 0, color: '#374151', textAlign: 'left' }}>
              <li style={{ marginBottom: '8px' }}>✍️ Songwriter</li>
              <li style={{ marginBottom: '8px' }}>🎧 Producer</li>
              <li>🎚️ Engineer</li>
            </ul>
          </div>
          <div>
            <p style={{ fontWeight: '600', marginBottom: '8px', color: '#111' }}>Musicians:</p>
            <ul style={{ listStyle: 'none', padding: 0, color: '#374151', textAlign: 'left' }}>
              <li style={{ marginBottom: '8px' }}>🎸 Session Musicians</li>
              <li style={{ marginBottom: '8px' }}>🎹 Instrumentalists</li>
              <li>🎤 Vocalists</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
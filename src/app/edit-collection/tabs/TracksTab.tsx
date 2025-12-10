// src/app/edit-collection/tabs/TracksTab.tsx
'use client';

import type { Album } from 'types/album';

interface TracksTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null) => void;
}

export function TracksTab() {
  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
        borderRadius: '12px',
        border: '3px solid #f97316',
        boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>⭐</div>
        <h3 style={{ 
          fontSize: '22px', 
          fontWeight: '700', 
          marginBottom: '8px',
          color: '#111',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Tracks Tab - HIGH PRIORITY
        </h3>
        <div style={{
          display: 'inline-block',
          background: '#f97316',
          color: 'white',
          padding: '6px 16px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: '700',
          marginBottom: '16px',
        }}>
          PHASE 4
        </div>
        <p style={{ color: '#78350f', fontSize: '14px', marginBottom: '20px', fontWeight: '600' }}>
          This is the most important tab after Main!
        </p>
        <ul style={{ 
          listStyle: 'none', 
          padding: 0, 
          color: '#374151',
          display: 'inline-block',
          textAlign: 'left',
        }}>
          <li style={{ marginBottom: '8px' }}>🎼 Tracklist table with drag-drop reordering</li>
          <li style={{ marginBottom: '8px' }}>💿 Multi-disc support with tabs</li>
          <li style={{ marginBottom: '8px' }}>➕ Add Header / Add Track / Add Disc buttons</li>
          <li style={{ marginBottom: '8px' }}>📦 Storage Device picker</li>
          <li style={{ marginBottom: '8px' }}>🔢 Matrix numbers per disc/side</li>
          <li style={{ marginBottom: '8px', fontSize: '16px', fontWeight: '700', color: '#f97316' }}>
            🎵 &ldquo;Import from Spotify&rdquo; integration
          </li>
        </ul>
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: 'rgba(249, 115, 22, 0.1)',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#9a3412',
          fontWeight: '600',
        }}>
          💡 Spotify integration will auto-populate track names, durations, and order
        </div>
      </div>
    </div>
  );
}
// src/app/edit-collection/tabs/TracksTab.tsx
'use client';

import { Album } from '../EditAlbumModal';

interface TracksTabProps {
  album: Album;
  onChange: (field: keyof Album, value: any) => void;
}

export default function TracksTab({ album, onChange }: TracksTabProps) {
  return (
    <div style={{ maxWidth: '1100px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: '#111' }}>
        Tracklist
      </h3>
      
      <div style={{
        padding: '40px',
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        borderRadius: '8px',
        border: '2px solid #f59e0b',
        textAlign: 'center' as const,
      }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎼</div>
        <h4 style={{ fontSize: '18px', fontWeight: '700', color: '#92400e', marginBottom: '8px' }}>
          ⭐ Tracks Tab - HIGH PRIORITY - Phase 4
        </h4>
        <p style={{ fontSize: '14px', color: '#92400e', marginBottom: '16px' }}>
          Multi-disc management, drag-drop reordering, track add/remove
        </p>
        <div style={{
          display: 'inline-block',
          padding: '10px 20px',
          background: '#10b981',
          color: 'white',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '700',
        }}>
          🎵 Includes "Import from Spotify" Integration
        </div>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '16px',
        background: '#dbeafe',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#1e40af',
      }}>
        <strong>Planned Features:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>Disc tabs for multi-disc albums</li>
          <li>Drag-drop track reordering</li>
          <li>Add Header / Add Track / Add Disc buttons</li>
          <li>Storage Device picker</li>
          <li>Matrix number inputs (Side A/B)</li>
          <li><strong>🎵 Import from Spotify</strong> - Auto-populate tracklist</li>
        </ul>
      </div>
    </div>
  );
}
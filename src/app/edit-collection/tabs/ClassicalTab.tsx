// src/app/edit-collection/tabs/ClassicalTab.tsx
'use client';

export function ClassicalTab() {
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
          Classical Tab - Coming in Phase 6
        </h3>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
          This tab will include add/picker functionality for:
        </p>
        <ul style={{ 
          listStyle: 'none', 
          padding: 0, 
          color: '#374151',
          display: 'inline-block',
          textAlign: 'left',
        }}>
          <li style={{ marginBottom: '8px' }}>🎼 Composer</li>
          <li style={{ marginBottom: '8px' }}>🎵 Composition</li>
          <li style={{ marginBottom: '8px' }}>🎺 Conductor</li>
          <li style={{ marginBottom: '8px' }}>🎻 Orchestra</li>
          <li>🎤 Chorus</li>
        </ul>
      </div>
    </div>
  );
}
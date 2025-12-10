// src/app/edit-collection/components/UniversalBottomBar.tsx
'use client';

import type { Album } from 'types/album';

interface UniversalBottomBarProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | null) => void;
}

const COLLECTION_STATUS_OPTIONS = [
  { value: 'in_collection', label: 'In Collection' },
  { value: 'for_sale', label: 'For Sale' },
  { value: 'wish_list', label: 'On Wish List' },
  { value: 'on_order', label: 'On Order' },
  { value: 'sold', label: 'Sold' },
  { value: 'not_in_collection', label: 'Not in Collection' },
];

export function UniversalBottomBar({ album, onChange }: UniversalBottomBarProps) {
  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    background: 'white',
    color: '#1f2937',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600' as const,
    color: '#6b7280',
    marginBottom: '6px',
  };

  return (
    <div style={{
      borderTop: '2px solid #e5e7eb',
      background: '#f9fafb',
      padding: '16px 24px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      alignItems: 'end',
    }}>
      {/* Collection Status */}
      <div>
        <label style={labelStyle}>Collection Status</label>
        <select
          value={album.collection_status || 'in_collection'}
          onChange={(e) => onChange('collection_status', e.target.value)}
          style={{
            ...inputStyle,
            width: '100%',
            cursor: 'pointer',
          }}
        >
          {COLLECTION_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Index */}
      <div>
        <label style={labelStyle}>Index</label>
        <input
          type="number"
          value={album.index_number || ''}
          onChange={(e) => onChange('index_number', e.target.value ? parseInt(e.target.value) : null)}
          placeholder="Index number"
          style={{
            ...inputStyle,
            width: '100%',
          }}
        />
      </div>

      {/* Quantity */}
      <div>
        <label style={labelStyle}>Quantity</label>
        <input
          type="number"
          min="1"
          value={album.sale_quantity || 1}
          onChange={(e) => onChange('sale_quantity', e.target.value ? parseInt(e.target.value) : 1)}
          style={{
            ...inputStyle,
            width: '100%',
          }}
        />
      </div>

      {/* Location */}
      <div>
        <label style={labelStyle}>Location</label>
        <input
          type="text"
          value={album.location || ''}
          onChange={(e) => onChange('location', e.target.value)}
          placeholder="Storage location"
          style={{
            ...inputStyle,
            width: '100%',
          }}
        />
      </div>
    </div>
  );
}